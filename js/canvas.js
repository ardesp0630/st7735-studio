/**
 * ST7735 Studio — 屏幕渲染引擎
 *
 * 在 Canvas 上按 160×128 真实像素绘制界面。
 * 绘制原语与 Adafruit_GFX 一一对应，便于代码生成器转换。
 */

import { TYPE, ICON, SCREEN, bindText, DEMO_DATA } from './elements.js'
// ---------- 主题配色（与固件 P_* 宏对应） ----------
export const THEMES = {
  paper: {
    label: '报纸',
    bg: '#C9C2B0', bar: '#F5F1E6', card: '#F5F1E6', card2: '#9C9482',
    div: '#B5B2AD', acc: '#8C5A2B', ink: '#1F1B14', ink2: '#4E4638',
    ok: '#2F6B3A', bad: '#9E2B24',
  },
  navy: {
    label: '深海蓝',
    bg: '#08131E', bar: '#0E2336', card: '#2A6A96', card2: '#123047',
    div: '#1C4059', acc: '#2FB6E8', ink: '#EAF6FF', ink2: '#7FA3BC',
    ok: '#4BD68C', bad: '#FF7A7A',
  },
  terminal: {
    label: '终端绿',
    bg: '#000000', bar: '#001A0D', card: '#00230F', card2: '#00170A',
    div: '#013D1E', acc: '#00E676', ink: '#00FF88', ink2: '#00A855',
    ok: '#00FF88', bad: '#FF5252',
  },
  nord: {
    label: 'Nord',
    bg: '#2E3440', bar: '#3B4252', card: '#434C5E', card2: '#3B4252',
    div: '#4C566A', acc: '#88C0D0', ink: '#ECEFF4', ink2: '#8FA3B8',
    ok: '#A3BE8C', bad: '#BF616A',
  },
}

export const THEME_KEYS = Object.keys(THEMES)

/** 解析颜色：主题色名 → 十六进制；#RRGGBB 原样返回 */
export function resolveColor(c, theme) {
  if (!c) return theme.ink
  if (c.charAt(0) === '#') return c
  return theme[c] || theme.ink
}

/** 十六进制 → RGB565 */
export function to565(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 8 ? h.slice(0, 6) : h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
  return '0x' + v.toString(16).toUpperCase().padStart(4, '0')
}

// ---------- 绘制原语（对应 GFX） ----------
const P = {
  rect(g, x, y, w, h, c) {
    if (w <= 0 || h <= 0) return
    g.fillStyle = c
    g.fillRect(x, y, w, h)
  },
  round(g, x, y, w, h, r, c) {
    if (w <= 0 || h <= 0) return
    r = Math.min(r || 0, w / 2, h / 2)
    g.fillStyle = c
    g.beginPath()
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
    g.fill()
  },
  circle(g, cx, cy, r, c) {
    g.fillStyle = c
    g.beginPath()
    g.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2)
    g.fill()
  },
  ring(g, cx, cy, r, c) {
    g.strokeStyle = c
    g.lineWidth = 1
    g.beginPath()
    g.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2)
    g.stroke()
  },
  tri(g, x1, y1, x2, y2, x3, y3, c) {
    g.fillStyle = c
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.lineTo(x3, y3)
    g.closePath()
    g.fill()
  },
  line(g, x1, y1, x2, y2, c) {
    g.strokeStyle = c
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(x1, y1 + 0.5)
    g.lineTo(x2, y2 + 0.5)
    g.stroke()
  },
}

// ---------- 文本（中文 12px/字，ASCII 6px/字符） ----------
function drawText(g, s, x, y, size, color) {
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'top'
  let cx = x
  for (const ch of s) {
    if (ch.charCodeAt(0) < 128) {
      g.font = 'bold ' + Math.round(7 * size) + 'px monospace'
      g.fillText(ch, cx + 3 * size, y)
      cx += 6 * size
    } else {
      g.font = Math.round(12 * size) + 'px sans-serif'
      g.fillText(ch, cx + 6 * size, y)
      cx += 12 * size
    }
  }
}

function textWidth(s, size) {
  let w = 0
  for (const ch of s) w += (ch.charCodeAt(0) < 128 ? 6 : 12) * size
  return w
}

// ---------- 内置图标（与固件 drawIcon 完全一致） ----------
function drawIcon(g, icon, x, y, w, h, c, bg) {
  const cx = x + w / 2, cy = y + h / 2
  const r = Math.max(1, Math.floor(Math.min(w, h) / 2))

  switch (icon) {
    case ICON.DOT:
      P.circle(g, cx, cy, r, c); break

    case ICON.UP:
      P.tri(g, cx, y, x + w - 1, y + h - 1, x, y + h - 1, c); break

    case ICON.DOWN:
      P.tri(g, cx, y + h - 1, x, y, x + w - 1, y, c); break

    case ICON.CHECK:
      for (let t = 0; t < 2; t++) {
        P.line(g, x, cy + t, x + w / 3, y + h - 1 + t, c)
        P.line(g, x + w / 3, y + h - 1 + t, x + w - 1, y + t, c)
      }
      break

    case ICON.CROSS:
      for (let t = 0; t < 2; t++) {
        P.line(g, x + t, y, x + w - 1 + t, y + h - 1, c)
        P.line(g, x + w - 1 - t, y, x - t, y + h - 1, c)
      }
      break

    case ICON.WARN:
      // 空心三角 + 感叹号
      P.line(g, cx, y, x + w - 1, y + h - 1, c)
      P.line(g, cx, y + 1, x + w - 2, y + h - 1, c)
      P.line(g, x + w - 1, y + h - 1, x, y + h - 1, c)
      P.line(g, x + w - 2, y + h - 1, x + 1, y + h - 1, c)
      P.line(g, x, y + h - 1, cx, y, c)
      P.line(g, x + 1, y + h - 1, cx, y + 1, c)
      P.rect(g, cx, Math.floor(y + h / 3), 1, Math.floor(h / 4), c)
      P.rect(g, cx, y + h - 3, 1, 1, c)
      break

    case ICON.RING:
      P.ring(g, cx, cy, r - 1, c)
      if (r > 3) P.ring(g, cx, cy, r - 2, c)
      break

    case ICON.WIFI:
      // 底部圆点 + 三条向上张开的弧
      P.circle(g, x + w / 6, y + h - 2, 1, c)
      for (let ring = 1; ring <= 3; ring++) {
        const rr = Math.floor(ring * (w * 2 / 3) / 3)
        if (rr < 2) continue
        for (let a = -52; a <= 52; a += 5) {
          const rad = (a - 90) * Math.PI / 180
          const px = Math.round(x + w / 6 + rr * Math.cos(rad))
          const py = Math.round(y + h - 2 + rr * Math.sin(rad))
          P.rect(g, px, py, 1, 1, c)
          P.rect(g, px, py - 1, 1, 1, c)
        }
      }
      break

    case ICON.CLOCK:
      P.ring(g, cx, cy, r - 1, c)
      if (r > 3) P.ring(g, cx, cy, r - 2, c)
      P.line(g, cx, cy, cx, cy - r + 3, c)
      P.line(g, cx, cy, cx + Math.floor(r / 2), cy + Math.floor(r / 5), c)
      break

    case ICON.BATTERY:
      P.line(g, x, y + 1, x + w - 4, y + 1, c)
      P.line(g, x, y + h - 2, x + w - 4, y + h - 2, c)
      P.line(g, x, y + 1, x, y + h - 2, c)
      P.line(g, x + w - 4, y + 1, x + w - 4, y + h - 2, c)
      P.rect(g, x + w - 3, Math.floor(y + h / 2) - 2, 2, 4, c)
      P.rect(g, x + 3, y + 4, Math.floor((w - 8) * 2 / 3), h - 6, c)
      break

    case ICON.BOLT:
      // 双梯形拼接（经字符网格验证的最优形状）
      P.tri(g, Math.floor(cx + w / 6), y,
        x + w - 1, Math.floor(y + h * 0.42),
        Math.floor(x + w / 4), Math.floor(y + h * 0.42), c)
      P.tri(g, Math.floor(cx - w / 6), Math.floor(y + h * 0.58),
        Math.floor(x + w * 0.75), Math.floor(y + h * 0.58),
        x, y + h - 1, c)
      P.rect(g, Math.floor(x + w / 4), Math.floor(y + h * 0.38),
        Math.floor(w / 2), Math.floor(h * 0.24), c)
      break

    case ICON.STAR:
      for (let i = 0; i < 5; i++) {
        const a1 = (-90 + i * 144) * Math.PI / 180
        const a2 = (-90 + (i + 2) * 144) * Math.PI / 180
        P.line(g, cx + r * Math.cos(a1), cy + r * Math.sin(a1),
          cx + r * Math.cos(a2), cy + r * Math.sin(a2), c)
      }
      break

    case ICON.WHALE:
      {
        const s = Math.max(1, Math.floor(r / 4))
        P.rect(g, x + Math.floor(w / 4), cy - s, Math.floor(w / 2) + 2, s * 2, c)
        P.circle(g, x + Math.floor(w / 4), cy, s * 2, c)
        P.circle(g, cx + Math.floor(w / 6), cy, s * 2, c)
        P.tri(g, cx + Math.floor(w / 5), cy, x + w - 1, cy - s * 2,
          x + w - 1, cy + Math.floor(s / 2), c)
        P.tri(g, cx - Math.floor(w / 12), cy - s, cx, y + 1,
          cx + Math.floor(w / 12), cy - s, c)
        P.circle(g, x + Math.floor(w / 4) - s, cy - Math.floor(s / 2), 1, bg)
      }
      break
  }
}

// ---------- 单个元素绘制 ----------
export function drawElement(g, e, theme, data = DEMO_DATA, hist = null) {
  if (!e.on) return
  const c = resolveColor(e.c, theme)

  switch (e.t) {
    case TYPE.RECT:
      P.rect(g, e.x, e.y, e.w, e.h, c); break

    case TYPE.ROUND:
      P.round(g, e.x, e.y, e.w, e.h, e.r, c); break

    case TYPE.CIRCLE:
      P.circle(g, e.x + e.w / 2, e.y + e.h / 2, Math.min(e.w, e.h) / 2, c); break

    case TYPE.TRI:
      P.tri(g, e.x + e.w / 2, e.y, e.x + e.w, e.y + e.h, e.x, e.y + e.h, c); break

    case TYPE.LINE:
      P.rect(g, e.x, e.y, e.w, Math.max(1, e.h), c); break

    case TYPE.ICON:
      drawIcon(g, e.icon, e.x, e.y, e.w || 10, e.h || 10, c, theme.bg); break

    case TYPE.TEXT: {
      const s = e.bind ? bindText(e.bind, data) : (e.text || '')
      if (!s) break
      const size = e.sz || 1
      // 在元素矩形内水平居中
      const tw = textWidth(s, size)
      const tx = e.x + (e.w > tw ? (e.w - tw) / 2 : 0)
      drawText(g, s, tx, e.y, size, c)
      break
    }

    case TYPE.PROGRESS: {
      P.rect(g, e.x, e.y, e.w, e.h, theme.card2)
      const pct = data.pct || 0
      const fw = Math.round(e.w * pct / 100)
      if (fw > 0) P.rect(g, e.x, e.y, fw, e.h, c)
      // 剩余端凸点
      let mx = e.x + fw
      mx = Math.max(e.x + 3, Math.min(e.x + e.w - 3, mx))
      P.circle(g, mx, e.y + e.h / 2, 2, c)
      break
    }

    case TYPE.HBAR: {
      // 柱状图：用历史数据或内置波形
      const t = hist || []
      const n = Math.min(12, t.length || 12)
      let mn = 1e9, mx = -1e9
      if (t.length) {
        for (let i = 0; i < n; i++) { if (t[i] < mn) mn = t[i]; if (t[i] > mx) mx = t[i] }
      } else {
        mn = 0; mx = 1
      }
      const span = (mx - mn) || 1
      const bw = Math.max(1, Math.floor(e.w / n) - 1)
      for (let i = 0; i < n; i++) {
        const v = t.length ? (t[t.length - n + i] - mn) / span : Math.abs(Math.sin(i * 0.8))
        const bh = Math.round(v * (e.h - 2)) + 2
        P.rect(g, e.x + i * (bw + 1), e.y + e.h - bh, bw, bh, c)
      }
      break
    }

    case TYPE.BITMAP:
      if (e._bitmapCanvas) {
        g.drawImage(e._bitmapCanvas, e.x, e.y, e.w, e.h)
      } else {
        g.fillStyle = 'rgba(128,128,128,0.25)'
        g.fillRect(e.x, e.y, e.w, e.h)
        P.line(g, e.x, e.y, e.x + e.w, e.y + e.h, c)
        P.line(g, e.x + e.w, e.y, e.x, e.y + e.h, c)
      }
      break
  }
}

// ---------- 整屏绘制 ----------
/**
 * @param {CanvasRenderingContext2D} g
 * @param {object} opts - { elements, theme, data, rotate, hist, selectedId, grid }
 */
export function renderScreen(g, opts) {
  const {
    elements = [], theme = THEMES.paper, data = DEMO_DATA,
    rotate = 0, hist = null, selectedId = null, grid = false,
  } = opts

  const { W, H } = SCREEN
  g.save()
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, g.canvas.width, g.canvas.height)

  // 180° 翻转
  if (rotate === 180) {
    g.translate(g.canvas.width, g.canvas.height)
    g.rotate(Math.PI)
  }

  g.fillStyle = theme.bg
  g.fillRect(0, 0, W, H)

  elements.forEach((e) => drawElement(g, e, theme, data, hist))

  // 选中框 + 手柄
  if (selectedId != null) {
    const s = elements.find((e) => e.id === selectedId)
    if (s) {
      g.strokeStyle = '#0A84FF'
      g.lineWidth = 1
      g.strokeRect(s.x - 0.5, s.y - 0.5, s.w + 1, s.h + 1)
      const hs = [
        [s.x, s.y], [s.x + s.w, s.y], [s.x, s.y + s.h], [s.x + s.w, s.y + s.h],
        [s.x + s.w, s.y + s.h / 2], [s.x + s.w / 2, s.y + s.h],
      ]
      g.fillStyle = '#0A84FF'
      hs.forEach((p) => g.fillRect(p[0] - 2, p[1] - 2, 4, 4))
    }
  }

  // 网格
  if (grid) {
    g.strokeStyle = 'rgba(255,70,70,0.2)'
    g.lineWidth = 0.5
    g.beginPath()
    for (let x = 0; x <= W; x += 10) { g.moveTo(x, 0); g.lineTo(x, H) }
    for (let y = 0; y <= H; y += 10) { g.moveTo(0, y); g.lineTo(W, y) }
    g.stroke()
  }

  g.restore()
}

/** 命中测试：返回最上层命中的元素 */
export function hitTest(elements, x, y) {
  for (let i = elements.length - 1; i >= 0; i--) {
    const e = elements[i]
    if (!e.on) continue
    const w = Math.max(e.w, 14), h = Math.max(e.h, 10)
    if (x >= e.x && x <= e.x + w && y >= e.y && y <= e.y + h) return e
  }
  return null
}

/** 手柄命中测试：返回 'tl'|'br'|'r'|'b'|null */
export function handleHit(e, x, y, tol = 4) {
  if (!e) return null
  const near = (a, b) => Math.abs(a - b) <= tol
  if (near(x, e.x) && near(y, e.y)) return 'tl'
  if (near(x, e.x + e.w) && near(y, e.y + e.h)) return 'br'
  if (near(x, e.x + e.w) && Math.abs(y - (e.y + e.h / 2)) <= tol) return 'r'
  if (near(y, e.y + e.h) && Math.abs(x - (e.x + e.w / 2)) <= tol) return 'b'
  return null
}
