import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, User, CloudOff, AlertTriangle } from 'lucide-react'
import { useAuth } from '../stores/useAuth'
import { useSyncQueue } from '../stores/useSyncQueue'

const pageTitles: Record<string, string> = {
  '/': 'ダッシュボード',
  '/items': '商品管理',
  '/remote-items': 'サーバー商品',
  '/products': '商品管理',
  '/inventory': '在庫管理',
  '/sales': '販売管理',
  '/customers': '顧客管理',
  '/labels': 'ラベル印刷',
  '/ai': 'AIエージェント',
  '/settings': '設定'
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const counts = useSyncQueue((s) => s.counts)
  const title = pageTitles[location.pathname] || 'SASO Willen Edition'

  const total = counts.pending + counts.conflict + counts.failed
  const hasIssues = counts.conflict > 0 || counts.failed > 0

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      <div className="flex items-center gap-4">
        {total > 0 && (
          <button
            onClick={() => navigate('/settings?tab=sync')}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
              hasIssues
                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
            }`}
            title={`保留中: ${counts.pending} / 競合: ${counts.conflict} / 失敗: ${counts.failed}`}
          >
            {hasIssues ? <AlertTriangle size={12} /> : <CloudOff size={12} />}
            <span>同期待ち {total}</span>
          </button>
        )}
        {user && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User size={16} />
            <span>{user.name || user.email || 'ユーザー'}</span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          <span>ログアウト</span>
        </button>
      </div>
    </header>
  )
}
