import { useState, useRef, useEffect, useCallback } from 'react'
import { Scan } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  placeholder?: string
  className?: string
}

/**
 * USBバーコードスキャナー専用入力コンポーネント
 * スキャナーからの高速連続入力（50ms未満）をバーコード入力として認識
 * 通常のキーボード入力も手動入力として対応
 */
export default function BarcodeScanner({
  onScan,
  placeholder = 'バーコードをスキャンまたは入力してEnter',
  className = ''
}: BarcodeScannerProps) {
  const [value, setValue] = useState('')
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastKeyTime = useRef<number>(0)
  const scanBuffer = useRef<string>('')

  // USBスキャナーからの高速キー入力を検知
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const active = document.activeElement
      // Ignore when any text input, textarea, select, or contenteditable has focus
      if (active === inputRef.current) return
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) return
      const now = Date.now()
      const timeDiff = now - lastKeyTime.current
      lastKeyTime.current = now

      if (e.key === 'Enter') {
        if (scanBuffer.current.length > 2) {
          const barcode = scanBuffer.current
          onScan(barcode)
          setLastScanned(barcode)
          setTimeout(() => setLastScanned(null), 2000)
        }
        scanBuffer.current = ''
        return
      }

      if (e.key.length === 1) {
        if (timeDiff < 50) {
          scanBuffer.current += e.key
        } else {
          scanBuffer.current = e.key
        }
      }
    },
    [onScan]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now()
    const timeDiff = now - lastKeyTime.current
    lastKeyTime.current = now

    if (e.key === 'Enter') {
      const barcode = value.trim()
      if (barcode.length > 0) {
        onScan(barcode)
        setLastScanned(barcode)
        setValue('')
        setTimeout(() => setLastScanned(null), 2000)
      }
      return
    }

    // 高速入力の場合はスキャナーとして扱う（フォーム自動サブミット）
    if (e.key.length === 1 && timeDiff < 30 && value.length > 5) {
      // スキャナー入力の場合はバッファに蓄積
      scanBuffer.current = value + e.key
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const barcode = value.trim()
    if (barcode.length > 0) {
      onScan(barcode)
      setLastScanned(barcode)
      setValue('')
      setTimeout(() => setLastScanned(null), 2000)
    }
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Scan size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          検索
        </button>
      </form>
      {lastScanned && (
        <p className="mt-1 text-xs text-green-600">
          スキャン完了: <span className="font-mono font-medium">{lastScanned}</span>
        </p>
      )}
    </div>
  )
}
