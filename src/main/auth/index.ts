import { shell, BrowserWindow, app } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

function decodeBase64Url(str: string): string {
  // Convert base64url to base64, then decode
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf-8')
}

interface StoredToken {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  expires_at?: string
}

interface AuthData {
  token: StoredToken | null
  codeVerifier: string | null
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
  return { token: null, codeVerifier: null }
}

function writeAuthData(data: AuthData): void {
  try {
    writeFileSync(getAuthFilePath(), JSON.stringify(data, null, 2), 'utf-8')
  } catch {
    // ignore
  }
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32))
}

function generateCodeChallenge(verifier: string): string {
  const hash = createHash('sha256').update(verifier).digest()
  return base64UrlEncode(hash)
}

export function startLogin(authServerUrl: string, clientId: string): void {
  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)

  const data = readAuthData()
  data.codeVerifier = verifier
  writeAuthData(data)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: 'saso://auth/callback',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'openid profile email'
  })

  const authUrl = `${authServerUrl}/authorize?${params.toString()}`
  shell.openExternal(authUrl)
}

export async function handleCallback(
  url: string,
  authServerUrl: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = new URL(url)
    const code = parsed.searchParams.get('code')
    const error = parsed.searchParams.get('error')

    if (error) {
      return { success: false, error: `認証エラー: ${error}` }
    }

    if (!code) {
      return { success: false, error: '認証コードが見つかりません' }
    }

    const authData = readAuthData()
    const verifier = authData.codeVerifier
    if (!verifier) {
      return { success: false, error: 'コードベリファイアが見つかりません' }
    }

    const token = await exchangeCodeForToken(authServerUrl, clientId, code, verifier)
    saveToken(token)
    const updated = readAuthData()
    updated.codeVerifier = null
    writeAuthData(updated)

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

async function exchangeCodeForToken(
  authServerUrl: string,
  clientId: string,
  code: string,
  codeVerifier: string
): Promise<StoredToken> {
  const response = await fetch(`${authServerUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: 'saso://auth/callback',
      code,
      code_verifier: codeVerifier
    }).toString()
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`トークン取得失敗: ${response.status} ${text}`)
  }

  const data = (await response.json()) as StoredToken
  if (data.expires_in) {
    data.expires_at = new Date(Date.now() + data.expires_in * 1000).toISOString()
  }
  return data
}

export function saveToken(token: StoredToken): void {
  const data = readAuthData()
  data.token = token
  writeAuthData(data)
}

export function getToken(): StoredToken | null {
  return readAuthData().token
}

export function clearToken(): void {
  writeAuthData({ token: null, codeVerifier: null })
}

export function getUser(): { id: string; name: string; email: string; token: string; expiresAt: string } | null {
  const token = getToken()
  if (!token) return null

  // Try to decode JWT id_token
  if (token.id_token) {
    try {
      const parts = token.id_token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>
        return {
          id: (payload.sub as string) || '',
          name: (payload.name as string) || (payload.preferred_username as string) || '',
          email: (payload.email as string) || '',
          token: token.access_token,
          expiresAt: token.expires_at || ''
        }
      }
    } catch {
      // Fall through
    }
  }

  // Try to decode access token as JWT
  try {
    const parts = token.access_token.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>
      return {
        id: (payload.sub as string) || 'user',
        name: (payload.name as string) || (payload.preferred_username as string) || 'ユーザー',
        email: (payload.email as string) || '',
        token: token.access_token,
        expiresAt: token.expires_at || ''
      }
    }
  } catch {
    // Fall through
  }

  return {
    id: 'user',
    name: 'ログイン済みユーザー',
    email: '',
    token: token.access_token,
    expiresAt: token.expires_at || ''
  }
}

export function isTokenValid(): boolean {
  const token = getToken()
  if (!token) return false
  if (!token.expires_at) return true
  return new Date(token.expires_at) > new Date()
}

// Register IPC handlers for auth
import { ipcMain } from 'electron'
import { getSetting } from '../database'

export async function loginWithCredentials(
  serverUrl: string,
  id: string,
  password: string
): Promise<{ success: boolean; user?: { id: string; name: string }; error?: string }> {
  try {
    const formData = new URLSearchParams({ id, password })
    const response = await fetch(`${serverUrl}/index.php?matter=auth&action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    })
    if (!response.ok) {
      return { success: false, error: `サーバーエラー: ${response.status}` }
    }
    const text = await response.text()
    // Try JSON parse first
    try {
      const json = JSON.parse(text) as Record<string, unknown>
      if (json.success === false || json.error) {
        return { success: false, error: String(json.error || 'ログインに失敗しました') }
      }
      const user = {
        id: String(json.id || json.user_id || id),
        name: String(json.name || json.username || id)
      }
      return { success: true, user }
    } catch {
      // Non-JSON response — treat non-empty as success
      if (text.trim().length > 0 && !text.includes('error') && !text.includes('Error')) {
        return { success: true, user: { id, name: id } }
      }
      return { success: false, error: 'ログインに失敗しました' }
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export function registerAuthHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('auth:loginWithCredentials', async (_event, id: string, password: string) => {
    try {
      const sasoServerUrl = getSetting('sasoServerUrl') || ''
      if (!sasoServerUrl) {
        return { success: false, error: 'SasoサーバーURLが設定されていません' }
      }
      const result = await loginWithCredentials(sasoServerUrl, id, password)
      return result
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:login', async () => {
    try {
      const authServerUrl = getSetting('authServerUrl') || ''
      const clientId = getSetting('authClientId') || ''
      if (!authServerUrl || !clientId) {
        return { success: false, error: '認証サーバーURLとクライアントIDを設定してください' }
      }
      startLogin(authServerUrl, clientId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      clearToken()
      mainWindow.webContents.send('auth:stateChanged', null)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:getUser', async () => {
    try {
      const user = getUser()
      return { success: true, data: user }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:getToken', async () => {
    try {
      const token = getToken()
      return { success: true, data: token?.access_token || null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
