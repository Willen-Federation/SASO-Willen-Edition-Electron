import { ipcMain } from 'electron'
import { readFileSync, statSync } from 'fs'
import { basename, extname } from 'path'
import { getSetting } from '../database'
import { getToken, refreshIfNeeded, clearToken } from '../auth'
import { enqueueOp } from './queue'

type SyncResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number; queued?: { id: string } }

interface SyncRequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | undefined>
  idempotencyKey?: string
  // When set, transient failures on this call (network error, 5xx, 408, 429)
  // are persisted to the offline queue for later replay. Only meaningful for
  // POST/PATCH paired with an Idempotency-Key.
  queueOpType?: 'create' | 'update'
}

function normalizeServerUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

function buildUrl(serverUrl: string, path: string, query?: SyncRequestOptions['query']): string {
  const base = `${normalizeServerUrl(serverUrl)}/api/v1${path}`
  if (!query) return base
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

function shouldQueue(opType: 'create' | 'update' | undefined, status: number | undefined): boolean {
  if (!opType) return false
  if (status === undefined || status === 0) return true // network error
  if (status === 408 || status === 429) return true
  if (status >= 500 && status < 600) return true
  return false
}

async function syncRequest<T>(path: string, options: SyncRequestOptions = {}): Promise<SyncResponse<T>> {
  const sasoServerUrl = getSetting('sasoServerUrl') || ''
  if (!sasoServerUrl) {
    return { success: false, error: 'SASOサーバーURLが未設定です' }
  }

  let token = getToken()
  if (!token) {
    return { success: false, error: 'デバイスがペアリングされていません' }
  }
  // Pre-emptive refresh so most calls do not need a retry.
  token = (await refreshIfNeeded(sasoServerUrl)) || token
  if (!token) {
    return { success: false, error: 'トークンの更新に失敗しました' }
  }

  const url = buildUrl(sasoServerUrl, path, options.query)
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token.access_token}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {})
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  }

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    const errMsg = `通信エラー: ${(err as Error).message}`
    if (shouldQueue(options.queueOpType, undefined) && options.idempotencyKey) {
      const queued = enqueueOp({
        opType: options.queueOpType!,
        endpoint: path,
        method: options.method ?? 'POST',
        body: options.body,
        idempotencyKey: options.idempotencyKey,
        lastError: errMsg
      })
      return { success: false, error: `${errMsg} (オフラインキューに保存)`, queued: { id: queued.id } }
    }
    return { success: false, error: errMsg }
  }

  // One transparent retry after a 401, in case the access token expired mid-request.
  if (response.status === 401) {
    const refreshed = await refreshIfNeeded(sasoServerUrl)
    if (!refreshed) {
      clearToken()
      return { success: false, error: '認証が切れました。再ペアリングしてください。', status: 401 }
    }
    init.headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${refreshed.access_token}` }
    try {
      response = await fetch(url, init)
    } catch (err) {
      const errMsg = `通信エラー: ${(err as Error).message}`
      if (shouldQueue(options.queueOpType, undefined) && options.idempotencyKey) {
        const queued = enqueueOp({
          opType: options.queueOpType!,
          endpoint: path,
          method: options.method ?? 'POST',
          body: options.body,
          idempotencyKey: options.idempotencyKey,
          lastError: errMsg
        })
        return { success: false, error: `${errMsg} (オフラインキューに保存)`, queued: { id: queued.id } }
      }
      return { success: false, error: errMsg }
    }
  }

  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null
  } catch {
    // ignore – fall through to status check
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === 'object' && parsed !== null && 'detail' in parsed
        ? String((parsed as { detail: unknown }).detail)
        : text.slice(0, 500)
    const error = `HTTP ${response.status}: ${detail || response.statusText}`
    if (shouldQueue(options.queueOpType, response.status) && options.idempotencyKey) {
      const queued = enqueueOp({
        opType: options.queueOpType!,
        endpoint: path,
        method: options.method ?? 'POST',
        body: options.body,
        idempotencyKey: options.idempotencyKey,
        lastError: error
      })
      return { success: false, status: response.status, error: `${error} (オフラインキューに保存)`, queued: { id: queued.id } }
    }
    return { success: false, status: response.status, error }
  }

  return { success: true, data: parsed as T }
}

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:health', async () => syncRequest('/health'))

  ipcMain.handle(
    'sync:items:list',
    async (
      _event,
      query: {
        q?: string
        category_id?: string | number
        barcode?: string
        isbn?: string
        label_code?: string
        cursor?: number
        limit?: number
      } = {}
    ) => syncRequest('/items', { query })
  )

  ipcMain.handle('sync:items:get', async (_event, id: string | number) =>
    syncRequest(`/items/${encodeURIComponent(String(id))}`)
  )

  ipcMain.handle('sync:items:create', async (_event, body: unknown, idempotencyKey?: string) =>
    syncRequest('/items', { method: 'POST', body, idempotencyKey, queueOpType: idempotencyKey ? 'create' : undefined })
  )

  ipcMain.handle(
    'sync:items:update',
    async (_event, id: string | number, body: unknown, idempotencyKey?: string) =>
      syncRequest(`/items/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body,
        idempotencyKey,
        queueOpType: idempotencyKey ? 'update' : undefined
      })
  )

  ipcMain.handle('sync:categories:list', async (_event, format?: 'flat' | 'tree') =>
    syncRequest('/categories', { query: format ? { format } : undefined })
  )

  ipcMain.handle('sync:storage-locations:list', async () => syncRequest('/storage-locations'))

  ipcMain.handle('sync:storage-locations:get', async (_event, id: string | number) =>
    syncRequest(`/storage-locations/${encodeURIComponent(String(id))}`)
  )

  ipcMain.handle('sync:storage-locations:items', async (_event, id: string | number) =>
    syncRequest(`/storage-locations/${encodeURIComponent(String(id))}/items`)
  )

  ipcMain.handle('sync:barcode:get', async (_event, code: string) =>
    syncRequest(`/barcode/${encodeURIComponent(code)}`)
  )

  ipcMain.handle('sync:mobile:config', async () => syncRequest('/mobile/config'))

  ipcMain.handle(
    'sync:items:drafts:create',
    async (
      _event,
      args: {
        imagePath: string
        fields?: {
          item_name?: string
          jan_code?: string
          isbn?: string
          price?: string | number
          barcode_hint?: string
        }
      }
    ) => uploadDraft(args.imagePath, args.fields ?? {})
  )
}

const DRAFT_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

async function uploadDraft(
  imagePath: string,
  fields: { item_name?: string; jan_code?: string; isbn?: string; price?: string | number; barcode_hint?: string }
): Promise<SyncResponse<{ draft_id: string | number; status: string }>> {
  const sasoServerUrl = getSetting('sasoServerUrl') || ''
  if (!sasoServerUrl) return { success: false, error: 'SASOサーバーURLが未設定です' }

  let token = getToken()
  if (!token) return { success: false, error: 'デバイスがペアリングされていません' }
  token = (await refreshIfNeeded(sasoServerUrl)) || token
  if (!token) return { success: false, error: 'トークンの更新に失敗しました' }

  let stat
  try {
    stat = statSync(imagePath)
  } catch (e) {
    return { success: false, error: `ファイルを読めません: ${(e as Error).message}` }
  }
  if (stat.size > 20 * 1024 * 1024) {
    return { success: false, error: '画像サイズが上限 (20MB) を超えています' }
  }

  const ext = extname(imagePath).toLowerCase()
  const mimeType = DRAFT_MIME_BY_EXT[ext]
  if (!mimeType) return { success: false, error: `対応していない拡張子です: ${ext}` }

  let buffer: Buffer
  try {
    buffer = readFileSync(imagePath)
  } catch (e) {
    return { success: false, error: `ファイルを読めません: ${(e as Error).message}` }
  }

  const form = new FormData()
  form.append('image', new Blob([buffer], { type: mimeType }), basename(imagePath))
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue
    form.append(k, String(v))
  }

  const url = `${normalizeServerUrl(sasoServerUrl)}/api/v1/items/drafts`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token.access_token}`
      },
      body: form
    })
  } catch (err) {
    return { success: false, error: `通信エラー: ${(err as Error).message}` }
  }

  if (response.status === 401) {
    const refreshed = await refreshIfNeeded(sasoServerUrl)
    if (!refreshed) {
      clearToken()
      return { success: false, error: '認証が切れました。再ペアリングしてください。', status: 401 }
    }
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${refreshed.access_token}`
        },
        body: form
      })
    } catch (err) {
      return { success: false, error: `通信エラー: ${(err as Error).message}` }
    }
  }

  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null
  } catch {
    // fall through
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === 'object' && parsed !== null && 'detail' in parsed
        ? String((parsed as { detail: unknown }).detail)
        : text.slice(0, 500)
    return {
      success: false,
      status: response.status,
      error: `HTTP ${response.status}: ${detail || response.statusText}`
    }
  }

  return { success: true, data: parsed as { draft_id: string | number; status: string } }
}
