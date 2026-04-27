import { ipcMain, BrowserWindow, webContents } from 'electron'

export function registerLabelHandlers(): void {
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
