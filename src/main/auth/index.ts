import { shell, BrowserWindow } from 'electron'
import { createHash, randomBytes } from 'crypto'
import Store from 'electron-store'

interface StoredToken {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  expires_at?: string
}

interface AuthStore {
  token: StoredToken | null
  codeVerifier: string | null
}

const store = new Store<AuthStore>({
  name: 'auth',
  defaults: {
    token: null,
    codeVerifier: null
  }
})

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

  store.set('codeVerifier', verifier)

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

    const verifier = store.get('codeVerifier')
    if (!verifier) {
      return { success: false, error: 'コードベリファイアが見つかりません' }
    }

    const token = await exchangeCodeForToken(authServerUrl, clientId, code, verifier)
    saveToken(token)
    store.set('codeVerifier', null)

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
  store.set('token', token)
}

export function getToken(): StoredToken | null {
  return store.get('token')
}

export function clearToken(): void {
  store.set('token', null)
  store.set('codeVerifier', null)
}

export function getUser(): { id: string; name: string; email: string; token: string; expiresAt: string } | null {
  const token = getToken()
  if (!token) return null

  // Try to decode JWT id_token
  if (token.id_token) {
    try {
      const parts = token.id_token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))
        return {
          id: payload.sub || '',
          name: payload.name || payload.preferred_username || '',
          email: payload.email || '',
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
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))
      return {
        id: payload.sub || 'user',
        name: payload.name || payload.preferred_username || 'ユーザー',
        email: payload.email || '',
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

export function registerAuthHandlers(mainWindow: BrowserWindow): void {
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
