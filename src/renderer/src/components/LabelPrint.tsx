import { useRef, useEffect } from 'react'
import { Printer } from 'lucide-react'
import type { Feature, LabelTemplate } from '@shared/types'

interface LabelItem {
  feature: Feature
  quantity: number
}

interface LabelPrintProps {
  items: LabelItem[]
  template: LabelTemplate | null
}

export default function LabelPrint({ items, template }: LabelPrintProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const width = template ? `${template.width}mm` : '58mm'
  const height = template ? `${template.height}mm` : '40mm'

  useEffect(() => {
    if (!containerRef.current) return
    renderBarcodes()
  }, [items])

  const renderBarcodes = async () => {
    const { default: JsBarcode } = await import('jsbarcode')
    items.forEach((item, idx) => {
      for (let q = 0; q < item.quantity; q++) {
        const canvas = document.getElementById(`barcode-canvas-${idx}-${q}`) as HTMLCanvasElement
        if (canvas) {
          try {
            JsBarcode(canvas, item.feature.full_code, {
              format: 'CODE128',
              width: 1.5,
              height: 40,
              displayValue: true,
              fontSize: 10,
              margin: 4
            })
          } catch {
            // barcode generation failed
          }
        }
      }
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const allLabels: { feature: Feature; barcodeId: string }[] = []
  items.forEach((item, idx) => {
    for (let q = 0; q < item.quantity; q++) {
      allLabels.push({ feature: item.feature, barcodeId: `barcode-canvas-${idx}-${q}` })
    }
  })

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        印刷するバリエーションを追加してください
      </div>
    )
  }

  return (
    <div>
      <div className="no-print mb-4">
        <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
          <Printer size={16} />
          印刷
        </button>
      </div>

      {/* Preview area */}
      <div className="no-print mb-4 p-4 bg-gray-100 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">
          プレビュー（{allLabels.length}枚）
          {template && <span className="ml-2 text-gray-400">テンプレート: {template.name}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {allLabels.slice(0, 6).map((label, i) => (
            <div
              key={i}
              className="bg-white border border-gray-300 rounded p-2 text-center"
              style={{ width: 120 }}
            >
              <div className="text-xs font-medium truncate">{label.feature.item_name}</div>
              <div className="text-xs text-gray-500">{label.feature.color_name} / {label.feature.size_name}</div>
              <div className="text-xs text-gray-400 font-mono">{label.feature.full_code}</div>
            </div>
          ))}
          {allLabels.length > 6 && (
            <div className="text-sm text-gray-500 self-center">他 {allLabels.length - 6} 枚...</div>
          )}
        </div>
      </div>

      {/* Print area - hidden on screen, visible when printing */}
      <div className="print-area hidden">
        <style>{`
          @media print {
            .print-area { display: block !important; }
            body > *:not(.print-area) { display: none !important; }
            .label-item {
              display: inline-block;
              width: ${width};
              height: ${height};
              border: 1px solid #ccc;
              padding: 4px;
              box-sizing: border-box;
              vertical-align: top;
              page-break-inside: avoid;
              text-align: center;
              font-family: sans-serif;
            }
            .label-name { font-size: 10pt; font-weight: bold; white-space: nowrap; overflow: hidden; }
            .label-variant { font-size: 8pt; color: #666; }
            .label-code { font-size: 8pt; font-family: monospace; }
          }
        `}</style>
        <div ref={containerRef}>
          {allLabels.map((label, i) => (
            <div key={i} className="label-item">
              <div className="label-name">{label.feature.item_name}</div>
              <div className="label-variant">{label.feature.color_name} / {label.feature.size_name}</div>
              <canvas id={label.barcodeId} style={{ maxWidth: '100%' }} />
              <div className="label-code">{label.feature.full_code}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
