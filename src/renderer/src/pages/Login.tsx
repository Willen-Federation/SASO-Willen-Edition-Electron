import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Loader2 } from 'lucide-react'
import { useAuth } from '../stores/useAuth'
import type { AuthUser } from '@shared/types'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitingForCallback, setWaitingForCallback] = useState(false)
  const [sasoServerUrl, setSasoServerUrl] = useState('')
  const [credId, setCredId] = useState('')
  const [credPassword, setCredPassword] = useState('')
  const [mode, setMode] = useState<'credentials' | 'oauth'>('credentials')
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated])

  useEffect(() => {
    // Check if SASO server URL is configured
    window.api.settings.get('sasoServerUrl').then((res) => {
      if (res.success && res.data) {
        setSasoServerUrl(res.data as string)
        setMode(res.data ? 'credentials' : 'oauth')
      }
    })

    window.api.auth.onAuthCallback((user) => {
      if (user) {
        navigate('/', { replace: true })
      } else {
        setWaitingForCallback(false)
        setError('ログインに失敗しました')
      }
    })
    window.api.auth.onAuthError((err) => {
      setWaitingForCallback(false)
      setLoading(false)
      setError(err)
    })
  }, [])

  const handleCredentialLogin = async () => {
    if (!credId.trim() || !credPassword.trim()) {
      setError('IDとパスワードを入力してください')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.auth.loginWithCredentials(credId.trim(), credPassword)
      if (result.success && result.user) {
        const user: AuthUser = {
          id: result.user.id,
          name: result.user.name,
          email: '',
          token: '',
          expiresAt: ''
        }
        useAuth.setState({ user, token: '', isAuthenticated: true })
        navigate('/', { replace: true })
      } else {
        setError(result.error || 'ログインに失敗しました')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await login()
      setWaitingForCallback(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleBypassLogin = () => {
    const demoUser: AuthUser = { id: 'demo', name: 'デモユーザー', email: 'demo@example.com', token: 'demo', expiresAt: '' }
    useAuth.setState({ user: demoUser, token: 'demo', isAuthenticated: true })
    navigate('/', { replace: true })
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
            <p className="text-gray-600">ブラウザでログイン中...</p>
            <p className="text-gray-400 text-xs mt-2">ブラウザでの認証完了後、自動的に戻ります</p>
            <button
              onClick={() => setWaitingForCallback(false)}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <>
            {/* Mode selector */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
              <button
                onClick={() => setMode('credentials')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${mode === 'credentials' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ID・パスワード
              </button>
              <button
                onClick={() => setMode('oauth')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${mode === 'oauth' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                OAuth / ブラウザ
              </button>
            </div>

            {mode === 'credentials' && (
              <div className="space-y-3">
                {sasoServerUrl && (
                  <div className="text-xs text-gray-400 text-center">
                    サーバー: {sasoServerUrl}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ユーザーID</label>
                  <input
                    type="text"
                    value={credId}
                    onChange={(e) => setCredId(e.target.value)}
                    placeholder="ID を入力"
                    className="input-field"
                    onKeyDown={(e) => e.key === 'Enter' && handleCredentialLogin()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                  <input
                    type="password"
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    placeholder="パスワードを入力"
                    className="input-field"
                    onKeyDown={(e) => e.key === 'Enter' && handleCredentialLogin()}
                  />
                </div>
                <button
                  onClick={handleCredentialLogin}
                  disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
                  ログイン
                </button>
              </div>
            )}

            {mode === 'oauth' && (
              <div className="space-y-3">
                <button
                  onClick={handleOAuthLogin}
                  disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
                  ブラウザでログイン
                </button>
              </div>
            )}

            <div className="mt-3">
              <button
                onClick={handleBypassLogin}
                className="w-full btn-secondary py-3 text-sm"
              >
                デモモードで開始（認証なし）
              </button>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          {mode === 'oauth' ? 'OAuth 2.0 PKCE フロー使用' : 'SASO バックエンド認証'}
        </p>
      </div>
    </div>
  )
}
