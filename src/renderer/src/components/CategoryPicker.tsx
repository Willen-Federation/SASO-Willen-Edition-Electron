import { useEffect } from 'react'
import { useRemoteItems } from '../stores/useRemoteItems'

interface CategoryPickerProps {
  value: string | number | ''
  onChange: (value: string | number | '') => void
  required?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function CategoryPicker({
  value,
  onChange,
  required = false,
  placeholder = 'カテゴリを選択',
  className = '',
  disabled = false
}: CategoryPickerProps) {
  const categories = useRemoteItems((s) => s.categories)
  const categoriesLoaded = useRemoteItems((s) => s.categoriesLoaded)
  const loadCategories = useRemoteItems((s) => s.loadCategories)

  useEffect(() => {
    if (!categoriesLoaded) void loadCategories()
  }, [categoriesLoaded, loadCategories])

  return (
    <select
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => {
        const v = e.target.value
        if (v === '') {
          onChange('')
        } else {
          const n = Number(v)
          onChange(Number.isFinite(n) && String(n) === v ? n : v)
        }
      }}
      required={required}
      disabled={disabled}
      className={`input-field ${className}`}
    >
      <option value="">{required ? `${placeholder} *` : placeholder}</option>
      {categories.map((c) => (
        <option key={String(c.id)} value={String(c.id)}>
          {'　'.repeat(c.depth || 0)}
          {c.name}
        </option>
      ))}
    </select>
  )
}
