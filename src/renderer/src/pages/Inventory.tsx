import { useEffect, useState } from 'react'
import { RefreshCw, ArrowUp, ArrowDown, ClipboardList, Warehouse, Search } from 'lucide-react'
import { useQuantityLogs } from '../stores/useQuantityLogs'
import Modal from '../components/Modal'
import BarcodeScanner from '../components/BarcodeScanner'
import type { Feature, QuantityLog } from '@shared/types'

type ActionType = 'stockIn' | 'shipment' | 'inventory'

export default function Inventory() {
  const { logs, quantities, loading, loadLogs, loadQuantity, stockIn, shipment, inventoryCount } = useQuantityLogs()

  const [features, setFeatures] = useState<Feature[]>([])
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [filterItem, setFilterItem] = useState('')
  const [search, setSearch] = useState('')

  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [showAction, setShowAction] = useState(false)
  const [actionType, setActionType] = useState<ActionType>('stockIn')
  const [actionQty, setActionQty] = useState('')
  const [actionReason, setActionReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [tab, setTab] = useState<'features' | 'logs'>('features')

  useEffect(() => {
    loadAllFeatures()
    loadLogs()
  }, [])

  const loadAllFeatures = async () => {
    setFeaturesLoading(true)
    try {
      const result = await window.api.features.list()
      if (result.success && result.data) {
        const featureList = result.data as Feature[]
        setFeatures(featureList)
        // Load quantities
        for (const f of featureList) {
          if (f.current_quantity === undefined) {
            loadQuantity(f.full_code)
          }
        }
      }
    } finally {
      setFeaturesLoading(false)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([loadAllFeatures(), loadLogs()])
  }

  const openAction = (feature: Feature, type: ActionType) => {
    setSelectedFeature(feature)
    setActionType(type)
    setActionQty('')
    setActionReason('')
    setActionError(null)
    setShowAction(true)
  }

  const handleAction = async () => {
    if (!selectedFeature) return
    const qty = parseInt(actionQty)
    if (isNaN(qty) || qty <= 0) { setActionError('正の数量を入力してください'); return }
    setSaving(true)
    setActionError(null)

    let result = null
    if (actionType === 'stockIn') {
      result = await stockIn(selectedFeature.full_code, qty, actionReason)
    } else if (actionType === 'shipment') {
      result = await shipment(selectedFeature.full_code, qty, actionReason)
    } else {
      result = await inventoryCount(selectedFeature.full_code, qty, actionReason)
    }

    setSaving(false)
    if (result) {
      setShowAction(false)
      // Refresh quantities
      await loadQuantity(selectedFeature.full_code)
      setFeatures((prev) =>
        prev.map((f) =>
          f.full_code === selectedFeature.full_code
            ? { ...f, current_quantity: quantities[f.full_code] ?? f.current_quantity }
            : f
        )
      )
    } else {
      setActionError('操作に失敗しました')
    }
  }

  const handleBarcodeScan = async (barcode: string) => {
    const result = await window.api.features.search(barcode)
    if (result.success && result.data && (result.data as Feature[]).length > 0) {
      setSearch(barcode)
    } else {
      setSearch(barcode)
    }
  }

  const filteredFeatures = features.filter((f) => {
    if (filterItem && f.item_id !== filterItem) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        f.full_code.includes(s) ||
        (f.item_name || '').toLowerCase().includes(s) ||
        (f.color_name || '').toLowerCase().includes(s) ||
        (f.size_name || '').toLowerCase().includes(s) ||
        (f.shelf_number || '').toLowerCase().includes(s)
      )
    }
    return true
  })

  const uniqueItems = Array.from(new Set(features.map((f) => f.item_id))).map((id) => {
    const f = features.find((x) => x.item_id === id)
    return { id, name: f?.item_name || id }
  })

  const getQty = (f: Feature) => quantities[f.full_code] ?? f.current_quantity ?? 0

  const actionLabel = { stockIn: '入庫', shipment: '出荷', inventory: '棚卸し' }[actionType]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">在庫管理</h2>
        <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
          <RefreshCw size={14} />
          更新
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('features')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'features' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
        >
          在庫一覧
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'logs' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
        >
          変動履歴
        </button>
      </div>

      {tab === 'features' && (
        <>
          <div className="card p-4">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-48 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="フルコード・商品名・棚番号で検索"
                  className="input-field pl-9"
                />
              </div>
              <BarcodeScanner onScan={handleBarcodeScan} placeholder="バーコードスキャン" className="w-64" />
              {uniqueItems.length > 0 && (
                <select
                  value={filterItem}
                  onChange={(e) => setFilterItem(e.target.value)}
                  className="input-field w-48"
                >
                  <option value="">全商品</option>
                  {uniqueItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="card p-0">
            {featuresLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : filteredFeatures.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Warehouse size={36} className="mx-auto mb-2 opacity-30" />
                <div>バリエーションが登録されていません</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3">バーコード</th>
                      <th className="px-4 py-3">商品</th>
                      <th className="px-4 py-3">カラー</th>
                      <th className="px-4 py-3">サイズ</th>
                      <th className="px-4 py-3">棚番号</th>
                      <th className="px-4 py-3 text-right">在庫数</th>
                      <th className="px-4 py-3 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredFeatures.map((f) => {
                      const qty = getQty(f)
                      return (
                        <tr key={f.full_code} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{f.full_code}</td>
                          <td className="px-4 py-3 font-medium">{f.item_name || f.item_id}</td>
                          <td className="px-4 py-3 text-gray-600">{f.color_name || f.color_code}</td>
                          <td className="px-4 py-3 text-gray-600">{f.size_name || f.size_code}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{f.shelf_number || '-'}</td>
                          <td className={`px-4 py-3 text-right font-bold ${qty <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {qty}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openAction(f, 'stockIn')}
                                className="flex items-center gap-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded"
                              >
                                <ArrowUp size={12} /> 入庫
                              </button>
                              <button
                                onClick={() => openAction(f, 'shipment')}
                                className="flex items-center gap-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 rounded"
                              >
                                <ArrowDown size={12} /> 出荷
                              </button>
                              <button
                                onClick={() => openAction(f, 'inventory')}
                                className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1 rounded"
                              >
                                <ClipboardList size={12} /> 棚卸
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
        </>
      )}

      {tab === 'logs' && (
        <div className="card p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">在庫変動の記録はありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3">バーコード</th>
                    <th className="px-4 py-3">種類</th>
                    <th className="px-4 py-3 text-right">変動数</th>
                    <th className="px-4 py-3">理由</th>
                    <th className="px-4 py-3">日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log: QuantityLog) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.full_code}</td>
                      <td className="px-4 py-3">
                        {log.is_inventory ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                            棚卸し
                          </span>
                        ) : log.fluctuation >= 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-green-50 text-green-700">
                            <ArrowUp size={10} /> 入庫
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-red-50 text-red-700">
                            <ArrowDown size={10} /> 出荷
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${log.fluctuation >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {log.fluctuation >= 0 ? '+' : ''}{log.fluctuation}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{log.reason || '-'}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(log.change_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAction && selectedFeature && (
        <Modal
          title={`${actionLabel} - ${selectedFeature.item_name || selectedFeature.item_id} / ${selectedFeature.color_name} / ${selectedFeature.size_name}`}
          onClose={() => setShowAction(false)}
          size="sm"
        >
          <div className="space-y-4">
            {actionError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{actionError}</div>}
            <div className="text-xs text-gray-500 font-mono">{selectedFeature.full_code}</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {actionType === 'inventory' ? '実際の在庫数' : '数量'}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={actionQty}
                onChange={(e) => setActionQty(e.target.value)}
                className="input-field"
                autoFocus
                placeholder={actionType === 'inventory' ? '実際の在庫数を入力' : '数量を入力'}
              />
              <div className="text-xs text-gray-500 mt-1">
                現在の在庫: {getQty(selectedFeature)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">理由（任意）</label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="input-field"
                placeholder="理由を入力"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAction(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleAction} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? '処理中...' : actionLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
