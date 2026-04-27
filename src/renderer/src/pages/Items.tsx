import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Package, ChevronDown, ChevronRight } from 'lucide-react'
import { useItems } from '../stores/useItems'
import Modal from '../components/Modal'
import BarcodeScanner from '../components/BarcodeScanner'
import type { Item, Color, Size } from '@shared/types'

// ── Item form ─────────────────────────────────────────────────────────────────
interface ItemFormData {
  name: string
  serial: string
  pla: boolean
  pla_note: string
  paper: boolean
  paper_note: string
}

const emptyItemForm: ItemFormData = {
  name: '',
  serial: '',
  pla: false,
  pla_note: '',
  paper: false,
  paper_note: ''
}

// ── Color form ────────────────────────────────────────────────────────────────
interface ColorFormData { code: string; name: string }
const emptyColorForm: ColorFormData = { code: '', name: '' }

// ── Size form ─────────────────────────────────────────────────────────────────
interface SizeFormData { code: string; name: string; order_number: string }
const emptySizeForm: SizeFormData = { code: '', name: '', order_number: '0' }

export default function Items() {
  const {
    items, colors, sizes, features, loading, error,
    loadItems, loadColors, loadSizes, loadFeatures,
    createItem, updateItem, deleteItem,
    createColor, updateColor, deleteColor,
    createSize, updateSize, deleteSize,
    createFeature, deleteFeature
  } = useItems()

  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormData>(emptyItemForm)
  const [itemFormError, setItemFormError] = useState<string | null>(null)
  const [savingItem, setSavingItem] = useState(false)

  // Color modal
  const [showColorModal, setShowColorModal] = useState(false)
  const [editColor, setEditColor] = useState<Color | null>(null)
  const [colorParentItemId, setColorParentItemId] = useState<string>('')
  const [colorForm, setColorForm] = useState<ColorFormData>(emptyColorForm)
  const [colorFormError, setColorFormError] = useState<string | null>(null)
  const [savingColor, setSavingColor] = useState(false)

  // Size modal
  const [showSizeModal, setShowSizeModal] = useState(false)
  const [editSize, setEditSize] = useState<Size | null>(null)
  const [sizeParentItemId, setSizeParentItemId] = useState<string>('')
  const [sizeForm, setSizeForm] = useState<SizeFormData>(emptySizeForm)
  const [sizeFormError, setSizeFormError] = useState<string | null>(null)
  const [savingSize, setSavingSize] = useState(false)

  useEffect(() => {
    loadItems()
  }, [])

  const filtered = items.filter((item) =>
    !search ||
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.serial || '').toLowerCase().includes(search.toLowerCase()) ||
    item.id.includes(search)
  )

  // ── Expand item ───────────────────────────────────────────────────────────
  const toggleExpand = async (itemId: string) => {
    if (expandedItem === itemId) {
      setExpandedItem(null)
      return
    }
    setExpandedItem(itemId)
    await Promise.all([loadColors(itemId), loadSizes(itemId), loadFeatures(itemId)])
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────────
  const openCreateItem = () => {
    setEditItem(null)
    setItemForm(emptyItemForm)
    setItemFormError(null)
    setShowItemModal(true)
  }

  const openEditItem = (item: Item) => {
    setEditItem(item)
    setItemForm({
      name: item.name,
      serial: item.serial || '',
      pla: item.pla,
      pla_note: item.pla_note || '',
      paper: item.paper,
      paper_note: item.paper_note || ''
    })
    setItemFormError(null)
    setShowItemModal(true)
  }

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) { setItemFormError('商品名は必須です'); return }
    setSavingItem(true)
    setItemFormError(null)
    const data = {
      name: itemForm.name.trim(),
      serial: itemForm.serial.trim() || null,
      pla: itemForm.pla,
      pla_note: itemForm.pla_note.trim() || null,
      paper: itemForm.paper,
      paper_note: itemForm.paper_note.trim() || null
    }
    let result = null
    if (editItem) {
      result = await updateItem(editItem.id, data)
    } else {
      result = await createItem(data)
    }
    setSavingItem(false)
    if (result) {
      setShowItemModal(false)
    } else {
      setItemFormError('保存に失敗しました')
    }
  }

  const handleDeleteItem = async (item: Item) => {
    if (!confirm(`「${item.name}」を削除しますか？（関連するカラー・サイズ・バリエーションもすべて削除されます）`)) return
    await deleteItem(item.id)
    if (expandedItem === item.id) setExpandedItem(null)
  }

  // ── Color CRUD ────────────────────────────────────────────────────────────
  const openCreateColor = (itemId: string) => {
    setColorParentItemId(itemId)
    setEditColor(null)
    setColorForm(emptyColorForm)
    setColorFormError(null)
    setShowColorModal(true)
  }

  const openEditColor = (color: Color) => {
    setColorParentItemId(color.item_id)
    setEditColor(color)
    setColorForm({ code: color.code, name: color.name })
    setColorFormError(null)
    setShowColorModal(true)
  }

  const handleSaveColor = async () => {
    if (!colorForm.code.trim() || !colorForm.name.trim()) { setColorFormError('コードと名前は必須です'); return }
    setSavingColor(true)
    setColorFormError(null)
    let result = null
    if (editColor) {
      result = await updateColor(editColor.id, { code: colorForm.code.padStart(2, '0'), name: colorForm.name })
    } else {
      result = await createColor({ item_id: colorParentItemId, code: colorForm.code.padStart(2, '0'), name: colorForm.name, image_type: null })
    }
    setSavingColor(false)
    if (result) {
      setShowColorModal(false)
    } else {
      setColorFormError('保存に失敗しました')
    }
  }

  const handleDeleteColor = async (color: Color) => {
    if (!confirm(`カラー「${color.name}」を削除しますか？`)) return
    await deleteColor(color.id, color.item_id)
  }

  // ── Size CRUD ─────────────────────────────────────────────────────────────
  const openCreateSize = (itemId: string) => {
    setSizeParentItemId(itemId)
    setEditSize(null)
    setSizeForm(emptySizeForm)
    setSizeFormError(null)
    setShowSizeModal(true)
  }

  const openEditSize = (size: Size) => {
    setSizeParentItemId(size.item_id)
    setEditSize(size)
    setSizeForm({ code: size.code, name: size.name, order_number: String(size.order_number) })
    setSizeFormError(null)
    setShowSizeModal(true)
  }

  const handleSaveSize = async () => {
    if (!sizeForm.code.trim() || !sizeForm.name.trim()) { setSizeFormError('コードと名前は必須です'); return }
    setSavingSize(true)
    setSizeFormError(null)
    const sizeData = {
      code: sizeForm.code.padStart(2, '0'),
      name: sizeForm.name,
      order_number: parseInt(sizeForm.order_number) || 0
    }
    let result = null
    if (editSize) {
      result = await updateSize(editSize.id, sizeData)
    } else {
      result = await createSize({ item_id: sizeParentItemId, ...sizeData })
    }
    setSavingSize(false)
    if (result) {
      setShowSizeModal(false)
    } else {
      setSizeFormError('保存に失敗しました')
    }
  }

  const handleDeleteSize = async (size: Size) => {
    if (!confirm(`サイズ「${size.name}」を削除しますか？`)) return
    await deleteSize(size.id, size.item_id)
  }

  // ── Feature management ────────────────────────────────────────────────────
  const handleCreateFeature = async (itemId: string, colorCode: string, sizeCode: string) => {
    await createFeature(itemId, colorCode, sizeCode)
  }

  const handleDeleteFeature = async (fullCode: string) => {
    if (!confirm(`バリエーション ${fullCode} を削除しますか？`)) return
    await deleteFeature(fullCode)
  }

  const handleBarcodeScan = (barcode: string) => {
    setSearch(barcode)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">商品管理</h2>
        <button onClick={openCreateItem} className="btn-primary flex items-center gap-2">
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
              placeholder="商品名・シリアル・IDで検索"
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
          <div>
            {filtered.map((item) => {
              const isExpanded = expandedItem === item.id
              const itemColors = colors[item.id] || []
              const itemSizes = sizes[item.id] || []
              const itemFeatures = features.filter((f) => f.item_id === item.id)

              return (
                <div key={item.id} className="border-b border-gray-100 last:border-b-0">
                  {/* Item row */}
                  <div className="flex items-center px-4 py-3 hover:bg-gray-50">
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="mr-2 text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        {item.pla && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">PLA</span>
                        )}
                        {item.paper && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Paper</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        ID: {item.id}
                        {item.serial && ` · S/N: ${item.serial}`}
                        {` · ${item.date_code}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openEditItem(item)}
                        className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded sub-section */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 px-8 py-4 space-y-4">
                      {/* Colors */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700">カラー</h4>
                          <button
                            onClick={() => openCreateColor(item.id)}
                            className="text-xs btn-secondary py-1 px-2 flex items-center gap-1"
                          >
                            <Plus size={12} /> 追加
                          </button>
                        </div>
                        {itemColors.length === 0 ? (
                          <div className="text-xs text-gray-400 py-1">カラーが登録されていません</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {itemColors.map((c) => (
                              <div key={c.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-2 py-1 text-xs">
                                <span className="font-mono text-gray-500">{c.code}</span>
                                <span className="text-gray-700">{c.name}</span>
                                <button onClick={() => openEditColor(c)} className="text-blue-400 hover:text-blue-600 ml-1">
                                  <Edit2 size={11} />
                                </button>
                                <button onClick={() => handleDeleteColor(c)} className="text-red-400 hover:text-red-600">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Sizes */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700">サイズ</h4>
                          <button
                            onClick={() => openCreateSize(item.id)}
                            className="text-xs btn-secondary py-1 px-2 flex items-center gap-1"
                          >
                            <Plus size={12} /> 追加
                          </button>
                        </div>
                        {itemSizes.length === 0 ? (
                          <div className="text-xs text-gray-400 py-1">サイズが登録されていません</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {itemSizes.map((s) => (
                              <div key={s.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-2 py-1 text-xs">
                                <span className="font-mono text-gray-500">{s.code}</span>
                                <span className="text-gray-700">{s.name}</span>
                                <span className="text-gray-400">#{s.order_number}</span>
                                <button onClick={() => openEditSize(s)} className="text-blue-400 hover:text-blue-600 ml-1">
                                  <Edit2 size={11} />
                                </button>
                                <button onClick={() => handleDeleteSize(s)} className="text-red-400 hover:text-red-600">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Features */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700">バリエーション（バーコード単位）</h4>
                        </div>
                        {itemColors.length > 0 && itemSizes.length > 0 && (
                          <div className="mb-2 text-xs text-gray-500">
                            カラー × サイズの組み合わせを作成:
                            <div className="flex flex-wrap gap-1 mt-1">
                              {itemColors.map((c) =>
                                itemSizes.map((s) => {
                                  const fc = `${item.id}${c.code}${s.code}`
                                  const exists = itemFeatures.some((f) => f.full_code === fc)
                                  if (exists) return null
                                  return (
                                    <button
                                      key={fc}
                                      onClick={() => handleCreateFeature(item.id, c.code, s.code)}
                                      className="text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 rounded px-2 py-0.5"
                                    >
                                      + {c.name} × {s.name}
                                    </button>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        )}
                        {itemFeatures.length === 0 ? (
                          <div className="text-xs text-gray-400 py-1">バリエーションが登録されていません</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                  <th className="pb-1 pr-3">フルコード</th>
                                  <th className="pb-1 pr-3">カラー</th>
                                  <th className="pb-1 pr-3">サイズ</th>
                                  <th className="pb-1 pr-3">棚番号</th>
                                  <th className="pb-1 pr-3 text-right">在庫</th>
                                  <th className="pb-1"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemFeatures.map((f) => (
                                  <tr key={f.full_code} className="border-b border-gray-100 last:border-0">
                                    <td className="py-1 pr-3 font-mono text-gray-700">{f.full_code}</td>
                                    <td className="py-1 pr-3">{f.color_name || f.color_code}</td>
                                    <td className="py-1 pr-3">{f.size_name || f.size_code}</td>
                                    <td className="py-1 pr-3 text-gray-500">{f.shelf_number || '-'}</td>
                                    <td className={`py-1 pr-3 text-right font-medium ${(f.current_quantity ?? 0) <= 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                      {f.current_quantity ?? 0}
                                    </td>
                                    <td className="py-1">
                                      <button
                                        onClick={() => handleDeleteFeature(f.full_code)}
                                        className="text-red-400 hover:text-red-600"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <Modal title={editItem ? '商品編集' : '商品追加'} onClose={() => setShowItemModal(false)} size="lg">
          <div className="space-y-4">
            {itemFormError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{itemFormError}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商品名 *</label>
              <input
                type="text"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="商品名（最大50文字）"
                maxLength={50}
                className="input-field"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">シリアル番号</label>
              <input
                type="text"
                value={itemForm.serial}
                onChange={(e) => setItemForm({ ...itemForm, serial: e.target.value })}
                placeholder="任意のシリアル番号"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.pla}
                    onChange={(e) => setItemForm({ ...itemForm, pla: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">PLA素材</span>
                </label>
                {itemForm.pla && (
                  <input
                    type="text"
                    value={itemForm.pla_note}
                    onChange={(e) => setItemForm({ ...itemForm, pla_note: e.target.value })}
                    placeholder="PLA備考"
                    className="input-field mt-2"
                  />
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.paper}
                    onChange={(e) => setItemForm({ ...itemForm, paper: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">紙素材</span>
                </label>
                {itemForm.paper && (
                  <input
                    type="text"
                    value={itemForm.paper_note}
                    onChange={(e) => setItemForm({ ...itemForm, paper_note: e.target.value })}
                    placeholder="紙素材備考"
                    className="input-field mt-2"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleSaveItem} disabled={savingItem} className="btn-primary disabled:opacity-50">
                {savingItem ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Color Modal */}
      {showColorModal && (
        <Modal title={editColor ? 'カラー編集' : 'カラー追加'} onClose={() => setShowColorModal(false)} size="sm">
          <div className="space-y-4">
            {colorFormError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{colorFormError}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">コード（2桁） *</label>
              <input
                type="text"
                value={colorForm.code}
                onChange={(e) => setColorForm({ ...colorForm, code: e.target.value })}
                placeholder="00-99"
                maxLength={2}
                className="input-field"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カラー名 *</label>
              <input
                type="text"
                value={colorForm.name}
                onChange={(e) => setColorForm({ ...colorForm, name: e.target.value })}
                placeholder="カラー名（最大50文字）"
                maxLength={50}
                className="input-field"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowColorModal(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleSaveColor} disabled={savingColor} className="btn-primary disabled:opacity-50">
                {savingColor ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Size Modal */}
      {showSizeModal && (
        <Modal title={editSize ? 'サイズ編集' : 'サイズ追加'} onClose={() => setShowSizeModal(false)} size="sm">
          <div className="space-y-4">
            {sizeFormError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{sizeFormError}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">コード（2桁） *</label>
              <input
                type="text"
                value={sizeForm.code}
                onChange={(e) => setSizeForm({ ...sizeForm, code: e.target.value })}
                placeholder="00-99"
                maxLength={2}
                className="input-field"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">サイズ名 *</label>
              <input
                type="text"
                value={sizeForm.name}
                onChange={(e) => setSizeForm({ ...sizeForm, name: e.target.value })}
                placeholder="サイズ名（最大50文字）"
                maxLength={50}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">表示順</label>
              <input
                type="number"
                min="0"
                max="99"
                value={sizeForm.order_number}
                onChange={(e) => setSizeForm({ ...sizeForm, order_number: e.target.value })}
                className="input-field w-24"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowSizeModal(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleSaveSize} disabled={savingSize} className="btn-primary disabled:opacity-50">
                {savingSize ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
