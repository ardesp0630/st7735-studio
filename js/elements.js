/**
 * ST7735 Studio — 元素模型与数据绑定定义
 *
 * 这套定义同时被三处使用：
 *   1. 网页编辑器（拖拽/预览）
 *   2. 代码生成器（输出 Arduino 代码）
 *   3. 固件（接收 JSON 后渲染）
 *
 * 三者必须保持一致，改动时三处同步。
 */

// ---------- 元素类型（与固件 enum 对应） ----------
export const TYPE = {
  TEXT: 0,      // 文本（支持数据绑定）
  RECT: 1,      // 实心矩形
  ROUND: 2,     // 圆角矩形
  CIRCLE: 3,    // 圆
  TRI: 4,       // 三角形
  LINE: 5,      // 线（横线）
  ICON: 6,      // 内置图标（GFX 基元绘制）
  BITMAP: 7,    // 1-bit 位图
  PROGRESS: 8,  // 进度条（含端点凸点）
  HBAR: 9,      // 柱状图（迷你）
}

export const TYPE_NAME = [
  '文本', '矩形', '圆角', '圆', '三角', '线', '图标', '位图', '进度条', '柱状图',
]

// ---------- 数据绑定源（与固件 enum 对应） ----------
export const BIND = {
  NONE: 0,
  BALANCE: 1,
  DELTA: 2,
  USED: 3,
  TOKENS: 4,
  POLLS: 5,
  SSID: 6,
  TIME: 7,
  AVAIL: 8,
  PCT: 9,
  TOKEN_M: 10,
  WIFI_FULL: 11,
  PWD: 12,
  GRANTED: 13,
  TOPUP: 14,
  CURRENCY: 15,
  IP: 16,
  RSSI: 17,
}

export const BIND_NAME = [
  '静态文本', '余额', '涨跌', '消耗', 'Token(原始)', '次数',
  'WiFi名', '时间', '可用态', '额度%',
  'Token(简写)', 'WiFi整行', 'WiFi密码', '赠送余额', '充值余额',
  '币种', '本机IP', '信号强度',
]

// ---------- 内置图标（与固件 enum 对应） ----------
export const ICON = {
  NONE: 0,
  DOT: 1,
  UP: 2,
  DOWN: 3,
  CHECK: 4,
  CROSS: 5,
  WARN: 6,
  RING: 7,
  WIFI: 8,
  CLOCK: 9,
  BATTERY: 10,
  BOLT: 11,
  STAR: 12,
  WHALE: 13,
}

export const ICON_LIST = [
  { v: ICON.DOT, name: '圆点' },
  { v: ICON.UP, name: '上三角' },
  { v: ICON.DOWN, name: '下三角' },
  { v: ICON.CHECK, name: '对勾' },
  { v: ICON.CROSS, name: '叉号' },
  { v: ICON.WARN, name: '警告' },
  { v: ICON.RING, name: '圆环' },
  { v: ICON.WIFI, name: 'WiFi' },
  { v: ICON.CLOCK, name: '时钟' },
  { v: ICON.BATTERY, name: '电池' },
  { v: ICON.BOLT, name: '闪电' },
  { v: ICON.STAR, name: '星形' },
  { v: ICON.WHALE, name: '鲸鱼' },
]

// ---------- 屏幕尺寸 ----------
export const SCREEN = { W: 160, H: 128 }

// ---------- 元素工厂 ----------
let nextUid = 1

/**
 * 创建一个元素（带默认值）
 * @param {number} type - TYPE 中的值
 * @param {object} over - 覆盖字段
 */
export function makeElement(type, over = {}) {
  const base = {
    id: nextUid++,
    t: type,
    x: 8,
    y: 8,
    w: 64,
    h: 16,
    c: 'ink',       // 颜色：主题色名 或 #RRGGBB
    sz: 1,          // 字号 1-4（仅文本）
    r: 0,           // 圆角（仅圆角矩形）
    bind: BIND.NONE,
    icon: ICON.DOT,
    on: true,
    text: '',
  }
  switch (type) {
    case TYPE.TEXT:
      Object.assign(base, { w: 64, h: 13, text: '文字' })
      break
    case TYPE.ICON:
      Object.assign(base, { w: 14, h: 14, c: 'acc' })
      break
    case TYPE.PROGRESS:
      Object.assign(base, { x: 10, y: 60, w: 140, h: 5, c: 'acc' })
      break
    case TYPE.HBAR:
      Object.assign(base, { w: 140, h: 28, c: 'acc' })
      break
    case TYPE.ROUND:
      Object.assign(base, { w: 140, h: 32, c: 'card', r: 6 })
      break
    case TYPE.LINE:
      Object.assign(base, { w: 140, h: 1, c: 'div' })
      break
    case TYPE.CIRCLE:
      Object.assign(base, { w: 20, h: 20, c: 'acc' })
      break
  }
  return Object.assign(base, over)
}

/** 重置 uid 计数器（载入布局时用，避免 id 冲突） */
export function syncUid(elements) {
  nextUid = elements.reduce((m, e) => Math.max(m, e.id || 0), 0) + 1
}

// ---------- 序列化 ----------
/** 导出为紧凑 JSON（供设备接收） */
export function toJSON(elements) {
  const els = elements.map((e) => {
    const o = { t: e.t, x: e.x, y: e.y, w: e.w, h: e.h, c: e.c }
    if (e.sz > 1) o.sz = e.sz
    if (e.r) o.r = e.r
    if (e.bind) o.bind = e.bind
    if (e.t === TYPE.ICON) o.icon = e.icon
    if (!e.on) o.on = 0
    if (e.text) o.text = e.text
    return o
  })
  return JSON.stringify({ elems: els })
}

/** 从 JSON 还原（id 重新分配） */
export function fromJSON(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json
  const arr = d.elems || d.layout || []
  return arr.map((e) => makeElement(e.t, {
    x: e.x, y: e.y, w: e.w, h: e.h,
    c: e.c || 'ink',
    sz: e.sz || 1,
    r: e.r || 0,
    bind: e.bind || 0,
    icon: e.icon || 0,
    on: e.on !== 0,
    text: e.text || '',
  }))
}

// ---------- 演示数据（预览用，非真实设备数据） ----------
export const DEMO_DATA = {
  balance: 96.50,
  delta: -0.02,
  used: 12.34,
  tokens: 518211416,
  polls: 1527,
  ssid: 'MyWiFi',
  time: '12:34:56',
  pct: 12,
  avail: true,
  pwd: 'password123',
  granted: 10.00,
  topup: 86.50,
  currency: 'CNY',
  ip: '192.168.1.23',
  rssi: -58,
}

/** Token 简写：518211416 → 51亿8211 */
export function formatTokens(t) {
  if (t >= 100000000) {
    return Math.floor(t / 100000000) + '亿' +
      String(Math.floor((t % 100000000) / 10000)).padStart(4, '0')
  }
  if (t >= 10000) return (t / 10000).toFixed(2) + '万'
  return String(t)
}

/** 按绑定源取显示文本 */
export function bindText(bind, data = DEMO_DATA) {
  switch (bind) {
    case BIND.BALANCE: return data.balance.toFixed(2)
    case BIND.DELTA: return (data.delta >= 0 ? '+' : '') + data.delta.toFixed(2)
    case BIND.USED: return data.used.toFixed(2)
    case BIND.TOKENS: return String(data.tokens)
    case BIND.POLLS: return String(data.polls)
    case BIND.SSID: return data.ssid
    case BIND.TIME: return data.time
    case BIND.AVAIL: return data.avail ? '可用' : '不足'
    case BIND.PCT: return data.pct + '%'
    case BIND.TOKEN_M: return formatTokens(data.tokens)
    case BIND.WIFI_FULL: return 'WiFi ' + data.ssid
    case BIND.PWD: return data.pwd
    case BIND.GRANTED: return data.granted.toFixed(2)
    case BIND.TOPUP: return data.topup.toFixed(2)
    case BIND.CURRENCY: return data.currency
    case BIND.IP: return data.ip
    case BIND.RSSI: return data.rssi + ' dBm'
    default: return ''
  }
}
