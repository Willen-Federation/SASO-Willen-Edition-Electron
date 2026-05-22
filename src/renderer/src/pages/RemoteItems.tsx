import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Package, Cloud, RefreshCw, Sparkles, ImagePlus } from 'lucide-react'
import { useRemoteItems } from '../stores/useRemoteItems'
import { useAuth } from '../stores/useAuth'
import Modal from '../components/Modal'
import BarcodeScanner from '../components/BarcodeScanner'
import CategoryPicker from '../components/CategoryPicker'
import StorageLocationPicker from '../components/StorageLocationPicker'
import ItemStatusBadge, { ITEM_STATUS_VALUES, itemStatusLabel } from '../components/ItemStatusBadge'
import type { ItemStatus, RemoteItem, RemoteItemCreate, RemoteItemPatch } from '@shared/types'

interface ItemFormData {
  name: string
  categoryId: string | number | ''
  janCode: string
  isbnCode: string
  labelCode: string
  note: string
  price: string
  stock: string
  status: ItemStatus
  storageLocationId: string | number | ''
}

function emptyForm(): ItemFormData {
  return {
    name: '',
    categoryId: '',
    janCode: '',
    isbnCode: '',
    labelCode: '',
    note: '',
    price: '',
    stock: '',
    status: 'active',
    storageLocationId: ''
  }
}

function formFromItem(item: RemoteItem): ItemFormData {
  return {
    name: item.name,
    categoryId: item.categoryId ?? '',
    janCode: item.janCode ?? '',
    isbnCode: item.isbnCode ?? '',
    labelCode: item.labelCode ?? '',
    note: item.note ?? '',
    price: item.price !== null && item.price !== undefined ? String(item.price) : '',
    stock: item.stock !== null && item.stock !== undefined ? String(item.stock) : '',
    status: item.status,
    storageLocationId: item.storageLocationId ?? ''
  }
}

function trimOrNull(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

function parseIntOrNull(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

export default function RemoteItems() {
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuth()
  const {
    items,
    total,
    nextCursor,
    loading,
    loadingMore,
    error,
    info,
    unauthorized,
    locations,
    loadPage,
    loadMore,
    getOne,
    create,
    update,
    lookupBarcode,
    clearError,
    clearInfo
  } = useRemoteItems()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | number | ''>('')
  const [locationFilter, setLocationFilter] = useState<string | number | ''>('')
  const [barcodeBanner, setBarcodeBanner] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RemoteItem | null>(null)
  const [form, setForm] = useState<ItemFormData>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [draftModalOpen, setDraftModalOpen] = useState(false)
  const [draftImage, setDraftImage] = useState<{ path: string; name: string; size: number } | null>(null)
  const [draftFields, setDraftFields] = useState({
    item_name: '',
    jan_code: '',
    isbn: '',
    price: '',
    barcode_hint: ''
  })
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftSuccess, setDraftSuccess] = useState<string | null>(null)
  const [draftSubmitting, setDraftSubmitting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }
    void loadPage({})
  }, [isAuthenticated, loadPage, navigate])

  useEffect(() => {
    if (unauthorized) {
      void logout().then(() => navigate('/login', { replace: true }))
    }
  }, [unauthorized, logout, navigate])

  const locationLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of locations) m.set(String(l.id), `${l.code} — ${l.name}`)
    return m
  }, [locations])

  const applyFilters = () => {
    void loadPage({
      q: search.trim() || undefined,
      category_id: categoryFilter === '' ? undefined : categoryFilter
    })
  }

  const handleScan = async (code: string) => {
    setBarcodeBanner(null)
    const result = await lookupBarcode(code)
    if (!result) return
    if (result.item) {
      const detail = await getOne(result.item.id)
      if (detail) openEdit(detail)
    } else {
      setBarcodeBanner(`バーコード "${code}" は未登録です`)
      setTimeout(() => setBarcodeBanner(null), 3000)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (item: RemoteItem) => {
    setEditing(item)
    setForm(formFromItem(item))
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('商品名は必須です')
      return
    }
    if (!editing && form.categoryId === '') {
      setFormError('新規作成時はカテゴリが必須です')
      return
    }
    setSaving(true)
    setFormError(null)

    let result: { item: RemoteItem | null; queued: boolean }
    if (editing) {
      const patch: RemoteItemPatch = {
        name: form.name.trim(),
        janCode: trimOrNull(form.janCode),
        isbnCode: trimOrNull(form.isbnCode),
        labelCode: trimOrNull(form.labelCode),
        note: trimOrNull(form.note),
        price: parseIntOrNull(form.price),
        stock: parseIntOrNull(form.stock),
        status: form.status
      }
      if (form.categoryId !== '') patch.categoryId = form.categoryId
      result = await update(editing.id, patch)
    } else {
      const body: RemoteItemCreate = {
        name: form.name.trim(),
        categoryId: form.categoryId as string | number,
        janCode: trimOrNull(form.janCode),
        isbnCode: trimOrNull(form.isbnCode),
        labelCode: trimOrNull(form.labelCode),
        note: trimOrNull(form.note),
        price: parseIntOrNull(form.price),
        stock: parseIntOrNull(form.stock)
      }
      result = await create(body)
    }

    setSaving(false)
    if (result.item || result.queued) {
      setModalOpen(false)
    } else {
      setFormError(useRemoteItems.getState().error || '保存に失敗しました')
    }
  }

  const openDraftModal = () => {
    setDraftImage(null)
    setDraftFields({ item_name: '', jan_code: '', isbn: '', price: '', barcode_hint: '' })
    setDraftError(null)
    setDraftSuccess(null)
    setDraftModalOpen(true)
  }

  const handlePickImage = async () => {
    setDraftError(null)
    const res = await window.api.dialog.pickImage()
    if (!res.success) {
      setDraftError(res.error)
      return
    }
    if (res.canceled) return
    setDraftImage({ path: res.path, name: res.name, size: res.size })
  }

  const handleSubmitDraft = async () => {
    if (!draftImage) {
      setDraftError('画像を選択してください')
      return
    }
    setDraftSubmitting(true)
    setDraftError(null)
    const res = await window.api.sync.itemsDraftCreate({
      imagePath: draftImage.path,
      fields: {
        item_name: draftFields.item_name.trim() || undefined,
        jan_code: draftFields.jan_code.trim() || undefined,
        isbn: draftFields.isbn.trim() || undefined,
        price: draftFields.price.trim() || undefined,
        barcode_hint: draftFields.barcode_hint.trim() || undefined
      }
    })
    setDraftSubmitting(false)
    if (res.success) {
      setDraftSuccess(
        `アップロード完了 (draft_id: ${String(res.data.draft_id)}). サーバー側で AI 処理後、商品一覧に反映されます。`
      )
      setTimeout(() => {
        setDraftModalOpen(false)
        void loadPage(useRemoteItems.getState().lastQuery)
      }, 2500)
    } else {
      setDraftError(res.error)
    }
  }

  const visible = useMemo(() => {
    if (locationFilter === '') return items
    return items.filter((it) => String(it.storageLocationId ?? '') === String(locationFilter))
  }, [items, locationFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Cloud size={20} className="text-primary-600" />
          サーバー商品
          <span className="text-xs font-normal text-gray-500">({total} 件)</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadPage(useRemoteItems.getState().lastQuery)}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
            title="再読み込み"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openDraftModal} className="btn-secondary flex items-center gap-2">
            <Sparkles size={14} />
            AI で商品登録
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            商品追加
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex gap-3 flex-wrap items-start">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              applyFilters()
            }}
            className="flex-1 min-w-48 relative"
          >
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={applyFilters}
              placeholder="商品名で検索 (Enter で実行)"
              className="input-field pl-9"
            />
          </form>
          <CategoryPicker
            value={categoryFilter}
            onChange={(v) => {
              setCategoryFilter(v)
              void loadPage({
                q: search.trim() || undefined,
                category_id: v === '' ? undefined : v
              })
            }}
            placeholder="カテゴリで絞り込み"
            className="w-56"
          />
          <StorageLocationPicker
            value={locationFilter}
            onChange={setLocationFilter}
            placeholder="保管場所で絞り込み"
            className="w-56"
          />
          <BarcodeScanner onScan={handleScan} placeholder="バーコードで商品検索" className="w-72" />
        </div>
        {barcodeBanner && (
          <div className="mt-3 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            {barcodeBanner}
          </div>
        )}
      </div>

      {error && !unauthorized && (
        <div className="flex items-start justify-between gap-3 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-500 underline text-xs">
            閉じる
          </button>
        </div>
      )}

      {info && (
        <div className="flex items-start justify-between gap-3 text-yellow-700 text-sm bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
          <span>{info}</span>
          <button onClick={clearInfo} className="text-yellow-700 underline text-xs">
            閉じる
          </button>
        </div>
      )}

      <div className="card p-0">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={36} className="mx-auto mb-2 opacity-30" />
            <div>
              {search || categoryFilter !== '' || locationFilter !== ''
                ? '条件に合う商品がありません'
                : 'サーバー上に商品がありません'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">商品名</th>
                  <th className="px-4 py-2">JAN</th>
                  <th className="px-4 py-2">ISBN</th>
                  <th className="px-4 py-2">カテゴリ</th>
                  <th className="px-4 py-2">保管場所</th>
                  <th className="px-4 py-2">ステータス</th>
                  <th className="px-4 py-2 text-right">在庫</th>
                  <th className="px-4 py-2 text-right">価格</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={String(item.id)}
                    onClick={() => openEdit(item)}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.note && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      {item.janCode || '-'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      {item.isbnCode || '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{item.categoryName || '-'}</td>
                    <td className="px-4 py-2 text-gray-700 text-xs">
                      {item.storageLocationId
                        ? locationLabelById.get(String(item.storageLocationId)) ??
                          String(item.storageLocationId)
                        : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <ItemStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">
                      {item.stock ?? 0}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-800">
                      {item.price !== null && item.price !== undefined
                        ? `¥${item.price.toLocaleString()}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor !== null && (
          <div className="border-t border-gray-100 py-3 text-center">
            <button
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {loadingMore ? '読み込み中...' : 'もっと読み込む'}
            </button>
          </div>
        )}
      </div>

      {draftModalOpen && (
        <Modal
          title="AI で商品登録 (画像 + 任意ヒント)"
          onClose={() => setDraftModalOpen(false)}
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
              画像をアップロードすると、サーバー側で AI が商品名・カテゴリなどを推定します。
              `draft_id` が返ったあとはサーバー側で非同期処理されるため、結果は一覧で確認してください (fire-and-forget)。
            </div>

            {draftError && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{draftError}</div>
            )}
            {draftSuccess && (
              <div className="text-green-700 text-sm bg-green-50 p-3 rounded-lg">{draftSuccess}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商品画像 *</label>
              {draftImage ? (
                <div className="border border-gray-200 rounded-lg p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-mono text-gray-700 break-all">{draftImage.name}</div>
                    <div className="text-xs text-gray-400">
                      {(draftImage.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button onClick={handlePickImage} className="btn-secondary text-xs">
                    変更
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePickImage}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-6 text-center text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex flex-col items-center gap-2"
                >
                  <ImagePlus size={28} />
                  <span className="text-sm">クリックして画像を選択</span>
                  <span className="text-xs text-gray-400">JPEG / PNG / WebP / GIF · 最大 20MB</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">商品名 (ヒント)</label>
                <input
                  type="text"
                  value={draftFields.item_name}
                  onChange={(e) => setDraftFields({ ...draftFields, item_name: e.target.value })}
                  className="input-field"
                  placeholder="任意。AIの精度向上に使われます"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">バーコード推定値</label>
                <input
                  type="text"
                  value={draftFields.barcode_hint}
                  onChange={(e) =>
                    setDraftFields({ ...draftFields, barcode_hint: e.target.value })
                  }
                  className="input-field font-mono"
                  placeholder="任意"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JAN</label>
                <input
                  type="text"
                  value={draftFields.jan_code}
                  onChange={(e) => setDraftFields({ ...draftFields, jan_code: e.target.value })}
                  className="input-field font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input
                  type="text"
                  value={draftFields.isbn}
                  onChange={(e) => setDraftFields({ ...draftFields, isbn: e.target.value })}
                  className="input-field font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">価格 (円)</label>
                <input
                  type="number"
                  value={draftFields.price}
                  onChange={(e) => setDraftFields({ ...draftFields, price: e.target.value })}
                  className="input-field"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setDraftModalOpen(false)} className="btn-secondary">
                キャンセル
              </button>
              <button
                onClick={() => void handleSubmitDraft()}
                disabled={draftSubmitting || !draftImage}
                className="btn-primary disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles size={14} />
                {draftSubmitting ? 'アップロード中...' : 'アップロードして AI 処理'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <Modal
          title={editing ? `商品編集: ${editing.name}` : '商品追加'}
          onClose={() => setModalOpen(false)}
          size="lg"
        >
          <div className="space-y-4">
            {formError && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{formError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商品名 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="商品名"
                className="input-field"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  カテゴリ {editing ? '' : '*'}
                </label>
                <CategoryPicker
                  value={form.categoryId}
                  onChange={(v) => setForm({ ...form, categoryId: v })}
                  required={!editing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ItemStatus })}
                  className="input-field"
                  disabled={!editing}
                  title={!editing ? '作成後に変更可能' : undefined}
                >
                  {ITEM_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {itemStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JAN コード</label>
                <input
                  type="text"
                  value={form.janCode}
                  onChange={(e) => setForm({ ...form, janCode: e.target.value })}
                  className="input-field font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN コード</label>
                <input
                  type="text"
                  value={form.isbnCode}
                  onChange={(e) => setForm({ ...form, isbnCode: e.target.value })}
                  className="input-field font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ラベルコード</label>
                <input
                  type="text"
                  value={form.labelCode}
                  onChange={(e) => setForm({ ...form, labelCode: e.target.value })}
                  className="input-field font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">価格 (円)</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="input-field"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">在庫</label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="input-field"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={3}
                maxLength={255}
                className="input-field resize-none"
                placeholder="255 文字まで"
              />
            </div>

            {editing && (
              <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                <div>ID: {String(editing.id)}</div>
                {editing.updatedAt && <div>最終更新: {editing.updatedAt}</div>}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="btn-secondary">
                キャンセル
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
