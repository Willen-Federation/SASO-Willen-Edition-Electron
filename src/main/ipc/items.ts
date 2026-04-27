import { ipcMain } from 'electron'
import {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
  listColors,
  createColor,
  updateColor,
  deleteColor,
  listSizes,
  createSize,
  updateSize,
  deleteSize,
  listFeatures,
  getFeature,
  createFeature,
  updateFeatureShelf,
  deleteFeature,
  searchFeaturesByBarcode,
  getLatestItemVar,
  createItemVar,
  getCategories,
  createCategory
} from '../database'

export function registerItemHandlers(): void {
  // ── Items ────────────────────────────────────────────────────────────────
  ipcMain.handle('items:list', async () => {
    try {
      return { success: true, data: listItems() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('items:get', async (_event, id: string) => {
    try {
      const item = getItem(id)
      if (!item) return { success: false, error: '商品が見つかりません' }
      return { success: true, data: item }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('items:create', async (_event, data) => {
    try {
      return { success: true, data: createItem(data) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('items:update', async (_event, id: string, data) => {
    try {
      const item = updateItem(id, data)
      if (!item) return { success: false, error: '商品が見つかりません' }
      return { success: true, data: item }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('items:delete', async (_event, id: string) => {
    try {
      const ok = deleteItem(id)
      return { success: ok }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('items:search', async (_event, query: string) => {
    try {
      return { success: true, data: searchItems(query) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Colors ───────────────────────────────────────────────────────────────
  ipcMain.handle('colors:list', async (_event, itemId: string) => {
    try {
      return { success: true, data: listColors(itemId) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('colors:create', async (_event, data) => {
    try {
      return { success: true, data: createColor(data) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('colors:update', async (_event, id: string, data) => {
    try {
      const color = updateColor(id, data)
      if (!color) return { success: false, error: 'カラーが見つかりません' }
      return { success: true, data: color }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('colors:delete', async (_event, id: string) => {
    try {
      const ok = deleteColor(id)
      return { success: ok }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Sizes ────────────────────────────────────────────────────────────────
  ipcMain.handle('sizes:list', async (_event, itemId: string) => {
    try {
      return { success: true, data: listSizes(itemId) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sizes:create', async (_event, data) => {
    try {
      return { success: true, data: createSize(data) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sizes:update', async (_event, id: string, data) => {
    try {
      const size = updateSize(id, data)
      if (!size) return { success: false, error: 'サイズが見つかりません' }
      return { success: true, data: size }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sizes:delete', async (_event, id: string) => {
    try {
      const ok = deleteSize(id)
      return { success: ok }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Features ─────────────────────────────────────────────────────────────
  ipcMain.handle('features:list', async (_event, itemId?: string) => {
    try {
      return { success: true, data: listFeatures(itemId) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('features:get', async (_event, fullCode: string) => {
    try {
      const feature = getFeature(fullCode)
      if (!feature) return { success: false, error: 'バリエーションが見つかりません' }
      return { success: true, data: feature }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('features:create', async (_event, itemId: string, colorCode: string, sizeCode: string) => {
    try {
      return { success: true, data: createFeature(itemId, colorCode, sizeCode) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('features:updateShelf', async (_event, fullCode: string, shelfNumber: string | null) => {
    try {
      const feature = updateFeatureShelf(fullCode, shelfNumber)
      if (!feature) return { success: false, error: 'バリエーションが見つかりません' }
      return { success: true, data: feature }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('features:delete', async (_event, fullCode: string) => {
    try {
      const ok = deleteFeature(fullCode)
      return { success: ok }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('features:search', async (_event, barcode: string) => {
    try {
      return { success: true, data: searchFeaturesByBarcode(barcode) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── ItemVars ─────────────────────────────────────────────────────────────
  ipcMain.handle('itemvars:latest', async (_event, itemId: string) => {
    try {
      return { success: true, data: getLatestItemVar(itemId) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('itemvars:create', async (_event, data) => {
    try {
      return { success: true, data: createItemVar(data) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Categories ───────────────────────────────────────────────────────────
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
