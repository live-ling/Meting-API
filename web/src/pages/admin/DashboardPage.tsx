import Placeholder from '../../components/Placeholder'

/**
 * 仪表盘：指标卡 + 最近操作。
 * 数据来自 /admin/* 系列接口，等样式原型确定后接真实查询。
 */
export default function DashboardPage() {
  return (
    <Placeholder
      title="仪表盘"
      description="后台总览：Cookie 健康度、用户与请求量、最近的异常与操作。"
      todos={[
        '四个指标卡：Cookie 总数 / 有效数 / 用户数 / 操作记录',
        '最近操作表格（时间、操作、详情、操作人）',
        '异常提醒：失效 Cookie、当前封禁 IP、最近 429 趋势',
      ]}
    />
  )
}
