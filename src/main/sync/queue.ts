import { ipcMain, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { db, getSetting } from '../database'
import { getToken, refreshIfNeeded, clearToken } from '../auth'
import type { PendingSyncOp } from '../../shared/types'

interface PendingRow {
  id: string
  op_type: string
  endpoint: string
  method: string
  body: string
  idempotency_key: string
  created_at: string
  retry_count: number
  last_error: string | null
  status: string
}

function rowToOp(row: PendingRow): PendingSyncOp {
  return {
    id: row.id,
    opType: row.op_type === 'update' ? 'update' : 'create',
    endpoint: row.endpoint,
    method: row.method,
    body: row.body,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    retryCount: row.retry_count,
    lastError: row.last_error,
    status: row.status === 'conflict' ? 'conflict' : row.status === 'failed' ? 'failed' : 'pending'
  }
}

export function enqueueOp(args: {
  opType: 'create' | 'update'
  endpoint: string
  method: string
  body: unknown
  idempotencyKey: string
  lastError?: string
}): PendingSyncOp {
  const id = uuidv4()
  const createdAt = new Date().toISOString()
  db.prepare(
    `INSERT INTO pending_sync_ops
       (id, op_type, endpoint, method, body, idempotency_key, created_at, retry_count, last_error, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending')`
  ).run(
    id,
    args.opType,
    args.endpoint,
    args.method,
    JSON.stringify(args.body ?? null),
    args.idempotencyKey,
    createdAt,
    args.lastError ?? null
  )
  broadcastUpdate()
  return rowToOp({
    id,
    op_type: args.opType,
    endpoint: args.endpoint,
    method: args.method,
    body: JSON.stringify(args.body ?? null),
    idempotency_key: args.idempotencyKey,
    created_at: createdAt,
    retry_count: 0,
    last_error: args.lastError ?? null,
    status: 'pending'
  })
}

export function listPending(): PendingSyncOp[] {
  const rows = db
    .prepare('SELECT * FROM pending_sync_ops ORDER BY created_at ASC')
    .all() as PendingRow[]
  return rows.map(rowToOp)
}

export function countByStatus(): { pending: number; conflict: number; failed: number } {
  const rows = db
    .prepare(
      "SELECT status, COUNT(*) as cnt FROM pending_sync_ops GROUP BY status"
    )
    .all() as { status: string; cnt: number }[]
  const out = { pending: 0, conflict: 0, failed: 0 }
  for (const r of rows) {
    if (r.status === 'pending') out.pending = r.cnt
    else if (r.status === 'conflict') out.conflict = r.cnt
    else if (r.status === 'failed') out.failed = r.cnt
  }
  return out
}

function deleteOp(id: string): void {
  db.prepare('DELETE FROM pending_sync_ops WHERE id = ?').run(id)
}

function markOp(id: string, status: 'conflict' | 'failed' | 'pending', error: string | null): void {
  db.prepare('UPDATE pending_sync_ops SET status = ?, last_error = ? WHERE id = ?').run(status, error, id)
}

function bumpRetry(id: string, error: string): void {
  db.prepare(
    'UPDATE pending_sync_ops SET retry_count = retry_count + 1, last_error = ? WHERE id = ?'
  ).run(error, id)
}

function broadcastUpdate(): void {
  const info = countByStatus()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('sync:queue:updated', info)
  }
}

function normalizeServerUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

async function replayOne(op: PendingSyncOp, serverUrl: string, accessToken: string): Promise<{ status: number; ok: boolean; detail?: string }> {
  const url = `${normalizeServerUrl(serverUrl)}/api/v1${op.endpoint}`
  const init: RequestInit = {
    method: op.method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': op.idempotencyKey
    },
    body: op.body
  }
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    return { status: 0, ok: false, detail: `通信エラー: ${(err as Error).message}` }
  }
  const text = await response.text()
  let detail = text.slice(0, 300)
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
      detail = String((parsed as { detail: unknown }).detail)
    }
  } catch {
    // raw text
  }
  return { status: response.status, ok: response.ok, detail }
}

async function isServerReachable(serverUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5_000)
    try {
      const response = await fetch(`${normalizeServerUrl(serverUrl)}/api/v1/health`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      })
      return response.ok
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

export async function drainQueue(): Promise<{ drained: number; remaining: number }> {
  const serverUrl = getSetting('sasoServerUrl') || ''
  if (!serverUrl) return { drained: 0, remaining: countByStatus().pending }

  const allPending = listPending().filter((o) => o.status === 'pending')
  if (allPending.length === 0) return { drained: 0, remaining: 0 }

  if (!(await isServerReachable(serverUrl))) {
    return { drained: 0, remaining: allPending.length }
  }

  // Re-use the existing auth refresh logic.
  const refreshed = await refreshIfNeeded(serverUrl)
  const token = refreshed || getToken()
  if (!token) {
    return { drained: 0, remaining: allPending.length }
  }

  let drained = 0
  for (const op of allPending) {
    const result = await replayOne(op, serverUrl, token.access_token)
    if (result.ok) {
      deleteOp(op.id)
      drained++
    } else if (result.status === 401) {
      // Token failed mid-drain — clear and stop. User will re-pair.
      clearToken()
      break
    } else if (result.status === 409) {
      markOp(op.id, 'conflict', result.detail ?? '競合 (409)')
    } else if (result.status >= 400 && result.status < 500 && result.status !== 408 && result.status !== 429) {
      // 4xx other than retry-able cases — permanent.
      markOp(op.id, 'failed', `HTTP ${result.status}: ${result.detail ?? ''}`)
    } else {
      // 5xx, network error, 408, 429 — keep pending, bump retry.
      bumpRetry(op.id, result.detail ?? `HTTP ${result.status}`)
    }
  }

  broadcastUpdate()
  return { drained, remaining: countByStatus().pending }
}

const DRAIN_INTERVAL_MS = 30_000
let workerHandle: NodeJS.Timeout | null = null

export function startSyncQueueWorker(): void {
  if (workerHandle) return
  // Initial broadcast so the renderer shows the badge on startup.
  setTimeout(broadcastUpdate, 1_000)
  workerHandle = setInterval(() => {
    void drainQueue()
  }, DRAIN_INTERVAL_MS)
}

export function stopSyncQueueWorker(): void {
  if (workerHandle) {
    clearInterval(workerHandle)
    workerHandle = null
  }
}

export function registerSyncQueueHandlers(): void {
  ipcMain.handle('sync:queue:list', async () => {
    try {
      return { success: true, data: listPending() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('sync:queue:pendingCount', async () => {
    try {
      return { success: true, data: countByStatus() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('sync:queue:drainNow', async () => {
    try {
      const result = await drainQueue()
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('sync:queue:remove', async (_event, id: string) => {
    try {
      deleteOp(id)
      broadcastUpdate()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
