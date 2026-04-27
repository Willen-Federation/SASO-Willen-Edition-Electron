import { ipcMain } from 'electron'
import { getSetting, setSetting, getAllSettings } from '../database'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, key: string) => {
    try {
      const value = getSetting(key)
      return { success: true, data: value }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    try {
      setSetting(key, value)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:getAll', async () => {
    try {
      return { success: true, data: getAllSettings() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
