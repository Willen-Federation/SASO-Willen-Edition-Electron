import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type {
  Product,
  Category,
  InventoryItem,
  StockMovement,
  Customer,
  SalesOrder,
  SalesOrderItem
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

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT REFERENCES categories(id),
    price REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '個',
    min_stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity REAL NOT NULL DEFAULT 0,
    location TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(product_id)
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    type TEXT NOT NULL CHECK(type IN ('in','out','adjustment','sale','return')),
    quantity REAL NOT NULL,
    reason TEXT,
    reference_id TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    product_id TEXT NOT NULL REFERENCES products(id),
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
insertDefaultSetting.run('authServerUrl', '')
insertDefaultSetting.run('authClientId', '')
insertDefaultSetting.run('aiProvider', 'claude')
insertDefaultSetting.run('claudeModel', 'claude-opus-4-5')
insertDefaultSetting.run('openaiModel', 'gpt-4o')
insertDefaultSetting.run('geminiModel', 'gemini-1.5-pro')
insertDefaultSetting.run('defaultLabelSize', '58mm')

// ── Products ──────────────────────────────────────────────────────────────────

export function getProducts(): Product[] {
  return db
    .prepare(
      `SELECT p.*, c.name as category_name, COALESCE(i.quantity, 0) as current_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN inventory i ON p.id = i.product_id
       ORDER BY p.name`
    )
    .all() as Product[]
}

export function getProductById(id: string): Product | null {
  return (
    (db
      .prepare(
        `SELECT p.*, c.name as category_name, COALESCE(i.quantity, 0) as current_stock
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN inventory i ON p.id = i.product_id
         WHERE p.id = ?`
      )
      .get(id) as Product) || null
  )
}

export function getProductByBarcode(barcode: string): Product | null {
  return (
    (db
      .prepare(
        `SELECT p.*, c.name as category_name, COALESCE(i.quantity, 0) as current_stock
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN inventory i ON p.id = i.product_id
         WHERE p.barcode = ?`
      )
      .get(barcode) as Product) || null
  )
}

export function searchProducts(query: string): Product[] {
  const q = `%${query}%`
  return db
    .prepare(
      `SELECT p.*, c.name as category_name, COALESCE(i.quantity, 0) as current_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN inventory i ON p.id = i.product_id
       WHERE p.name LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?
       ORDER BY p.name`
    )
    .all(q, q, q) as Product[]
}

export function createProduct(
  data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'current_stock' | 'category_name'>
): Product {
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO products (id, barcode, name, description, category_id, price, cost, unit, min_stock, image_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.barcode || null,
    data.name,
    data.description || null,
    data.category_id || null,
    data.price,
    data.cost,
    data.unit || '個',
    data.min_stock || 0,
    data.image_url || null,
    now,
    now
  )
  // Create inventory record
  db.prepare(
    'INSERT INTO inventory (id, product_id, quantity, updated_at) VALUES (?, ?, 0, ?)'
  ).run(uuidv4(), id, now)

  return getProductById(id)!
}

export function updateProduct(
  id: string,
  data: Partial<Omit<Product, 'id' | 'created_at' | 'current_stock' | 'category_name'>>
): Product | null {
  const now = new Date().toISOString()
  const existing = getProductById(id)
  if (!existing) return null

  db.prepare(
    `UPDATE products SET
      barcode = ?, name = ?, description = ?, category_id = ?,
      price = ?, cost = ?, unit = ?, min_stock = ?, image_url = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    data.barcode !== undefined ? data.barcode : existing.barcode,
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.category_id !== undefined ? data.category_id : existing.category_id,
    data.price !== undefined ? data.price : existing.price,
    data.cost !== undefined ? data.cost : existing.cost,
    data.unit !== undefined ? data.unit : existing.unit,
    data.min_stock !== undefined ? data.min_stock : existing.min_stock,
    data.image_url !== undefined ? data.image_url : existing.image_url,
    now,
    id
  )
  return getProductById(id)
}

export function deleteProduct(id: string): boolean {
  const usage = db
    .prepare('SELECT COUNT(*) as cnt FROM sales_order_items WHERE product_id = ?')
    .get(id) as { cnt: number }
  if (usage.cnt > 0) throw new Error('この商品は注文で使用されているため削除できません')
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id)
  return result.changes > 0
}

// ── Categories ────────────────────────────────────────────────────────────────

export function getCategories(): Category[] {
  return db
    .prepare('SELECT * FROM categories ORDER BY name')
    .all() as Category[]
}

export function createCategory(name: string, parent_id?: string): Category {
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO categories (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    parent_id || null,
    now
  )
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export function getInventory(): InventoryItem[] {
  return db
    .prepare(
      `SELECT i.*, p.name as product_name, p.barcode as product_barcode,
              p.min_stock, p.price
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       ORDER BY p.name`
    )
    .all() as InventoryItem[]
}

export function getInventoryByProductId(productId: string): InventoryItem | null {
  return (
    (db
      .prepare(
        `SELECT i.*, p.name as product_name, p.barcode as product_barcode, p.min_stock, p.price
         FROM inventory i
         JOIN products p ON i.product_id = p.id
         WHERE i.product_id = ?`
      )
      .get(productId) as InventoryItem) || null
  )
}

export function adjustStock(
  productId: string,
  quantity: number,
  type: StockMovement['type'],
  reason?: string,
  referenceId?: string,
  createdBy?: string
): InventoryItem {
  const now = new Date().toISOString()

  // Update or create inventory record
  const existing = db
    .prepare('SELECT * FROM inventory WHERE product_id = ?')
    .get(productId) as InventoryItem | undefined

  if (existing) {
    db.prepare(
      'UPDATE inventory SET quantity = quantity + ?, updated_at = ? WHERE product_id = ?'
    ).run(quantity, now, productId)
  } else {
    db.prepare(
      'INSERT INTO inventory (id, product_id, quantity, updated_at) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), productId, quantity, now)
  }

  // Record movement
  db.prepare(
    `INSERT INTO stock_movements (id, product_id, type, quantity, reason, reference_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    productId,
    type,
    Math.abs(quantity),
    reason || null,
    referenceId || null,
    createdBy || null,
    now
  )

  return getInventoryByProductId(productId)!
}

export function getStockMovements(productId?: string): StockMovement[] {
  if (productId) {
    return db
      .prepare(
        `SELECT sm.*, p.name as product_name
         FROM stock_movements sm
         JOIN products p ON sm.product_id = p.id
         WHERE sm.product_id = ?
         ORDER BY sm.created_at DESC
         LIMIT 200`
      )
      .all(productId) as StockMovement[]
  }
  return db
    .prepare(
      `SELECT sm.*, p.name as product_name
       FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       ORDER BY sm.created_at DESC
       LIMIT 200`
    )
    .all() as StockMovement[]
}

// ── Customers ─────────────────────────────────────────────────────────────────

export function getCustomers(): Customer[] {
  return db.prepare('SELECT * FROM customers ORDER BY name').all() as Customer[]
}

export function getCustomerById(id: string): Customer | null {
  return (db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer) || null
}

export function createCustomer(
  data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>
): Customer {
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO customers (id, name, email, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, data.name, data.email || null, data.phone || null, data.address || null, now, now)
  return getCustomerById(id)!
}

export function updateCustomer(
  id: string,
  data: Partial<Omit<Customer, 'id' | 'created_at'>>
): Customer | null {
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
  return db
    .prepare(
      `SELECT so.*, c.name as customer_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       ORDER BY so.created_at DESC`
    )
    .all() as SalesOrder[]
}

export function getOrderById(id: string): SalesOrder | null {
  const order = (db
    .prepare(
      `SELECT so.*, c.name as customer_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.id = ?`
    )
    .get(id) as SalesOrder) || null
  if (!order) return null

  order.items = db
    .prepare(
      `SELECT soi.*, p.name as product_name, p.barcode as product_barcode
       FROM sales_order_items soi
       JOIN products p ON soi.product_id = p.id
       WHERE soi.order_id = ?`
    )
    .all(id) as SalesOrderItem[]

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
  ).run(
    id,
    data.customer_id || null,
    subtotal,
    tax,
    total,
    data.notes || null,
    data.created_by || null,
    now,
    now
  )

  for (const item of itemsToInsert) {
    db.prepare(
      'INSERT INTO sales_order_items (id, order_id, product_id, quantity, unit_price, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(item.id, id, item.product_id, item.quantity, item.unit_price, item.discount, item.total)
  }

  return getOrderById(id)!
}

export function updateOrderStatus(
  id: string,
  status: SalesOrder['status']
): SalesOrder | null {
  const now = new Date().toISOString()
  db.prepare('UPDATE sales_orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
  return getOrderById(id)
}

export function completeOrder(id: string, createdBy?: string): SalesOrder | null {
  const order = getOrderById(id)
  if (!order) return null
  if (order.status !== 'pending') throw new Error('この注文は既に処理されています')

  const completeTransaction = db.transaction(() => {
    db.prepare(
      "UPDATE sales_orders SET status = 'completed', updated_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), id)

    for (const item of order.items || []) {
      adjustStock(
        item.product_id,
        -item.quantity,
        'sale',
        `販売注文 #${id.slice(0, 8)}`,
        id,
        createdBy
      )
    }
  })

  completeTransaction()
  return getOrderById(id)
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getDashboardStats() {
  const totalProducts = (
    db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }
  ).cnt

  const totalCategories = (
    db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number }
  ).cnt

  const totalCustomers = (
    db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as { cnt: number }
  ).cnt

  const totalInventoryValue = (
    db
      .prepare(
        `SELECT COALESCE(SUM(i.quantity * p.price), 0) as val
         FROM inventory i JOIN products p ON i.product_id = p.id`
      )
      .get() as { val: number }
  ).val

  const lowStockCount = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM inventory i
         JOIN products p ON i.product_id = p.id
         WHERE i.quantity <= p.min_stock`
      )
      .get() as { cnt: number }
  ).cnt

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStr = todayStart.toISOString()

  const todayStats = db
    .prepare(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as rev
       FROM sales_orders
       WHERE status = 'completed' AND created_at >= ?`
    )
    .get(todayStr) as { cnt: number; rev: number }

  const recentMovements = db
    .prepare(
      `SELECT sm.*, p.name as product_name
       FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       ORDER BY sm.created_at DESC
       LIMIT 10`
    )
    .all() as StockMovement[]

  return {
    totalProducts,
    totalCategories,
    totalCustomers,
    totalInventoryValue,
    lowStockCount,
    todaySales: todayStats.cnt,
    todayRevenue: todayStats.rev,
    recentMovements
  }
}
