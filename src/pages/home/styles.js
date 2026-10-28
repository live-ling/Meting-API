/**
 * 首页样式（小米官网式产品介绍页）
 *
 * 结构节奏：白底首屏（大标题 + 响应预览）→ 灰底数据带 → 白底卖点 → 灰底参数表
 * → 白底快速上手 → 白底响应约定 → 黑底 CTA → 深色页脚。
 * 只用 tokens.js 里的变量取色取距，避免出现"手写色值"。
 */

import { platformIconCss } from '../shared/platform-icons.js'

const homePageStyles = String.raw`
${platformIconCss}

/* ========== 基础 ========== */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  overflow-x: hidden;
  scroll-behavior: smooth;
  scroll-padding-top: 88px;
}

body {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  background: var(--paper);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  text-wrap: pretty;
}

h1,
h2,
h3,
p,
ul,
ol,
dl,
dd,
figure {
  margin: 0;
}

ul,
ol {
  padding: 0;
  list-style: none;
}

img {
  max-width: 100%;
  display: block;
}

a {
  color: var(--accent);
  text-decoration: none;
}

a:hover {
  color: var(--accent-hover);
}

code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  color: var(--ink);
  background: var(--paper-soft);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

::selection {
  background: var(--accent);
  color: #fff;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  top: -48px;
  left: var(--s4);
  z-index: 100;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  background: var(--ink);
  color: #fff;
  font-size: var(--fs-small);
}

.skip-link:focus {
  top: var(--s3);
  color: #fff;
}

/* 复制结果反馈：成功绿、失败橙 */
.status-line {
  min-height: 22px;
  color: var(--muted);
  font-size: var(--fs-small);
}

.status-line.is-ok {
  color: var(--ok);
}

.status-line.is-warn {
  color: var(--warn);
}

/* ========== 顶栏 ========== */
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(12px);
}

.topbar-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s6);
  width: 100%;
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 var(--s5);
  min-height: 64px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  color: var(--ink-strong);
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.brand-logo {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  flex: 0 0 auto;
}

.brand:hover {
  color: var(--ink-strong);
}

.brand small {
  color: var(--muted-soft);
  font-size: var(--fs-small);
  font-weight: 400;
}

.topnav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1);
  margin-left: auto;
}

.topnav a {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 var(--s3);
  border-radius: var(--radius-sm);
  color: var(--muted);
  font-size: var(--fs-small);
  font-weight: 500;
  white-space: nowrap;
  transition: color var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease);
}

.topnav a:hover {
  color: var(--ink);
  background: var(--paper-soft);
}

/* ========== 按钮 ========== */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s2);
  min-height: var(--tap);
  padding: 0 var(--s5);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--paper-soft);
  color: var(--ink);
  font-family: inherit;
  font-size: var(--fs-small);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease), transform var(--t-fast) var(--ease);
}

.button:hover {
  background: #efefef;
  color: var(--ink);
}

.button:active {
  transform: scale(0.985);
}

.button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.button-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.button-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: #fff;
}

.button-ghost {
  background: var(--paper);
  border-color: var(--line);
  color: var(--ink);
}

.button-ghost:hover {
  background: var(--paper-soft);
  border-color: var(--line-strong);
  color: var(--ink);
}

.button-sm {
  min-height: 40px;
  padding: 0 var(--s4);
  font-weight: 500;
}

/* 触屏设备：小按钮也保证 44px 点击区 */
@media (pointer: coarse) {
  .button-sm {
    min-height: var(--tap);
  }
}

/* ========== 首屏 ========== */
.hero {
  padding: clamp(56px, 8vw, 112px) 0 clamp(40px, 6vw, 72px);
  text-align: center;
}

.hero-inner {
  width: 100%;
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 var(--s5);
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  color: var(--muted);
  font-size: var(--fs-kicker);
  letter-spacing: 0.04em;
}

.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.hero h1 {
  margin: var(--s5) auto 0;
  max-width: 14em;
  font-size: var(--fs-display);
  font-weight: 800;
  line-height: var(--lh-display);
  letter-spacing: -0.02em;
}

.hero-lede {
  max-width: 36em;
  margin: var(--s5) auto 0;
  color: var(--muted);
  font-size: 1.0625rem;
  line-height: 1.8;
}

.hero-cta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--s3);
  margin-top: var(--s6);
}

.hero-endpoint {
  display: inline-flex;
  align-items: center;
  gap: var(--s3);
  max-width: 100%;
  margin-top: var(--s7);
  padding: var(--s2) var(--s2) var(--s2) var(--s5);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--paper-soft);
}

.endpoint-label {
  color: var(--muted-soft);
  font-size: var(--fs-small);
  white-space: nowrap;
}

.endpoint-value {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--fs-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 响应预览：用代码本身当产品图 */
.hero-visual {
  max-width: 720px;
  margin: var(--s8) auto 0;
  text-align: left;
}

.response-card {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--paper);
  box-shadow: var(--shadow-card);
}

.response-head {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s3) var(--s5);
  border-bottom: 1px solid var(--line);
  background: var(--surface-muted);
}

.response-head code {
  overflow: hidden;
  color: var(--muted);
  font-size: var(--fs-small);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  padding: 0;
}

.method {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: var(--fs-small);
  font-weight: 700;
}

.badge {
  margin-left: auto;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.badge-ok {
  background: var(--ok-soft);
  color: var(--ok);
}

.response-body {
  margin: 0;
  padding: var(--s5);
  overflow-x: auto;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.9;
  background: var(--paper);
}

.response-foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  padding: var(--s3) var(--s5);
  border-top: 1px solid var(--line);
}

.mini-chip {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--paper-soft);
  color: var(--muted);
  font-size: 0.75rem;
}

/* ========== 数据带 ========== */
.stats {
  padding: clamp(40px, 6vw, 64px) 0;
  background: var(--paper-soft);
}

.stats-inner,
.page-footer .footer-inner {
  width: 100%;
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 var(--s5);
}

.stats-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s2) var(--s5);
}

.stats-head h2 {
  font-size: var(--fs-h3);
  font-weight: 700;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s6);
  margin-top: var(--s6);
}

.stat strong {
  display: block;
  font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.stat span {
  display: block;
  margin-top: var(--s2);
  color: var(--muted);
  font-size: var(--fs-small);
}

/* ========== 区块 ========== */
.section {
  width: 100%;
  max-width: var(--page-max);
  margin: 0 auto;
  padding: clamp(56px, 8vw, 96px) var(--s5);
}

.section-gray {
  max-width: none;
  padding: clamp(56px, 8vw, 96px) 0;
  background: var(--paper-soft);
}

.section-gray > * {
  width: 100%;
  max-width: var(--page-max);
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--s5);
  padding-right: var(--s5);
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--s3) var(--s7);
}

.section-head h2 {
  font-size: var(--fs-h2);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.section-note {
  max-width: 34em;
  color: var(--muted);
  font-size: var(--fs-small);
  line-height: 1.7;
}

.scroll-hint {
  display: none;
  margin-top: var(--s4);
  color: var(--muted-soft);
  font-size: var(--fs-small);
}

/* ========== 卖点卡片 ========== */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s4);
  margin-top: var(--s6);
}

.feature {
  padding: var(--s5) 0 0;
  border-top: 1px solid var(--line);
  transition: border-color var(--t-med) var(--ease);
}

.feature:hover {
  border-top-color: var(--ink);
}

.feature h3 {
  margin-top: 0;
  font-size: var(--fs-h3);
  font-weight: 700;
}

.feature p {
  margin-top: var(--s2);
  color: var(--muted);
  font-size: var(--fs-small);
  line-height: 1.7;
}

/* ========== 参数表 ========== */
.table-wrap {
  margin-top: var(--s5);
  overflow-x: auto;
  border-radius: var(--radius-md);
  background: var(--paper);
  scrollbar-width: thin;
}

.table-wrap:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.spec-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: var(--fs-small);
}

.spec-table th,
.spec-table td {
  padding: var(--s3) var(--s4);
  border-bottom: 1px solid var(--line);
  text-align: center;
}

.spec-table thead th {
  font-weight: 600;
  color: var(--ink);
  border-bottom-color: var(--line-strong);
}

.spec-table tbody th,
.spec-table .type-col {
  text-align: left;
  font-weight: 500;
}

.spec-table .type-col {
  padding-left: var(--s5);
}

.spec-table tbody tr:last-child th,
.spec-table tbody tr:last-child td {
  border-bottom: 0;
}

.spec-table tbody tr:hover {
  background: var(--accent-tint);
}

.spec-table code {
  background: transparent;
  padding: 0;
  color: var(--muted);
}

.platform-name {
  display: block;
  font-size: var(--fs-small);
  white-space: nowrap;
}

.name-short {
  display: none;
}

.platform-ico {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 4px;
  border-radius: 4px;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  vertical-align: -3px;
}

.platform-id {
  display: block;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 400;
}

.spec-table th.is-down .platform-name {
  color: var(--muted-soft);
  text-decoration: line-through;
}

.mark-yes {
  color: var(--ok);
  font-weight: 700;
}

.mark-no {
  color: var(--line-strong);
  font-weight: 700;
}

.spec-notes {
  margin-top: var(--s5);
  display: grid;
  gap: var(--s2);
  color: var(--muted);
  font-size: var(--fs-small);
  line-height: 1.7;
}

.spec-notes code {
  background: rgba(0, 0, 0, 0.04);
}

.tag {
  display: inline-block;
  margin-right: var(--s2);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  font-weight: 600;
}

.tag-warn {
  background: var(--warn-soft);
  color: var(--warn);
}

.tag-danger {
  background: var(--danger-soft);
  color: var(--danger);
}

/* ========== 快速上手 ========== */
.quick-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s3);
  margin-top: var(--s6);
}

.quick-item {
  min-width: 0;
  padding: var(--s4) var(--s5);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  transition: border-color var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease);
}

.quick-item:hover {
  border-color: var(--line-strong);
  background: var(--surface-muted);
}

.quick-top {
  display: flex;
  align-items: baseline;
  gap: var(--s3);
}

.quick-no {
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: var(--fs-small);
}

.quick-label {
  font-weight: 600;
}

.quick-result {
  margin-left: var(--s2);
  color: var(--muted-soft);
  font-size: var(--fs-small);
  font-weight: 400;
}

.quick-row {
  display: flex;
  align-items: center;
  gap: var(--s3);
  min-width: 0;
  margin-top: var(--s2);
}

.quick-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding: var(--s2) var(--s3);
  border-radius: var(--radius-sm);
  background: var(--paper-soft);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========== 响应约定 ========== */
.contract-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: var(--s5);
  margin-top: var(--s6);
}

.contract-card {
  padding: var(--s5);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

.contract-card h3 {
  font-size: var(--fs-h3);
  font-weight: 700;
}

.spec-list {
  margin-top: var(--s4);
}

.spec-list > div {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: var(--s4);
  padding: var(--s3) 0;
  border-top: 1px solid var(--line);
}

.spec-list dt {
  font-family: var(--font-mono);
  font-size: var(--fs-small);
  color: var(--ink);
}

.spec-list dd {
  color: var(--muted);
  font-size: var(--fs-small);
  line-height: 1.7;
}

.note-list {
  margin-top: var(--s4);
  counter-reset: note;
}

.note-list li {
  position: relative;
  padding: var(--s3) 0 var(--s3) var(--s6);
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: var(--fs-small);
  line-height: 1.7;
}

.note-list li::before {
  counter-increment: note;
  content: counter(note, decimal-leading-zero);
  position: absolute;
  left: 0;
  color: var(--muted-soft);
  font-family: var(--font-mono);
}

/* ========== CTA / 提示词 ========== */
.prompt-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s5);
  padding: clamp(32px, 5vw, 56px);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: #fff;
}

.prompt-copy h2 {
  font-size: var(--fs-h2);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.prompt-copy p {
  max-width: 36em;
  margin-top: var(--s3);
  color: #b9b9b9;
  font-size: var(--fs-small);
  line-height: 1.8;
}

/* 弹窗：脚本加上 .is-dialog 才固定居中，无脚本时内容内联可读 */
.modal.is-dialog {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: var(--s4);
  background: rgba(0, 0, 0, 0.45);
}

.modal.is-dialog[hidden] {
  display: none;
}

.modal:focus {
  outline: none;
}

.modal-card {
  display: flex;
  flex-direction: column;
  width: min(880px, 100%);
  max-height: min(88vh, 900px);
  border-radius: var(--radius-md);
  background: var(--paper);
  box-shadow: var(--shadow-float);
  overflow: hidden;
}

.modal-head,
.modal-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  padding: var(--s4) var(--s5);
}

.modal-head {
  border-bottom: 1px solid var(--line);
}

.modal-title h3 {
  font-size: 1rem;
  font-weight: 700;
}

.modal-sub {
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.75rem;
}

.modal-foot {
  border-top: 1px solid var(--line);
}

.modal-foot .status-line {
  margin: 0;
}

#ai-prompt {
  display: block;
  width: 100%;
  min-height: min(56vh, 520px);
  flex: 1;
  padding: var(--s5);
  border: 0;
  background: #fbfbfb;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.9;
  resize: none;
  scrollbar-width: thin;
}

#ai-prompt:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px #ffd9bf;
}

/* ========== 页脚 ========== */
.page-footer {
  padding: var(--s7) 0;
  background: var(--ink);
  color: #a3a3a3;
  font-size: var(--fs-small);
}

.page-footer .footer-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4) var(--s6);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s5);
}

.footer-links a {
  color: #cfcfcf;
}

.footer-links a:hover {
  color: #fff;
}

/* ========== 响应式 ========== */
@media (max-width: 1024px) {
  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s5);
  }

  .contract-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  /* 顶栏保持一行：品牌在左，两个导航在右 */
  .topbar-inner {
    flex-wrap: nowrap;
    gap: var(--s2);
    min-height: 60px;
    padding: 0 var(--s4);
  }

  .brand {
    font-size: 1rem;
  }

  .topnav {
    margin-left: auto;
    flex-wrap: nowrap;
    gap: 0;
  }

  .topnav a {
    padding: 0 var(--s2);
  }

  .brand small {
    display: none;
  }

  .hero {
    padding-top: var(--s6);
  }

  .hero h1 {
    max-width: 12em;
  }

  /* 接口地址：一条紧凑的横条，不再堆成三行 */
  .hero-endpoint {
    flex-wrap: nowrap;
    gap: var(--s2);
    width: 100%;
    padding: var(--s2) var(--s2) var(--s2) var(--s3);
    border-radius: 14px;
  }

  .endpoint-label {
    display: none;
  }

  .endpoint-value {
    flex: 1;
    min-width: 0;
    width: auto;
    text-align: left;
  }

  .scroll-hint {
    display: block;
  }

  .section,
  .stats-inner,
  .page-footer .footer-inner {
    padding-left: var(--s4);
    padding-right: var(--s4);
  }

  .section-gray > * {
    padding-left: var(--s4);
    padding-right: var(--s4);
  }

  /* 代码预览在窄屏横向滚动，不把 URL 折断 */
  .response-body {
    padding: var(--s4);
    font-size: 0.6875rem;
    white-space: pre;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .quick-row {
    flex-wrap: wrap;
  }

  .quick-url {
    flex-basis: 100%;
  }

  /* 参数表：窄屏用短平台名 + 小图标，保持自适应宽度（避免撑宽布局视口） */
  .spec-table {
    min-width: 0;
    font-size: 0.6875rem;
  }

  .spec-table th,
  .spec-table td {
    padding: var(--s2) 2px;
  }

  .spec-table .type-col {
    padding-left: var(--s3);
  }

  .platform-name {
    font-size: 0.6875rem;
  }

  .platform-ico {
    width: 14px;
    height: 14px;
    margin-right: 3px;
    vertical-align: -2px;
  }

  .name-full {
    display: none;
  }

  .name-short {
    display: inline;
  }

  .platform-id {
    display: none;
  }

  .prompt-banner {
    padding: var(--s6) var(--s5);
  }

  .modal-card {
    max-height: 92vh;
  }

  /* 弹窗头部收成一行：标题在左，关闭在右，副标题让位给正文 */
  .modal-head {
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: var(--s3);
    padding: var(--s3) var(--s4);
  }

  .modal-title {
    flex: 1;
    min-width: 0;
  }

  .modal-title h3 {
    font-size: 0.9375rem;
  }

  .modal-sub {
    display: none;
  }

  .modal-head .button {
    flex: 0 0 auto;
    min-height: 40px;
    padding: 0 var(--s3);
    font-size: 0.8125rem;
  }

  .modal-foot {
    padding: var(--s3) var(--s4);
  }

  #ai-prompt {
    min-height: 46vh;
    padding: var(--s4);
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  /* 小屏标题再降一档，"把音乐接进你的产品。"才能落在两行内 */
  .hero h1 {
    font-size: 2rem;
    line-height: 1.25;
  }

  .feature-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .spec-list > div {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s1);
  }
}
`.trim()

export default homePageStyles
export { homePageStyles }
