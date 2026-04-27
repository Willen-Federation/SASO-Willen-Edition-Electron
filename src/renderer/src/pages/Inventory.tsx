import { useEffect, useState } from 'react'
import { RefreshCw, ArrowUp, ArrowDown, AlertTriangle, Warehouse } from 'lucide-react'
import { useInventory } from '../stores/useInventory'
import Modal from '../components/Modal'
import type { InventoryItem, StockMovement } from '@shared/types'

const typeLabel: Record<string, string> = {
  in: '入庫',
  out: '出庫',
  adjustment: '調整',
  sale: '販売',
  return: '返品'
}

const typeColor: Record<string, string> = {
  in: 'text-green-600 bg-green-50',
  out: 'text-red-600 bg-red-50',
  adjustment: 'text-yellow-600 bg-yellow-50',
  sale: 'text-blue-600 bg-blue-50',
  return: 'text-purple-600 bg-purple-50'
}

type AdjustType = 'in' | 'out' | 'adjustment'

export default function Inventory() {
  const { inventory, movements, loading, loadInventory, loadMovements, stockIn, stockOut, adjustStock } = useInventory()
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustType, setAdjustType] = useState<AdjustType>('in')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'inventory' | 'movements'>('inventory')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInventory()
    loadMovements()
  }, [])

  const openAdjust = (item: InventoryItem, type: AdjustType) => {
    setSelectedItem(item)
    setAdjustType(type)
    setAdjustQty('')
    setAdjustReason('')
    setError(null)
    setShowAdjust(true)
  }

  const handleAdjust = async () => {
    if (!selectedItem) return
    const qty = parseFloat(adjustQty)
    if (isNaN(qty) || qty === 0) { setError('数量を入力してください'); return }
    if (adjustType !== 'adjustment' && qty < 0) { setError('正の数量を入力してください'); return }
    setSaving(true)
    setError(null)
    let result = null
    if (adjustType === 'in') {
      result = await stockIn(selectedItem.product_id, qty, adjustReason)
    } else if (adjustType === 'out') {
      result = await stockOut(selectedItem.product_id, qty, adjustReason)
    } else {
      // adjustment: user inputs actual quantity as delta
      result = await adjustStock(selectedItem.product_id, qty, 'adjustment', adjustReason)
    }
    setSaving(false)
    if (result) {
      setShowAdjust(false)
      await loadMovements()
    } else {
      setError('操作に失敗しました')
    }
  }

  const stockStatus = (item: InventoryItem) => {
    if (item.quantity <= 0) return 'red'
    if (item.min_stock && item.quantity <= item.min_stock) return 'amber'
    return 'green'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">在庫管理</h2>
        <button onClick={() => { loadInventory(); loadMovements() }} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
          <RefreshCw size={14} />
          更新
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('inventory')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'inventory' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
        >
          在庫一覧
        </button>
        <button
          onClick={() => setTab('movements')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'movements' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
        >
          在庫移動履歴
        </button>
      </div>

      {tab === 'inventory' && (
        <div className="card p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Warehouse size={36} className="mx-auto mb-2 opacity-30" />
              <div>在庫データがありません</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3">商品名</th>
                    <th className="px-4 py-3">バーコード</th>
                    <th className="px-4 py-3 text-right">在庫数</th>
                    <th className="px-4 py-3 text-right">最小在庫</th>
                    <th className="px-4 py-3 text-right">在庫価値</th>
                    <th className="px-4 py-3 text-center">状態</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inventory.map((item) => {
                    const status = stockStatus(item)
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{item.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.product_barcode || '-'}</td>
                        <td className={`px-4 py-3 text-right font-bold ${status === 'red' ? 'text-red-600' : status === 'amber' ? 'text-amber-600' : 'text-gray-900'}`}>
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{item.min_stock ?? 0}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          ¥{((item.price ?? 0) * item.quantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {status === 'red' && (
                            <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                              <AlertTriangle size={12} /> 在庫切れ
                            </span>
                          )}
                          {status === 'amber' && (
                            <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                              <AlertTriangle size={12} /> 在庫不足
                            </span>
                          )}
                          {status === 'green' && (
                            <span className="text-green-600 text-xs">正常</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openAdjust(item, 'in')}
                              className="flex items-center gap-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded"
                            >
                              <ArrowUp size={12} /> 入庫
                            </button>
                            <button
                              onClick={() => openAdjust(item, 'out')}
                              className="flex items-center gap-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 rounded"
                            >
                              <ArrowDown size={12} /> 出庫
                            </button>
                            <button
                              onClick={() => openAdjust(item, 'adjustment')}
                              className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1 rounded"
                            >
                              調整
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'movements' && (
        <div className="card p-0">
          {movements.length === 0 ? (
            <div className="text-center py-12 text-gray-400">在庫移動の記録はありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3">商品</th>
                    <th className="px-4 py-3">種類</th>
                    <th className="px-4 py-3 text-right">数量</th>
                    <th className="px-4 py-3">理由</th>
                    <th className="px-4 py-3">日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {movements.map((m: StockMovement) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{m.product_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${typeColor[m.type]}`}>
                          {typeLabel[m.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{m.quantity}</td>
                      <td className="px-4 py-3 text-gray-500">{m.reason || '-'}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(m.created_at).toLocaleString('ja-JP')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdjust && selectedItem && (
        <Modal
          title={`在庫${adjustType === 'in' ? '入庫' : adjustType === 'out' ? '出庫' : '調整'} - ${selectedItem.product_name}`}
          onClose={() => setShowAdjust(false)}
          size="sm"
        >
          <div className="space-y-4">
            {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {adjustType === 'adjustment' ? '調整数量（正=増加、負=減少）' : '数量'}
              </label>
              <input
                type="number"
                min={adjustType === 'adjustment' ? undefined : '0'}
                step="1"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="input-field"
                autoFocus
                placeholder="数量を入力"
              />
              <div className="text-xs text-gray-500 mt-1">現在の在庫数: {selectedItem.quantity}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">理由（任意）</label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="input-field"
                placeholder="理由を入力"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAdjust(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleAdjust} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? '処理中...' : '実行'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
