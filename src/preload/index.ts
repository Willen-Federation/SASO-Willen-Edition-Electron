import { contextBridge, ipcRenderer } from 'electron'

const api = {
  items: {
    list: () => ipcRenderer.invoke('items:list'),
    get: (id: string) => ipcRenderer.invoke('items:get', id),
    create: (data: unknown) => ipcRenderer.invoke('items:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('items:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('items:delete', id),
    search: (query: string) => ipcRenderer.invoke('items:search', query)
  },
  colors: {
    list: (itemId: string) => ipcRenderer.invoke('colors:list', itemId),
    create: (data: unknown) => ipcRenderer.invoke('colors:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('colors:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('colors:delete', id)
  },
  sizes: {
    list: (itemId: string) => ipcRenderer.invoke('sizes:list', itemId),
    create: (data: unknown) => ipcRenderer.invoke('sizes:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('sizes:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('sizes:delete', id)
  },
  features: {
    list: (itemId?: string) => ipcRenderer.invoke('features:list', itemId),
    get: (fullCode: string) => ipcRenderer.invoke('features:get', fullCode),
    create: (itemId: string, colorCode: string, sizeCode: string) =>
      ipcRenderer.invoke('features:create', itemId, colorCode, sizeCode),
    updateShelf: (fullCode: string, shelfNumber: string | null) =>
      ipcRenderer.invoke('features:updateShelf', fullCode, shelfNumber),
    delete: (fullCode: string) => ipcRenderer.invoke('features:delete', fullCode),
    search: (barcode: string) => ipcRenderer.invoke('features:search', barcode)
  },
  itemvars: {
    latest: (itemId: string) => ipcRenderer.invoke('itemvars:latest', itemId),
    create: (data: unknown) => ipcRenderer.invoke('itemvars:create', data)
  },
  quantityLogs: {
    list: (fullCode?: string) => ipcRenderer.invoke('quantitylogs:list', fullCode),
    stockIn: (fullCode: string, quantity: number, reason?: string) =>
      ipcRenderer.invoke('quantitylogs:stockIn', fullCode, quantity, reason),
    shipment: (fullCode: string, quantity: number, reason?: string) =>
      ipcRenderer.invoke('quantitylogs:shipment', fullCode, quantity, reason),
    inventory: (fullCode: string, actualQuantity: number, reason?: string) =>
      ipcRenderer.invoke('quantitylogs:inventory', fullCode, actualQuantity, reason),
    quantity: (fullCode: string) => ipcRenderer.invoke('quantitylogs:quantity', fullCode)
  },
  labelTemplates: {
    list: () => ipcRenderer.invoke('labeltemplates:list'),
    create: (data: unknown) => ipcRenderer.invoke('labeltemplates:create', data),
    update: (id: string, data: unknown) => ipcRenderer.invoke('labeltemplates:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('labeltemplates:delete', id)
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (name: string, parentId?: string) => ipcRenderer.invoke('categories:create', name, parentId)
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
    discoverProviders: () => ipcRenderer.invoke('auth:discoverProviders'),
    testServerUrl: (url: string) => ipcRenderer.invoke('auth:testServerUrl', url),
    pair: (providerId?: number) => ipcRenderer.invoke('auth:pair', providerId),
    pairWithToken: (payload: string) => ipcRenderer.invoke('auth:pairWithToken', payload),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    getToken: () => ipcRenderer.invoke('auth:getToken'),
    onAuthCallback: (callback: (user: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, user: unknown) => callback(user)
      ipcRenderer.on('auth:stateChanged', listener)
      return () => ipcRenderer.removeListener('auth:stateChanged', listener)
    }
  },
  sync: {
    health: () => ipcRenderer.invoke('sync:health'),
    readiness: () => ipcRenderer.invoke('sync:health:readiness'),
    itemsList: (
      query?: {
        q?: string
        category_id?: string | number
        barcode?: string
        isbn?: string
        label_code?: string
        cursor?: number
        limit?: number
      }
    ) => ipcRenderer.invoke('sync:items:list', query),
    itemsGet: (id: string | number) => ipcRenderer.invoke('sync:items:get', id),
    itemsCreate: (data: unknown, idempotencyKey?: string) =>
      ipcRenderer.invoke('sync:items:create', data, idempotencyKey),
    itemsUpdate: (id: string | number, data: unknown, idempotencyKey?: string) =>
      ipcRenderer.invoke('sync:items:update', id, data, idempotencyKey),
    categoriesList: (format?: 'flat' | 'tree') =>
      ipcRenderer.invoke('sync:categories:list', format),
    storageLocationsList: () => ipcRenderer.invoke('sync:storage-locations:list'),
    storageLocationsGet: (id: string | number) =>
      ipcRenderer.invoke('sync:storage-locations:get', id),
    storageLocationsItems: (id: string | number) =>
      ipcRenderer.invoke('sync:storage-locations:items', id),
    barcodeGet: (code: string) => ipcRenderer.invoke('sync:barcode:get', code),
    mobileConfig: () => ipcRenderer.invoke('sync:mobile:config'),
    itemsDraftCreate: (args: {
      imagePath: string
      fields?: {
        item_name?: string
        jan_code?: string
        isbn?: string
        price?: string | number
        barcode_hint?: string
      }
    }) => ipcRenderer.invoke('sync:items:drafts:create', args)
  },
  labels: {
    print: (options?: unknown) => ipcRenderer.invoke('labels:print', options),
    getPrinters: () => ipcRenderer.invoke('labels:getPrinters')
  },
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:stats')
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  dialog: {
    pickImage: () => ipcRenderer.invoke('dialog:pickImage')
  },
  syncQueue: {
    list: () => ipcRenderer.invoke('sync:queue:list'),
    pendingCount: () => ipcRenderer.invoke('sync:queue:pendingCount'),
    drainNow: () => ipcRenderer.invoke('sync:queue:drainNow'),
    remove: (id: string) => ipcRenderer.invoke('sync:queue:remove', id),
    onUpdated: (callback: (info: { pending: number; conflict: number; failed: number }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, info: { pending: number; conflict: number; failed: number }) =>
        callback(info)
      ipcRenderer.on('sync:queue:updated', listener)
      return () => ipcRenderer.removeListener('sync:queue:updated', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
