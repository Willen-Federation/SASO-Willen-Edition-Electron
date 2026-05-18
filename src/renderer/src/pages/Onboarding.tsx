import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link, Loader2, ServerCog } from 'lucide-react'

/// First-launch screen: ask the user to enter / verify the SASO server URL
/// before any auth flow runs. The Settings tab still exposes the same field
/// for power users, but this onboarding makes the requirement explicit on
/// fresh installs (no more silent fallback to a hardcoded default).
export default function Onboarding() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const normalize = (raw: string): string => raw.trim().replace(/\/+$/, '')

  const handleConnect = async (): Promise<void> => {
    const normalized = normalize(url)
    if (!normalized) {
      setError('URLを入力してください')
      return
    }
    if (!/^https?:\/\//i.test(normalized)) {
      setError('http:// または https:// で始まるURLを入力してください')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const test = await window.api.auth.testServerUrl(normalized)
      if (!test.success) {
        setError(`接続できませんでした: ${test.error || 'unknown'}`)
        return
      }
      const save = await window.api.settings.set('sasoServerUrl', normalized)
      if (!save.success) {
        setError(`保存に失敗しました: ${save.error || 'unknown'}`)
        return
      }
      navigate('/login', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <ServerCog className="text-primary-600" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">サーバーを設定</h1>
          <p className="text-gray-500 mt-1 text-sm">
            SASO バックエンドの URL を入力してください
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">
          SASO サーバー URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://saso.example.com"
          className="input-field"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleConnect()
          }}
        />
        <p className="text-xs text-gray-400 mt-1 mb-4">末尾スラッシュ不要</p>

        <button
          onClick={handleConnect}
          disabled={busy}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Link size={18} />}
          {busy ? '接続中…' : '接続して始める'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          サーバーURLは管理者にお問い合わせください
        </p>
      </div>
    </div>
  )
}
