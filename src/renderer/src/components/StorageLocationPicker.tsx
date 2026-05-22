import { useEffect } from 'react'
import { useRemoteItems } from '../stores/useRemoteItems'

interface StorageLocationPickerProps {
  value: string | number | ''
  onChange: (value: string | number | '') => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function StorageLocationPicker({
  value,
  onChange,
  placeholder = '保管場所を選択',
  className = '',
  disabled = false
}: StorageLocationPickerProps) {
  const locations = useRemoteItems((s) => s.locations)
  const locationsLoaded = useRemoteItems((s) => s.locationsLoaded)
  const loadLocations = useRemoteItems((s) => s.loadLocations)

  useEffect(() => {
    if (!locationsLoaded) void loadLocations()
  }, [locationsLoaded, loadLocations])

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
      disabled={disabled}
      className={`input-field ${className}`}
    >
      <option value="">{placeholder}</option>
      {locations.map((l) => (
        <option key={String(l.id)} value={String(l.id)}>
          {l.code} — {l.name}
        </option>
      ))}
    </select>
  )
}
