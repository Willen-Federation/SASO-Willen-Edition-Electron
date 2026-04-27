import { useEffect, useState } from 'react'
import { Plus, Trash2, Printer } from 'lucide-react'
import BarcodeScanner from '../components/BarcodeScanner'
import LabelPrint from '../components/LabelPrint'
import type { Product } from '@shared/types'

interface LabelEntry {
  product: Product
  quantity: number
}

export default function Labels() {
  const [entries, setEntries] = useState<LabelEntry[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [labelSize, setLabelSize] = useState<'58mm' | '40x30'>('58mm')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.products.list().then((res) => {
      if (res.success && res.data) setAllProducts(res.data as Product[])
    })
  }, [])

  const handleBarcodeScan = async (barcode: string) => {
    const res = await window.api.products.get(barcode)
    if (res.success && res.data) {
      addProduct(res.data as Product)
    } else {
      setError(`バーコード "${barcode}" の商品が見つかりません`)
      setTimeout(() => setError(null), 3000)
    }
  }

  const addProduct = (product: Product) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.product.id === product.id)
      if (existing) return prev.map((e) => e.product.id === product.id ? { ...e, quantity: e.quantity + 1 } : e)
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, quantity: qty } : e))
  }

  const remove = (idx: number) => setEntries((prev) => prev.filter((_, i) => i !== idx))

  const totalLabels = entries.reduce((sum, e) => sum + e.quantity, 0)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">ラベル印刷</h2>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ラベルサイズ</label>
          <div className="flex gap-3">
            {(['58mm', '40x30'] as const).map((size) => (
              <label key={size} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="labelSize" value={size} checked={labelSize === size} onChange={() => setLabelSize(size)} className="text-primary-600" />
                <span className="text-sm">{size === '58mm' ? '58mm幅 (レシート)' : '40×30mm (小ラベル)'}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">商品追加</label>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          <BarcodeScanner onScan={handleBarcodeScan} placeholder="バーコードをスキャンして商品追加" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">商品リストから選択</label>
          <select
            className="input-field"
            onChange={(e) => {
              const p = allProducts.find((p) => p.id === e.target.value)
              if (p) { addProduct(p); e.target.value = '' }
            }}
            defaultValue=""
          >
            <option value="">商品を選択...</option>
            {allProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} {p.barcode ? `(${p.barcode})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700">印刷リスト（合計 {totalLabels} 枚）</h3>
            <button onClick={() => setEntries([])} className="text-sm text-red-500 hover:text-red-700">すべて削除</button>
          </div>
          <div className="space-y-2 mb-4">
            {entries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm">{entry.product.name}</div>
                  <div className="text-xs text-gray-500">¥{entry.product.price.toLocaleString()} {entry.product.barcode ? `· ${entry.product.barcode}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">枚数:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={entry.quantity}
                    onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                    className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <LabelPrint items={entries} labelSize={labelSize} />
        </div>
      )}

      {entries.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <Printer size={40} className="mx-auto mb-2 opacity-30" />
          <div>バーコードをスキャンするか、リストから商品を選択してください</div>
        </div>
      )}
    </div>
  )
}
