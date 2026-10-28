import Placeholder from '../components/Placeholder'

export default function HomePage() {
  return (
    <Placeholder
      title="Meting API · 首页"
      description="产品介绍页：接口能力、参数矩阵、快速上手与 AI 提示词。"
      todos={[
        '首屏：定位 + 响应预览 + 接口地址复制',
        '服务运行数据（/api/stats）',
        '能力矩阵（provider × type，实时读取后端能力）',
        '快速上手示例与 AI 提示词弹窗',
      ]}
    />
  )
}
