import { create } from 'zustand'
import type { Product, Category } from '@shared/types'

interface ProductsState {
  products: Product[]
  categories: Category[]
  loading: boolean
  error: string | null
  loadProducts: () => Promise<void>
  loadCategories: () => Promise<void>
  createProduct: (data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'current_stock' | 'category_name'>) => Promise<Product | null>
  updateProduct: (id: string, data: Partial<Product>) => Promise<Product | null>
  deleteProduct: (id: string) => Promise<boolean>
  searchProducts: (query: string) => Promise<Product[]>
}

export const useProducts = create<ProductsState>((set, get) => ({
  products: [],
  categories: [],
  loading: false,
  error: null,

  loadProducts: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.products.list()
      if (result.success && result.data) {
        set({ products: result.data as Product[], loading: false })
      } else {
        set({ error: result.error || 'エラーが発生しました', loading: false })
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadCategories: async () => {
    try {
      const result = await window.api.categories.list()
      if (result.success && result.data) {
        set({ categories: result.data as Category[] })
      }
    } catch {
      // silent
    }
  },

  createProduct: async (data) => {
    try {
      const result = await window.api.products.create(data)
      if (result.success && result.data) {
        await get().loadProducts()
        return result.data as Product
      }
      set({ error: result.error || '作成に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  updateProduct: async (id, data) => {
    try {
      const result = await window.api.products.update(id, data)
      if (result.success && result.data) {
        await get().loadProducts()
        return result.data as Product
      }
      set({ error: result.error || '更新に失敗しました' })
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  deleteProduct: async (id) => {
    try {
      const result = await window.api.products.delete(id)
      if (result.success) {
        await get().loadProducts()
        return true
      }
      set({ error: result.error || '削除に失敗しました' })
      return false
    } catch (e) {
      set({ error: (e as Error).message })
      return false
    }
  },

  searchProducts: async (query) => {
    try {
      const result = await window.api.products.search(query)
      if (result.success && result.data) return result.data as Product[]
      return []
    } catch {
      return []
    }
  }
}))
