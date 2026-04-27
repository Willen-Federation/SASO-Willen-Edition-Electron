import { useEffect, useState } from 'react'
import { Plus, ShoppingCart, CheckCircle, XCircle, Eye, Trash2, Search } from 'lucide-react'
import { useSales } from '../stores/useSales'
import Modal from '../components/Modal'
import BarcodeScanner from '../components/BarcodeScanner'
import type { SalesOrder, SalesOrderItem, Feature, Customer } from '@shared/types'

interface OrderItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount: number
}

const statusLabel: Record<string, string> = { pending: '未完了', completed: '完了', cancelled: 'キャンセル' }
const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500'
}

export default function Sales() {
  const { orders, customers, loading, loadOrders, loadCustomers, createOrder, completeOrder, cancelOrder, createCustomer } = useSales()
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { loadOrders(); loadCustomers() }, [])

  const handleBarcodeScan = async (barcode: string) => {
    const res = await window.api.features.search(barcode)
    if (res.success && res.data && (res.data as Feature[]).length > 0) {
      addFeature((res.data as Feature[])[0])
    } else {
      setError(`バーコード "${barcode}" のバリエーションが見つかりません`)
      setTimeout(() => setError(null), 3000)
    }
  }

  const addFeature = (f: Feature) => {
    const name = `${f.item_name || f.item_id} / ${f.color_name || f.color_code} / ${f.size_name || f.size_code}`
    const price = f.current_price ?? 0
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.product_id === f.full_code)
      if (existing) return prev.map((i) => i.product_id === f.full_code ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product_id: f.full_code, product_name: name, quantity: 1, unit_price: price, discount: 0 }]
    })
  }

  const updateItem = (idx: number, field: keyof OrderItem, value: number) => {
    setOrderItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const removeItem = (idx: number) => setOrderItems((prev) => prev.filter((_, i) => i !== idx))
  const calcSubtotal = () => orderItems.reduce((sum, i) => sum + i.quantity * i.unit_price - i.discount, 0)

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) { setError('商品を追加してください'); return }
    setSaving(true); setError(null)
    const result = await createOrder({
      customer_id: selectedCustomerId || undefined,
      items: orderItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, discount: i.discount })),
      notes: notes || undefined
    })
    setSaving(false)
    if (result) { setShowCreate(false); setOrderItems([]); setSelectedCustomerId(''); setNotes('') }
    else setError('注文作成に失敗しました')
  }

  const handleAddNewCustomer = async () => {
    if (!newCustomerName.trim()) return
    const res = await createCustomer({ name: newCustomerName.trim(), email: null, phone: null, address: null })
    if (res) { setSelectedCustomerId(res.id); setNewCustomerName(''); setShowNewCustomer(false) }
  }

  const handleComplete = async (id: string) => {
    if (!confirm('この注文を完了にしますか？在庫から差し引かれます。')) return
    await completeOrder(id)
  }

  const handleCancel = async (id: string) => {
    if (!confirm('この注文をキャンセルしますか？')) return
    await cancelOrder(id)
  }

  const openView = async (order: SalesOrder) => {
    const res = await window.api.sales.get(order.id)
    if (res.success && res.data) setViewOrder(res.data as SalesOrder)
  }

  const filteredOrders = orders.filter(o =>
    !search || o.id.includes(search) || (o.customer_name || '').includes(search) || statusLabel[o.status].includes(search)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">販売管理</h2>
        <button onClick={() => { setShowCreate(true); setOrderItems([]); setSelectedCustomerId(''); setNotes(''); setError(null) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} />新規販売
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="注文ID・顧客名で検索" className="input-field pl-9" />
        </div>
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShoppingCart size={36} className="mx-auto mb-2 opacity-30" />
            <div>{search ? '検索結果がありません' : '注文がありません'}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3">注文ID</th>
                  <th className="px-4 py-3">顧客</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3 text-right">合計</th>
                  <th className="px-4 py-3">日時</th>
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{o.id.slice(0,8)}</td>
                    <td className="px-4 py-3">{o.customer_name || '一般顧客'}</td>
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[o.status]}`}>{statusLabel[o.status]}</span></td>
                    <td className="px-4 py-3 text-right font-medium">¥{o.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openView(o)} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"><Eye size={14} /></button>
                        {o.status === 'pending' && (<>
                          <button onClick={() => handleComplete(o.id)} className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50"><CheckCircle size={14} /></button>
                          <button onClick={() => handleCancel(o.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"><XCircle size={14} /></button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="新規販売注文" onClose={() => setShowCreate(false)} size="xl">
          <div className="space-y-4">
            {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">顧客</label>
              <div className="flex gap-2">
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="input-field flex-1">
                  <option value="">一般顧客</option>
                  {customers.map((c: Customer) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewCustomer(!showNewCustomer)} className="btn-secondary text-sm px-3">+ 新規</button>
              </div>
              {showNewCustomer && (
                <div className="mt-2 flex gap-2">
                  <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="顧客名" className="input-field flex-1" onKeyDown={(e) => e.key === 'Enter' && handleAddNewCustomer()} />
                  <button onClick={handleAddNewCustomer} className="btn-primary text-sm px-3">追加</button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商品追加</label>
              <BarcodeScanner onScan={handleBarcodeScan} placeholder="バーコードをスキャンして商品追加" />
            </div>
            {orderItems.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500"><th className="px-3 py-2 text-left">商品名</th><th className="px-3 py-2 text-right w-24">単価</th><th className="px-3 py-2 text-right w-20">数量</th><th className="px-3 py-2 text-right w-24">割引</th><th className="px-3 py-2 text-right w-24">小計</th><th className="px-3 py-2 w-8"></th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {orderItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-medium">{item.product_name}</td>
                        <td className="px-3 py-2"><input type="number" min="0" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value)||0)} className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm" /></td>
                        <td className="px-3 py-2"><input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value)||1)} className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm" /></td>
                        <td className="px-3 py-2"><input type="number" min="0" value={item.discount} onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value)||0)} className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm" /></td>
                        <td className="px-3 py-2 text-right font-medium">¥{(item.quantity*item.unit_price-item.discount).toLocaleString()}</td>
                        <td className="px-3 py-2"><button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 bg-gray-50 flex justify-end gap-6 text-sm font-medium">
                  <span className="text-gray-500">小計: ¥{calcSubtotal().toLocaleString()}</span>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows={2} placeholder="備考・メモ" />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleCreateOrder} disabled={saving || orderItems.length===0} className="btn-primary disabled:opacity-50">{saving ? '作成中...' : '注文を作成'}</button>
            </div>
          </div>
        </Modal>
      )}

      {viewOrder && (
        <Modal title={`注文詳細 #${viewOrder.id.slice(0,8)}`} onClose={() => setViewOrder(null)} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">顧客: </span><span className="font-medium">{viewOrder.customer_name || '一般顧客'}</span></div>
              <div><span className="text-gray-500">ステータス: </span><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[viewOrder.status]}`}>{statusLabel[viewOrder.status]}</span></div>
              <div><span className="text-gray-500">日時: </span>{new Date(viewOrder.created_at).toLocaleString('ja-JP')}</div>
            </div>
            {viewOrder.items && viewOrder.items.length > 0 && (
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead><tr className="bg-gray-50 text-gray-500"><th className="px-3 py-2 text-left">商品</th><th className="px-3 py-2 text-right">単価</th><th className="px-3 py-2 text-right">数量</th><th className="px-3 py-2 text-right">小計</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {viewOrder.items.map((item: SalesOrderItem) => (
                    <tr key={item.id}><td className="px-3 py-2">{item.product_name}</td><td className="px-3 py-2 text-right">¥{item.unit_price.toLocaleString()}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2 text-right font-medium">¥{item.total.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex flex-col items-end gap-1 text-sm">
              <div><span className="text-gray-500">小計: </span>¥{viewOrder.subtotal.toLocaleString()}</div>
              <div><span className="text-gray-500">消費税: </span>¥{viewOrder.tax.toLocaleString()}</div>
              <div className="text-lg font-bold"><span className="text-gray-500 text-sm font-normal">合計: </span>¥{viewOrder.total.toLocaleString()}</div>
            </div>
            {viewOrder.status === 'pending' && (
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => { handleCancel(viewOrder.id); setViewOrder(null) }} className="btn-danger text-sm">キャンセル</button>
                <button onClick={() => { handleComplete(viewOrder.id); setViewOrder(null) }} className="btn-primary text-sm">注文完了</button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
