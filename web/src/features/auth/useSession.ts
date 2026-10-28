import { useQuery } from '@tanstack/react-query'
import { apiData } from '../../lib/http'

export interface Session {
  username: string
  role: string
}

/**
 * 登录态来自 GET /admin/check：
 * - 200 → { username, role }
 * - 401 → 未登录（这里归一成 null，不抛错）
 */
export function useSession() {
  return useQuery<Session | null>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return await apiData<Session>('/admin/check')
      } catch {
        return null
      }
    },
    staleTime: 30_000,
  })
}
