import { ipcMain, shell } from 'electron'

// Restricts shell.openExternal to http(s) URLs to keep arbitrary
// file:// / javascript: / custom-scheme requests from sneaking through.
export function registerShellHandlers(): void {
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { success: false, error: '無効な URL です (http/https のみ許可)' }
    }
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
