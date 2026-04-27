import { useEffect, useState } from 'react'
import { Users, Plus, Edit2, Search } from 'lucide-react'
import { useSales } from '../stores/useSales'
import Modal from '../components/Modal'
import type { Customer } from '@shared/types'

interface CustomerForm {
  name: string
  email: string
  phone: string
  address: string
}

const emptyForm: CustomerForm = { name: '', email: '', phone: '', address: '' }

export default function Customers() {
  const { customers, loading, loadCustomers, createCustomer } = useSales()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadCustomers() }, [])

  const filtered = customers.filter(c =>
    !search || c.name.includes(search) || (c.email || '').includes(search) || (c.phone || '').includes(search)
  )

  const openCreate = () => {
    setEditCustomer(null)
    setForm(emptyForm)
    setError(null)
    setShowModal(true)
  }

  const openEdit = (c: Customer) => {
    setEditCustomer(c)
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '' })
    setError(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('顧客名は必須です'); return }
    setSaving(true)
    setError(null)
    if (editCustomer) {
      const res = await window.api.customers.update(editCustomer.id, {
        name: form.name, email: form.email || null, phone: form.phone || null, address: form.address || null
      })
      if (res.success) { await loadCustomers(); setShowModal(false) }
      else setError(res.error || '更新に失敗しました')
    } else {
      const res = await createCustomer({ name: form.name, email: form.email || null, phone: form.phone || null, address: form.address || null })
      if (res) setShowModal(false)
      else setError('作成に失敗しました')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">顧客管理</h2>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} />顧客追加
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="名前・メール・電話で検索" className="input-field pl-9" />
        </div>
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users size={36} className="mx-auto mb-2 opacity-30" />
            <div>{search ? '検索結果がありません' : '顧客が登録されていません'}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3">顧客名</th>
                  <th className="px-4 py-3">メール</th>
                  <th className="px-4 py-3">電話</th>
                  <th className="px-4 py-3">住所</th>
                  <th className="px-4 py-3">登録日</th>
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-40">{c.address || '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(c.created_at).toLocaleDateString('ja-JP')}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50">
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editCustomer ? '顧客編集' : '顧客追加'} onClose={() => setShowModal(false)} size="md">
          <div className="space-y-4">
            {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">顧客名 *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="input-field" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
              <textarea value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} className="input-field" rows={2} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
