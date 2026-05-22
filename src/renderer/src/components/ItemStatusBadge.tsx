import type { ItemStatus } from '@shared/types'

const STATUS_META: Record<ItemStatus, { label: string; classes: string }> = {
  active: { label: 'アクティブ', classes: 'bg-green-100 text-green-700' },
  archived: { label: 'アーカイブ', classes: 'bg-gray-100 text-gray-600' },
  discontinued: { label: '販売終了', classes: 'bg-red-100 text-red-700' },
  pending: { label: '保留中', classes: 'bg-yellow-100 text-yellow-700' },
  in_storage: { label: '保管中', classes: 'bg-blue-100 text-blue-700' },
  in_use: { label: '利用中', classes: 'bg-indigo-100 text-indigo-700' },
  for_sale: { label: '販売中', classes: 'bg-emerald-100 text-emerald-700' },
  reserved: { label: '仮押さえ', classes: 'bg-orange-100 text-orange-700' },
  shipped: { label: '発送済み', classes: 'bg-purple-100 text-purple-700' }
}

export const ITEM_STATUS_VALUES: ItemStatus[] = [
  'active',
  'in_storage',
  'in_use',
  'for_sale',
  'reserved',
  'shipped',
  'pending',
  'archived',
  'discontinued'
]

export function itemStatusLabel(status: ItemStatus): string {
  return STATUS_META[status]?.label ?? status
}

export default function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const meta = STATUS_META[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.classes}`}>
      {meta.label}
    </span>
  )
}
