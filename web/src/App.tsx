import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { adminBase } from './boot'
import HomePage from './pages/HomePage'
import TestPage from './pages/TestPage'
import NotFoundPage from './pages/NotFoundPage'

/**
 * 后台体积最大（表单、表格、组件库），单独切一个 chunk：
 * 首页与试听页的首屏不会把后台代码一起下载。
 */
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))

/**
 * 三条站点路由：
 * /        介绍页
 * /test    试听实验室
 * <admin>  管理后台（路径由服务端注入，可能是 /admin 或自定义路径）
 */
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="boot-loading">加载中…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path={`${adminBase}/*`} element={<AdminApp />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
