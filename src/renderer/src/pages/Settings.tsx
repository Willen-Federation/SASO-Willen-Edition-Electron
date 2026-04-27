import { useEffect, useState } from 'react'
import { Save, Eye, EyeOff, CheckCircle } from 'lucide-react'

type Tab = 'ai' | 'auth' | 'general'

interface Settings {
  aiProvider: string
  claudeApiKey: string
  claudeModel: string
  openaiApiKey: string
  openaiModel: string
  geminiApiKey: string
  geminiModel: string
  authServerUrl: string
  authClientId: string
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

export default function Settings() {
  const [tab, setTab] = useState<Tab>('ai')
  const [settings, setSettings] = useState<Settings>({
    aiProvider: 'claude',
    claudeApiKey: '',
    claudeModel: 'claude-opus-4-5',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-pro',
    authServerUrl: '',
    authClientId: '',
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

  const tabs = [
    { id: 'ai', label: 'AI設定' },
    { id: 'auth', label: '認証' },
    { id: 'general', label: '一般' }
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">設定</h2>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saving ? '保存中...' : saved ? '保存しました' : '保存'}
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
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
            <p className="text-sm text-gray-500">OAuth 2.0 PKCE フローでブラウザ経由ログインを設定します。</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">認証サーバーURL</label>
              <input
                type="url"
                value={settings.authServerUrl}
                onChange={(e) => set('authServerUrl', e.target.value)}
                placeholder="https://auth.example.com"
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1">例: https://your-auth-server.com（末尾スラッシュ不要）</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">クライアントID</label>
              <input
                type="text"
                value={settings.authClientId}
                onChange={(e) => set('authClientId', e.target.value)}
                placeholder="your-client-id"
                className="input-field"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium mb-1">リダイレクトURI設定</p>
              <p>認証サーバーに以下のリダイレクトURIを登録してください:</p>
              <code className="block mt-1 font-mono bg-blue-100 px-2 py-1 rounded">saso://auth/callback</code>
            </div>
          </div>
        )}

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
