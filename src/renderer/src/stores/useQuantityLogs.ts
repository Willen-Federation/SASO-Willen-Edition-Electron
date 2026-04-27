import { create } from 'zustand'
import type { QuantityLog } from '@shared/types'

interface QuantityLogsState {
  logs: QuantityLog[]
  quantities: Record<string, number>
  loading: boolean
  error: string | null
  loadLogs: (fullCode?: string) => Promise<void>
  loadQuantity: (fullCode: string) => Promise<number>
  stockIn: (fullCode: string, quantity: number, reason?: string) => Promise<QuantityLog | null>
  shipment: (fullCode: string, quantity: number, reason?: string) => Promise<QuantityLog | null>
  inventoryCount: (fullCode: string, actualQuantity: number, reason?: string) => Promise<QuantityLog | null>
}

export const useQuantityLogs = create<QuantityLogsState>((set, get) => ({
  logs: [],
  quantities: {},
  loading: false,
  error: null,

  loadLogs: async (fullCode?: string) => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.quantityLogs.list(fullCode)
      if (result.success && result.data) {
        set({ logs: result.data as QuantityLog[], loading: false })
      } else {
        set({ error: result.error || 'エラーが発生しました', loading: false })
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadQuantity: async (fullCode: string) => {
    try {
      const result = await window.api.quantityLogs.quantity(fullCode)
      const qty = result.success ? (result.data as number) : 0
      set((state) => ({ quantities: { ...state.quantities, [fullCode]: qty } }))
      return qty
    } catch {
      return 0
    }
  },

  stockIn: async (fullCode, quantity, reason?) => {
    try {
      const result = await window.api.quantityLogs.stockIn(fullCode, quantity, reason)
      if (result.success && result.data) {
        const log = result.data as QuantityLog
        set((state) => ({
          logs: [log, ...state.logs],
          quantities: {
            ...state.quantities,
            [fullCode]: (state.quantities[fullCode] ?? 0) + quantity
          }
        }))
        return log
      }
      set({ error: result.error || '入庫に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  shipment: async (fullCode, quantity, reason?) => {
    try {
      const result = await window.api.quantityLogs.shipment(fullCode, quantity, reason)
      if (result.success && result.data) {
        const log = result.data as QuantityLog
        set((state) => ({
          logs: [log, ...state.logs],
          quantities: {
            ...state.quantities,
            [fullCode]: (state.quantities[fullCode] ?? 0) - quantity
          }
        }))
        return log
      }
      set({ error: result.error || '出荷に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  inventoryCount: async (fullCode, actualQuantity, reason?) => {
    try {
      const result = await window.api.quantityLogs.inventory(fullCode, actualQuantity, reason)
      if (result.success && result.data) {
        const log = result.data as QuantityLog
        set((state) => ({
          logs: [log, ...state.logs],
          quantities: { ...state.quantities, [fullCode]: actualQuantity }
        }))
        // Reload full logs to get the accurate fluctuation
        await get().loadLogs(fullCode)
        return log
      }
      set({ error: result.error || '棚卸しに失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  }
}))
