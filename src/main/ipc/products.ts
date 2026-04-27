import { ipcMain } from 'electron'
import {
  getProducts,
  getProductById,
  getProductByBarcode,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  createCategory
} from '../database'

export function registerProductHandlers(): void {
  ipcMain.handle('products:list', async () => {
    try {
      return { success: true, data: getProducts() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:get', async (_event, idOrBarcode: string) => {
    try {
      let product = getProductById(idOrBarcode)
      if (!product) product = getProductByBarcode(idOrBarcode)
      if (!product) return { success: false, error: '商品が見つかりません' }
      return { success: true, data: product }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:create', async (_event, data) => {
    try {
      const product = createProduct(data)
      return { success: true, data: product }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:update', async (_event, id: string, data) => {
    try {
      const product = updateProduct(id, data)
      if (!product) return { success: false, error: '商品が見つかりません' }
      return { success: true, data: product }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:delete', async (_event, id: string) => {
    try {
      const ok = deleteProduct(id)
      return { success: ok }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:search', async (_event, query: string) => {
    try {
      return { success: true, data: searchProducts(query) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('categories:list', async () => {
    try {
      return { success: true, data: getCategories() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('categories:create', async (_event, name: string, parentId?: string) => {
    try {
      return { success: true, data: createCategory(name, parentId) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
