import { create } from 'zustand'
import type { SalesOrder, Customer } from '@shared/types'

interface CreateOrderData {
  customer_id?: string
  items: { product_id: string; quantity: number; unit_price: number; discount?: number }[]
  notes?: string
}

interface SalesState {
  orders: SalesOrder[]
  customers: Customer[]
  currentOrder: SalesOrder | null
  loading: boolean
  error: string | null
  loadOrders: () => Promise<void>
  loadCustomers: () => Promise<void>
  getOrder: (id: string) => Promise<SalesOrder | null>
  createOrder: (data: CreateOrderData) => Promise<SalesOrder | null>
  updateOrder: (id: string, status: string) => Promise<SalesOrder | null>
  completeOrder: (id: string) => Promise<SalesOrder | null>
  cancelOrder: (id: string) => Promise<SalesOrder | null>
  createCustomer: (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<Customer | null>
}

export const useSales = create<SalesState>((set, get) => ({
  orders: [],
  customers: [],
  currentOrder: null,
  loading: false,
  error: null,

  loadOrders: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.sales.list()
      if (result.success && result.data) {
        set({ orders: result.data as SalesOrder[], loading: false })
      } else {
        set({ error: result.error || 'エラーが発生しました', loading: false })
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadCustomers: async () => {
    try {
      const result = await window.api.customers.list()
      if (result.success && result.data) {
        set({ customers: result.data as Customer[] })
      }
    } catch {
      // silent
    }
  },

  getOrder: async (id) => {
    try {
      const result = await window.api.sales.get(id)
      if (result.success && result.data) {
        set({ currentOrder: result.data as SalesOrder })
        return result.data as SalesOrder
      }
      return null
    } catch {
      return null
    }
  },

  createOrder: async (data) => {
    try {
      const result = await window.api.sales.create(data)
      if (result.success && result.data) {
        await get().loadOrders()
        return result.data as SalesOrder
      }
      set({ error: result.error || '注文作成に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  updateOrder: async (id, status) => {
    try {
      const result = await window.api.sales.update(id, status)
      if (result.success && result.data) {
        await get().loadOrders()
        return result.data as SalesOrder
      }
      set({ error: result.error || '更新に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  completeOrder: async (id) => {
    try {
      const result = await window.api.sales.complete(id)
      if (result.success && result.data) {
        await get().loadOrders()
        return result.data as SalesOrder
      }
      set({ error: result.error || '注文完了に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  cancelOrder: async (id) => {
    try {
      const result = await window.api.sales.cancel(id)
      if (result.success && result.data) {
        await get().loadOrders()
        return result.data as SalesOrder
      }
      set({ error: result.error || 'キャンセルに失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  createCustomer: async (data) => {
    try {
      const result = await window.api.customers.create(data)
      if (result.success && result.data) {
        await get().loadCustomers()
        return result.data as Customer
      }
      set({ error: result.error || '顧客作成に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  }
}))
