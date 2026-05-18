import { shell, BrowserWindow, ipcMain } from 'electron'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { awaitPairingCallback } from './loopback'
import { getSetting } from '../database'

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

async function startPairing(
  sasoServerUrl: string,
  deviceName: string
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

export function getUser(): {
  id: string
  name: string
  email: string
  token: string
  expiresAt: string
  deviceName: string
} | null {
  const token = getToken()
  if (!token) return null

  let id = ''
  let name = ''
  let email = ''
  try {
    const parts = token.access_token.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>
      id = (payload.sub as string) || (payload.mid as string) || ''
      name = (payload.name as string) || (payload.mid as string) || ''
      email = (payload.email as string) || ''
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
    deviceName: token.device_name || ''
  }
}

export function isTokenValid(): boolean {
  const token = getToken()
  if (!token) return false
  if (!token.expires_at) return true
  return new Date(token.expires_at) > new Date()
}

export function registerAuthHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('auth:pair', async () => {
    try {
      const sasoServerUrl = getSetting('sasoServerUrl') || ''
      const deviceName = `${app.getName()} (${require('os').hostname()})`
      const result = await startPairing(sasoServerUrl, deviceName)
      if (result.success) {
        mainWindow.webContents.send('auth:stateChanged', getUser())
      }
      return result
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
