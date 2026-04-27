import { ipcMain } from 'electron'
import { getInventory, getInventoryByProductId, adjustStock, getStockMovements } from '../database'
import type { StockMovement } from '../../shared/types'

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:list', async () => {
    try {
      return { success: true, data: getInventory() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:get', async (_event, productId: string) => {
    try {
      const item = getInventoryByProductId(productId)
      if (!item) return { success: false, error: '在庫が見つかりません' }
      return { success: true, data: item }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'inventory:adjust',
    async (
      _event,
      productId: string,
      quantity: number,
      type: StockMovement['type'],
      reason?: string
    ) => {
      try {
        const item = adjustStock(productId, quantity, type, reason)
        return { success: true, data: item }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    'inventory:stockIn',
    async (_event, productId: string, quantity: number, reason?: string) => {
      try {
        const item = adjustStock(productId, Math.abs(quantity), 'in', reason || '入庫')
        return { success: true, data: item }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    'inventory:stockOut',
    async (_event, productId: string, quantity: number, reason?: string) => {
      try {
        const item = adjustStock(productId, -Math.abs(quantity), 'out', reason || '出庫')
        return { success: true, data: item }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle('inventory:movements', async (_event, productId?: string) => {
    try {
      return { success: true, data: getStockMovements(productId) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
