import { contextBridge, ipcRenderer } from 'electron'

const api = {
  products: {
    list: () => ipcRenderer.invoke('products:list'),
    get: (idOrBarcode: string) => ipcRenderer.invoke('products:get', idOrBarcode),
    create: (data: unknown) => ipcRenderer.invoke('products:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('products:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('products:delete', id),
    search: (query: string) => ipcRenderer.invoke('products:search', query)
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (name: string, parentId?: string) => ipcRenderer.invoke('categories:create', name, parentId)
  },
  inventory: {
    list: () => ipcRenderer.invoke('inventory:list'),
    get: (productId: string) => ipcRenderer.invoke('inventory:get', productId),
    adjust: (productId: string, quantity: number, type: string, reason?: string) =>
      ipcRenderer.invoke('inventory:adjust', productId, quantity, type, reason),
    stockIn: (productId: string, quantity: number, reason?: string) =>
      ipcRenderer.invoke('inventory:stockIn', productId, quantity, reason),
    stockOut: (productId: string, quantity: number, reason?: string) =>
      ipcRenderer.invoke('inventory:stockOut', productId, quantity, reason),
    movements: (productId?: string) => ipcRenderer.invoke('inventory:movements', productId)
  },
  sales: {
    list: () => ipcRenderer.invoke('sales:list'),
    get: (id: string) => ipcRenderer.invoke('sales:get', id),
    create: (data: unknown) => ipcRenderer.invoke('sales:create', data),
    update: (id: string, status: string) => ipcRenderer.invoke('sales:update', id, status),
    complete: (id: string) => ipcRenderer.invoke('sales:complete', id),
    cancel: (id: string) => ipcRenderer.invoke('sales:cancel', id)
  },
  customers: {
    list: () => ipcRenderer.invoke('customers:list'),
    get: (id: string) => ipcRenderer.invoke('customers:get', id),
    create: (data: unknown) => ipcRenderer.invoke('customers:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('customers:update', id, data)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },
  ai: {
    chat: (messages: unknown[]) => ipcRenderer.invoke('ai:chat', messages)
  },
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    getToken: () => ipcRenderer.invoke('auth:getToken'),
    onAuthCallback: (callback: (user: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, user: unknown) => callback(user)
      ipcRenderer.on('auth:stateChanged', listener)
      return () => ipcRenderer.removeListener('auth:stateChanged', listener)
    },
    onAuthError: (callback: (error: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('auth:error', listener)
      return () => ipcRenderer.removeListener('auth:error', listener)
    }
  },
  labels: {
    print: (options?: unknown) => ipcRenderer.invoke('labels:print', options),
    getPrinters: () => ipcRenderer.invoke('labels:getPrinters')
  },
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:stats')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
