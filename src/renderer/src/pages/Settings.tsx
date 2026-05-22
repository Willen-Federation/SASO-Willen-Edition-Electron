import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save, Eye, EyeOff, CheckCircle, ExternalLink, RefreshCw, Trash2, AlertTriangle, CloudOff } from 'lucide-react'
import { useFeatureFlags } from '../stores/useFeatureFlags'
import { useSyncQueue } from '../stores/useSyncQueue'
import type { AuthUser, PendingSyncOp } from '@shared/types'

type Tab = 'ai' | 'auth' | 'sync' | 'general'

interface Settings {
  aiProvider: string
  claudeApiKey: string
  claudeModel: string
  openaiApiKey: string
  openaiModel: string
  geminiApiKey: string
  geminiModel: string
  sasoServerUrl: string
  taxRate: string
  currency: string
  defaultLabelSize: string
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'APIキーを非表示' : 'APIキーを表示'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

function TestConnectionRow() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [detail, setDetail] = useState<string>('')
  const [running, setRunning] = useState(false)
  const handle = async () => {
    setRunning(true)
    const res = await window.api.sync.health()
    setRunning(false)
    if (res.success) {
      setStatus('ok')
      setDetail(JSON.stringify(res.data))
    } else {
      setStatus('err')
      setDetail(res.error || 'unknown error')
    }
  }
  return (
    <div className="border-t border-gray-100 pt-4">
      <button onClick={handle} disabled={running} className="btn-secondary text-sm disabled:opacity-50">
        {running ? 'チェック中…' : '接続テスト (/api/v1/health)'}
      </button>
      {status === 'ok' && <p className="text-xs text-green-600 mt-2 font-mono break-all">{detail}</p>}
      {status === 'err' && <p className="text-xs text-red-600 mt-2 font-mono break-all">{detail}</p>}
    </div>
  )
}

function DeviceInfoSection({ serverUrl }: { serverUrl: string }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    window.api.auth.getUser().then((r) => {
      if (r.success && r.data) setUser(r.data as AuthUser)
    })
  }, [])

  const openMyPage = async () => {
    if (!serverUrl) return
    const trimmed = serverUrl.replace(/\/+$/, '')
    await window.api.shell.openExternal(`${trimmed}/mypage/start/`)
  }

  if (!user) {
    return (
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-gray-700 mb-2">デバイス情報</p>
        <p className="text-sm text-gray-500">未ペアリングです</p>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 pt-4 space-y-2">
      <p className="text-sm font-medium text-gray-700">デバイス情報</p>
      <dl className="text-xs text-gray-600 grid grid-cols-[120px_1fr] gap-y-1">
        <dt>デバイス名</dt>
        <dd className="font-mono">{user.deviceName || user.name}</dd>
        <dt>デバイス ID</dt>
        <dd className="font-mono">{user.deviceId !== undefined ? String(user.deviceId) : '-'}</dd>
        <dt>メンバー ID</dt>
        <dd className="font-mono">{user.memberId || user.id || '-'}</dd>
        <dt>JWT 有効期限</dt>
        <dd className="font-mono">{user.expiresAt || '-'}</dd>
        <dt>付与スコープ</dt>
        <dd className="flex flex-wrap gap-1">
          {(user.scopes ?? []).length > 0 ? (
            (user.scopes ?? []).map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 font-mono text-gray-700">
                {s}
              </span>
            ))
          ) : (
            <span className="text-gray-400">なし</span>
          )}
        </dd>
      </dl>
      <button
        onClick={openMyPage}
        disabled={!serverUrl}
        className="btn-secondary text-sm flex items-center gap-2 mt-3 disabled:opacity-50"
      >
        <ExternalLink size={14} />
        サーバー側で詳細管理 (/mypage)
      </button>
      <p className="text-xs text-gray-400">
        他端末の一覧や失効など、ペアリング済みデバイスの管理は SASO サーバーの MyPage で行います。
      </p>
    </div>
  )
}

function FeatureFlagsSection() {
  const flags = useFeatureFlags((s) => s.flags)
  const loaded = useFeatureFlags((s) => s.loaded)
  const loading = useFeatureFlags((s) => s.loading)
  const version = useFeatureFlags((s) => s.version)
  const generatedAt = useFeatureFlags((s) => s.generatedAt)
  const error = useFeatureFlags((s) => s.error)
  const load = useFeatureFlags((s) => s.load)

  return (
    <div className="border-t border-gray-100 pt-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">フィーチャーフラグ</p>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          再取得
        </button>
      </div>
      {!loaded && !loading && (
        <p className="text-xs text-gray-400">ペアリング後に自動取得されます</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {loaded && (
        <>
          <p className="text-xs text-gray-400">
            version: <span className="font-mono">{version || '-'}</span>{' '}
            <span className="mx-1">·</span> generated: <span className="font-mono">{generatedAt || '-'}</span>
          </p>
          {flags.length === 0 ? (
            <p className="text-xs text-gray-400">フラグはありません</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {flags.map((f) => (
                <span
                  key={f.key}
                  className={`text-xs px-2 py-0.5 rounded font-mono ${
                    f.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                  title={f.rolloutPercent !== undefined ? `rollout: ${f.rolloutPercent}%` : undefined}
                >
                  {f.key}: {f.enabled ? 'on' : 'off'}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SyncQueueSection() {
  const counts = useSyncQueue((s) => s.counts)
  const ops = useSyncQueue((s) => s.ops)
  const draining = useSyncQueue((s) => s.draining)
  const refresh = useSyncQueue((s) => s.refresh)
  const drainNow = useSyncQueue((s) => s.drainNow)
  const remove = useSyncQueue((s) => s.remove)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const renderRow = (op: PendingSyncOp) => {
    const badgeColor =
      op.status === 'conflict'
        ? 'bg-red-100 text-red-700'
        : op.status === 'failed'
        ? 'bg-gray-200 text-gray-700'
        : 'bg-yellow-100 text-yellow-700'
    return (
      <div key={op.id} className="border border-gray-200 rounded-lg p-3 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded ${badgeColor}`}>
              {op.status === 'pending' ? '保留中' : op.status === 'conflict' ? '競合' : '失敗'}
            </span>
            <span className="font-mono text-gray-600">
              {op.method} {op.endpoint}
            </span>
          </div>
          <button
            onClick={() => void remove(op.id)}
            className="text-red-400 hover:text-red-600"
            title="削除"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="text-gray-500 grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span>retry: {op.retryCount}</span>
          <span>作成: {op.createdAt}</span>
        </div>
        {op.lastError && (
          <p className="text-red-600 font-mono break-all">{op.lastError}</p>
        )}
        <details className="text-gray-400">
          <summary className="cursor-pointer">body</summary>
          <pre className="font-mono whitespace-pre-wrap break-all bg-gray-50 p-2 rounded mt-1">{op.body}</pre>
        </details>
      </div>
    )
  }

  const hasIssues = counts.conflict > 0 || counts.failed > 0

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        <p className="font-medium mb-1">オフラインキュー</p>
        <p>
          オフライン中の作成/更新は SQLite に保存され、30秒ごとの自動チェックで復旧後に順次再送されます。
          Idempotency-Key により重複登録は起きません。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card p-3">
          <div className="text-xs text-gray-500">保留中</div>
          <div className="text-2xl font-bold text-yellow-700">{counts.pending}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-gray-500">競合</div>
          <div className="text-2xl font-bold text-red-700">{counts.conflict}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-gray-500">失敗</div>
          <div className="text-2xl font-bold text-gray-700">{counts.failed}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void drainNow()}
          disabled={draining || counts.pending === 0}
          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={draining ? 'animate-spin' : ''} />
          {draining ? '同期中...' : '今すぐ再送'}
        </button>
        <button onClick={() => void refresh()} className="btn-secondary text-sm">
          再読み込み
        </button>
      </div>

      {hasIssues && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            競合または失敗エントリがあります。サーバー側で対象が更新された可能性があります。確認の上、削除してください。
          </span>
        </div>
      )}

      {ops.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <CloudOff size={28} className="mx-auto mb-2 opacity-30" />
          <div className="text-sm">同期待ちのオペレーションはありません</div>
        </div>
      ) : (
        <div className="space-y-2">{ops.map(renderRow)}</div>
      )}
    </div>
  )
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'ai'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [settings, setSettings] = useState<Settings>({
    aiProvider: 'claude',
    claudeApiKey: '',
    claudeModel: 'claude-opus-4-5',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-pro',
    sasoServerUrl: '',
    taxRate: '10',
    currency: 'JPY',
    defaultLabelSize: '58mm'
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.settings.getAll().then((res) => {
      if (res.success && res.data) {
        const s = res.data as Record<string, string>
        setSettings((prev) => ({ ...prev, ...s }))
      }
    })
  }, [])

  const set = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    for (const [key, value] of Object.entries(settings)) {
      await window.api.settings.set(key, String(value))
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ai', label: 'AI設定' },
    { id: 'auth', label: '認証' },
    { id: 'sync', label: '同期' },
    { id: 'general', label: '一般' }
  ]

  const switchTab = (next: Tab) => {
    setTab(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'ai') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">設定</h2>
        {tab !== 'sync' && (
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saving ? '保存中...' : saved ? '保存しました' : '保存'}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card space-y-5">
        {tab === 'ai' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AIプロバイダー</label>
              <select value={settings.aiProvider} onChange={(e) => set('aiProvider', e.target.value)} className="input-field">
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">ChatGPT (OpenAI)</option>
                <option value="gemini">Gemini (Google)</option>
              </select>
            </div>

            <div className="space-y-4">
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
                  Claude (Anthropic)
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">APIキー</label>
                    <SecretInput value={settings.claudeApiKey} onChange={(v) => set('claudeApiKey', v)} placeholder="sk-ant-..." />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">モデル</label>
                    <select value={settings.claudeModel} onChange={(e) => set('claudeModel', e.target.value)} className="input-field">
                      <option value="claude-opus-4-5">claude-opus-4-5</option>
                      <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                      <option value="claude-haiku-4-5-20251001">claude-haiku-4-5</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  ChatGPT (OpenAI)
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">APIキー</label>
                    <SecretInput value={settings.openaiApiKey} onChange={(v) => set('openaiApiKey', v)} placeholder="sk-..." />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">モデル</label>
                    <select value={settings.openaiModel} onChange={(e) => set('openaiModel', e.target.value)} className="input-field">
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4-turbo">gpt-4-turbo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                  Gemini (Google)
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">APIキー</label>
                    <SecretInput value={settings.geminiApiKey} onChange={(v) => set('geminiApiKey', v)} placeholder="AIza..." />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">モデル</label>
                    <select value={settings.geminiModel} onChange={(e) => set('geminiModel', e.target.value)} className="input-field">
                      <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'auth' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium mb-1">SASO ペアリング</p>
              <p>
                サーバー URL を指定し「このデバイスをペアリング」でブラウザ経由の OAuth ペアリングを行います。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SASO サーバー URL</label>
              <input
                type="url"
                value={settings.sasoServerUrl}
                onChange={(e) => set('sasoServerUrl', e.target.value)}
                placeholder="https://saso.example.com"
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1">SASO バックエンドの URL(末尾スラッシュ不要)。空欄のままだと起動時にオンボーディング画面でURL入力を求められます。</p>
            </div>

            <TestConnectionRow />
            <DeviceInfoSection serverUrl={settings.sasoServerUrl} />
            <FeatureFlagsSection />
          </div>
        )}

        {tab === 'sync' && <SyncQueueSection />}

        {tab === 'general' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">消費税率 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={settings.taxRate}
                onChange={(e) => set('taxRate', e.target.value)}
                className="input-field w-32"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">通貨</label>
              <select value={settings.currency} onChange={(e) => set('currency', e.target.value)} className="input-field w-40">
                <option value="JPY">JPY (日本円)</option>
                <option value="USD">USD (米ドル)</option>
                <option value="EUR">EUR (ユーロ)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">デフォルトラベルサイズ</label>
              <select value={settings.defaultLabelSize} onChange={(e) => set('defaultLabelSize', e.target.value)} className="input-field w-48">
                <option value="58mm">58mm幅</option>
                <option value="40x30">40×30mm</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
