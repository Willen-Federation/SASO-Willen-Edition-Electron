import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Wrench, ChevronDown, ChevronUp } from 'lucide-react'
import type { AIMessage, ToolCall } from '@shared/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  timestamp: Date
}

const EXAMPLE_COMMANDS = [
  '在庫一覧を表示して',
  '今日の売上を教えて',
  '在庫が少ない商品はどれ？',
  'ダッシュボードの統計を見せて',
]

function ToolCallDisplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded-lg p-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-blue-600 font-medium"
      >
        <Wrench size={12} />
        ツール呼び出し ({toolCalls.length}件)
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {toolCalls.map((tc, i) => (
            <div key={i} className="bg-white border border-blue-100 rounded p-2">
              <div className="font-mono text-blue-700 font-medium">{tc.name}</div>
              <div className="text-gray-500 mt-1">
                引数: <span className="font-mono">{JSON.stringify(tc.arguments, null, 2)}</span>
              </div>
              {tc.result !== undefined && (
                <div className="text-gray-600 mt-1">
                  結果: <span className="font-mono text-xs">{JSON.stringify(tc.result).slice(0, 200)}{JSON.stringify(tc.result).length > 200 ? '...' : ''}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AIAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'こんにちは！SASO Willen Editionの AIアシスタントです。在庫管理、販売管理、商品検索などをお手伝いします。何でもお気軽にご質問ください。',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState('claude')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.settings.getAll().then((res) => {
      if (res.success && res.data) setSettings(res.data as Record<string, string>)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const currentProvider = settings.aiProvider || provider

  const hasApiKey = () => {
    if (currentProvider === 'claude') return !!settings.claudeApiKey
    if (currentProvider === 'openai') return !!settings.openaiApiKey
    if (currentProvider === 'gemini') return !!settings.geminiApiKey
    return false
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const apiMessages: AIMessage[] = messages
      .concat(userMsg)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await window.api.ai.chat(apiMessages)
      if (res.success && res.data) {
        const data = res.data as { message: string; toolCalls?: ToolCall[] }
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.message || (data.toolCalls ? 'ツールを実行しました。' : ''),
          toolCalls: data.toolCalls,
          timestamp: new Date()
        }])
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `エラー: ${res.error || '不明なエラーが発生しました'}`,
          timestamp: new Date()
        }])
      }
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `エラー: ${(e as Error).message}`,
        timestamp: new Date()
      }])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-primary-600" />
          <h2 className="text-xl font-bold text-gray-800">AIエージェント</h2>
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
            {currentProvider.toUpperCase()}
          </span>
        </div>
        {!hasApiKey() && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            ⚠ 設定ページでAPIキーを登録してください
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary-600' : 'bg-gray-100'}`}>
              {msg.role === 'user'
                ? <User size={16} className="text-white" />
                : <Bot size={16} className="text-gray-600" />
              }
            </div>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <ToolCallDisplay toolCalls={msg.toolCalls} />
              )}
              <div className="text-xs text-gray-400 mt-1 px-1">
                {msg.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Bot size={16} className="text-gray-600" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-primary-600" />
              <span className="text-sm text-gray-500">考え中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Example commands */}
      {messages.length <= 1 && (
        <div className="shrink-0 py-3">
          <p className="text-xs text-gray-400 mb-2">例えばこんな質問ができます:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                onClick={() => setInput(cmd)}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 pt-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="メッセージを入力... (Enter で送信)"
            className="input-field flex-1"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="btn-primary px-4 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
