// ── Item (商品) ────────────────────────────────────────────────────────────────
export interface Item {
  id: string                // 8-digit zero-padded string
  serial: string | null
  name: string              // max 50 chars
  pla: boolean
  pla_note: string | null
  paper: boolean
  paper_note: string | null
  date_code: string         // YYYYMMDD
  created_at: string
}

// ── Color (カラー) ────────────────────────────────────────────────────────────
export interface Color {
  id: string                // UUID
  item_id: string
  code: string              // 2-digit zero-padded 00-99
  name: string              // max 50 chars
  image_type: string | null
}

// ── Size (サイズ) ─────────────────────────────────────────────────────────────
export interface Size {
  id: string                // UUID
  item_id: string
  code: string              // 2-digit zero-padded 00-99
  name: string              // max 50 chars
  order_number: number      // 0-99
}

// ── Feature (バリエーション = barcode unit) ────────────────────────────────────
export interface Feature {
  full_code: string         // 12 chars = item.id[8] + color.code[2] + size.code[2]
  item_id: string
  color_code: string        // 2 chars
  size_code: string         // 2 chars
  shelf_number: string | null
  label_amount: number | null
  // joined fields (optional)
  item_name?: string
  color_name?: string
  size_name?: string
  current_price?: number | null
  current_quantity?: number
}

// ── ItemVar (価格・カテゴリ履歴) ──────────────────────────────────────────────
export interface ItemVar {
  id: string                // UUID
  item_id: string
  category_id: number | null
  price: number | null      // integer yen
  update_at: string
}

// ── QuantityLog (在庫変動) ────────────────────────────────────────────────────
export interface QuantityLog {
  id: string                // UUID
  full_code: string
  fluctuation: number       // positive = stock in, negative = shipment
  is_inventory: boolean     // true = 棚卸し
  change_at: string
  reason: string | null
}

// ── LabelTemplate ─────────────────────────────────────────────────────────────
export interface LabelTemplate {
  id: string                // UUID
  name: string              // 1-50 alphanumeric + hyphen/underscore
  margin_top: number        // mm
  margin_left: number       // mm
  width: number             // mm
  height: number            // mm
  interval_column: number   // mm
  interval_row: number      // mm
  created_at: string
}

// ── Category ──────────────────────────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

// ── Customer ──────────────────────────────────────────────────────────────────
export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
  updated_at: string
}

// ── SalesOrderItem ────────────────────────────────────────────────────────────
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

// ── SalesOrder ────────────────────────────────────────────────────────────────
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

// ── Member (ユーザー) ─────────────────────────────────────────────────────────
export interface Member {
  id: string                // 8-20 alphanumeric + hyphen/underscore
  name: string              // max 50 chars
  password_hash: string     // bcrypt hash
}

// ── AI / App ──────────────────────────────────────────────────────────────────
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
  sasoServerUrl: string
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

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalItems: number
  totalFeatures: number
  totalCategories: number
  totalCustomers: number
  lowStockCount: number      // features with current quantity <= 0
  todaySales: number
  todayRevenue: number
  recentLogs: QuantityLog[]
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string
  name: string
  email: string
  token: string
  expiresAt: string
  deviceName?: string
  deviceId?: number | string
  memberId?: string
  scopes?: string[]
}

export type AuthProviderType =
  | 'local'
  | 'oidc'
  | 'saml'
  | 'firebase'
  | 'auth0'
  | 'cognito'
  | 'unknown'

export interface AuthProviderSummary {
  id: number
  name: string
  type: AuthProviderType
  isDefault: boolean
  enabled: boolean
}

export interface ServerAuthDiscovery {
  serverName: string
  version: string
  mobileSetupUrl: string
  authStrategy: 'local-only' | 'default-only' | 'user-choice'
  providers: AuthProviderSummary[]
}

// ── IPC ───────────────────────────────────────────────────────────────────────
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
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface AIResponse {
  message: string
  toolCalls?: ToolCall[]
}

// ── Server-side (Remote) API resources ────────────────────────────────────────
// These mirror the SASO server's /api/v1 REST responses. They are intentionally
// separate from the local `Item`/`Category` types above, which model the local
// PLA/paper + color/size variation workflow and are not the same domain object.

// Must match server UpdateItemController status enum.
export type ItemStatus =
  | 'active'
  | 'archived'
  | 'discontinued'
  | 'pending'
  | 'in_storage'
  | 'in_use'
  | 'for_sale'
  | 'reserved'
  | 'shipped'

export interface RemoteItemAttribute {
  key: string
  label: string
  value: string
}

export interface RemoteItem {
  id: number | string
  name: string
  description?: string | null
  categoryId: number | string | null
  categoryName?: string | null
  janCode?: string | null
  isbnCode?: string | null
  labelCode?: string | null
  note?: string | null
  price?: number | null
  stock?: number | null
  status: ItemStatus
  storageLocationId?: number | string | null
  features?: unknown
  registeredAt?: string
  updatedAt?: string
  attributes?: RemoteItemAttribute[]
}

export interface RemoteItemListResponse {
  data: RemoteItem[]
  total: number
  nextCursor: number | null
}

export interface RemoteCategory {
  id: number | string
  name: string
  nameEn?: string | null
  nameJa?: string | null
  parentId: number | string | null
  depth: number
  sortOrder: number
  code?: string | null
  children: RemoteCategory[]
}

export interface RemoteCategoryListResponse {
  data: RemoteCategory[]
  total: number
}

export interface RemoteStorageLocation {
  id: number | string
  parentId: number | string | null
  code: string
  name: string
  locationType: string
  depth: number
  position: number
  operationalStatus: string
  canReceive: boolean
  canShip: boolean
  capacity: number | null
  description: string | null
}

export interface RemoteStorageLocationListResponse {
  data: RemoteStorageLocation[]
  total: number
}

export interface BarcodeLookupResult {
  code: string
  status: string
  item: { id: number | string; name: string } | null
}

export interface RemoteItemCreate {
  name: string
  categoryId: number | string
  janCode?: string | null
  isbnCode?: string | null
  labelCode?: string | null
  note?: string | null
  price?: number | null
  stock?: number | null
}

export type RemoteItemPatch = Partial<RemoteItemCreate & { status: ItemStatus }>

export interface FeatureFlag {
  key: string
  enabled: boolean
  rolloutPercent?: number
  conditions?: unknown
}

export interface MobileConfigBundle {
  version: string
  generatedAt: string
  featureFlags: FeatureFlag[]
}

export interface RemoteItemDraftCreated {
  draft_id: string | number
  status: string
}

// Subset of the JWT claims we surface to the renderer for the
// device-info section. Scopes drive UI gating in addition to the
// fetched feature flags.
export interface DeviceTokenInfo {
  deviceId?: number | string
  deviceName?: string
  expiresAt?: string
  scopes: string[]
  memberId?: string
}

export interface PendingSyncOp {
  id: string
  opType: 'create' | 'update'
  endpoint: string
  method: string
  body: string
  idempotencyKey: string
  createdAt: string
  retryCount: number
  lastError: string | null
  status: 'pending' | 'conflict' | 'failed'
}
