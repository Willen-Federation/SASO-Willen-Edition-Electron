export interface Category {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

export interface Product {
  id: string
  barcode: string | null
  name: string
  description: string | null
  category_id: string | null
  category_name?: string
  price: number
  cost: number
  unit: string
  min_stock: number
  image_url: string | null
  created_at: string
  updated_at: string
  current_stock?: number
}

export interface InventoryItem {
  id: string
  product_id: string
  product_name?: string
  product_barcode?: string
  quantity: number
  location: string | null
  updated_at: string
  min_stock?: number
  price?: number
}

export interface StockMovement {
  id: string
  product_id: string
  product_name?: string
  type: 'in' | 'out' | 'adjustment' | 'sale' | 'return'
  quantity: number
  reason: string | null
  reference_id: string | null
  created_by: string | null
  created_at: string
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface SalesOrderItem {
  id: string
  order_id: string
  product_id: string
  product_name?: string
  product_barcode?: string
  quantity: number
  unit_price: number
  discount: number
  total: number
}

export interface SalesOrder {
  id: string
  customer_id: string | null
  customer_name?: string
  status: 'pending' | 'completed' | 'cancelled'
  subtotal: number
  tax: number
  discount: number
  total: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  items?: SalesOrderItem[]
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_call_id?: string
  tool_name?: string
}

export interface AIConfig {
  provider: 'claude' | 'openai' | 'gemini'
  apiKey: string
  model: string
}

export interface AppSettings {
  taxRate: number
  currency: string
  language: string
  authServerUrl: string
  authClientId: string
  aiProvider: 'claude' | 'openai' | 'gemini'
  claudeApiKey: string
  claudeModel: string
  openaiApiKey: string
  openaiModel: string
  geminiApiKey: string
  geminiModel: string
  defaultPrinter: string
  defaultLabelSize: string
}

export interface DashboardStats {
  totalProducts: number
  totalCategories: number
  totalCustomers: number
  totalInventoryValue: number
  lowStockCount: number
  todaySales: number
  todayRevenue: number
  recentMovements: StockMovement[]
}

export interface AuthUser {
  id: string
  name: string
  email: string
  token: string
  expiresAt: string
}

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface AIResponse {
  message: string
  toolCalls?: ToolCall[]
}
