import { QueryClient } from '@tanstack/react-query'

/**
 * 服务端状态统一交给 TanStack Query：
 * - 401 不重试（登录态失效直接回登录页）
 * - 轮询类数据（监测状态、API 日志）用 refetchInterval 声明式配置
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
    mutations: {
      retry: false,
    },
  },
})
