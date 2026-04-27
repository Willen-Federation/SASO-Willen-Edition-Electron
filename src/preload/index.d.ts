import type {
  Product,
  Category,
  InventoryItem,
  StockMovement,
  Customer,
  SalesOrder,
  DashboardStats,
  AIMessage,
  AuthUser,
  IpcResponse
} from '../shared/types'

interface CreateOrderData {
  customer_id?: string
  items: { product_id: string; quantity: number; unit_price: number; discount?: number }[]
  notes?: string
  created_by?: string
}

declare global {
  interface Window {
    api: {
      products: {
        list: () => Promise<IpcResponse<Product[]>>
        get: (idOrBarcode: string) => Promise<IpcResponse<Product>>
        create: (data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'current_stock' | 'category_name'>) => Promise<IpcResponse<Product>>
        update: (id: string, data: Partial<Product>) => Promise<IpcResponse<Product>>
        delete: (id: string) => Promise<IpcResponse<void>>
        search: (query: string) => Promise<IpcResponse<Product[]>>
      }
      categories: {
        list: () => Promise<IpcResponse<Category[]>>
        create: (name: string, parentId?: string) => Promise<IpcResponse<Category>>
      }
      inventory: {
        list: () => Promise<IpcResponse<InventoryItem[]>>
        get: (productId: string) => Promise<IpcResponse<InventoryItem>>
        adjust: (productId: string, quantity: number, type: StockMovement['type'], reason?: string) => Promise<IpcResponse<InventoryItem>>
        stockIn: (productId: string, quantity: number, reason?: string) => Promise<IpcResponse<InventoryItem>>
        stockOut: (productId: string, quantity: number, reason?: string) => Promise<IpcResponse<InventoryItem>>
        movements: (productId?: string) => Promise<IpcResponse<StockMovement[]>>
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
        login: () => Promise<IpcResponse<void>>
        logout: () => Promise<IpcResponse<void>>
        getUser: () => Promise<IpcResponse<AuthUser | null>>
        getToken: () => Promise<IpcResponse<string | null>>
        onAuthCallback: (callback: (user: AuthUser | null) => void) => () => void
        onAuthError: (callback: (error: string) => void) => () => void
      }
      labels: {
        print: (options?: { printerName?: string; silent?: boolean }) => Promise<IpcResponse<void>>
        getPrinters: () => Promise<IpcResponse<Electron.PrinterInfo[]>>
      }
      dashboard: {
        getStats: () => Promise<IpcResponse<DashboardStats>>
      }
    }
  }
}
