import { ipcMain } from 'electron'
import {
  listQuantityLogs,
  addStockIn,
  addShipment,
  doInventoryCount,
  getFeatureCurrentQuantity
} from '../database'

export function registerQuantityLogHandlers(): void {
  ipcMain.handle('quantitylogs:list', async (_event, fullCode?: string) => {
    try {
      return { success: true, data: listQuantityLogs(fullCode) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('quantitylogs:stockIn', async (_event, fullCode: string, quantity: number, reason?: string) => {
    try {
      return { success: true, data: addStockIn(fullCode, quantity, reason) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('quantitylogs:shipment', async (_event, fullCode: string, quantity: number, reason?: string) => {
    try {
      return { success: true, data: addShipment(fullCode, quantity, reason) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('quantitylogs:inventory', async (_event, fullCode: string, actualQuantity: number, reason?: string) => {
    try {
      return { success: true, data: doInventoryCount(fullCode, actualQuantity, reason) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('quantitylogs:quantity', async (_event, fullCode: string) => {
    try {
      return { success: true, data: getFeatureCurrentQuantity(fullCode) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
