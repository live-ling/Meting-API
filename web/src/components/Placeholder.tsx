interface PlaceholderProps {
  title: string
  description?: string
  /** 这个页面接下来要做什么，先列出来，等样式原型到位再替换 */
  todos?: string[]
}

/**
 * 迁移期的占位页：保留路由与页面标题，内容等样式原型。
 * 正式实现时整块替换成真实组件。
 */
export default function Placeholder({ title, description, todos }: PlaceholderProps) {
  return (
    <section className="placeholder">
      <p className="placeholder-kicker">TODO · 等待样式原型</p>
      <h1>{title}</h1>
      {description ? <p className="placeholder-desc">{description}</p> : null}
      {todos?.length ? (
        <ul className="placeholder-list">
          {todos.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
