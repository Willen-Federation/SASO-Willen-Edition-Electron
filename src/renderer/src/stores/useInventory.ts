import { create } from 'zustand'
import type { InventoryItem, StockMovement } from '@shared/types'

interface InventoryState {
  inventory: InventoryItem[]
  movements: StockMovement[]
  loading: boolean
  error: string | null
  loadInventory: () => Promise<void>
  loadMovements: (productId?: string) => Promise<void>
  adjustStock: (productId: string, quantity: number, type: StockMovement['type'], reason?: string) => Promise<InventoryItem | null>
  stockIn: (productId: string, quantity: number, reason?: string) => Promise<InventoryItem | null>
  stockOut: (productId: string, quantity: number, reason?: string) => Promise<InventoryItem | null>
}

export const useInventory = create<InventoryState>((set, get) => ({
  inventory: [],
  movements: [],
  loading: false,
  error: null,

  loadInventory: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.inventory.list()
      if (result.success && result.data) {
        set({ inventory: result.data as InventoryItem[], loading: false })
      } else {
        set({ error: result.error || 'エラーが発生しました', loading: false })
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadMovements: async (productId?) => {
    try {
      const result = await window.api.inventory.movements(productId)
      if (result.success && result.data) {
        set({ movements: result.data as StockMovement[] })
      }
    } catch {
      // silent
    }
  },

  adjustStock: async (productId, quantity, type, reason?) => {
    try {
      const result = await window.api.inventory.adjust(productId, quantity, type, reason)
      if (result.success && result.data) {
        await get().loadInventory()
        return result.data as InventoryItem
      }
      set({ error: result.error || '在庫調整に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  stockIn: async (productId, quantity, reason?) => {
    try {
      const result = await window.api.inventory.stockIn(productId, quantity, reason)
      if (result.success && result.data) {
        await get().loadInventory()
        return result.data as InventoryItem
      }
      set({ error: result.error || '入庫に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  stockOut: async (productId, quantity, reason?) => {
    try {
      const result = await window.api.inventory.stockOut(productId, quantity, reason)
      if (result.success && result.data) {
        await get().loadInventory()
        return result.data as InventoryItem
      }
      set({ error: result.error || '出庫に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  }
}))
