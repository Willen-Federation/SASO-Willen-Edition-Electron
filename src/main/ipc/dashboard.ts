import { ipcMain } from 'electron'
import { getDashboardStats } from '../database'

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:stats', async () => {
    try {
      const stats = getDashboardStats()
      return { success: true, data: stats }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
