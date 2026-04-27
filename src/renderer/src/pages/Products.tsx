import { useEffect, useRef, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Package, Barcode } from 'lucide-react'
import { useProducts } from '../stores/useProducts'
import Modal from '../components/Modal'
import BarcodeScanner from '../components/BarcodeScanner'
import type { Product, Category } from '@shared/types'

interface ProductFormData {
  barcode: string
  name: string
  description: string
  category_id: string
  price: string
  cost: string
  unit: string
  min_stock: string
}

const emptyForm: ProductFormData = {
  barcode: '',
  name: '',
  description: '',
  category_id: '',
  price: '0',
  cost: '0',
  unit: '個',
  min_stock: '0'
}

export default function Products() {
  const { products, categories, loading, error, loadProducts, loadCategories, createProduct, updateProduct, deleteProduct } = useProducts()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  const filtered = products.filter((p) =>
    !search || p.name.includes(search) || (p.barcode || '').includes(search) || (p.description || '').includes(search)
  )

  const openCreate = () => {
    setEditProduct(null)
    setForm(emptyForm)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (p: Product) => {
    setEditProduct(p)
    setForm({
      barcode: p.barcode || '',
      name: p.name,
      description: p.description || '',
      category_id: p.category_id || '',
      price: String(p.price),
      cost: String(p.cost),
      unit: p.unit,
      min_stock: String(p.min_stock)
    })
    setFormError(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('商品名は必須です'); return }
    setSaving(true)
    setFormError(null)
    const data = {
      barcode: form.barcode || null,
      name: form.name,
      description: form.description || null,
      category_id: form.category_id || null,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      unit: form.unit || '個',
      min_stock: parseInt(form.min_stock) || 0,
      image_url: null
    }
    let result = null
    if (editProduct) {
      result = await updateProduct(editProduct.id, data)
    } else {
      result = await createProduct(data)
    }
    setSaving(false)
    if (result) {
      setShowModal(false)
    } else {
      setFormError('保存に失敗しました')
    }
  }

  const handleDelete = async (p: Product) => {
    if (!confirm(`「${p.name}」を削除しますか？`)) return
    await deleteProduct(p.id)
  }

  const handleBarcodeScan = (barcode: string) => {
    setSearch(barcode)
  }

  const handleFormBarcodeScan = (barcode: string) => {
    setForm((f) => ({ ...f, barcode }))
  }

  const stockColor = (p: Product) => {
    const stock = p.current_stock ?? 0
    if (stock <= 0) return 'text-red-600 font-bold'
    if (stock <= p.min_stock) return 'text-amber-600 font-medium'
    return 'text-gray-900'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">商品管理</h2>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          商品追加
        </button>
      </div>

      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="商品名・バーコードで検索"
              className="input-field pl-9"
            />
          </div>
          <BarcodeScanner onScan={handleBarcodeScan} placeholder="バーコードで検索" className="w-72" />
        </div>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={36} className="mx-auto mb-2 opacity-30" />
            <div>{search ? '検索結果がありません' : '商品が登録されていません'}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3">バーコード</th>
                  <th className="px-4 py-3">商品名</th>
                  <th className="px-4 py-3">カテゴリ</th>
                  <th className="px-4 py-3 text-right">価格</th>
                  <th className="px-4 py-3 text-right">在庫数</th>
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{p.barcode || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      {p.description && <div className="text-xs text-gray-400 truncate max-w-48">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.category_name || '-'}</td>
                    <td className="px-4 py-3 text-right">¥{p.price.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right ${stockColor(p)}`}>
                      {(p.current_stock ?? 0).toLocaleString()} {p.unit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editProduct ? '商品編集' : '商品追加'}
          onClose={() => setShowModal(false)}
          size="lg"
        >
          <div className="space-y-4">
            {formError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{formError}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">バーコード</label>
              <div className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="バーコード番号"
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  className="btn-secondary flex items-center gap-1.5 px-3"
                  aria-label="バーコード入力欄にフォーカス"
                  onClick={() => barcodeInputRef.current?.focus()}
                >
                  <Barcode size={16} />
                </button>
              </div>
              <div className="mt-1">
                <BarcodeScanner onScan={handleFormBarcodeScan} placeholder="スキャンしてバーコード入力" className="mt-1" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商品名 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="商品名"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="商品説明"
                className="input-field"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">カテゴリなし</option>
                  {categories.map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">単位</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="個"
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">販売価格 (円)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">仕入価格 (円)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最小在庫数</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
