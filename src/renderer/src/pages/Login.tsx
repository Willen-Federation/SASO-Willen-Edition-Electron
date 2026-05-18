import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogIn,
  Loader2,
  KeyRound,
  ShieldCheck,
  Lock,
  Cloud,
  Flame,
  ExternalLink
} from 'lucide-react'
import type { AuthProviderSummary, ServerAuthDiscovery } from '@shared/types'
import { useAuth } from '../stores/useAuth'

/// Unified login page.
///
/// Lays out three independent sections after fetching
/// `GET /api/v1/auth/providers` from the configured SASO server:
///   1. Username / password — rendered as a "ログイン" button that opens the
///      server's `/m/setup?provider_id=<local-id>` flow in the system
///      browser. The browser shows `/auth/start/{id}` so the user types
///      credentials there (avoids the app shipping with a credential POST
///      against a non-existent JWT-issuing endpoint).
///   2. Server-configured providers — one button per enabled non-local
///      provider, same browser hand-off but scoped to that provider.
///   3. QR code / manual token — the existing pairing flow.
export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitingForCallback, setWaitingForCallback] = useState(false)
  const [sasoServerUrl, setSasoServerUrl] = useState('')
  const [discovery, setDiscovery] = useState<ServerAuthDiscovery | null>(null)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualPayload, setManualPayload] = useState('')
  const { isAuthenticated, checkAuth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    void window.api.settings.get('sasoServerUrl').then((res) => {
      if (res.success && res.data) {
        setSasoServerUrl(res.data as string)
      } else {
        // Belt-and-braces: if the URL slipped past the App-level guard,
        // bounce the user straight to onboarding rather than render a
        // dysfunctional login page.
        navigate('/onboarding', { replace: true })
      }
    })
  }, [navigate])

  useEffect(() => {
    if (!sasoServerUrl) return
    void window.api.auth.discoverProviders().then((res) => {
      if (res.success && res.data) {
        setDiscovery(res.data)
      } else {
        setDiscoveryError(res.error || 'プロバイダー情報を取得できませんでした')
      }
    })
  }, [sasoServerUrl])

  useEffect(() => {
    const off = window.api.auth.onAuthCallback((user) => {
      if (user) {
        void checkAuth().then(() => navigate('/', { replace: true }))
      }
    })
    return off
  }, [checkAuth, navigate])

  const handlePair = async (providerId?: number): Promise<void> => {
    setLoading(true)
    setError(null)
    setWaitingForCallback(true)
    try {
      const result = await window.api.auth.pair(providerId)
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

  const handleManualPair = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.auth.pairWithToken(manualPayload)
      if (!result.success) {
        setError(result.error || 'ペアリングに失敗しました')
      } else {
        await checkAuth()
        navigate('/', { replace: true })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const localProvider = discovery?.providers.find(
    (p) => p.enabled && p.type === 'local'
  )
  const externalProviders =
    discovery?.providers.filter((p) => p.enabled && p.type !== 'local') ?? []

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <LogIn className="text-primary-600" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SASO Willen Edition</h1>
          {discovery?.serverName && (
            <p className="text-gray-700 mt-1 text-sm font-medium">
              {discovery.serverName}
            </p>
          )}
          {sasoServerUrl && (
            <p className="text-gray-400 mt-0.5 text-xs">{sasoServerUrl}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
        )}
        {discoveryError && !discovery && (
          <div className="bg-yellow-50 text-yellow-800 rounded-lg p-3 mb-4 text-xs">
            プロバイダー情報の取得に失敗しました ({discoveryError})。ユーザー名/パスワードログインのみ利用できます。
          </div>
        )}

        {waitingForCallback ? (
          <div className="text-center py-4">
            <Loader2 className="animate-spin mx-auto text-primary-600 mb-3" size={32} />
            <p className="text-gray-600">ブラウザでログインを完了してください…</p>
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
          <div className="space-y-4">
            {/* ── 2-a. Username / password (Local provider) ────────────── */}
            <SectionHeader icon={<Lock size={14} />} label="ユーザー名でログイン" />
            <button
              onClick={() => void handlePair(localProvider?.id)}
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <ExternalLink size={18} />
              )}
              ユーザー名とパスワードでログイン
            </button>
            <p className="text-xs text-gray-500">
              ブラウザで SASO のログイン画面が開き、認証後にアプリへ戻ります。
            </p>

            {/* ── 2-c. Server-configured providers ──────────────────────── */}
            {externalProviders.length > 0 && (
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <SectionHeader
                  icon={<ShieldCheck size={14} />}
                  label="サーバー設定のログイン方法"
                />
                {externalProviders.map((provider) => (
                  <ProviderButton
                    key={provider.id}
                    provider={provider}
                    disabled={loading}
                    onClick={() => void handlePair(provider.id)}
                  />
                ))}
              </div>
            )}

            {/* ── 2-b. QR / manual token ────────────────────────────────── */}
            <div className="pt-3 border-t border-gray-200">
              <SectionHeader
                icon={<KeyRound size={14} />}
                label="QRコード / 手動トークン"
              />
              {!manualMode ? (
                <button
                  onClick={() => {
                    setManualMode(true)
                    setError(null)
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-800 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <KeyRound size={14} />
                  ペアリングコードを手動で入力
                </button>
              ) : (
                <div className="space-y-2 mt-2">
                  <label className="text-xs text-gray-600 block">
                    管理画面で発行したペアリングコード (SASO1:...) を貼り付けてください
                  </label>
                  <textarea
                    value={manualPayload}
                    onChange={(e) => setManualPayload(e.target.value)}
                    placeholder="SASO1:xxxxxxxx|https://saso.example.com"
                    rows={3}
                    className="w-full text-xs font-mono border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleManualPair()}
                      disabled={loading || !manualPayload.trim()}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 py-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <KeyRound size={16} />
                      )}
                      ペアリングを実行
                    </button>
                    <button
                      onClick={() => {
                        setManualMode(false)
                        setManualPayload('')
                        setError(null)
                      }}
                      className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          /api/v1/mobile/connect (JWT bearer)
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({
  icon,
  label
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
      <span className="text-primary-600">{icon}</span>
      {label}
    </div>
  )
}

function ProviderButton({
  provider,
  disabled,
  onClick
}: {
  provider: AuthProviderSummary
  disabled: boolean
  onClick: () => void
}) {
  const Icon = providerIcon(provider.type)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 text-sm text-gray-700 hover:text-gray-900 py-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
    >
      <Icon size={16} />
      {provider.name}
    </button>
  )
}

function providerIcon(type: AuthProviderSummary['type']): typeof Cloud {
  switch (type) {
    case 'firebase':
      return Flame
    case 'auth0':
      return ShieldCheck
    case 'cognito':
      return Cloud
    case 'saml':
      return ShieldCheck
    case 'oidc':
    default:
      return ExternalLink
  }
}
