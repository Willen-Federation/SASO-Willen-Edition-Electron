import { ipcMain, BrowserWindow, webContents } from 'electron'
import {
  listLabelTemplates,
  createLabelTemplate,
  updateLabelTemplate,
  deleteLabelTemplate
} from '../database'

export function registerLabelHandlers(): void {
  // ── Label Templates ───────────────────────────────────────────────────────
  ipcMain.handle('labeltemplates:list', async () => {
    try {
      return { success: true, data: listLabelTemplates() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('labeltemplates:create', async (_event, data) => {
    try {
      return { success: true, data: createLabelTemplate(data) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('labeltemplates:update', async (_event, id: string, data) => {
    try {
      const tmpl = updateLabelTemplate(id, data)
      if (!tmpl) return { success: false, error: 'テンプレートが見つかりません' }
      return { success: true, data: tmpl }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('labeltemplates:delete', async (_event, id: string) => {
    try {
      const ok = deleteLabelTemplate(id)
      return { success: ok }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Print ─────────────────────────────────────────────────────────────────
  ipcMain.handle('labels:getPrinters', async (_event) => {
    try {
      const allWc = webContents.getAllWebContents()
      const wc = allWc.find((w) => w.getType() === 'window') || allWc[0]
      if (!wc) return { success: true, data: [] }
      const win = BrowserWindow.fromWebContents(wc)
      if (!win) return { success: true, data: [] }
      const printers = await win.webContents.getPrintersAsync()
      return { success: true, data: printers }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('labels:print', async (_event, options?: { printerName?: string; silent?: boolean }) => {
    try {
      const allWc = webContents.getAllWebContents()
      const wc = allWc.find((w) => w.getType() === 'window') || allWc[0]
      if (!wc) return { success: false, error: 'ウィンドウが見つかりません' }

      return new Promise((resolve) => {
        wc.print(
          {
            silent: options?.silent ?? false,
            printBackground: true,
            deviceName: options?.printerName || ''
          },
          (success, failureReason) => {
            if (success) {
              resolve({ success: true })
            } else {
              resolve({ success: false, error: failureReason })
            }
          }
        )
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
