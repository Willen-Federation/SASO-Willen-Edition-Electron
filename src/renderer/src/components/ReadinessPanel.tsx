import { useEffect, useState } from 'react'
import { Activity, CheckCircle, XCircle, CircleSlash } from 'lucide-react'
import type { ReadinessStatus, ReadinessProbeStatus } from '@shared/types'

function probeBadge(status: ReadinessProbeStatus): {
  label: string
  cls: string
  Icon: typeof CheckCircle
} {
  switch (status) {
    case 'ok':
      return { label: 'OK', cls: 'bg-green-100 text-green-700', Icon: CheckCircle }
    case 'missing':
      return { label: 'MISSING', cls: 'bg-yellow-100 text-yellow-700', Icon: CircleSlash }
    case 'failed':
      return { label: 'FAILED', cls: 'bg-red-100 text-red-700', Icon: XCircle }
  }
}

/// Calls GET /api/v1/health/readiness and renders per-probe diagnostics.
///
/// Use this when /health returns 200 but feature endpoints fail with 503 —
/// the per-probe `status: missing` rows usually mean Phinx migrations have
/// not been applied on the target server.
///
/// The underlying endpoint is unauthenticated, so this component is safe to
/// render both inside the authenticated Settings → 認証 tab and inline on
/// the public Login page (where the user is stuck because the server has no
/// providers and needs to see *why*).
export default function ReadinessPanel({ autoRun = false }: { autoRun?: boolean }) {
  const [report, setReport] = useState<ReadinessStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [ranOnce, setRanOnce] = useState(false)

  const run = async (): Promise<void> => {
    setRunning(true)
    setError(null)
    const res = await window.api.sync.readiness()
    setRunning(false)
    setRanOnce(true)
    if (res.success) {
      setReport(res.data)
    } else {
      setReport(null)
      setError(res.error)
    }
  }

  useEffect(() => {
    if (autoRun && !ranOnce && !running) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun])

  const headerBadge = report
    ? report.status === 'ready'
      ? { label: 'READY', cls: 'bg-green-100 text-green-700' }
      : { label: 'DEGRADED', cls: 'bg-red-100 text-red-700' }
    : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-700">サーバー診断</p>
          {headerBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${headerBadge.cls}`}>
              {headerBadge.label}
            </span>
          )}
        </div>
        <button
          onClick={() => void run()}
          disabled={running}
          className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <Activity size={12} className={running ? 'animate-pulse' : ''} />
          {running ? '診断中…' : ranOnce ? '再診断' : '診断を実行'}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        /health が 200 でも商品/カテゴリ等が 503 (SASO-INFRA-9001) で失敗するときに、
        どのスキーマ要素が欠落しているかを表示します。
      </p>
      {error && (
        <p className="text-xs text-red-600 font-mono break-all">{error}</p>
      )}
      {report && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400">
            generated: <span className="font-mono">{report.time || '-'}</span>
          </p>
          <div className="space-y-1">
            {report.checks.map((check) => {
              const { label, cls, Icon } = probeBadge(check.status)
              return (
                <div
                  key={check.name}
                  className="flex items-start gap-2 text-xs border border-gray-100 rounded-md px-2 py-1.5 bg-white"
                >
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono shrink-0 ${cls}`}>
                    <Icon size={10} />
                    {label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-gray-700 break-all">{check.name}</div>
                    {check.detail && (
                      <div className="text-gray-500 break-words mt-0.5">{check.detail}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {report.status === 'degraded' && (
            <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-2 mt-2">
              スキーマが古い可能性があります。サーバーで <span className="font-mono">phinx migrate</span> の実行を検討してください。
            </div>
          )}
        </div>
      )}
    </div>
  )
}
