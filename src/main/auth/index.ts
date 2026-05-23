import { shell, BrowserWindow, ipcMain } from 'electron'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { awaitPairingCallback } from './loopback'
import { getSetting } from '../database'
import type {
  AuthProviderSummary,
  AuthProviderType,
  ServerAuthDiscovery
} from '../../shared/types'

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf-8')
}

interface StoredToken {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  device_id?: number
  device_name?: string
  expires_at?: string
}

interface AuthData {
  token: StoredToken | null
}

function getAuthFilePath(): string {
  return join(app.getPath('userData'), 'auth.json')
}

function readAuthData(): AuthData {
  try {
    const path = getAuthFilePath()
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8')) as AuthData
    }
  } catch {
    // ignore
  }
  return { token: null }
}

function writeAuthData(data: AuthData): void {
  writeFileSync(getAuthFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export function saveToken(token: StoredToken): void {
  writeAuthData({ token })
}

export function getToken(): StoredToken | null {
  return readAuthData().token
}

export function clearToken(): void {
  writeAuthData({ token: null })
}

function normalizeServerUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

// ---------------------------------------------------------------------------
// Server discovery — GET /api/v1/auth/providers
// ---------------------------------------------------------------------------

/// Used when discovery has not yet run or failed.
///
/// The provider list is intentionally empty: the renderer's `Login.tsx`
/// treats `localProvider?.id` as `undefined` and passes nothing to
/// `auth.pair`, so `startPairing` omits the `provider_id` query
/// parameter and lets the server pick its default provider. Returning a
/// fake `id: 0` here would otherwise forward `provider_id=0` to /m/setup
/// and 400 on every server (DB ids start at 1).
const LOCAL_ONLY_FALLBACK: ServerAuthDiscovery = {
  serverName: '',
  version: '',
  mobileSetupUrl: '',
  authStrategy: 'local-only',
  providers: []
}

/// Generous-but-bounded timeout for the two public endpoints we hit
/// before the user is authenticated. Long enough for a sluggish
/// reverse-proxy / cold PHP-FPM worker, short enough that a firewalled
/// host or wrong port doesn't leave the "接続中…" spinner hanging
/// forever.
const PUBLIC_FETCH_TIMEOUT_MS = 10_000

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = PUBLIC_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function coerceProviderType(raw: unknown): AuthProviderType {
  switch (raw) {
    case 'local':
    case 'oidc':
    case 'saml':
    case 'firebase':
    case 'auth0':
    case 'cognito':
      return raw
    default:
      return 'unknown'
  }
}

async function discoverProviders(sasoServerUrl: string): Promise<ServerAuthDiscovery> {
  if (!sasoServerUrl) return LOCAL_ONLY_FALLBACK
  try {
    const url = `${normalizeServerUrl(sasoServerUrl)}/api/v1/auth/providers`
    const response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) return LOCAL_ONLY_FALLBACK
    const raw = (await response.json()) as Record<string, unknown>
    const providers = Array.isArray(raw.providers)
      ? raw.providers.map((p: Record<string, unknown>) => ({
          id: Number(p.id ?? 0),
          name: String(p.name ?? ''),
          type: coerceProviderType(p.type),
          isDefault: Boolean(p.isDefault),
          enabled: Boolean(p.enabled)
        }))
      : []
    if (providers.length === 0) return LOCAL_ONLY_FALLBACK
    const strategy = raw.authStrategy
    return {
      serverName: String(raw.serverName ?? ''),
      version: String(raw.version ?? ''),
      mobileSetupUrl: String(raw.mobileSetupUrl ?? ''),
      authStrategy:
        strategy === 'local-only' || strategy === 'default-only' || strategy === 'user-choice'
          ? strategy
          : 'local-only',
      providers
    }
  } catch {
    return LOCAL_ONLY_FALLBACK
  }
}

// ---------------------------------------------------------------------------
// JWT exchange + refresh
// ---------------------------------------------------------------------------

async function exchangePairingForJwt(
  sasoServerUrl: string,
  rawToken: string,
  deviceName: string
): Promise<StoredToken> {
  const url = `${normalizeServerUrl(sasoServerUrl)}/api/v1/mobile/connect`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ token: rawToken, deviceName })
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`/mobile/connect failed: ${response.status} ${text}`)
  }
  const data = (await response.json()) as StoredToken
  if (!data.expires_at && data.expires_in) {
    data.expires_at = new Date(Date.now() + data.expires_in * 1000).toISOString()
  }
  return data
}

// ---------------------------------------------------------------------------
// REST username/password flow — POST /api/v1/auth/login
// ---------------------------------------------------------------------------
//
// Issues the same `{access_token, refresh_token, ...}` shape as
// /api/v1/mobile/connect, but accepts credentials directly so the Electron
// app does not have to hand the user off to a browser. Migration tracker:
// docs/api/auth-endpoints.md — replaces /auth/start/ form posting.

interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  traceId?: string
}

async function parseProblemJson(response: Response): Promise<ProblemDetails> {
  try {
    const text = await response.text()
    if (!text) return {}
    const parsed = JSON.parse(text) as unknown
    if (parsed && typeof parsed === 'object') return parsed as ProblemDetails
  } catch {
    // not JSON — fall through
  }
  return {}
}

function loginErrorMessage(status: number, problem: ProblemDetails): string {
  // Map SASO-AUTH codes from docs/api/auth-endpoints.md to Japanese strings
  // the renderer can show verbatim. Fall back to detail / HTTP status if a
  // future code reaches us.
  switch (problem.code) {
    case 'SASO-AUTH-1001':
      return 'ユーザー名またはパスワードが正しくありません'
    case 'SASO-AUTH-1009':
      return 'このアカウントは管理者によりロックされています'
    case 'SASO-AUTH-1010':
      return '試行回数が上限を超えました。しばらく待ってから再度お試しください'
    case 'SASO-AUTH-1011':
      return 'リクエスト内容が正しくありません'
    case 'SASO-AUTH-1012':
      return '現在のパスワードが一致しません'
    case 'SASO-AUTH-1013':
      return '新しいパスワードはポリシーを満たしていません (8〜64文字、半角英数 / _ / -、現在のパスワードと異なる必要があります)'
    default:
      return problem.detail || `HTTP ${status}`
  }
}

async function loginWithPassword(
  sasoServerUrl: string,
  username: string,
  password: string,
  deviceName: string
): Promise<{ success: true; token: StoredToken } | { success: false; error: string; code?: string }> {
  if (!sasoServerUrl) {
    return { success: false, error: 'SASOサーバーURLが設定されていません' }
  }
  const url = `${normalizeServerUrl(sasoServerUrl)}/api/v1/auth/login`
  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ username, password, deviceName })
    })
  } catch (err) {
    const message =
      (err as Error).name === 'AbortError'
        ? `タイムアウト (${PUBLIC_FETCH_TIMEOUT_MS / 1000}秒)`
        : (err as Error).message
    return { success: false, error: `通信エラー: ${message}` }
  }

  if (!response.ok) {
    const problem = await parseProblemJson(response)
    return { success: false, error: loginErrorMessage(response.status, problem), code: problem.code }
  }

  const data = (await response.json()) as StoredToken
  if (!data.expires_at && data.expires_in) {
    data.expires_at = new Date(Date.now() + data.expires_in * 1000).toISOString()
  }
  return { success: true, token: data }
}

// ---------------------------------------------------------------------------
// REST logout — POST /api/v1/auth/logout (revokes server-side refresh token)
// ---------------------------------------------------------------------------
//
// Best-effort: if the server is unreachable or the access token has already
// expired, we still clear the local token so the user can sign back in.

async function revokeServerSession(sasoServerUrl: string, accessToken: string): Promise<void> {
  if (!sasoServerUrl || !accessToken) return
  const url = `${normalizeServerUrl(sasoServerUrl)}/api/v1/auth/logout`
  try {
    await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    })
  } catch {
    // Network failure is non-fatal — the refresh token will expire on its own.
  }
}

// ---------------------------------------------------------------------------
// REST password change — POST /api/v1/auth/password
// ---------------------------------------------------------------------------

async function changePassword(
  sasoServerUrl: string,
  accessToken: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  if (!sasoServerUrl) {
    return { success: false, error: 'SASOサーバーURLが設定されていません' }
  }
  if (!accessToken) {
    return { success: false, error: '未認証です。再度ログインしてください' }
  }
  const url = `${normalizeServerUrl(sasoServerUrl)}/api/v1/auth/password`
  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    })
  } catch (err) {
    const message =
      (err as Error).name === 'AbortError'
        ? `タイムアウト (${PUBLIC_FETCH_TIMEOUT_MS / 1000}秒)`
        : (err as Error).message
    return { success: false, error: `通信エラー: ${message}` }
  }

  if (!response.ok) {
    const problem = await parseProblemJson(response)
    return { success: false, error: loginErrorMessage(response.status, problem), code: problem.code }
  }
  return { success: true }
}

export async function refreshIfNeeded(sasoServerUrl: string): Promise<StoredToken | null> {
  const token = getToken()
  if (!token || !token.refresh_token) return token
  const expiresAtMs = token.expires_at ? new Date(token.expires_at).getTime() : 0
  if (expiresAtMs - Date.now() > 60_000) return token

  const url = `${normalizeServerUrl(sasoServerUrl)}/api/v1/mobile/token/refresh`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ refresh_token: token.refresh_token })
  })
  if (!response.ok) {
    return null
  }
  const next = (await response.json()) as StoredToken
  if (!next.expires_at && next.expires_in) {
    next.expires_at = new Date(Date.now() + next.expires_in * 1000).toISOString()
  }
  // Carry forward device metadata if the refresh response omits it.
  next.device_id = next.device_id ?? token.device_id
  next.device_name = next.device_name ?? token.device_name
  saveToken(next)
  return next
}

// ---------------------------------------------------------------------------
// Pairing flows — browser-based, optionally scoped to a provider
// ---------------------------------------------------------------------------

async function startPairing(
  sasoServerUrl: string,
  deviceName: string,
  providerId?: number
): Promise<{ success: boolean; error?: string }> {
  if (!sasoServerUrl) {
    return { success: false, error: 'SASOサーバーURLが設定されていません' }
  }

  const state = randomBytes(16).toString('hex')
  const { port, promise, dispose } = await awaitPairingCallback(state)
  try {
    const redirectUri = `http://127.0.0.1:${port}/callback`
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      state
    })
    if (providerId !== undefined) {
      params.set('provider_id', String(providerId))
    }
    const setupUrl = `${normalizeServerUrl(sasoServerUrl)}/m/setup?${params.toString()}`
    await shell.openExternal(setupUrl)

    const { token: rawToken, server: claimedServer } = await promise

    // Prefer the server URL the IdP redirected back with (matches the
    // pairing code's origin), but fall back to the configured value.
    const targetServer = claimedServer || sasoServerUrl
    const jwt = await exchangePairingForJwt(targetServer, rawToken, deviceName)
    saveToken(jwt)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  } finally {
    dispose()
  }
}

// Manual pairing path. Accepts either the full QR payload
// `SASO1:{token}|{server_url}` (preferred — carries the issuing host so we
// always exchange against the right origin) or the bare token segment.
function parsePairingPayload(
  payload: string,
  fallbackServerUrl: string
): { token: string; serverUrl: string } | { error: string } {
  const trimmed = payload.trim()
  if (!trimmed) return { error: 'ペアリングコードを入力してください' }

  if (trimmed.startsWith('SASO1:')) {
    const body = trimmed.slice('SASO1:'.length)
    const [token, server] = body.split('|', 2)
    if (!token) return { error: 'トークンが空です' }
    const serverUrl = (server && /^https?:\/\//.test(server)) ? server : fallbackServerUrl
    if (!serverUrl) return { error: 'サーバーURLが取得できませんでした' }
    return { token, serverUrl }
  }

  if (!fallbackServerUrl) {
    return { error: 'サーバーURLが設定されていないため、トークンのみのペアリングはできません' }
  }
  return { token: trimmed, serverUrl: fallbackServerUrl }
}

async function startManualPairing(
  payload: string,
  fallbackServerUrl: string,
  deviceName: string
): Promise<{ success: boolean; error?: string }> {
  const parsed = parsePairingPayload(payload, fallbackServerUrl)
  if ('error' in parsed) return { success: false, error: parsed.error }

  try {
    const jwt = await exchangePairingForJwt(parsed.serverUrl, parsed.token, deviceName)
    saveToken(jwt)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Server URL connection test (used by onboarding)
// ---------------------------------------------------------------------------

async function testServerUrl(
  sasoServerUrl: string
): Promise<{ success: boolean; error?: string; status?: number }> {
  if (!sasoServerUrl) return { success: false, error: 'URLが空です' }
  if (!/^https?:\/\//i.test(sasoServerUrl)) {
    return { success: false, error: 'http:// または https:// で始まるURLを入力してください' }
  }
  try {
    const url = `${normalizeServerUrl(sasoServerUrl)}/api/v1/health`
    const response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json' }
    })
    return {
      success: response.ok,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`
    }
  } catch (err) {
    const message =
      (err as Error).name === 'AbortError'
        ? `タイムアウト (${PUBLIC_FETCH_TIMEOUT_MS / 1000}秒)`
        : (err as Error).message
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Token introspection helpers (used by getUser / isTokenValid)
// ---------------------------------------------------------------------------

export function getUser(): {
  id: string
  name: string
  email: string
  token: string
  expiresAt: string
  deviceName: string
  deviceId?: number | string
  memberId?: string
  scopes: string[]
} | null {
  const token = getToken()
  if (!token) return null

  let id = ''
  let name = ''
  let email = ''
  let memberId = ''
  let scopes: string[] = []
  try {
    const parts = token.access_token.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>
      id = (payload.sub as string) || (payload.mid as string) || ''
      name = (payload.name as string) || (payload.mid as string) || ''
      email = (payload.email as string) || ''
      memberId = (payload.mid as string) || ''
      const rawScopes = payload.scope ?? payload.scopes
      if (typeof rawScopes === 'string') {
        scopes = rawScopes.split(/\s+/).filter(Boolean)
      } else if (Array.isArray(rawScopes)) {
        scopes = rawScopes.map((s) => String(s))
      }
    }
  } catch {
    // fall through
  }

  return {
    id: id || 'user',
    name: name || token.device_name || 'ペアリング済みデバイス',
    email,
    token: token.access_token,
    expiresAt: token.expires_at || '',
    deviceName: token.device_name || '',
    deviceId: token.device_id,
    memberId,
    scopes
  }
}

export function isTokenValid(): boolean {
  const token = getToken()
  if (!token) return false
  if (!token.expires_at) return true
  return new Date(token.expires_at) > new Date()
}

// ---------------------------------------------------------------------------
// IPC wiring
// ---------------------------------------------------------------------------

export function registerAuthHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('auth:discoverProviders', async () => {
    try {
      const sasoServerUrl = getSetting('sasoServerUrl') || ''
      const discovery = await discoverProviders(sasoServerUrl)
      return { success: true, data: discovery }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:testServerUrl', async (_event, url: string) => {
    return testServerUrl(url)
  })

  ipcMain.handle('auth:pair', async (_event, providerId?: number) => {
    try {
      const sasoServerUrl = getSetting('sasoServerUrl') || ''
      const deviceName = `${app.getName()} (${require('os').hostname()})`
      const result = await startPairing(sasoServerUrl, deviceName, providerId)
      if (result.success) {
        mainWindow.webContents.send('auth:stateChanged', getUser())
      }
      return result
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:pairWithToken', async (_event, payload: string) => {
    try {
      const sasoServerUrl = getSetting('sasoServerUrl') || ''
      const deviceName = `${app.getName()} (${require('os').hostname()})`
      const result = await startManualPairing(payload, sasoServerUrl, deviceName)
      if (result.success) {
        mainWindow.webContents.send('auth:stateChanged', getUser())
      }
      return result
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'auth:login',
    async (_event, username: string, password: string) => {
      try {
        const sasoServerUrl = getSetting('sasoServerUrl') || ''
        const deviceName = `${app.getName()} (${require('os').hostname()})`
        const result = await loginWithPassword(sasoServerUrl, username, password, deviceName)
        if (!result.success) {
          return { success: false, error: result.error, code: result.code }
        }
        saveToken(result.token)
        mainWindow.webContents.send('auth:stateChanged', getUser())
        return { success: true }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle('auth:logout', async () => {
    try {
      // Best-effort server-side revocation. If it fails (offline, expired
      // token, server down) we still clear the local token so the user can
      // sign back in — the refresh token will age out on its own.
      const sasoServerUrl = getSetting('sasoServerUrl') || ''
      const token = getToken()
      if (sasoServerUrl && token?.access_token) {
        await revokeServerSession(sasoServerUrl, token.access_token)
      }
      clearToken()
      mainWindow.webContents.send('auth:stateChanged', null)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'auth:changePassword',
    async (_event, currentPassword: string, newPassword: string) => {
      try {
        const sasoServerUrl = getSetting('sasoServerUrl') || ''
        // Refresh first so we don't fail with a stale access token on an
        // otherwise valid session.
        if (sasoServerUrl) await refreshIfNeeded(sasoServerUrl)
        const token = getToken()
        if (!token?.access_token) {
          return { success: false, error: '未認証です。再度ログインしてください' }
        }
        const result = await changePassword(
          sasoServerUrl,
          token.access_token,
          currentPassword,
          newPassword
        )
        return result
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle('auth:getUser', async () => {
    try {
      return { success: true, data: getUser() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:getToken', async () => {
    try {
      const sasoServerUrl = getSetting('sasoServerUrl') || ''
      if (sasoServerUrl) await refreshIfNeeded(sasoServerUrl)
      const token = getToken()
      return { success: true, data: token?.access_token || null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
