import { useEffect, useState } from 'react'
import { Plus, Trash2, Printer, Edit2 } from 'lucide-react'
import BarcodeScanner from '../components/BarcodeScanner'
import LabelPrint from '../components/LabelPrint'
import Modal from '../components/Modal'
import type { Feature, LabelTemplate } from '@shared/types'

interface LabelEntry {
  feature: Feature
  quantity: number
}

interface TemplateFormData {
  name: string
  margin_top: string
  margin_left: string
  width: string
  height: string
  interval_column: string
  interval_row: string
}

const emptyTemplateForm: TemplateFormData = {
  name: '',
  margin_top: '10',
  margin_left: '10',
  width: '58',
  height: '40',
  interval_column: '2',
  interval_row: '2'
}

export default function Labels() {
  const [entries, setEntries] = useState<LabelEntry[]>([])
  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'print' | 'templates'>('print')

  // Template form
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState<LabelTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState<TemplateFormData>(emptyTemplateForm)
  const [templateFormError, setTemplateFormError] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    const res = await window.api.labelTemplates.list()
    if (res.success && res.data) {
      const tmplList = res.data as LabelTemplate[]
      setTemplates(tmplList)
      if (tmplList.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(tmplList[0].id)
      }
    }
  }

  const handleBarcodeScan = async (barcode: string) => {
    const res = await window.api.features.search(barcode)
    if (res.success && res.data && (res.data as Feature[]).length > 0) {
      addFeature((res.data as Feature[])[0])
    } else {
      setError(`バーコード "${barcode}" のバリエーションが見つかりません`)
      setTimeout(() => setError(null), 3000)
    }
  }

  const addFeature = (feature: Feature) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.feature.full_code === feature.full_code)
      if (existing) return prev.map((e) => e.feature.full_code === feature.full_code ? { ...e, quantity: e.quantity + 1 } : e)
      return [...prev, { feature, quantity: 1 }]
    })
  }

  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, quantity: qty } : e))
  }

  const remove = (idx: number) => setEntries((prev) => prev.filter((_, i) => i !== idx))

  const totalLabels = entries.reduce((sum, e) => sum + e.quantity, 0)

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null

  // ── Template CRUD ─────────────────────────────────────────────────────────
  const openCreateTemplate = () => {
    setEditTemplate(null)
    setTemplateForm(emptyTemplateForm)
    setTemplateFormError(null)
    setShowTemplateModal(true)
  }

  const openEditTemplate = (t: LabelTemplate) => {
    setEditTemplate(t)
    setTemplateForm({
      name: t.name,
      margin_top: String(t.margin_top),
      margin_left: String(t.margin_left),
      width: String(t.width),
      height: String(t.height),
      interval_column: String(t.interval_column),
      interval_row: String(t.interval_row)
    })
    setTemplateFormError(null)
    setShowTemplateModal(true)
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) { setTemplateFormError('テンプレート名は必須です'); return }
    setSavingTemplate(true)
    setTemplateFormError(null)
    const data = {
      name: templateForm.name.trim(),
      margin_top: parseFloat(templateForm.margin_top) || 10,
      margin_left: parseFloat(templateForm.margin_left) || 10,
      width: parseFloat(templateForm.width) || 58,
      height: parseFloat(templateForm.height) || 40,
      interval_column: parseFloat(templateForm.interval_column) || 2,
      interval_row: parseFloat(templateForm.interval_row) || 2
    }
    let result = null
    if (editTemplate) {
      result = await window.api.labelTemplates.update(editTemplate.id, data)
    } else {
      result = await window.api.labelTemplates.create(data)
    }
    setSavingTemplate(false)
    if (result.success) {
      await loadTemplates()
      setShowTemplateModal(false)
    } else {
      setTemplateFormError(result.error || '保存に失敗しました')
    }
  }

  const handleDeleteTemplate = async (t: LabelTemplate) => {
    if (!confirm(`テンプレート「${t.name}」を削除しますか？`)) return
    await window.api.labelTemplates.delete(t.id)
    await loadTemplates()
    if (selectedTemplateId === t.id) setSelectedTemplateId('')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">ラベル印刷</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('print')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'print' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
        >
          印刷
        </button>
        <button
          onClick={() => setTab('templates')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'templates' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
        >
          テンプレート管理
        </button>
      </div>

      {tab === 'print' && (
        <>
          <div className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ラベルテンプレート</label>
              {templates.length === 0 ? (
                <div className="text-sm text-gray-400">テンプレートが登録されていません。テンプレート管理タブで作成してください。</div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="input-field w-64"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.width}×{t.height}mm)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">バーコードスキャンで追加</label>
              {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
              <BarcodeScanner onScan={handleBarcodeScan} placeholder="バーコードをスキャンして追加" />
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
                      <div className="font-medium text-sm">{entry.feature.item_name}</div>
                      <div className="text-xs text-gray-500">
                        {entry.feature.color_name} / {entry.feature.size_name}
                        {' · '}<span className="font-mono">{entry.feature.full_code}</span>
                      </div>
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
              <LabelPrint items={entries} template={selectedTemplate} />
            </div>
          )}

          {entries.length === 0 && (
            <div className="card text-center py-12 text-gray-400">
              <Printer size={40} className="mx-auto mb-2 opacity-30" />
              <div>バーコードをスキャンしてバリエーションを追加してください</div>
            </div>
          )}
        </>
      )}

      {tab === 'templates' && (
        <>
          <div className="flex justify-end">
            <button onClick={openCreateTemplate} className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              テンプレート追加
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              テンプレートが登録されていません
            </div>
          ) : (
            <div className="card p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3">名前</th>
                    <th className="px-4 py-3">サイズ (mm)</th>
                    <th className="px-4 py-3">余白 (mm)</th>
                    <th className="px-4 py-3">間隔 (mm)</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{t.name}</td>
                      <td className="px-4 py-3 text-gray-600">{t.width} × {t.height}</td>
                      <td className="px-4 py-3 text-gray-600">上{t.margin_top} 左{t.margin_left}</td>
                      <td className="px-4 py-3 text-gray-600">列{t.interval_column} 行{t.interval_row}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditTemplate(t)}
                            className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(t)}
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
        </>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <Modal
          title={editTemplate ? 'テンプレート編集' : 'テンプレート追加'}
          onClose={() => setShowTemplateModal(false)}
          size="md"
        >
          <div className="space-y-4">
            {templateFormError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{templateFormError}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート名 *</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="例: standard-58mm"
                className="input-field"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">幅 (mm)</label>
                <input type="number" min="0" step="0.5" value={templateForm.width} onChange={(e) => setTemplateForm({ ...templateForm, width: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">高さ (mm)</label>
                <input type="number" min="0" step="0.5" value={templateForm.height} onChange={(e) => setTemplateForm({ ...templateForm, height: e.target.value })} className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">上余白 (mm)</label>
                <input type="number" min="0" step="0.5" value={templateForm.margin_top} onChange={(e) => setTemplateForm({ ...templateForm, margin_top: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">左余白 (mm)</label>
                <input type="number" min="0" step="0.5" value={templateForm.margin_left} onChange={(e) => setTemplateForm({ ...templateForm, margin_left: e.target.value })} className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">列間隔 (mm)</label>
                <input type="number" min="0" step="0.5" value={templateForm.interval_column} onChange={(e) => setTemplateForm({ ...templateForm, interval_column: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">行間隔 (mm)</label>
                <input type="number" min="0" step="0.5" value={templateForm.interval_row} onChange={(e) => setTemplateForm({ ...templateForm, interval_row: e.target.value })} className="input-field" />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowTemplateModal(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleSaveTemplate} disabled={savingTemplate} className="btn-primary disabled:opacity-50">
                {savingTemplate ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
