import type { LucideIcon } from 'lucide-react'
import {
  BarChart3, Bell, Cookie, KeyRound, ListOrdered, Radio, Settings,
  Shield, Users,
} from 'lucide-react'

export interface AdminSection {
  key: string
  label: string
  description: string
  icon: LucideIcon
  todos?: string[]
}

/**
 * 后台导航：与现有 /admin 的九个功能区一一对应。
 * 路由挂载在管理后台根路径下（adminBase），这里只写相对段。
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: 'dashboard',
    label: '仪表盘',
    description: '关键指标与最近操作。',
    icon: BarChart3,
    todos: ['Cookie 数量 / 有效数 / 用户数 / 操作数', '最近操作表格', '异常提示（Cookie 失效、封禁数）'],
  },
  {
    key: 'cookies',
    label: 'Cookie 管理',
    description: '各平台 Cookie 的增删改查与有效性验证。',
    icon: Cookie,
    todos: ['列表：平台 / 预览 / 备注 / 验证状态 / 启用', '新增与编辑弹窗', '单条验证、批量验证'],
  },
  {
    key: 'monitor',
    label: 'Cookie 监测',
    description: '定时检查 Cookie 有效性并推送通知。',
    icon: Bell,
    todos: ['监测状态卡片', '立即检查', '监测日志'],
  },
  {
    key: 'tokens',
    label: 'API Token',
    description: '对外令牌的签发与吊销。',
    icon: KeyRound,
    todos: ['令牌列表', '创建（有效期、备注）', '吊销'],
  },
  {
    key: 'abuse',
    label: '滥用防护',
    description: '限流规则、违规记录与 IP 封禁。',
    icon: Shield,
    todos: ['规则开关', '违规明细', '封禁列表与解封'],
  },
  {
    key: 'users',
    label: '用户管理',
    description: '后台账号与角色。',
    icon: Users,
    todos: ['用户列表', '新增 / 修改角色', '删除'],
  },
  {
    key: 'logs',
    label: '操作日志',
    description: '后台操作审计。',
    icon: ListOrdered,
    todos: ['筛选（时间 / 操作人）', '表格与分页'],
  },
  {
    key: 'api-logs',
    label: 'API 调用日志',
    description: '接口请求明细、统计与导出。',
    icon: Radio,
    todos: ['统计卡片', '明细表与筛选', '导出 CSV'],
  },
  {
    key: 'settings',
    label: '设置',
    description: '站点路径、Webhook、SMTP、双因素认证。',
    icon: Settings,
    todos: ['后台路径', 'Webhook 与测试', 'SMTP 与测试', '2FA 绑定 / 关闭', '修改密码'],
  },
]
