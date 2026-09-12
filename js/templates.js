/**
 * ST7735 Studio — 界面模板库
 *
 * 每个模板是一个元素数组。载入后用户可继续编辑。
 */

import { TYPE, ICON, BIND, makeElement } from './elements.js'

/** 模板定义：元素用简写描述，载入时展开 */
const defs = {
  // ---------- 1. 余额屏（默认） ----------
  balance: {
    name: '余额屏',
    desc: '大号数字 + 进度条 + 统计信息',
    theme: 'paper',
    els: [
      [TYPE.RECT, { x: 0, y: 0, w: 160, h: 15, c: 'bar' }],
      [TYPE.TEXT, { x: 5, y: 3, w: 56, h: 10, c: 'acc', text: 'Balance' }],
      [TYPE.ICON, { x: 118, y: 4, w: 7, h: 7, c: 'ok', icon: ICON.DOT }],
      [TYPE.TEXT, { x: 128, y: 3, w: 32, h: 10, c: 'ink2', bind: BIND.TIME }],

      [TYPE.ROUND, { x: 2, y: 16, w: 156, h: 32, c: 'card', r: 5 }],
      [TYPE.TEXT, { x: 24, y: 19, w: 112, h: 26, c: 'ink', sz: 3, bind: BIND.BALANCE }],
      [TYPE.PROGRESS, { x: 10, y: 44, w: 140, h: 4, c: 'acc' }],

      [TYPE.HBAR, { x: 2, y: 52, w: 156, h: 30, c: 'acc' }],

      [TYPE.ROUND, { x: 2, y: 86, w: 77, h: 15, c: 'card2', r: 3 }],
      [TYPE.TEXT, { x: 6, y: 87, w: 22, h: 13, c: 'ink', text: 'Used' }],
      [TYPE.TEXT, { x: 30, y: 87, w: 44, h: 13, c: 'ink', bind: BIND.USED }],
      [TYPE.ROUND, { x: 81, y: 86, w: 77, h: 15, c: 'card2', r: 3 }],
      [TYPE.TEXT, { x: 85, y: 87, w: 22, h: 13, c: 'ink', text: 'Polls' }],
      [TYPE.TEXT, { x: 109, y: 87, w: 44, h: 13, c: 'ink', bind: BIND.POLLS }],

      [TYPE.TEXT, { x: 4, y: 104, w: 34, h: 10, c: 'ink2', text: 'Token' }],
      [TYPE.TEXT, { x: 40, y: 104, w: 110, h: 10, c: 'ink2', bind: BIND.TOKEN_M }],
      [TYPE.TEXT, { x: 4, y: 114, w: 22, h: 10, c: 'ink2', text: 'WiFi' }],
      [TYPE.TEXT, { x: 28, y: 114, w: 80, h: 10, c: 'ink2', bind: BIND.SSID }],
      [TYPE.TEXT, { x: 112, y: 114, w: 46, h: 10, c: 'ink2', bind: BIND.RSSI }],
    ],
  },

  // ---------- 2. 极简大字 ----------
  minimal: {
    name: '极简大字',
    desc: '只有余额和状态，最干净',
    theme: 'navy',
    els: [
      [TYPE.TEXT, { x: 4, y: 4, w: 60, h: 12, c: 'ink2', text: 'BALANCE' }],
      [TYPE.ICON, { x: 144, y: 5, w: 10, h: 10, c: 'ok', icon: ICON.DOT }],
      [TYPE.TEXT, { x: 4, y: 36, w: 152, h: 44, c: 'ink', sz: 4, bind: BIND.BALANCE }],
      [TYPE.LINE, { x: 4, y: 88, w: 152, h: 1, c: 'div' }],
      [TYPE.TEXT, { x: 4, y: 96, w: 152, h: 14, c: 'acc', bind: BIND.DELTA }],
      [TYPE.TEXT, { x: 4, y: 114, w: 152, h: 10, c: 'ink2', bind: BIND.TIME }],
    ],
  },

  // ---------- 3. 时钟 ----------
  clock: {
    name: '时钟',
    desc: '大号时间 + 日期 + 状态',
    theme: 'terminal',
    els: [
      [TYPE.TEXT, { x: 4, y: 3, w: 80, h: 10, c: 'acc', text: 'CLOCK' }],
      [TYPE.ICON, { x: 130, y: 7, w: 8, h: 8, c: 'ink2', icon: ICON.CLOCK }],
      [TYPE.ICON, { x: 144, y: 5, w: 10, h: 10, c: 'ok', icon: ICON.DOT }],

      [TYPE.ROUND, { x: 2, y: 18, w: 156, h: 54, c: 'card', r: 6 }],
      [TYPE.TEXT, { x: 6, y: 30, w: 148, h: 36, c: 'ink', sz: 4, bind: BIND.TIME }],

      [TYPE.ROUND, { x: 2, y: 78, w: 156, h: 22, c: 'card2', r: 4 }],
      [TYPE.TEXT, { x: 6, y: 82, w: 70, h: 14, c: 'ink2', text: 'Network' }],
      [TYPE.TEXT, { x: 76, y: 82, w: 78, h: 14, c: 'ink', bind: BIND.SSID }],

      [TYPE.ICON, { x: 6, y: 106, w: 9, h: 9, c: 'acc', icon: ICON.WIFI }],
      [TYPE.TEXT, { x: 20, y: 106, w: 60, h: 10, c: 'ink2', bind: BIND.RSSI }],
      [TYPE.TEXT, { x: 90, y: 106, w: 64, h: 10, c: 'ink2', bind: BIND.IP }],
    ],
  },

  // ---------- 4. 仪表盘 ----------
  dashboard: {
    name: '仪表盘',
    desc: '四宫格状态卡片',
    theme: 'nord',
    els: [
      [TYPE.RECT, { x: 0, y: 0, w: 160, h: 15, c: 'bar' }],
      [TYPE.TEXT, { x: 5, y: 3, w: 100, h: 10, c: 'acc', text: 'DASHBOARD' }],
      [TYPE.ICON, { x: 146, y: 4, w: 9, h: 9, c: 'ok', icon: ICON.DOT }],

      // 上排两格
      [TYPE.ROUND, { x: 2, y: 18, w: 77, h: 46, c: 'card', r: 5 }],
      [TYPE.TEXT, { x: 6, y: 22, w: 69, h: 12, c: 'ink2', text: 'Token' }],
      [TYPE.TEXT, { x: 6, y: 38, w: 69, h: 22, c: 'ink', sz: 2, bind: BIND.TOKEN_M }],

      [TYPE.ROUND, { x: 81, y: 18, w: 77, h: 46, c: 'card', r: 5 }],
      [TYPE.TEXT, { x: 85, y: 22, w: 69, h: 12, c: 'ink2', text: 'Calls' }],
      [TYPE.TEXT, { x: 85, y: 38, w: 69, h: 22, c: 'ink', sz: 2, bind: BIND.POLLS }],

      // 下排两格
      [TYPE.ROUND, { x: 2, y: 68, w: 77, h: 40, c: 'card2', r: 5 }],
      [TYPE.TEXT, { x: 6, y: 72, w: 69, h: 12, c: 'ink2', text: 'WiFi' }],
      [TYPE.TEXT, { x: 6, y: 88, w: 69, h: 14, c: 'ink', bind: BIND.RSSI }],

      [TYPE.ROUND, { x: 81, y: 68, w: 77, h: 40, c: 'card2', r: 5 }],
      [TYPE.TEXT, { x: 85, y: 72, w: 69, h: 12, c: 'ink2', text: 'IP' }],
      [TYPE.TEXT, { x: 85, y: 88, w: 69, h: 14, c: 'ink', bind: BIND.IP }],

      [TYPE.PROGRESS, { x: 2, y: 114, w: 156, h: 5, c: 'acc' }],
      [TYPE.TEXT, { x: 2, y: 121, w: 156, h: 7, c: 'ink2', bind: BIND.TIME }],
    ],
  },

  // ---------- 5. 传感器 ----------
  sensor: {
    name: '传感器',
    desc: '数值 + 柱状趋势 + 上下限',
    theme: 'paper',
    els: [
      [TYPE.RECT, { x: 0, y: 0, w: 160, h: 15, c: 'bar' }],
      [TYPE.TEXT, { x: 5, y: 3, w: 90, h: 10, c: 'acc', text: 'SENSOR' }],
      [TYPE.TEXT, { x: 130, y: 3, w: 28, h: 10, c: 'ink2', bind: BIND.TIME }],

      [TYPE.ROUND, { x: 2, y: 18, w: 156, h: 40, c: 'card', r: 5 }],
      [TYPE.TEXT, { x: 6, y: 22, w: 100, h: 12, c: 'ink2', text: 'Current' }],
      [TYPE.TEXT, { x: 8, y: 34, w: 144, h: 22, c: 'ink', sz: 3, bind: BIND.BALANCE }],

      [TYPE.ROUND, { x: 2, y: 62, w: 156, h: 40, c: 'card2', r: 4 }],
      [TYPE.HBAR, { x: 6, y: 66, w: 148, h: 32, c: 'acc' }],

      [TYPE.TEXT, { x: 4, y: 106, w: 50, h: 11, c: 'ink2', text: 'Min' }],
      [TYPE.TEXT, { x: 56, y: 106, w: 40, h: 11, c: 'ink', text: '0.00' }],
      [TYPE.TEXT, { x: 100, y: 106, w: 56, h: 11, c: 'ink2', bind: BIND.DELTA }],

      [TYPE.PROGRESS, { x: 4, y: 120, w: 152, h: 4, c: 'ok' }],
    ],
  },

  // ---------- 6. 空白 ----------
  blank: {
    name: '空白画布',
    desc: '从零开始设计',
    theme: 'paper',
    els: [],
  },
}

/** 获取模板列表 */
export function listTemplates() {
  return Object.entries(defs).map(([key, t]) => ({
    key, name: t.name, desc: t.desc, theme: t.theme, count: t.els.length,
  }))
}

/** 载入模板，返回 { elements, theme } */
export function loadTemplate(key) {
  const t = defs[key]
  if (!t) return null
  const elements = t.els.map(([type, over]) => makeElement(type, over))
  return { elements, theme: t.theme }
}
