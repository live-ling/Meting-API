import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { Session } from '../../features/auth/useSession'
import { apiRequest } from '../../lib/http'
import { ADMIN_SECTIONS } from './sections'

interface AdminLayoutProps {
  session: Session
  children: ReactNode
}

/**
 * 后台外壳：侧栏导航 + 顶栏（当前页标题、账号、退出）。
 * 具体视觉等样式原型到位后替换，这里只保证信息结构与路由可用。
 */
export default function AdminLayout({ session, children }: AdminLayoutProps) {
  const queryClient = useQueryClient()
  const location = useLocation()
  const current = ADMIN_SECTIONS.find((section) => location.pathname.endsWith(`/${section.key}`))

  async function logout() {
    try {
      await apiRequest('/admin/logout', {
        method: 'POST',
        headers: { 'X-Auth-Username': session.username },
      })
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['session'] })
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true" />
          <span className="admin-brand-text">Meting</span>
          <span className="admin-brand-sub">管理后台</span>
        </div>
        <nav className="admin-nav" aria-label="后台导航">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <NavLink
                key={section.key}
                to={section.key}
                className={({ isActive }) => (isActive ? 'admin-nav-item is-active' : 'admin-nav-item')}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>{section.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <h1>{current?.label ?? '管理后台'}</h1>
          <div className="admin-user">
            <span className="admin-user-name">{session.username}</span>
            <span className="admin-user-role">{session.role}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void logout()}>
              <LogOut size={14} strokeWidth={1.8} aria-hidden="true" />
              退出登录
            </button>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
