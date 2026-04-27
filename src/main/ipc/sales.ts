import { ipcMain } from 'electron'
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  completeOrder,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getSetting
} from '../database'

export function registerSalesHandlers(): void {
  ipcMain.handle('sales:list', async () => {
    try {
      return { success: true, data: getOrders() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:get', async (_event, id: string) => {
    try {
      const order = getOrderById(id)
      if (!order) return { success: false, error: '注文が見つかりません' }
      return { success: true, data: order }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:create', async (_event, data) => {
    try {
      const taxRateStr = getSetting('taxRate')
      const taxRate = taxRateStr ? parseFloat(taxRateStr) : 10
      const order = createOrder({ ...data, taxRate })
      return { success: true, data: order }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:update', async (_event, id: string, status: string) => {
    try {
      const order = updateOrderStatus(id, status as 'pending' | 'completed' | 'cancelled')
      if (!order) return { success: false, error: '注文が見つかりません' }
      return { success: true, data: order }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:complete', async (_event, id: string) => {
    try {
      const order = completeOrder(id)
      if (!order) return { success: false, error: '注文が見つかりません' }
      return { success: true, data: order }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:cancel', async (_event, id: string) => {
    try {
      const order = updateOrderStatus(id, 'cancelled')
      if (!order) return { success: false, error: '注文が見つかりません' }
      return { success: true, data: order }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Customers
  ipcMain.handle('customers:list', async () => {
    try {
      return { success: true, data: getCustomers() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('customers:get', async (_event, id: string) => {
    try {
      const customer = getCustomerById(id)
      if (!customer) return { success: false, error: '顧客が見つかりません' }
      return { success: true, data: customer }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('customers:create', async (_event, data) => {
    try {
      const customer = createCustomer(data)
      return { success: true, data: customer }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('customers:update', async (_event, id: string, data) => {
    try {
      const customer = updateCustomer(id, data)
      if (!customer) return { success: false, error: '顧客が見つかりません' }
      return { success: true, data: customer }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
