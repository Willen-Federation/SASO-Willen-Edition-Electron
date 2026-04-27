import { useRef, useEffect } from 'react'
import { Printer } from 'lucide-react'
import type { Product } from '@shared/types'

interface LabelItem {
  product: Product
  quantity: number
}

interface LabelPrintProps {
  items: LabelItem[]
  labelSize?: '58mm' | '40x30' | 'custom'
}

export default function LabelPrint({ items, labelSize = '58mm' }: LabelPrintProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const labelDimensions = {
    '58mm': { width: '58mm', height: '40mm' },
    '40x30': { width: '40mm', height: '30mm' },
    custom: { width: '80mm', height: '50mm' }
  }[labelSize]

  useEffect(() => {
    if (!containerRef.current) return
    renderBarcodes()
  }, [items])

  const renderBarcodes = async () => {
    const { default: JsBarcode } = await import('jsbarcode')
    items.forEach((item, idx) => {
      for (let q = 0; q < item.quantity; q++) {
        const canvas = document.getElementById(`barcode-canvas-${idx}-${q}`) as HTMLCanvasElement
        if (canvas && item.product.barcode) {
          try {
            JsBarcode(canvas, item.product.barcode, {
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

  const allLabels: { product: Product; barcodeId: string }[] = []
  items.forEach((item, idx) => {
    for (let q = 0; q < item.quantity; q++) {
      allLabels.push({ product: item.product, barcodeId: `barcode-canvas-${idx}-${q}` })
    }
  })

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        印刷する商品を追加してください
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
        <p className="text-sm text-gray-600 mb-2">プレビュー（{allLabels.length}枚）</p>
        <div className="flex flex-wrap gap-2">
          {allLabels.slice(0, 6).map((label, i) => (
            <div
              key={i}
              className="bg-white border border-gray-300 rounded p-2 text-center"
              style={{ width: 120 }}
            >
              <div className="text-xs font-medium truncate">{label.product.name}</div>
              <div className="text-xs text-gray-500">¥{label.product.price.toLocaleString()}</div>
              {label.product.barcode && (
                <div className="text-xs text-gray-400 font-mono">{label.product.barcode}</div>
              )}
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
              width: ${labelDimensions.width};
              height: ${labelDimensions.height};
              border: 1px solid #ccc;
              padding: 4px;
              box-sizing: border-box;
              vertical-align: top;
              page-break-inside: avoid;
              text-align: center;
              font-family: sans-serif;
            }
            .label-name { font-size: 10pt; font-weight: bold; white-space: nowrap; overflow: hidden; }
            .label-price { font-size: 9pt; }
          }
        `}</style>
        <div ref={containerRef}>
          {allLabels.map((label, i) => (
            <div key={i} className="label-item">
              <div className="label-name">{label.product.name}</div>
              {label.product.barcode && (
                <canvas id={label.barcodeId} style={{ maxWidth: '100%' }} />
              )}
              <div className="label-price">¥{label.product.price.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
