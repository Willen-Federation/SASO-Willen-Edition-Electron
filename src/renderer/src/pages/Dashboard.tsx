import { useEffect, useState } from 'react'
import { Package, TrendingUp, ShoppingCart, AlertTriangle, ArrowUp, ArrowDown, RefreshCw, Layers } from 'lucide-react'
import type { DashboardStats, QuantityLog } from '@shared/types'

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-bold text-gray-900 mt-0.5">{value}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const result = await window.api.dashboard.getStats()
    if (result.success && result.data) {
      setStats(result.data as DashboardStats)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">概要</h2>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
          <RefreshCw size={14} />
          更新
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="総商品数"
          value={stats.totalItems.toLocaleString()}
          subtitle={`カテゴリ: ${stats.totalCategories}`}
          icon={Package}
          color="bg-blue-500"
        />
        <StatCard
          title="バリエーション数"
          value={stats.totalFeatures.toLocaleString()}
          subtitle={`在庫不足: ${stats.lowStockCount}件`}
          icon={Layers}
          color="bg-green-500"
        />
        <StatCard
          title="本日の販売数"
          value={stats.todaySales.toLocaleString()}
          icon={ShoppingCart}
          color="bg-purple-500"
        />
        <StatCard
          title="本日の売上"
          value={`¥${stats.todayRevenue.toLocaleString()}`}
          subtitle={`顧客数: ${stats.totalCustomers}`}
          icon={TrendingUp}
          color="bg-orange-500"
        />
      </div>

      {stats.lowStockCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 mt-0.5" size={18} />
          <div>
            <div className="font-medium text-amber-800">在庫不足のバリエーションがあります</div>
            <div className="text-sm text-amber-600 mt-0.5">{stats.lowStockCount}件のバリエーションの在庫が0以下です</div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">最近の在庫変動</h3>
        {stats.recentLogs.length === 0 ? (
          <div className="text-center py-6 text-gray-400">在庫変動の記録はありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4">バーコード</th>
                  <th className="pb-2 pr-4">種類</th>
                  <th className="pb-2 pr-4">変動数</th>
                  <th className="pb-2 pr-4">理由</th>
                  <th className="pb-2">日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentLogs.map((log: QuantityLog) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{log.full_code}</td>
                    <td className="py-2 pr-4">
                      {log.is_inventory ? (
                        <span className="text-purple-600 text-xs font-medium">棚卸し</span>
                      ) : log.fluctuation >= 0 ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <ArrowUp size={12} /> 入庫
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                          <ArrowDown size={12} /> 出荷
                        </span>
                      )}
                    </td>
                    <td className={`py-2 pr-4 font-medium ${log.fluctuation >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {log.fluctuation >= 0 ? '+' : ''}{log.fluctuation}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{log.reason || '-'}</td>
                    <td className="py-2 text-gray-400">
                      {new Date(log.change_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
