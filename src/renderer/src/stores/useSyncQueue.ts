import { create } from 'zustand'
import type { PendingSyncOp } from '@shared/types'

interface QueueCounts {
  pending: number
  conflict: number
  failed: number
}

interface SyncQueueState {
  counts: QueueCounts
  ops: PendingSyncOp[]
  loading: boolean
  draining: boolean
  error: string | null
  refresh: () => Promise<void>
  refreshCounts: () => Promise<void>
  drainNow: () => Promise<{ drained: number; remaining: number } | null>
  remove: (id: string) => Promise<void>
  subscribe: () => () => void
  applyCounts: (next: QueueCounts) => void
}

const zeroCounts: QueueCounts = { pending: 0, conflict: 0, failed: 0 }

export const useSyncQueue = create<SyncQueueState>((set, get) => ({
  counts: zeroCounts,
  ops: [],
  loading: false,
  draining: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null })
    const [listRes, countRes] = await Promise.all([
      window.api.syncQueue.list(),
      window.api.syncQueue.pendingCount()
    ])
    set({
      loading: false,
      ops: listRes.success && listRes.data ? listRes.data : [],
      counts: countRes.success && countRes.data ? countRes.data : zeroCounts,
      error: listRes.success ? null : listRes.error || null
    })
  },

  refreshCounts: async () => {
    const res = await window.api.syncQueue.pendingCount()
    if (res.success && res.data) set({ counts: res.data })
  },

  drainNow: async () => {
    set({ draining: true, error: null })
    const res = await window.api.syncQueue.drainNow()
    set({ draining: false })
    if (res.success && res.data) {
      await get().refresh()
      return res.data
    }
    set({ error: res.error || 'drain に失敗しました' })
    return null
  },

  remove: async (id: string) => {
    const res = await window.api.syncQueue.remove(id)
    if (res.success) {
      await get().refresh()
    } else {
      set({ error: res.error || '削除に失敗しました' })
    }
  },

  subscribe: () => {
    return window.api.syncQueue.onUpdated((info) => {
      set({ counts: info })
    })
  },

  applyCounts: (next) => set({ counts: next })
}))
