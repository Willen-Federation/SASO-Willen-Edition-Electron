import { create } from 'zustand'
import type { Item, Color, Size, Feature, ItemVar } from '@shared/types'

interface ItemsState {
  items: Item[]
  colors: Record<string, Color[]>
  sizes: Record<string, Size[]>
  features: Feature[]
  loading: boolean
  error: string | null
  loadItems: () => Promise<void>
  loadColors: (itemId: string) => Promise<void>
  loadSizes: (itemId: string) => Promise<void>
  loadFeatures: (itemId?: string) => Promise<void>
  createItem: (data: Omit<Item, 'id' | 'date_code' | 'created_at'>) => Promise<Item | null>
  updateItem: (id: string, data: Partial<Item>) => Promise<Item | null>
  deleteItem: (id: string) => Promise<boolean>
  searchItems: (query: string) => Promise<Item[]>
  createColor: (data: Omit<Color, 'id'>) => Promise<Color | null>
  updateColor: (id: string, data: Partial<Color>) => Promise<Color | null>
  deleteColor: (id: string, itemId: string) => Promise<boolean>
  createSize: (data: Omit<Size, 'id'>) => Promise<Size | null>
  updateSize: (id: string, data: Partial<Size>) => Promise<Size | null>
  deleteSize: (id: string, itemId: string) => Promise<boolean>
  createFeature: (itemId: string, colorCode: string, sizeCode: string) => Promise<Feature | null>
  updateFeatureShelf: (fullCode: string, shelfNumber: string | null) => Promise<Feature | null>
  deleteFeature: (fullCode: string) => Promise<boolean>
  searchFeatures: (barcode: string) => Promise<Feature[]>
  getLatestItemVar: (itemId: string) => Promise<ItemVar | null>
  createItemVar: (data: Omit<ItemVar, 'id' | 'update_at'>) => Promise<ItemVar | null>
}

export const useItems = create<ItemsState>((set, get) => ({
  items: [],
  colors: {},
  sizes: {},
  features: [],
  loading: false,
  error: null,

  loadItems: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.items.list()
      if (result.success && result.data) {
        set({ items: result.data as Item[], loading: false })
      } else {
        set({ error: result.error || 'エラーが発生しました', loading: false })
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadColors: async (itemId: string) => {
    try {
      const result = await window.api.colors.list(itemId)
      if (result.success && result.data) {
        set((state) => ({ colors: { ...state.colors, [itemId]: result.data as Color[] } }))
      }
    } catch {
      // silent
    }
  },

  loadSizes: async (itemId: string) => {
    try {
      const result = await window.api.sizes.list(itemId)
      if (result.success && result.data) {
        set((state) => ({ sizes: { ...state.sizes, [itemId]: result.data as Size[] } }))
      }
    } catch {
      // silent
    }
  },

  loadFeatures: async (itemId?: string) => {
    try {
      const result = await window.api.features.list(itemId)
      if (result.success && result.data) {
        set({ features: result.data as Feature[] })
      }
    } catch {
      // silent
    }
  },

  createItem: async (data) => {
    try {
      const result = await window.api.items.create(data)
      if (result.success && result.data) {
        await get().loadItems()
        return result.data as Item
      }
      set({ error: result.error || '作成に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  updateItem: async (id, data) => {
    try {
      const result = await window.api.items.update(id, data)
      if (result.success && result.data) {
        await get().loadItems()
        return result.data as Item
      }
      set({ error: result.error || '更新に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  deleteItem: async (id) => {
    try {
      const result = await window.api.items.delete(id)
      if (result.success) {
        await get().loadItems()
        return true
      }
      set({ error: result.error || '削除に失敗しました' })
      return false
    } catch (e) {
      set({ error: (e as Error).message })
      return false
    }
  },

  searchItems: async (query) => {
    try {
      const result = await window.api.items.search(query)
      if (result.success && result.data) return result.data as Item[]
      return []
    } catch {
      return []
    }
  },

  createColor: async (data) => {
    try {
      const result = await window.api.colors.create(data)
      if (result.success && result.data) {
        await get().loadColors(data.item_id)
        return result.data as Color
      }
      set({ error: result.error || 'カラー作成に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  updateColor: async (id, data) => {
    try {
      const result = await window.api.colors.update(id, data)
      if (result.success && result.data) {
        const color = result.data as Color
        await get().loadColors(color.item_id)
        return color
      }
      set({ error: result.error || 'カラー更新に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  deleteColor: async (id, itemId) => {
    try {
      const result = await window.api.colors.delete(id)
      if (result.success) {
        await get().loadColors(itemId)
        return true
      }
      set({ error: result.error || 'カラー削除に失敗しました' })
      return false
    } catch (e) {
      set({ error: (e as Error).message })
      return false
    }
  },

  createSize: async (data) => {
    try {
      const result = await window.api.sizes.create(data)
      if (result.success && result.data) {
        await get().loadSizes(data.item_id)
        return result.data as Size
      }
      set({ error: result.error || 'サイズ作成に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  updateSize: async (id, data) => {
    try {
      const result = await window.api.sizes.update(id, data)
      if (result.success && result.data) {
        const size = result.data as Size
        await get().loadSizes(size.item_id)
        return size
      }
      set({ error: result.error || 'サイズ更新に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  deleteSize: async (id, itemId) => {
    try {
      const result = await window.api.sizes.delete(id)
      if (result.success) {
        await get().loadSizes(itemId)
        return true
      }
      set({ error: result.error || 'サイズ削除に失敗しました' })
      return false
    } catch (e) {
      set({ error: (e as Error).message })
      return false
    }
  },

  createFeature: async (itemId, colorCode, sizeCode) => {
    try {
      const result = await window.api.features.create(itemId, colorCode, sizeCode)
      if (result.success && result.data) {
        await get().loadFeatures(itemId)
        return result.data as Feature
      }
      set({ error: result.error || 'バリエーション作成に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  updateFeatureShelf: async (fullCode, shelfNumber) => {
    try {
      const result = await window.api.features.updateShelf(fullCode, shelfNumber)
      if (result.success && result.data) {
        return result.data as Feature
      }
      set({ error: result.error || '棚番号更新に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  deleteFeature: async (fullCode) => {
    try {
      const result = await window.api.features.delete(fullCode)
      if (result.success) {
        set((state) => ({ features: state.features.filter((f) => f.full_code !== fullCode) }))
        return true
      }
      set({ error: result.error || 'バリエーション削除に失敗しました' })
      return false
    } catch (e) {
      set({ error: (e as Error).message })
      return false
    }
  },

  searchFeatures: async (barcode) => {
    try {
      const result = await window.api.features.search(barcode)
      if (result.success && result.data) return result.data as Feature[]
      return []
    } catch {
      return []
    }
  },

  getLatestItemVar: async (itemId) => {
    try {
      const result = await window.api.itemvars.latest(itemId)
      if (result.success) return result.data as ItemVar | null
      return null
    } catch {
      return null
    }
  },

  createItemVar: async (data) => {
    try {
      const result = await window.api.itemvars.create(data)
      if (result.success && result.data) return result.data as ItemVar
      return null
    } catch {
      return null
    }
  }
}))
