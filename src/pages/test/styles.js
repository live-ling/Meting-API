import { designTokens } from '../shared/tokens.js'
import { platformIconCss } from '../shared/platform-icons.js'

/**
 * /test 样式：印刷质感的三栏播放器。
 *
 * 三栏 = 控制台 / 封套 / 歌词，之间用 1px 细线分隔；顶栏与整页同宽。
 * 视觉语言：纸张底色 + 近黑墨色 + 橙色强调，衬线标题、等宽小标签、纸面颗粒。
 * 强调色沿用站点橙（参考稿的酸性黄在这里换成品牌色）。
 */

const testPageStyles = String.raw`
${designTokens}
${platformIconCss}

/* ========== 基础 ========== */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

*::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

body {
  --paper: #efe9dd;
  --paper-2: #e7e0d0;
  --paper-3: #d9cfba;
  --ink: #15130e;
  --ink-strong: #000;
  --muted: rgba(21, 19, 14, 0.62);
  --muted-soft: rgba(21, 19, 14, 0.42);
  --line: rgba(21, 19, 14, 0.14);
  --line-strong: rgba(21, 19, 14, 0.3);
  --accent: #ff6900;
  --accent-hover: #e85d00;
  --accent-soft: rgba(255, 105, 0, 0.12);
  --surface: #f7f2e8;
  --font-display: Georgia, "Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", SimSun, serif;
  --font-body: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-mono: ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
  --shadow: 0 40px 80px -50px rgba(21, 19, 14, 0.55);
  --shadow-soft: 0 22px 44px -32px rgba(21, 19, 14, 0.45);

  margin: 0;
  min-width: 320px;
  min-height: 100svh;
  overflow-x: hidden;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-wrap: pretty;
}

/* 纸面颗粒 */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 900;
  pointer-events: none;
  opacity: 0.3;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
}

h1,
h2,
h3,
p,
ul,
ol,
fieldset,
legend {
  margin: 0;
  padding: 0;
}

ul,
ol {
  list-style: none;
}

fieldset {
  border: 0;
  min-width: 0;
}

code {
  font-family: var(--font-mono);
  font-size: 0.92em;
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

/* ========== 顶栏 ========== */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  height: 68px;
  padding: 0 clamp(18px, 3.2vw, 42px);
  border-bottom: 1px solid var(--line);
}

.brand {
  display: inline-flex;
  align-items: baseline;
  gap: 0.65rem;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.3em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
}

.brand .mark {
  width: 11px;
  height: 11px;
  border: 1px solid var(--ink);
  background: var(--accent);
  transform: translateY(1px) rotate(45deg);
}

/* 站点图标：与首页 / 后台同一枚 logo（内联 data URI，不发额外请求） */
.brand-logo {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  object-fit: cover;
  transform: translateY(2px);
}

.brand em {
  color: var(--muted);
  font-family: var(--font-display);
  font-size: 1.24rem;
  font-style: italic;
  letter-spacing: 0.02em;
  text-transform: none;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.55em;
  padding: 0.58em 1.1em;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.685rem;
  letter-spacing: 0.14em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--t-med) var(--ease), letter-spacing var(--t-med) var(--ease),
    border-color var(--t-med) var(--ease), background-color var(--t-med) var(--ease);
}

.ghost:hover {
  border-color: var(--ink);
  background: var(--accent);
  color: var(--ink);
  letter-spacing: 0.2em;
}

.ghost:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* ========== 三栏舞台 ========== */
.player {
  display: grid;
  grid-template-columns: 1.06fr 1.12fr 1fr;
  height: calc(100svh - 68px);
  min-height: 0;
}

.player > section {
  position: relative;
  min-width: 0;
}

.player > section + section {
  border-left: 1px solid var(--line);
}

/* 错落入场 */
.deck > *,
.art-stage,
.lyr-head {
  opacity: 0;
  transform: translateY(16px);
  animation: fadeUp 0.8s var(--ease) forwards;
}

.deck > *:nth-child(1) { animation-delay: 0.04s; }
.deck > *:nth-child(2) { animation-delay: 0.1s; }
.deck > *:nth-child(3) { animation-delay: 0.16s; }
.deck > *:nth-child(4) { animation-delay: 0.2s; }
.deck > *:nth-child(5) { animation-delay: 0.25s; }
.deck > *:nth-child(6) { animation-delay: 0.3s; }
.deck > *:nth-child(7) { animation-delay: 0.35s; }
.art-stage { animation-delay: 0.22s; }
.lyr-head { animation-delay: 0.3s; }

@keyframes fadeUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== 左：控制台 ========== */
.deck {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.1rem;
  padding: clamp(26px, 3.4vw, 52px) clamp(20px, 2.9vw, 44px);
}

.kicker {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.685rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.kicker .bar {
  flex: 0 0 auto;
  width: 34px;
  height: 1px;
  background: var(--line-strong);
}

.kicker-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kicker .dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line-strong);
  transition: background var(--t-med) var(--ease), transform var(--t-med) var(--ease);
}

.player.is-playing .kicker .dot {
  background: var(--accent);
  transform: scale(1.5);
}

.track-title {
  min-width: 0;
  margin: 0.2rem 0 0.1rem;
}

.track-title .num {
  display: block;
  overflow: hidden;
  margin-bottom: 0.85rem;
  color: var(--accent-hover);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.24em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.track-title .title-text {
  display: block;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: clamp(2.1rem, 3.4vw, 3.6rem);
  font-weight: 500;
  line-height: 0.98;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}

.track-artist {
  color: var(--muted);
  font-family: var(--font-display);
  font-size: clamp(1.1rem, 1.5vw, 1.5rem);
  font-style: italic;
  line-height: 1.2;
}

.track-meta {
  padding-bottom: 0.38rem;
  border-bottom: 1px solid var(--line);
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* 进度：细线 + 橙色旋钮 */
.progress-wrap {
  margin-top: 0.15rem;
}

.scrub {
  display: block;
  width: 100%;
  height: 20px;
  margin: 0;
  padding: 8px 0;
  border: 0;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.scrub::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(to right, var(--ink) 0 var(--range-value, 0%), rgba(21, 19, 14, 0.14) var(--range-value, 0%) 100%);
}

.scrub::-moz-range-track {
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(to right, var(--ink) 0 var(--range-value, 0%), rgba(21, 19, 14, 0.14) var(--range-value, 0%) 100%);
}

.scrub::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  margin-top: -4.5px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  background: var(--accent);
  appearance: none;
  -webkit-appearance: none;
  transition: transform var(--t-fast) var(--ease);
}

.scrub::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  background: var(--accent);
}

.scrub:hover::-webkit-slider-thumb,
.scrub:focus-visible::-webkit-slider-thumb {
  transform: scale(1.25);
}

.scrub:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: 99px;
}

.scrub:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.times {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* 传送控制 */
.transport {
  display: flex;
  align-items: center;
  gap: clamp(12px, 1.6vw, 22px);
  margin-top: 0.6rem;
}

.tbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: transparent;
  font-size: 0;
  cursor: pointer;
  transition: border-color var(--t-med) var(--ease), background-color var(--t-med) var(--ease);
}

/* 上一首 / 下一首：只换颜色，不做位移——指针下的元素跟着抖很难受 */
.tbtn:hover:not(:disabled) {
  border-color: var(--ink);
  background: var(--paper-2);
}

.tbtn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.tbtn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.tbtn::before {
  content: '';
  width: 11px;
  height: 14px;
  background: var(--ink);
  clip-path: polygon(0 50%, 75% 0, 75% 100%);
}

.transport [data-ui='next']::before {
  clip-path: polygon(25% 0, 100% 50%, 25% 100%);
}

.playbtn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--ink);
  color: var(--paper);
  font-size: 0;
  cursor: pointer;
  transition: transform var(--t-med) var(--ease), background-color var(--t-med) var(--ease);
}

/* 三角形的视觉重心在 1/3 处，用 25% 起笔让墨迹重心落在圆心 */
.playbtn::before {
  content: '';
  width: 22px;
  height: 24px;
  margin: 0;
  background: currentColor;
  clip-path: polygon(25% 0, 100% 50%, 25% 100%);
}

.playbtn[aria-pressed='true']::before {
  width: 18px;
  height: 22px;
  margin-left: 0;
  background:
    linear-gradient(currentColor, currentColor) 0 0 / 6px 100% no-repeat,
    linear-gradient(currentColor, currentColor) 12px 0 / 6px 100% no-repeat;
  clip-path: none;
}

.playbtn::after {
  content: '';
  position: absolute;
  inset: -11px;
  border: 1px dashed var(--line-strong);
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity var(--t-med) var(--ease), transform var(--t-med) var(--ease);
}

.player.is-playing .playbtn::after {
  opacity: 1;
  transform: scale(1);
  animation: spin 26s linear infinite;
}

@keyframes spin {
  to {
    transform: scale(1) rotate(360deg);
  }
}

.playbtn:hover:not(:disabled) {
  transform: scale(1.04);
}

.playbtn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 6px;
}

.playbtn:disabled {
  background: rgba(21, 19, 14, 0.18);
  cursor: not-allowed;
}

/* 模式 / 音量 */
.deckrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-top: 0.35rem;
  padding-top: 0.95rem;
  border-top: 1px solid var(--line);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.55em 1em;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.685rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  cursor: pointer;
  transition: letter-spacing var(--t-med) var(--ease), color var(--t-med) var(--ease),
    border-color var(--t-med) var(--ease), background-color var(--t-med) var(--ease);
}

.chip:hover {
  border-color: var(--ink);
  background: var(--accent);
  color: var(--ink);
  letter-spacing: 0.2em;
}

.chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.vol {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-left: auto;
}

.vol-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease);
}

.vol-btn::before {
  content: '';
  width: 0;
  height: 0;
  border-right: 9px solid var(--muted);
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
}

.vol-btn:hover {
  border-color: var(--line-strong);
  background: var(--paper-2);
}

.vol-btn.is-muted::before {
  border-right-color: var(--line-strong);
}

.vol-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

#volume {
  width: 108px;
  height: 16px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}

#volume::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(to right, var(--ink) 0 var(--range-value, 100%), rgba(21, 19, 14, 0.14) var(--range-value, 100%) 100%);
}

#volume::-moz-range-track {
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(to right, var(--ink) 0 var(--range-value, 100%), rgba(21, 19, 14, 0.14) var(--range-value, 100%) 100%);
}

#volume::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: -3.5px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  background: var(--accent);
  appearance: none;
  -webkit-appearance: none;
}

#volume::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  background: var(--accent);
}

#volume:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: 99px;
}

.vol-num {
  min-width: 3.2em;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-align: right;
}

/* ========== 中：封套 ========== */
.art {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(26px, 3.2vw, 48px) clamp(20px, 2.8vw, 44px);
}

.art-stage {
  position: relative;
  /*
   * 唱片圆环与橙色衬纸都要探出封套一点，靠 padding 预留这块空间，
   * 否则窄屏下它们会顶出栏外造成横向溢出。
   * padding 用固定值（不随宽度缩放），保证任何断点下留白一致。
   */
  --stage-pad: 26px;
  width: min(100%, 440px);
  padding: var(--stage-pad);
}

/* 圆环不再用负偏移，改由 stage 的 padding 让出空间 */
.art-vtext {
  position: absolute;
  top: 0;
  right: calc(100% + 12px);
  height: 100%;
  display: flex;
  align-items: center;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  white-space: nowrap;
  writing-mode: vertical-rl;
}

/*
 * 封面背后的唱片沟槽圆环：三层同心圆。
 *
 * 只有内层虚线环在转：旋转会让元素的外接矩形变大（420px 的圆转 17°
 * 就有 523px），外层跟着转就会顶出栏外造成横向溢出。
 * 外层保持静止、内层转起来，照样有「唱片在转」的观感。
 */
.groove {
  position: absolute;
  inset: 10px;
  z-index: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  opacity: 0.7;
}

/* 内圈虚线环反向转，视觉上像唱片在转 */
.groove::before {
  content: '';
  position: absolute;
  inset: 12%;
  border: 1px dashed var(--line);
  border-radius: 50%;
  animation: grooveSpinReverse 26s linear infinite;
}

/* 第三层：缓慢呼吸的细环（缩放同样会放大包围盒，用 opacity 变化代替） */
.groove::after {
  content: '';
  position: absolute;
  inset: 24%;
  border: 1px solid var(--line);
  border-radius: 50%;
  opacity: 0.35;
  animation: groovePulse 5.5s var(--ease) infinite;
}

@keyframes grooveSpinReverse {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes groovePulse {
  0%,
  100% {
    opacity: 0.3;
  }

  50% {
    opacity: 0.75;
  }
}

/* 橙色衬纸：斜着露在封套右下，偏移量收在 stage 的 padding 内 */
.plate {
  position: absolute;
  top: 14px;
  right: -8px;
  bottom: -8px;
  left: 14px;
  z-index: 1;
  background: var(--accent);
  transform: rotate(2.2deg);
}

.sleeve {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  margin: 0;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--paper-3);
  box-shadow: var(--shadow);
  transform: rotate(-1.2deg);
  animation: breathe 9.5s ease-in-out infinite;
  animation-play-state: paused;
  transition: transform 0.6s var(--ease);
}

.player.is-playing .sleeve {
  animation-play-state: running;
}

@keyframes breathe {
  0%,
  100% {
    transform: rotate(-1.2deg) scale(1);
  }

  50% {
    transform: rotate(-0.5deg) scale(1.015);
  }
}

.sleeve img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1) contrast(1.12);
  transition: filter 0.8s var(--ease), transform 1.1s var(--ease);
}

.player.is-playing .sleeve img {
  filter: grayscale(0.25) contrast(1.05);
}

.sleeve:hover img {
  transform: scale(1.03);
}

.sleeve::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(150deg, rgba(255, 105, 0, 0.12), rgba(21, 19, 14, 0.26) 62%),
    radial-gradient(circle at 76% 18%, rgba(255, 105, 0, 0.18), transparent 55%);
  mix-blend-mode: multiply;
  pointer-events: none;
}

/* 没有封面时不叠罩染，保留纸面本色 */
.sleeve:has(img[hidden])::after {
  content: none;
}

.sleeve-empty {
  color: rgba(21, 19, 14, 0.35);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.8;
  letter-spacing: 0.28em;
  text-align: center;
}

.sleeve-tag {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 3;
  padding: 0.55em 1.05em 0.5em;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.cover-note {
  position: absolute;
  top: calc(100% + 14px);
  left: 0;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
}

/* ========== 右：歌词 ========== */
.lyrics {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: clamp(24px, 2.8vw, 42px) clamp(18px, 2.4vw, 34px);
}

.lyr-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 0.85rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--line);
}

.lyr-head h2 {
  font-size: 0.76rem;
  font-weight: 500;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.lyr-head span {
  color: var(--muted-soft);
  font-family: var(--font-display);
  font-size: 1.08rem;
  font-style: italic;
}

/*
 * 歌词区排版：
 * - 行距拉开（1.62），上下留白充足，滚动时不挤；
 * - 当前行放大 + 加粗 + 深墨色，未唱行降到软墨色，形成清晰层级；
 * - 行首短横是「唱针」标记，当前行变长并转橙。
 * 高度：lyrics 栏是 flex 列，lyr-scroll 撑满剩余高度并自己滚动；
 * 上下各留一屏的余量，最后几行也能被顶到中线附近。
 */
.lyr-scroll {
  flex: 1 1 auto;
  min-height: 0;
  height: 0;
  padding: 30vh 0.2rem 30vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--muted);
  font-size: 0.9375rem;
  line-height: 1.62;
  white-space: pre-line;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

.lyr-scroll:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -4px;
}

.lyric-line {
  position: relative;
  display: block;
  width: 100%;
  padding: 0.55rem 0.25rem 0.55rem 1.35rem;
  border: 0;
  background: transparent;
  color: var(--muted-soft);
  font-family: var(--font-display);
  font-size: 1.0625rem;
  line-height: 1.62;
  letter-spacing: 0.01em;
  text-align: left;
  cursor: pointer;
  opacity: 0.58;
  transition: color 0.45s var(--ease), opacity 0.45s var(--ease), transform 0.45s var(--ease),
    font-size 0.45s var(--ease), padding-left 0.45s var(--ease);
}

/* 行首标记：未唱是细短横，当前行拉长并转橙 */
.lyric-line::before {
  content: '';
  position: absolute;
  top: 1.35em;
  left: 0;
  width: 0.6rem;
  height: 1px;
  background: var(--line-strong);
  transition: width 0.4s var(--ease), background 0.4s var(--ease), height 0.4s var(--ease),
    top 0.4s var(--ease);
}

/* 翻译行：跟在原文下面，更小更淡 */
.lyric-translation {
  display: block;
  margin-top: 0.15rem;
  color: var(--muted-soft);
  font-size: 0.82em;
  font-style: italic;
  line-height: 1.5;
  opacity: 0.85;
}

.lyric-line:hover {
  color: var(--muted);
  opacity: 0.92;
}

.lyric-line:hover::before {
  width: 1.05rem;
  background: var(--accent-hover);
}

/* 当前行：放大、加重、变深，并微微右移 */
.lyric-line.current {
  color: var(--ink);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.42;
  letter-spacing: 0;
  opacity: 1;
  transform: translateX(6px);
  padding-left: 1.5rem;
}

.lyric-line.current::before {
  top: 1.02em;
  width: 1.5rem;
  height: 2px;
  background: var(--accent);
}

/* ========== 抽屉 ========== */
.drawer-backdrop.is-on {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(21, 19, 14, 0.34);
  backdrop-filter: blur(2px);
}

.drawer.is-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
  width: min(430px, 92vw);
  border-left: 1px solid var(--line);
  background: var(--paper-2);
  box-shadow: -40px 0 90px -60px rgba(21, 19, 14, 0.8);
}

.drawer.is-drawer[hidden] {
  display: none;
}

.drawer.is-drawer:focus {
  outline: none;
}

.drawer-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  padding: 1.4rem 1.5rem 1rem;
  border-bottom: 1px solid var(--line);
}

.drawer-head h2 {
  font-family: var(--font-display);
  font-size: 1.9rem;
  font-weight: 500;
  line-height: 1;
}

.drawer-head p {
  margin-top: 0.4rem;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: transparent;
  color: var(--ink);
  font-size: 1rem;
  cursor: pointer;
  transition: transform var(--t-med) var(--ease), background-color var(--t-med) var(--ease),
    color var(--t-med) var(--ease);
}

.icon-btn:hover {
  background: var(--ink);
  color: var(--paper);
  transform: rotate(90deg);
}

.icon-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.drawer-tabs {
  display: flex;
  gap: 18px;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--line);
}

.drawer-tab {
  padding: 0.8rem 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
}

.drawer-tab[aria-selected='true'] {
  border-bottom-color: var(--accent);
  color: var(--ink);
}

.drawer-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.drawer-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.player:not([data-drawer-tab='queue']) .drawer-panel[data-drawer-panel='queue'],
.player:not([data-drawer-tab='source']) .drawer-panel[data-drawer-panel='source'] {
  display: none;
}

/* 队列行 */
.plist {
  flex: 1;
  overflow-y: auto;
  padding: 0.7rem 0.85rem 1.3rem;
}

.plist-empty {
  padding: 0.8rem 0.6rem;
  color: var(--muted-soft);
  font-size: 0.82rem;
}

.track-row {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 1fr);
  grid-template-areas: 'no name' 'no artist';
  align-items: center;
  column-gap: 0.8rem;
  width: 100%;
  padding: 0.72rem 0.8rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--t-med) var(--ease), transform var(--t-med) var(--ease);
}

.track-row:hover {
  background: rgba(21, 19, 14, 0.055);
  transform: translateX(5px);
}

.track-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.track-row.current {
  background: var(--ink);
  color: var(--paper);
}

.track-no {
  grid-area: no;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-align: center;
}

.track-row.current .track-no {
  color: var(--accent);
}

.track-name {
  grid-area: name;
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artist {
  grid-area: artist;
  overflow: hidden;
  margin-top: 2px;
  color: var(--muted-soft);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-row.current .track-artist {
  color: rgba(239, 233, 221, 0.6);
}

/* 换源面板 */
.source-panel {
  display: grid;
  gap: var(--s5);
  padding: 1.2rem 1.5rem 1.6rem;
  overflow-y: auto;
}

.source-group {
  display: grid;
  gap: var(--s2);
}

.field-label {
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.source-panel .chip {
  position: relative;
  display: inline-flex;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.source-panel .chip:hover {
  background: transparent;
  letter-spacing: normal;
}

.chip input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.chip-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 0.9rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.8rem;
  cursor: pointer;
}

.chip:hover .chip-text {
  border-color: var(--ink);
  color: var(--ink);
}

.chip input:focus-visible + .chip-text {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chip input:checked + .chip-text {
  border-color: var(--ink);
  background: var(--accent);
  color: var(--ink);
  font-weight: 600;
}

.chip.is-off .chip-text {
  opacity: 0.4;
  cursor: not-allowed;
  text-decoration: line-through;
}

.chip.is-off .chip-text::after {
  content: '不可用';
  margin-left: 2px;
  font-size: 0.62rem;
  text-decoration: none;
}

.platform-ico {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  flex: 0 0 auto;
  filter: grayscale(0.2);
}

.id-row {
  display: flex;
  gap: var(--s2);
}

.id-input {
  flex: 1;
  min-width: 0;
  min-height: 40px;
  padding: 0 0.9rem;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.id-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.request-preview {
  display: grid;
  gap: 0.4rem;
  padding: 0.7rem;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.request-preview code {
  overflow-wrap: anywhere;
  color: var(--muted);
  font-size: 0.72rem;
}

.preset-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s2);
  margin-top: 0.4rem;
}

.preset {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.preset:hover {
  border-color: var(--line-strong);
  background: rgba(21, 19, 14, 0.04);
}

.preset[aria-current='true'] {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.preset-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  font-weight: 600;
}

.preset-id {
  overflow: hidden;
  color: var(--muted-soft);
  font-family: var(--font-mono);
  font-size: 0.64rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--tap);
  padding: 0 1.1rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}

.button-primary {
  background: var(--accent);
  border-color: var(--ink);
  color: var(--ink);
  font-weight: 600;
}

.button-primary:hover {
  background: var(--accent-hover);
}

.button-ghost {
  background: transparent;
  border-color: var(--line-strong);
  color: var(--ink);
}

.button-sm {
  min-height: 36px;
  padding: 0 0.9rem;
}

.button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.fineprint {
  color: var(--muted-soft);
  font-size: 0.72rem;
  line-height: 1.6;
}

.noscript-note {
  padding: 0 var(--s5) var(--s6);
  color: #a3320b;
  font-size: var(--fs-small);
  text-align: center;
}

/* ========== 响应式 ========== */
@media (max-width: 1080px) {
  .player {
    grid-template-columns: 1fr 1fr;
    height: auto;
    min-height: 0;
  }

  .lyrics {
    grid-column: 1 / -1;
    min-height: 320px;
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .art-vtext {
    display: none;
  }
}

@media (max-width: 760px) {
  .topbar {
    height: 58px;
    padding: 0 16px;
  }

  .brand em {
    display: none;
  }

  .player {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }

  .deck {
    gap: 0.85rem;
    padding: 22px 18px;
  }

  .art {
    padding: 8px 18px 26px;
  }

  .art-stage {
    width: min(100%, 320px);
  }

  .lyrics {
    grid-column: auto;
    min-height: 300px;
    padding: 20px 18px 24px;
    border-top: 1px solid var(--line);
  }

  .track-title .title-text {
    font-size: clamp(1.9rem, 8vw, 2.6rem);
  }

  .lyric-line {
    font-size: 1.05rem;
  }

  .lyric-line.current {
    font-size: 1.32rem;
  }

  .preset-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
`.trim()

export default testPageStyles
export { testPageStyles }
