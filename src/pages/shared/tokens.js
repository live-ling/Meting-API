/**
 * 全站设计令牌（/ 与 /test 共用）
 *
 * 视觉方向：小米官网式的产品介绍页 —— 白底、近黑正文、单一橙色强调、
 * 宽松但严格对齐的栅格、参数表式的信息呈现。不引入衬线体、不做装饰性渐变。
 *
 * 这里只放「值」，不放选择器：两个页面各自的 styles.js 里用 var() 取用。
 * 单位与命名约定：间距 s1..s9 = 4/8/12/16/24/32/48/64/96，字号 fs-*，行高 lh-*。
 */
export const designTokens = String.raw`
:root {
  /* ── 颜色：白 / 灰 / 黑 + 小米橙 ────────────────────── */
  --paper: #ffffff;
  --paper-soft: #f7f7f7;
  --surface: #ffffff;
  --surface-muted: #fafafa;
  --ink: #191919;
  --ink-strong: #000000;
  --muted: #5c5c5c;
  --muted-soft: #8f8f8f;
  --line: #e5e5e5;
  --line-strong: #c4c4c4;
  --accent: #ff6900;
  --accent-hover: #e85d00;
  --accent-soft: #fff1e6;
  --accent-tint: #fff8f2;
  --ok: #00a862;
  --ok-soft: #e8f7f0;
  --warn: #b26a00;
  --warn-soft: #fff5e5;
  --danger: #d93025;
  --danger-soft: #fdecea;

  /* ── 字体：无衬线为主，等宽只给代码 ─────────────────── */
  --font-sans: "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei",
    system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, "Courier New", monospace;

  /* ── 字号：5 级 clamp 阶梯 ──────────────────────────── */
  --fs-display: clamp(2.25rem, 1.45rem + 4vw, 4.25rem);
  --fs-h2: clamp(1.5rem, 1.2rem + 1.4vw, 2.25rem);
  --fs-h3: clamp(1.0625rem, 1rem + 0.35vw, 1.25rem);
  --fs-body: clamp(0.9375rem, 0.9rem + 0.18vw, 1.0625rem);
  --fs-small: 0.875rem;
  --fs-kicker: 0.8125rem;
  --lh-display: 1.15;
  --lh-head: 1.3;
  --lh-body: 1.75;

  /* ── 间距：4 的倍数 ─────────────────────────────────── */
  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --s5: 24px;
  --s6: 32px;
  --s7: 48px;
  --s8: 64px;
  --s9: 96px;

  /* ── 圆角 / 阴影 ────────────────────────────────────── */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.05);
  --shadow-float: 0 8px 40px rgba(0, 0, 0, 0.12);

  /* ── 版式与动效 ─────────────────────────────────────── */
  --page-max: 1226px;
  --measure: 40em;
  --tap: 44px;
  --ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --t-fast: 150ms;
  --t-med: 220ms;
}

/* 降低动态效果：所有过渡与动画直接关闭 */
@media (prefers-reduced-motion: reduce) {
  :root {
    --t-fast: 0ms;
    --t-med: 0ms;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`.trim()
