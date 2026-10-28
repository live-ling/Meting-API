import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="placeholder">
      <p className="placeholder-kicker">404</p>
      <h1>没有这个页面</h1>
      <p className="placeholder-desc">
        <Link to="/">回到首页</Link>
      </p>
    </section>
  )
}
