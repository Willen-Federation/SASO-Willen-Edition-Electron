import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Loader2 } from 'lucide-react'
import { useAuth } from '../stores/useAuth'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitingForCallback, setWaitingForCallback] = useState(false)
  const [sasoServerUrl, setSasoServerUrl] = useState('')
  const { isAuthenticated, checkAuth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated])

  useEffect(() => {
    window.api.settings.get('sasoServerUrl').then((res) => {
      if (res.success && res.data) {
        setSasoServerUrl(res.data as string)
      }
    })

    const off = window.api.auth.onAuthCallback((user) => {
      if (user) {
        checkAuth().then(() => navigate('/', { replace: true }))
      }
    })
    return off
  }, [])

  const handlePair = async () => {
    setLoading(true)
    setError(null)
    setWaitingForCallback(true)
    try {
      const result = await window.api.auth.pair()
      if (!result.success) {
        setError(result.error || 'ペアリングに失敗しました')
        setWaitingForCallback(false)
      } else {
        await checkAuth()
        navigate('/', { replace: true })
      }
    } catch (e) {
      setError((e as Error).message)
      setWaitingForCallback(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <LogIn className="text-primary-600" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SASO Willen Edition</h1>
          <p className="text-gray-500 mt-1 text-sm">在庫・販売管理システム</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
        )}

        {waitingForCallback ? (
          <div className="text-center py-4">
            <Loader2 className="animate-spin mx-auto text-primary-600 mb-3" size={32} />
            <p className="text-gray-600">ブラウザでペアリングを完了してください…</p>
            <p className="text-gray-400 text-xs mt-2">
              ログイン後、自動的にアプリへ戻ります。
            </p>
            <button
              onClick={() => setWaitingForCallback(false)}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sasoServerUrl && (
              <div className="text-xs text-gray-400 text-center">
                サーバー: {sasoServerUrl}
              </div>
            )}
            <button
              onClick={handlePair}
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
              このデバイスをペアリング
            </button>
            <p className="text-xs text-gray-500 text-center">
              ブラウザで SASO にログインしてデバイスをペアリングします。
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          /api/v1/mobile/connect (JWT bearer)
        </p>
      </div>
    </div>
  )
}
