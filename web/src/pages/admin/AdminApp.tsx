import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import Placeholder from '../../components/Placeholder'
import { useSession } from '../../features/auth/useSession'
import AdminLayout from './AdminLayout'
import DashboardPage from './DashboardPage'
import LoginPage from './LoginPage'
import { ADMIN_SECTIONS } from './sections'

/**
 * 后台入口：
 * 1. 先查会话（GET /admin/check）
 * 2. 未登录 → 登录页；已登录 → 侧栏布局 + 子路由
 * 3. 子路由与旧后台的九个功能区对应，先占位，随后逐页替换
 */
export default function AdminApp() {
  const queryClient = useQueryClient()
  const { data: session, isLoading } = useSession()

  if (isLoading) {
    return <div className="boot-loading">正在检查登录状态…</div>
  }

  if (!session) {
    return (
      <LoginPage
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['session'] })
        }}
      />
    )
  }

  return (
    <AdminLayout session={session}>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        {ADMIN_SECTIONS.filter((section) => section.key !== 'dashboard').map((section) => (
          <Route
            key={section.key}
            path={section.key}
            element={
              <Placeholder
                title={section.label}
                description={section.description}
                todos={section.todos}
              />
            }
          />
        ))}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AdminLayout>
  )
}
