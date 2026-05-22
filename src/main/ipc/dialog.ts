import { ipcMain, dialog, BrowserWindow } from 'electron'
import { statSync } from 'fs'
import { basename, extname } from 'path'

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:pickImage', async () => {
    const focused = BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = {
      title: '商品画像を選択',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
    }
    const result = focused
      ? await dialog.showOpenDialog(focused, opts)
      : await dialog.showOpenDialog(opts)

    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, canceled: true }
    }

    const path = result.filePaths[0]
    const ext = extname(path).toLowerCase()
    const mimeType = MIME_BY_EXT[ext]
    if (!mimeType) {
      return { success: false, error: `対応していない拡張子です: ${ext}` }
    }

    try {
      const stat = statSync(path)
      if (stat.size > MAX_IMAGE_BYTES) {
        return {
          success: false,
          error: `画像サイズが上限 (${MAX_IMAGE_BYTES / 1024 / 1024}MB) を超えています`
        }
      }
      return {
        success: true,
        canceled: false,
        path,
        name: basename(path),
        mimeType,
        size: stat.size
      }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
