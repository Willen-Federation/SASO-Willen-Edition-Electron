import { create } from 'zustand'
import type {
  RemoteItem,
  RemoteItemCreate,
  RemoteItemPatch,
  RemoteCategory,
  RemoteStorageLocation,
  BarcodeLookupResult
} from '@shared/types'

interface ListQuery {
  q?: string
  category_id?: string | number
  barcode?: string
  isbn?: string
  label_code?: string
  limit?: number
}

interface RemoteItemsState {
  items: RemoteItem[]
  total: number
  nextCursor: number | null
  loading: boolean
  loadingMore: boolean
  error: string | null
  info: string | null
  unauthorized: boolean
  /// Non-null when the most recent failure carried an `SASO-INFRA-*` problem
  /// code (e.g. SASO-INFRA-9001 from `/items` on an un-migrated server).
  /// The renderer renders a "サーバー診断を実行" CTA when this is set.
  infraIssue: { code: string; status?: number } | null
  lastQuery: ListQuery
  categories: RemoteCategory[]
  categoriesLoaded: boolean
  locations: RemoteStorageLocation[]
  locationsLoaded: boolean
  loadPage: (query?: ListQuery) => Promise<void>
  loadMore: () => Promise<void>
  getOne: (id: string | number) => Promise<RemoteItem | null>
  create: (body: RemoteItemCreate) => Promise<{ item: RemoteItem | null; queued: boolean }>
  update: (id: string | number, patch: RemoteItemPatch) => Promise<{ item: RemoteItem | null; queued: boolean }>
  lookupBarcode: (code: string) => Promise<BarcodeLookupResult | null>
  loadCategories: () => Promise<void>
  loadLocations: () => Promise<void>
  clearError: () => void
  clearInfo: () => void
  clearInfraIssue: () => void
}

function detectInfra(code?: string): { code: string } | null {
  return code && code.startsWith('SASO-INFRA-') ? { code } : null
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useRemoteItems = create<RemoteItemsState>((set, get) => ({
  items: [],
  total: 0,
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
  info: null,
  unauthorized: false,
  infraIssue: null,
  lastQuery: {},
  categories: [],
  categoriesLoaded: false,
  locations: [],
  locationsLoaded: false,

  loadPage: async (query = {}) => {
    set({ loading: true, error: null, unauthorized: false, infraIssue: null, lastQuery: query })
    const result = await window.api.sync.itemsList(query)
    if (result.success) {
      set({
        items: result.data.data,
        total: result.data.total,
        nextCursor: result.data.nextCursor,
        loading: false
      })
    } else {
      const infra = detectInfra(result.code)
      set({
        loading: false,
        error: result.error,
        unauthorized: result.status === 401,
        infraIssue: infra ? { code: infra.code, status: result.status } : null
      })
    }
  },

  loadMore: async () => {
    const { nextCursor, lastQuery, items, loadingMore } = get()
    if (nextCursor === null || loadingMore) return
    set({ loadingMore: true, error: null })
    const result = await window.api.sync.itemsList({ ...lastQuery, cursor: nextCursor })
    if (result.success) {
      set({
        items: [...items, ...result.data.data],
        total: result.data.total,
        nextCursor: result.data.nextCursor,
        loadingMore: false
      })
    } else {
      const infra = detectInfra(result.code)
      set({
        loadingMore: false,
        error: result.error,
        unauthorized: result.status === 401,
        infraIssue: infra ? { code: infra.code, status: result.status } : null
      })
    }
  },

  getOne: async (id) => {
    const result = await window.api.sync.itemsGet(id)
    if (result.success) return result.data
    set({ error: result.error, unauthorized: result.status === 401 })
    return null
  },

  create: async (body) => {
    set({ error: null, info: null })
    const result = await window.api.sync.itemsCreate(body, newIdempotencyKey())
    if (result.success) {
      await get().loadPage(get().lastQuery)
      return { item: result.data, queued: false }
    }
    if (result.queued) {
      set({ info: 'オフラインのため、後で自動再送されるキューに保存しました' })
      return { item: null, queued: true }
    }
    set({ error: result.error, unauthorized: result.status === 401 })
    return { item: null, queued: false }
  },

  update: async (id, patch) => {
    set({ error: null, info: null })
    const result = await window.api.sync.itemsUpdate(id, patch, newIdempotencyKey())
    if (result.success) {
      set({
        items: get().items.map((it) => (String(it.id) === String(id) ? result.data : it))
      })
      return { item: result.data, queued: false }
    }
    if (result.queued) {
      set({ info: 'オフラインのため、後で自動再送されるキューに保存しました' })
      return { item: null, queued: true }
    }
    set({ error: result.error, unauthorized: result.status === 401 })
    return { item: null, queued: false }
  },

  lookupBarcode: async (code) => {
    set({ error: null })
    const result = await window.api.sync.barcodeGet(code)
    if (result.success) return result.data
    set({ error: result.error, unauthorized: result.status === 401 })
    return null
  },

  loadCategories: async () => {
    const result = await window.api.sync.categoriesList('flat')
    if (result.success) {
      set({ categories: result.data.data, categoriesLoaded: true })
    } else {
      set({ error: result.error, unauthorized: result.status === 401 })
    }
  },

  loadLocations: async () => {
    const result = await window.api.sync.storageLocationsList()
    if (result.success) {
      set({ locations: result.data.data, locationsLoaded: true })
    } else {
      set({ error: result.error, unauthorized: result.status === 401 })
    }
  },

  clearError: () => set({ error: null }),
  clearInfo: () => set({ info: null }),
  clearInfraIssue: () => set({ infraIssue: null })
}))
