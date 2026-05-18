import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
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
  SalesOrderItem,
  DashboardStats
} from '../../shared/types'

const dbPath = join(app.getPath('userData'), 'saso.db')
export const db: DatabaseType = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES categories(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    serial TEXT,
    name TEXT NOT NULL,
    pla INTEGER NOT NULL DEFAULT 0,
    pla_note TEXT,
    paper INTEGER NOT NULL DEFAULT 0,
    paper_note TEXT,
    date_code TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS colors (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    image_type TEXT,
    UNIQUE(item_id, code)
  );

  CREATE TABLE IF NOT EXISTS sizes (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    order_number INTEGER NOT NULL DEFAULT 0,
    UNIQUE(item_id, code)
  );

  CREATE TABLE IF NOT EXISTS features (
    full_code TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    color_code TEXT NOT NULL,
    size_code TEXT NOT NULL,
    shelf_number TEXT,
    label_amount INTEGER
  );

  CREATE TABLE IF NOT EXISTS item_vars (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    category_id INTEGER,
    price INTEGER,
    update_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quantity_logs (
    id TEXT PRIMARY KEY,
    full_code TEXT NOT NULL REFERENCES features(full_code) ON DELETE CASCADE,
    fluctuation INTEGER NOT NULL,
    is_inventory INTEGER NOT NULL DEFAULT 0,
    change_at TEXT NOT NULL,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS label_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    margin_top REAL NOT NULL DEFAULT 10,
    margin_left REAL NOT NULL DEFAULT 10,
    width REAL NOT NULL DEFAULT 58,
    height REAL NOT NULL DEFAULT 40,
    interval_column REAL NOT NULL DEFAULT 2,
    interval_row REAL NOT NULL DEFAULT 2,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales_orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// Insert default settings if not exists
const insertDefaultSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
)
insertDefaultSetting.run('taxRate', '10')
insertDefaultSetting.run('currency', 'JPY')
insertDefaultSetting.run('language', 'ja')
// sasoServerUrl is intentionally left unset on first launch so the
// onboarding flow asks the user to type or scan it instead of silently
// pre-filling a value that points at the wrong server.
insertDefaultSetting.run('aiProvider', 'claude')
insertDefaultSetting.run('claudeModel', 'claude-opus-4-5')
insertDefaultSetting.run('openaiModel', 'gpt-4o')
insertDefaultSetting.run('geminiModel', 'gemini-1.5-pro')
insertDefaultSetting.run('defaultLabelSize', '58mm')

// ── Helpers ───────────────────────────────────────────────────────────────────

export function generateItemId(): string {
  const ts = Date.now() % 100000000
  return String(ts).padStart(8, '0')
}

export function generateDateCode(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

// ── Items ─────────────────────────────────────────────────────────────────────

function rowToItem(row: Record<string, unknown>): Item {
  return {
    id: row.id as string,
    serial: row.serial as string | null,
    name: row.name as string,
    pla: Boolean(row.pla),
    pla_note: row.pla_note as string | null,
    paper: Boolean(row.paper),
    paper_note: row.paper_note as string | null,
    date_code: row.date_code as string,
    created_at: row.created_at as string
  }
}

export function listItems(): Item[] {
  const rows = db.prepare('SELECT * FROM items ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToItem)
}

export function getItem(id: string): Item | null {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? rowToItem(row) : null
}

export function createItem(data: Omit<Item, 'id' | 'date_code' | 'created_at'>): Item {
  const id = generateItemId()
  const date_code = generateDateCode()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO items (id, serial, name, pla, pla_note, paper, paper_note, date_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.serial || null,
    data.name,
    data.pla ? 1 : 0,
    data.pla_note || null,
    data.paper ? 1 : 0,
    data.paper_note || null,
    date_code,
    now
  )
  return getItem(id)!
}

export function updateItem(id: string, data: Partial<Omit<Item, 'id' | 'date_code' | 'created_at'>>): Item | null {
  const existing = getItem(id)
  if (!existing) return null
  db.prepare(
    `UPDATE items SET
      serial = ?, name = ?, pla = ?, pla_note = ?, paper = ?, paper_note = ?
     WHERE id = ?`
  ).run(
    data.serial !== undefined ? data.serial : existing.serial,
    data.name !== undefined ? data.name : existing.name,
    data.pla !== undefined ? (data.pla ? 1 : 0) : (existing.pla ? 1 : 0),
    data.pla_note !== undefined ? data.pla_note : existing.pla_note,
    data.paper !== undefined ? (data.paper ? 1 : 0) : (existing.paper ? 1 : 0),
    data.paper_note !== undefined ? data.paper_note : existing.paper_note,
    id
  )
  return getItem(id)
}

export function deleteItem(id: string): boolean {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(id)
  return result.changes > 0
}

export function searchItems(query: string): Item[] {
  const q = `%${query}%`
  const rows = db.prepare(
    `SELECT * FROM items WHERE name LIKE ? OR serial LIKE ? OR id LIKE ? ORDER BY created_at DESC`
  ).all(q, q, q) as Record<string, unknown>[]
  return rows.map(rowToItem)
}

// ── Colors ────────────────────────────────────────────────────────────────────

export function listColors(itemId: string): Color[] {
  return db.prepare('SELECT * FROM colors WHERE item_id = ? ORDER BY code').all(itemId) as Color[]
}

export function createColor(data: Omit<Color, 'id'>): Color {
  const id = uuidv4()
  db.prepare(
    'INSERT INTO colors (id, item_id, code, name, image_type) VALUES (?, ?, ?, ?, ?)'
  ).run(id, data.item_id, data.code, data.name, data.image_type || null)
  return db.prepare('SELECT * FROM colors WHERE id = ?').get(id) as Color
}

export function updateColor(id: string, data: Partial<Omit<Color, 'id' | 'item_id'>>): Color | null {
  const existing = db.prepare('SELECT * FROM colors WHERE id = ?').get(id) as Color | undefined
  if (!existing) return null
  db.prepare(
    'UPDATE colors SET code = ?, name = ?, image_type = ? WHERE id = ?'
  ).run(
    data.code !== undefined ? data.code : existing.code,
    data.name !== undefined ? data.name : existing.name,
    data.image_type !== undefined ? data.image_type : existing.image_type,
    id
  )
  return db.prepare('SELECT * FROM colors WHERE id = ?').get(id) as Color
}

export function deleteColor(id: string): boolean {
  const result = db.prepare('DELETE FROM colors WHERE id = ?').run(id)
  return result.changes > 0
}

// ── Sizes ─────────────────────────────────────────────────────────────────────

export function listSizes(itemId: string): Size[] {
  return db.prepare('SELECT * FROM sizes WHERE item_id = ? ORDER BY order_number, code').all(itemId) as Size[]
}

export function createSize(data: Omit<Size, 'id'>): Size {
  const id = uuidv4()
  db.prepare(
    'INSERT INTO sizes (id, item_id, code, name, order_number) VALUES (?, ?, ?, ?, ?)'
  ).run(id, data.item_id, data.code, data.name, data.order_number ?? 0)
  return db.prepare('SELECT * FROM sizes WHERE id = ?').get(id) as Size
}

export function updateSize(id: string, data: Partial<Omit<Size, 'id' | 'item_id'>>): Size | null {
  const existing = db.prepare('SELECT * FROM sizes WHERE id = ?').get(id) as Size | undefined
  if (!existing) return null
  db.prepare(
    'UPDATE sizes SET code = ?, name = ?, order_number = ? WHERE id = ?'
  ).run(
    data.code !== undefined ? data.code : existing.code,
    data.name !== undefined ? data.name : existing.name,
    data.order_number !== undefined ? data.order_number : existing.order_number,
    id
  )
  return db.prepare('SELECT * FROM sizes WHERE id = ?').get(id) as Size
}

export function deleteSize(id: string): boolean {
  const result = db.prepare('DELETE FROM sizes WHERE id = ?').run(id)
  return result.changes > 0
}

// ── Features ──────────────────────────────────────────────────────────────────

function buildFeatureQuery(whereClause: string): string {
  return `
    SELECT f.*,
           i.name as item_name,
           c.name as color_name,
           s.name as size_name,
           (SELECT iv.price FROM item_vars iv WHERE iv.item_id = f.item_id ORDER BY iv.update_at DESC LIMIT 1) as current_price,
           COALESCE((SELECT SUM(ql.fluctuation) FROM quantity_logs ql WHERE ql.full_code = f.full_code), 0) as current_quantity
    FROM features f
    JOIN items i ON f.item_id = i.id
    JOIN colors c ON c.item_id = f.item_id AND c.code = f.color_code
    JOIN sizes s ON s.item_id = f.item_id AND s.code = f.size_code
    ${whereClause}
  `
}

export function listFeatures(itemId?: string): Feature[] {
  if (itemId) {
    return db.prepare(buildFeatureQuery('WHERE f.item_id = ?')).all(itemId) as Feature[]
  }
  return db.prepare(buildFeatureQuery('')).all() as Feature[]
}

export function getFeature(fullCode: string): Feature | null {
  return (db.prepare(buildFeatureQuery('WHERE f.full_code = ?')).get(fullCode) as Feature) || null
}

export function createFeature(itemId: string, colorCode: string, sizeCode: string): Feature {
  const full_code = `${itemId}${colorCode}${sizeCode}`
  db.prepare(
    'INSERT OR IGNORE INTO features (full_code, item_id, color_code, size_code) VALUES (?, ?, ?, ?)'
  ).run(full_code, itemId, colorCode, sizeCode)
  return getFeature(full_code)!
}

export function updateFeatureShelf(fullCode: string, shelfNumber: string | null): Feature | null {
  db.prepare('UPDATE features SET shelf_number = ? WHERE full_code = ?').run(shelfNumber, fullCode)
  return getFeature(fullCode)
}

export function deleteFeature(fullCode: string): boolean {
  const result = db.prepare('DELETE FROM features WHERE full_code = ?').run(fullCode)
  return result.changes > 0
}

export function getFeatureCurrentQuantity(fullCode: string): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(fluctuation), 0) as qty FROM quantity_logs WHERE full_code = ?'
  ).get(fullCode) as { qty: number }
  return row.qty
}

export function searchFeaturesByBarcode(barcode: string): Feature[] {
  const exact = getFeature(barcode)
  if (exact) return [exact]
  const q = `${barcode}%`
  return db.prepare(buildFeatureQuery('WHERE f.full_code LIKE ?')).all(q) as Feature[]
}

// ── ItemVars ──────────────────────────────────────────────────────────────────

export function getLatestItemVar(itemId: string): ItemVar | null {
  return (
    (db.prepare(
      'SELECT * FROM item_vars WHERE item_id = ? ORDER BY update_at DESC LIMIT 1'
    ).get(itemId) as ItemVar) || null
  )
}

export function createItemVar(data: Omit<ItemVar, 'id' | 'update_at'>): ItemVar {
  const id = uuidv4()
  const update_at = new Date().toISOString()
  db.prepare(
    'INSERT INTO item_vars (id, item_id, category_id, price, update_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, data.item_id, data.category_id ?? null, data.price ?? null, update_at)
  return db.prepare('SELECT * FROM item_vars WHERE id = ?').get(id) as ItemVar
}

// ── QuantityLogs ──────────────────────────────────────────────────────────────

function rowToQuantityLog(row: Record<string, unknown>): QuantityLog {
  return {
    id: row.id as string,
    full_code: row.full_code as string,
    fluctuation: row.fluctuation as number,
    is_inventory: Boolean(row.is_inventory),
    change_at: row.change_at as string,
    reason: row.reason as string | null
  }
}

export function listQuantityLogs(fullCode?: string): QuantityLog[] {
  if (fullCode) {
    const rows = db.prepare(
      'SELECT * FROM quantity_logs WHERE full_code = ? ORDER BY change_at DESC LIMIT 200'
    ).all(fullCode) as Record<string, unknown>[]
    return rows.map(rowToQuantityLog)
  }
  const rows = db.prepare(
    'SELECT * FROM quantity_logs ORDER BY change_at DESC LIMIT 200'
  ).all() as Record<string, unknown>[]
  return rows.map(rowToQuantityLog)
}

export function addStockIn(fullCode: string, quantity: number, reason?: string): QuantityLog {
  const id = uuidv4()
  const change_at = new Date().toISOString()
  db.prepare(
    'INSERT INTO quantity_logs (id, full_code, fluctuation, is_inventory, change_at, reason) VALUES (?, ?, ?, 0, ?, ?)'
  ).run(id, fullCode, Math.abs(quantity), change_at, reason || null)
  return rowToQuantityLog(db.prepare('SELECT * FROM quantity_logs WHERE id = ?').get(id) as Record<string, unknown>)
}

export function addShipment(fullCode: string, quantity: number, reason?: string): QuantityLog {
  const id = uuidv4()
  const change_at = new Date().toISOString()
  db.prepare(
    'INSERT INTO quantity_logs (id, full_code, fluctuation, is_inventory, change_at, reason) VALUES (?, ?, ?, 0, ?, ?)'
  ).run(id, fullCode, -Math.abs(quantity), change_at, reason || null)
  return rowToQuantityLog(db.prepare('SELECT * FROM quantity_logs WHERE id = ?').get(id) as Record<string, unknown>)
}

export function doInventoryCount(fullCode: string, actualQuantity: number, reason?: string): QuantityLog {
  const current = getFeatureCurrentQuantity(fullCode)
  const delta = actualQuantity - current
  const id = uuidv4()
  const change_at = new Date().toISOString()
  db.prepare(
    'INSERT INTO quantity_logs (id, full_code, fluctuation, is_inventory, change_at, reason) VALUES (?, ?, ?, 1, ?, ?)'
  ).run(id, fullCode, delta, change_at, reason || null)
  return rowToQuantityLog(db.prepare('SELECT * FROM quantity_logs WHERE id = ?').get(id) as Record<string, unknown>)
}

// ── LabelTemplates ────────────────────────────────────────────────────────────

export function listLabelTemplates(): LabelTemplate[] {
  return db.prepare('SELECT * FROM label_templates ORDER BY name').all() as LabelTemplate[]
}

export function createLabelTemplate(data: Omit<LabelTemplate, 'id' | 'created_at'>): LabelTemplate {
  const id = uuidv4()
  const created_at = new Date().toISOString()
  db.prepare(
    `INSERT INTO label_templates (id, name, margin_top, margin_left, width, height, interval_column, interval_row, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, data.name, data.margin_top, data.margin_left,
    data.width, data.height, data.interval_column, data.interval_row, created_at
  )
  return db.prepare('SELECT * FROM label_templates WHERE id = ?').get(id) as LabelTemplate
}

export function updateLabelTemplate(id: string, data: Partial<Omit<LabelTemplate, 'id' | 'created_at'>>): LabelTemplate | null {
  const existing = db.prepare('SELECT * FROM label_templates WHERE id = ?').get(id) as LabelTemplate | undefined
  if (!existing) return null
  db.prepare(
    `UPDATE label_templates SET
      name = ?, margin_top = ?, margin_left = ?, width = ?, height = ?, interval_column = ?, interval_row = ?
     WHERE id = ?`
  ).run(
    data.name ?? existing.name,
    data.margin_top ?? existing.margin_top,
    data.margin_left ?? existing.margin_left,
    data.width ?? existing.width,
    data.height ?? existing.height,
    data.interval_column ?? existing.interval_column,
    data.interval_row ?? existing.interval_row,
    id
  )
  return db.prepare('SELECT * FROM label_templates WHERE id = ?').get(id) as LabelTemplate
}

export function deleteLabelTemplate(id: string): boolean {
  const result = db.prepare('DELETE FROM label_templates WHERE id = ?').run(id)
  return result.changes > 0
}

// ── Categories ────────────────────────────────────────────────────────────────

export function getCategories(): Category[] {
  return db.prepare('SELECT * FROM categories ORDER BY name').all() as Category[]
}

export function createCategory(name: string, parent_id?: string): Category {
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO categories (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)').run(
    id, name, parent_id || null, now
  )
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
}

// ── Customers ─────────────────────────────────────────────────────────────────

export function getCustomers(): Customer[] {
  return db.prepare('SELECT * FROM customers ORDER BY name').all() as Customer[]
}

export function getCustomerById(id: string): Customer | null {
  return (db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer) || null
}

export function createCustomer(data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Customer {
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO customers (id, name, email, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, data.name, data.email || null, data.phone || null, data.address || null, now, now)
  return getCustomerById(id)!
}

export function updateCustomer(id: string, data: Partial<Omit<Customer, 'id' | 'created_at'>>): Customer | null {
  const now = new Date().toISOString()
  const existing = getCustomerById(id)
  if (!existing) return null
  db.prepare(
    'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?'
  ).run(
    data.name ?? existing.name,
    data.email !== undefined ? data.email : existing.email,
    data.phone !== undefined ? data.phone : existing.phone,
    data.address !== undefined ? data.address : existing.address,
    now,
    id
  )
  return getCustomerById(id)
}

// ── Sales Orders ──────────────────────────────────────────────────────────────

export function getOrders(): SalesOrder[] {
  return db.prepare(
    `SELECT so.*, c.name as customer_name
     FROM sales_orders so
     LEFT JOIN customers c ON so.customer_id = c.id
     ORDER BY so.created_at DESC`
  ).all() as SalesOrder[]
}

export function getOrderById(id: string): SalesOrder | null {
  const order = (db.prepare(
    `SELECT so.*, c.name as customer_name
     FROM sales_orders so
     LEFT JOIN customers c ON so.customer_id = c.id
     WHERE so.id = ?`
  ).get(id) as SalesOrder) || null
  if (!order) return null

  order.items = db.prepare(
    `SELECT * FROM sales_order_items WHERE order_id = ?`
  ).all(id) as SalesOrderItem[]

  return order
}

export function createOrder(data: {
  customer_id?: string
  items: { product_id: string; quantity: number; unit_price: number; discount?: number }[]
  notes?: string
  created_by?: string
  taxRate?: number
}): SalesOrder {
  const id = uuidv4()
  const now = new Date().toISOString()
  const taxRate = data.taxRate ?? 10

  let subtotal = 0
  const itemsToInsert = data.items.map((item) => {
    const discount = item.discount ?? 0
    const total = item.quantity * item.unit_price - discount
    subtotal += total
    return { ...item, id: uuidv4(), discount, total }
  })

  const tax = Math.round(subtotal * (taxRate / 100))
  const total = subtotal + tax

  db.prepare(
    `INSERT INTO sales_orders (id, customer_id, status, subtotal, tax, discount, total, notes, created_by, created_at, updated_at)
     VALUES (?, ?, 'pending', ?, ?, 0, ?, ?, ?, ?, ?)`
  ).run(id, data.customer_id || null, subtotal, tax, total, data.notes || null, data.created_by || null, now, now)

  for (const item of itemsToInsert) {
    db.prepare(
      'INSERT INTO sales_order_items (id, order_id, product_id, quantity, unit_price, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(item.id, id, item.product_id, item.quantity, item.unit_price, item.discount, item.total)
  }

  return getOrderById(id)!
}

export function updateOrderStatus(id: string, status: SalesOrder['status']): SalesOrder | null {
  const now = new Date().toISOString()
  db.prepare('UPDATE sales_orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
  return getOrderById(id)
}

export function completeOrder(id: string): SalesOrder | null {
  const order = getOrderById(id)
  if (!order) return null
  if (order.status !== 'pending') throw new Error('この注文は既に処理されています')
  db.prepare("UPDATE sales_orders SET status = 'completed', updated_at = ? WHERE id = ?").run(
    new Date().toISOString(), id
  )
  return getOrderById(id)
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getDashboardStats(): DashboardStats {
  const totalItems = (
    db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number }
  ).cnt

  const totalFeatures = (
    db.prepare('SELECT COUNT(*) as cnt FROM features').get() as { cnt: number }
  ).cnt

  const totalCategories = (
    db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number }
  ).cnt

  const totalCustomers = (
    db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as { cnt: number }
  ).cnt

  const lowStockCount = (
    db.prepare(
      `SELECT COUNT(*) as cnt FROM (
         SELECT full_code, COALESCE(SUM(fluctuation), 0) as qty
         FROM quantity_logs
         GROUP BY full_code
         HAVING qty <= 0
       ) sub`
    ).get() as { cnt: number }
  ).cnt

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStr = todayStart.toISOString()

  const todayStats = db.prepare(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as rev
     FROM sales_orders
     WHERE status = 'completed' AND created_at >= ?`
  ).get(todayStr) as { cnt: number; rev: number }

  const recentLogRows = db.prepare(
    'SELECT * FROM quantity_logs ORDER BY change_at DESC LIMIT 10'
  ).all() as Record<string, unknown>[]
  const recentLogs = recentLogRows.map(rowToQuantityLog)

  return {
    totalItems,
    totalFeatures,
    totalCategories,
    totalCustomers,
    lowStockCount,
    todaySales: todayStats.cnt,
    todayRevenue: todayStats.rev,
    recentLogs
  }
}
