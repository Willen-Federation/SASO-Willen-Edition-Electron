import { useState, useRef, useEffect, useCallback } from 'react'
import { Scan, Camera, CameraOff, RefreshCw } from 'lucide-react'

type ScanMode = 'keyboard' | 'camera'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  placeholder?: string
  className?: string
  defaultMode?: ScanMode
}

export default function BarcodeScanner({
  onScan,
  placeholder = 'バーコードをスキャンまたは入力してEnter',
  className = '',
  defaultMode = 'keyboard'
}: BarcodeScannerProps) {
  const [mode, setMode] = useState<ScanMode>(defaultMode)
  const [value, setValue] = useState('')
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [cameraReady, setCameraReady] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastKeyTime = useRef<number>(0)
  const scanBuffer = useRef<string>('')
  // IScannerControls returned by decodeFromVideoDevice
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    setCameraReady(false)
  }, [])

  useEffect(() => {
    if (mode !== 'camera') {
      stopCamera()
      return
    }

    let cancelled = false

    const startCamera = async () => {
      setCameraError(null)
      setCameraReady(false)
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')

        const deviceList = await BrowserMultiFormatReader.listVideoInputDevices()
        if (cancelled) return

        setCameras(deviceList)

        if (deviceList.length === 0) {
          setCameraError('カメラが見つかりません。カメラが接続されているか確認してください。')
          setMode('keyboard')
          return
        }

        // Determine which camera to use
        const validId = deviceList.find((d) => d.deviceId === selectedCamera)?.deviceId
        const deviceId = validId || deviceList[0].deviceId

        // First call: no camera selected yet — set it and let the effect re-run
        if (!selectedCamera) {
          setSelectedCamera(deviceId)
          return
        }

        if (!videoRef.current || cancelled) return

        const reader = new BrowserMultiFormatReader()

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, _err) => {
            if (result && !cancelled) {
              const barcode = result.getText()
              onScan(barcode)
              setLastScanned(barcode)
              setTimeout(() => setLastScanned(null), 2500)
            }
          }
        )

        if (cancelled) {
          controls.stop()
          return
        }

        controlsRef.current = controls
        setCameraReady(true)
      } catch (e) {
        if (!cancelled) {
          const msg = (e as Error).message || ''
          if (msg.includes('Permission') || msg.includes('NotAllowed')) {
            setCameraError('カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。')
          } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
            setCameraError('カメラが見つかりません。')
          } else {
            setCameraError(`カメラの起動に失敗しました: ${msg}`)
          }
          setMode('keyboard')
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [mode, selectedCamera, onScan, stopCamera])

  // USB/hardware scanner: detect rapid keydown bursts globally
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (mode !== 'keyboard') return
      const active = document.activeElement
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
    [onScan, mode]
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

    if (e.key.length === 1 && timeDiff < 30 && value.length > 5) {
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

  const switchToCamera = () => {
    setCameraError(null)
    setSelectedCamera('')
    setMode('camera')
  }

  const switchToKeyboard = () => {
    setMode('keyboard')
  }

  const retryCamera = () => {
    setCameraError(null)
    setSelectedCamera('')
    setMode('camera')
  }

  return (
    <div className={className}>
      {mode === 'keyboard' ? (
        /* ── キーボード / USB スキャナーモード ── */
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
          <button
            type="button"
            onClick={switchToCamera}
            aria-label="カメラモードに切替"
            title="Webカメラでスキャン"
            className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
          >
            <Camera size={16} />
            <span className="hidden sm:inline text-xs">カメラ</span>
          </button>
        </form>
      ) : (
        /* ── カメラモード ── */
        <div className="space-y-2">
          {/* カメラ選択 + 終了ボタン */}
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {cameras.map((cam, i) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `カメラ ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={switchToKeyboard}
              aria-label="キーボードモードに切替"
              className="ml-auto px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            >
              <CameraOff size={15} />
              <span className="text-xs">終了</span>
            </button>
          </div>

          {cameraError ? (
            /* エラー表示 */
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{cameraError}</p>
              <button
                type="button"
                onClick={retryCamera}
                className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                <RefreshCw size={12} /> 再試行
              </button>
            </div>
          ) : (
            /* カメラビュー */
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3', maxHeight: 260 }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* スキャンガイド枠 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="border-2 border-green-400 rounded-md"
                  style={{ width: '62%', height: '38%' }}
                />
              </div>
              {/* 準備中インジケーター */}
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">カメラ起動中…</span>
                  </div>
                </div>
              )}
              {/* スキャン成功フラッシュ */}
              {lastScanned && (
                <div className="absolute inset-x-0 bottom-0 bg-green-500/90 py-1.5 text-center">
                  <span className="text-white text-xs font-medium">✓ {lastScanned}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* キーボードモード時のスキャン完了通知 */}
      {mode === 'keyboard' && lastScanned && (
        <p className="mt-1 text-xs text-green-600">
          スキャン完了: <span className="font-mono font-medium">{lastScanned}</span>
        </p>
      )}
    </div>
  )
}
