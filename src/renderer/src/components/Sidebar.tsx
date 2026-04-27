import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  Printer,
  Bot,
  Settings
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'ダッシュボード', end: true },
  { to: '/products', icon: Package, label: '商品管理' },
  { to: '/inventory', icon: Warehouse, label: '在庫管理' },
  { to: '/sales', icon: ShoppingCart, label: '販売管理' },
  { to: '/customers', icon: Users, label: '顧客管理' },
  { to: '/labels', icon: Printer, label: 'ラベル印刷' },
  { to: '/ai', icon: Bot, label: 'AIエージェント' },
  { to: '/settings', icon: Settings, label: '設定' }
]

export default function Sidebar() {
  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-gray-700">
        <div className="text-lg font-bold text-white">SASO Willen</div>
        <div className="text-xs text-gray-400 mt-0.5">在庫・販売管理システム</div>
      </div>
      <nav className="flex-1 py-3">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 border-t border-gray-700 text-xs text-gray-500">
        v1.0.0
      </div>
    </aside>
  )
}
