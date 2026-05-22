import type {
  Item,
  Color,
  Size,
  Feature,
  ItemVar,
  QuantityLog,
  LabelTemplate,
  Category,
  Customer,
  SalesOrder,
  DashboardStats,
  AIMessage,
  AuthUser,
  ServerAuthDiscovery,
  IpcResponse,
  RemoteItem,
  RemoteItemListResponse,
  RemoteItemCreate,
  RemoteItemPatch,
  RemoteCategory,
  RemoteCategoryListResponse,
  RemoteStorageLocation,
  RemoteStorageLocationListResponse,
  BarcodeLookupResult,
  MobileConfigBundle,
  RemoteItemDraftCreated,
  PendingSyncOp
} from '../shared/types'

type SyncResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number; queued?: { id: string } }

interface CreateOrderData {
  customer_id?: string
  items: { product_id: string; quantity: number; unit_price: number; discount?: number }[]
  notes?: string
  created_by?: string
}

declare global {
  interface Window {
    api: {
      items: {
        list: () => Promise<IpcResponse<Item[]>>
        get: (id: string) => Promise<IpcResponse<Item>>
        create: (data: Omit<Item, 'id' | 'date_code' | 'created_at'>) => Promise<IpcResponse<Item>>
        update: (id: string, data: Partial<Item>) => Promise<IpcResponse<Item>>
        delete: (id: string) => Promise<IpcResponse<void>>
        search: (query: string) => Promise<IpcResponse<Item[]>>
      }
      colors: {
        list: (itemId: string) => Promise<IpcResponse<Color[]>>
        create: (data: Omit<Color, 'id'>) => Promise<IpcResponse<Color>>
        update: (id: string, data: Partial<Color>) => Promise<IpcResponse<Color>>
        delete: (id: string) => Promise<IpcResponse<void>>
      }
      sizes: {
        list: (itemId: string) => Promise<IpcResponse<Size[]>>
        create: (data: Omit<Size, 'id'>) => Promise<IpcResponse<Size>>
        update: (id: string, data: Partial<Size>) => Promise<IpcResponse<Size>>
        delete: (id: string) => Promise<IpcResponse<void>>
      }
      features: {
        list: (itemId?: string) => Promise<IpcResponse<Feature[]>>
        get: (fullCode: string) => Promise<IpcResponse<Feature>>
        create: (itemId: string, colorCode: string, sizeCode: string) => Promise<IpcResponse<Feature>>
        updateShelf: (fullCode: string, shelfNumber: string | null) => Promise<IpcResponse<Feature>>
        delete: (fullCode: string) => Promise<IpcResponse<void>>
        search: (barcode: string) => Promise<IpcResponse<Feature[]>>
      }
      itemvars: {
        latest: (itemId: string) => Promise<IpcResponse<ItemVar | null>>
        create: (data: Omit<ItemVar, 'id' | 'update_at'>) => Promise<IpcResponse<ItemVar>>
      }
      quantityLogs: {
        list: (fullCode?: string) => Promise<IpcResponse<QuantityLog[]>>
        stockIn: (fullCode: string, quantity: number, reason?: string) => Promise<IpcResponse<QuantityLog>>
        shipment: (fullCode: string, quantity: number, reason?: string) => Promise<IpcResponse<QuantityLog>>
        inventory: (fullCode: string, actualQuantity: number, reason?: string) => Promise<IpcResponse<QuantityLog>>
        quantity: (fullCode: string) => Promise<IpcResponse<number>>
      }
      labelTemplates: {
        list: () => Promise<IpcResponse<LabelTemplate[]>>
        create: (data: Omit<LabelTemplate, 'id' | 'created_at'>) => Promise<IpcResponse<LabelTemplate>>
        update: (id: string, data: Partial<LabelTemplate>) => Promise<IpcResponse<LabelTemplate>>
        delete: (id: string) => Promise<IpcResponse<void>>
      }
      categories: {
        list: () => Promise<IpcResponse<Category[]>>
        create: (name: string, parentId?: string) => Promise<IpcResponse<Category>>
      }
      sales: {
        list: () => Promise<IpcResponse<SalesOrder[]>>
        get: (id: string) => Promise<IpcResponse<SalesOrder>>
        create: (data: CreateOrderData) => Promise<IpcResponse<SalesOrder>>
        update: (id: string, status: string) => Promise<IpcResponse<SalesOrder>>
        complete: (id: string) => Promise<IpcResponse<SalesOrder>>
        cancel: (id: string) => Promise<IpcResponse<SalesOrder>>
      }
      customers: {
        list: () => Promise<IpcResponse<Customer[]>>
        get: (id: string) => Promise<IpcResponse<Customer>>
        create: (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<IpcResponse<Customer>>
        update: (id: string, data: Partial<Customer>) => Promise<IpcResponse<Customer>>
      }
      settings: {
        get: (key: string) => Promise<IpcResponse<string | null>>
        set: (key: string, value: string) => Promise<IpcResponse<void>>
        getAll: () => Promise<IpcResponse<Record<string, string>>>
      }
      ai: {
        chat: (messages: AIMessage[]) => Promise<IpcResponse<{ message: string; toolCalls?: unknown[] }>>
      }
      auth: {
        discoverProviders: () => Promise<IpcResponse<ServerAuthDiscovery>>
        testServerUrl: (url: string) => Promise<{ success: boolean; error?: string; status?: number }>
        pair: (providerId?: number) => Promise<{ success: boolean; error?: string }>
        pairWithToken: (payload: string) => Promise<{ success: boolean; error?: string }>
        logout: () => Promise<IpcResponse<void>>
        getUser: () => Promise<IpcResponse<AuthUser | null>>
        getToken: () => Promise<IpcResponse<string | null>>
        onAuthCallback: (callback: (user: AuthUser | null) => void) => () => void
      }
      sync: {
        health: () => Promise<SyncResult<{ status: string; version: string; time: string }>>
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
        ) => Promise<SyncResult<RemoteItemListResponse>>
        itemsGet: (id: string | number) => Promise<SyncResult<RemoteItem>>
        itemsCreate: (data: RemoteItemCreate, idempotencyKey?: string) => Promise<SyncResult<RemoteItem>>
        itemsUpdate: (
          id: string | number,
          data: RemoteItemPatch,
          idempotencyKey?: string
        ) => Promise<SyncResult<RemoteItem>>
        categoriesList: (format?: 'flat' | 'tree') => Promise<SyncResult<RemoteCategoryListResponse>>
        storageLocationsList: () => Promise<SyncResult<RemoteStorageLocationListResponse>>
        storageLocationsGet: (id: string | number) => Promise<SyncResult<RemoteStorageLocation>>
        storageLocationsItems: (id: string | number) => Promise<SyncResult<{ data: RemoteItem[]; total: number }>>
        barcodeGet: (code: string) => Promise<SyncResult<BarcodeLookupResult>>
        mobileConfig: () => Promise<SyncResult<MobileConfigBundle>>
        itemsDraftCreate: (args: {
          imagePath: string
          fields?: {
            item_name?: string
            jan_code?: string
            isbn?: string
            price?: string | number
            barcode_hint?: string
          }
        }) => Promise<SyncResult<RemoteItemDraftCreated>>
      }
      labels: {
        print: (options?: { printerName?: string; silent?: boolean }) => Promise<IpcResponse<void>>
        getPrinters: () => Promise<IpcResponse<Electron.PrinterInfo[]>>
      }
      dashboard: {
        getStats: () => Promise<IpcResponse<DashboardStats>>
      }
      shell: {
        openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
      }
      dialog: {
        pickImage: () => Promise<
          { success: true; canceled: false; path: string; name: string; mimeType: string; size: number }
          | { success: true; canceled: true }
          | { success: false; error: string }
        >
      }
      syncQueue: {
        list: () => Promise<IpcResponse<PendingSyncOp[]>>
        pendingCount: () => Promise<IpcResponse<{ pending: number; conflict: number; failed: number }>>
        drainNow: () => Promise<IpcResponse<{ drained: number; remaining: number }>>
        remove: (id: string) => Promise<IpcResponse<void>>
        onUpdated: (
          callback: (info: { pending: number; conflict: number; failed: number }) => void
        ) => () => void
      }
    }
  }
}
