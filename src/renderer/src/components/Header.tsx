import { useLocation } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../stores/useAuth'

const pageTitles: Record<string, string> = {
  '/': 'ダッシュボード',
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
  const { user, logout } = useAuth()
  const title = pageTitles[location.pathname] || 'SASO Willen Edition'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      <div className="flex items-center gap-4">
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
