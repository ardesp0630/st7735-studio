/**
 * ST7735 Studio — 主控逻辑
 */

import {
  TYPE, TYPE_NAME, BIND, BIND_NAME, ICON, ICON_LIST,
  SCREEN, makeElement, syncUid, toJSON, fromJSON, DEMO_DATA,
  THEMES, THEME_KEYS, resolveColor, to565,
  renderScreen, hitTest, handleHit,
  listTemplates, loadTemplate,
  genElements, genRenderFunc, genFullSketch, genPalette, copyText,
  imageToBitmap, bitmapToCanvas, bitmapToCode, readImageFile, bytesPerRow,
} from './index.js'

// ============================================================
//  全局状态
// ============================================================
const state = {
  elements: [],
  theme: 'paper',
  selectedId: null,
  zoom: 3,
  grid: false,
  rotate: 0,
  hist: Array.from({ length: 30 }, (_, i) => 96.5 - i * 0.028 + Math.sin(i * 0.7) * 0.06),
  codeKind: 'render',
  bmp: null,        // { img, bytes, w, h, inv }
}

const $ = (id) => document.getElementById(id)
const el = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

function toast(msg, ms = 2400) {
  const t = $('toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => t.classList.remove('show'), ms)
}

// ============================================================
//  视图切换
// ============================================================
document.querySelectorAll('.navbtn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.navbtn').forEach((x) => x.classList.remove('active'))
    document.querySelectorAll('.view').forEach((x) => x.classList.remove('active'))
    b.classList.add('active')
    $('view-' + b.dataset.view).classList.add('active')
    if (b.dataset.view === 'code') genCode()
  })
})

// ============================================================
//  画布渲染
// ============================================================
function draw() {
  const cv = $('screen')
  const g = cv.getContext('2d')
  const z = state.zoom
  cv.width = SCREEN.W * z
  cv.height = SCREEN.H * z
  g.setTransform(z, 0, 0, z, 0, 0)
  g.imageSmoothingEnabled = false
  renderScreen(g, {
    elements: state.elements,
    theme: THEMES[state.theme],
    data: DEMO_DATA,
    rotate: state.rotate,
    hist: state.hist,
    selectedId: state.selectedId,
    grid: state.grid,
  })
}

// ============================================================
//  触摸 / 鼠标拖拽
// ============================================================
let drag = null
const HANDLE_TOL = 5

function pointFrom(ev) {
  const cv = $('screen')
  const r = cv.getBoundingClientRect()
  const t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev
  return {
    x: (t.clientX - r.left) / r.width * SCREEN.W,
    y: (t.clientY - r.top) / r.height * SCREEN.H,
  }
}

function onDown(ev) {
  const p = pointFrom(ev)
  const sel = state.elements.find((e) => e.id === state.selectedId)

  // 手柄优先
  if (sel) {
    const h = handleHit(sel, p.x, p.y, HANDLE_TOL)
    if (h) {
      drag = { mode: 'resize', id: sel.id, h, sx: p.x, sy: p.y, o: { ...sel } }
      ev.preventDefault()
      return
    }
  }

  // 元素命中
  const hit = hitTest(state.elements, p.x, p.y)
  if (hit) {
    state.selectedId = hit.id
    drag = { mode: 'move', id: hit.id, sx: p.x, sy: p.y, o: { ...hit } }
    renderAll()
    ev.preventDefault()
    return
  }

  state.selectedId = null
  renderAll()
}

function onMove(ev) {
  if (!drag) return
  const p = pointFrom(ev)
  const e = state.elements.find((x) => x.id === drag.id)
  if (!e) return
  const dx = p.x - drag.sx, dy = p.y - drag.sy
  const o = drag.o
  const R = Math.round

  if (drag.mode === 'move') {
    e.x = Math.max(0, Math.min(SCREEN.W - e.w, R(o.x + dx)))
    e.y = Math.max(0, Math.min(SCREEN.H - e.h, R(o.y + dy)))
  } else {
    if (drag.h === 'br' || drag.h === 'r') e.w = Math.max(4, R(o.w + dx))
    if (drag.h === 'br' || drag.h === 'b') e.h = Math.max(4, R(o.h + dy))
    if (drag.h === 'tl') {
      const nw = Math.max(4, R(o.w - dx)), nh = Math.max(4, R(o.h - dy))
      e.x = R(o.x + (o.w - nw)); e.y = R(o.y + (o.h - nh))
      e.w = nw; e.h = nh
    }
    if (e.x + e.w > SCREEN.W) e.w = SCREEN.W - e.x
    if (e.y + e.h > SCREEN.H) e.h = SCREEN.H - e.y
  }
  draw()
  updateProps()
  ev.preventDefault()
}

function onUp() {
  if (drag) { drag = null; renderList() }
}

// ============================================================
//  元素列表
// ============================================================
function renderList() {
  const box = $('el-list')
  box.innerHTML = ''
  $('el-count').textContent = state.elements.length

  if (!state.elements.length) {
    box.appendChild(el('div', 'hint', '还没有元素，去「添加元素」或载入模板'))
    return
  }

  state.elements.slice().reverse().forEach((e) => {
    const row = el('div', 'el-row' + (e.id === state.selectedId ? ' sel' : ''))
    const info = e.bind ? BIND_NAME[e.bind] : (e.text || '')
    row.innerHTML =
      `<span class="et">${TYPE_NAME[e.t]}</span>` +
      `<span class="exy">${e.x},${e.y} ${e.w}×${e.h}${info ? ' · ' + info : ''}</span>`

    const sw = el('label', 'sw')
    const inp = el('input')
    inp.type = 'checkbox'
    inp.checked = !!e.on
    inp.addEventListener('change', () => { e.on = inp.checked; renderAll() })
    sw.appendChild(inp)
    sw.appendChild(el('i'))
    row.appendChild(sw)

    row.addEventListener('click', (ev) => {
      if (ev.target === inp) return
      state.selectedId = e.id
      renderAll()
    })
    box.appendChild(row)
  })
}

// ============================================================
//  属性面板
// ============================================================
function current() {
  return state.elements.find((e) => e.id === state.selectedId) || null
}

function updateProps() {
  const e = current()
  const box = $('props')
  if (!e) { box.style.display = 'none'; return }
  box.style.display = 'block'

  $('prop-title').textContent = TYPE_NAME[e.t] + ' #' + e.id
  $('prop-xyz').textContent = `x ${e.x}  y ${e.y}  宽 ${e.w}  高 ${e.h}`

  $('prop-bind').value = String(e.bind || 0)
  $('prop-color').value = resolveColor(e.c, THEMES[state.theme])

  // 条件显示
  $('prop-size-wrap').style.display = (e.t === TYPE.TEXT) ? 'block' : 'none'
  $('prop-radius-wrap').style.display = (e.t === TYPE.ROUND) ? 'block' : 'none'
  $('prop-icon-wrap').style.display = (e.t === TYPE.ICON) ? 'block' : 'none'
  $('prop-text-wrap').style.display = (e.t === TYPE.TEXT && !e.bind) ? 'block' : 'none'
  if (e.t === TYPE.TEXT && !e.bind) $('prop-text').value = e.text || ''

  // 字号
  const szBox = $('prop-sizes')
  szBox.innerHTML = ''
  if (e.t === TYPE.TEXT) {
    [1, 2, 3, 4].forEach((n) => {
      const b = el('button', (e.sz || 1) === n ? 'on' : '', '字号' + n)
      b.addEventListener('click', () => { e.sz = n; renderAll() })
      szBox.appendChild(b)
    })
  }

  // 圆角
  const rBox = $('prop-radius')
  rBox.innerHTML = ''
  if (e.t === TYPE.ROUND) {
    [0, 3, 5, 8, 12].forEach((n) => {
      const b = el('button', (e.r || 0) === n ? 'on' : '', String(n))
      b.addEventListener('click', () => { e.r = n; renderAll() })
      rBox.appendChild(b)
    })
  }

  // 图标
  const iBox = $('prop-icons')
  iBox.innerHTML = ''
  if (e.t === TYPE.ICON) {
    ICON_LIST.forEach((p) => {
      const b = el('button', e.icon === p.v ? 'on' : '', p.name)
      b.addEventListener('click', () => { e.icon = p.v; renderAll() })
      iBox.appendChild(b)
    })
  }
}

function renderAll() {
  draw()
  renderList()
  updateProps()
}

// ============================================================
//  初始化 UI
// ============================================================
function initUI() {
  // 添加元素
  const addRow = $('add-row')
  ;[
    ['文本', TYPE.TEXT], ['矩形', TYPE.RECT], ['圆角卡', TYPE.ROUND],
    ['圆', TYPE.CIRCLE], ['三角', TYPE.TRI], ['线', TYPE.LINE],
    ['图标', TYPE.ICON], ['进度条', TYPE.PROGRESS], ['柱状图', TYPE.HBAR],
  ].forEach(([name, t]) => {
    const b = el('button', '', '+' + name)
    b.addEventListener('click', () => {
      const e = makeElement(t)
      state.elements.push(e)
      state.selectedId = e.id
      renderAll()
      toast('已添加「' + name + '」')
    })
    addRow.appendChild(b)
  })

  // 缩放 / 网格 / 翻转
  document.querySelectorAll('.zoom[data-z]').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.zoom[data-z]').forEach((x) => x.classList.remove('active'))
      b.classList.add('active')
      state.zoom = +b.dataset.z
      draw()
    })
  })
  $('btn-grid').addEventListener('click', () => {
    state.grid = !state.grid
    $('btn-grid').classList.toggle('active', state.grid)
    draw()
  })
  $('btn-rot').addEventListener('click', () => {
    state.rotate = state.rotate === 180 ? 0 : 180
    $('btn-rot').classList.toggle('active', state.rotate === 180)
    draw()
  })

  // 位置/尺寸微调
  document.querySelectorAll('[data-nudge]').forEach((b) => {
    b.addEventListener('click', () => {
      const e = current(); if (!e) return
      const [dx, dy] = b.dataset.nudge.split(',').map(Number)
      e.x = Math.max(0, Math.min(SCREEN.W - e.w, e.x + dx))
      e.y = Math.max(0, Math.min(SCREEN.H - e.h, e.y + dy))
      renderAll()
    })
  })
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.addEventListener('click', () => {
      const e = current(); if (!e) return
      const [dw, dh] = b.dataset.size.split(',').map(Number)
      e.w = Math.max(4, e.w + dw)
      e.h = Math.max(4, e.h + dh)
      renderAll()
    })
  })

  // 绑定
  BIND_NAME.forEach((n, i) => {
    const o = el('option')
    o.value = i
    o.textContent = n
    $('prop-bind').appendChild(o)
  })
  $('prop-bind').addEventListener('change', function () {
    const e = current(); if (!e) return
    e.bind = +this.value
    renderAll()
  })

  // 颜色
  const cbox = $('prop-colors')
  ;['ink', 'ink2', 'acc', 'ok', 'bad', 'card', 'card2', 'bar', 'bg', 'div'].forEach((k) => {
    const b = el('button', 'swatch')
    b.style.background = THEMES[state.theme][k]
    b.title = k
    b.addEventListener('click', () => {
      const e = current(); if (!e) return
      e.c = k
      renderAll()
    })
    cbox.appendChild(b)
  })
  $('prop-color').addEventListener('input', function () {
    const e = current(); if (!e) return
    e.c = this.value.toUpperCase()
    renderAll()
  })

  // 文字
  $('prop-text').addEventListener('input', function () {
    const e = current(); if (!e) return
    e.text = this.value
    draw()
    renderList()
  })

  // 图层 / 复制 / 删除
  document.querySelectorAll('[data-layer]').forEach((b) => {
    b.addEventListener('click', () => {
      const e = current(); if (!e) return
      const i = state.elements.indexOf(e)
      const j = i + Number(b.dataset.layer)
      if (j < 0 || j >= state.elements.length) return
      state.elements[i] = state.elements[j]
      state.elements[j] = e
      renderAll()
    })
  })
  $('btn-dup').addEventListener('click', () => {
    const e = current(); if (!e) return
    // makeElement 会分配新 id；先取出再覆盖其他属性
    const fresh = makeElement(e.t)
    const n = Object.assign({}, e, { id: fresh.id, x: e.x + 4, y: e.y + 4 })
    // 位图 Canvas 引用可以共享（只读）
    state.elements.push(n)
    state.selectedId = n.id
    renderAll()
  })
  $('btn-del').addEventListener('click', () => {
    const e = current(); if (!e) return
    state.elements = state.elements.filter((x) => x !== e)
    state.selectedId = null
    renderAll()
  })

  // 主题
  const thRow = $('theme-row')
  THEME_KEYS.forEach((k) => {
    const b = el('button', state.theme === k ? 'on' : '', THEMES[k].label)
    b.addEventListener('click', () => {
      state.theme = k
      Array.from(thRow.children).forEach((c) => c.classList.remove('on'))
      b.classList.add('on')
      renderAll()
      renderPropColors()
    })
    thRow.appendChild(b)
  })

  // 事件绑定
  const cv = $('screen')
  cv.addEventListener('mousedown', onDown)
  cv.addEventListener('touchstart', onDown, { passive: false })
  window.addEventListener('mousemove', onMove)
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('mouseup', onUp)
  window.addEventListener('touchend', onUp)
}

function renderPropColors() {
  const cbox = $('prop-colors')
  Array.from(cbox.children).forEach((b) => {
    b.style.background = THEMES[state.theme][b.title] || '#888'
  })
}

// ============================================================
//  模板
// ============================================================
function initTemplates() {
  const grid = $('tpl-grid')
  listTemplates().forEach((t) => {
    const card = el('div', 'tpl-card')
    card.innerHTML =
      `<div class="tpl-name">${t.name}</div>` +
      `<div class="tpl-desc">${t.desc}</div>` +
      `<div class="tpl-meta">${t.count} 个元素 · ${THEMES[t.theme].label}</div>`
    card.addEventListener('click', () => {
      const r = loadTemplate(t.key)
      state.elements = r.elements
      state.theme = r.theme
      state.selectedId = null
      syncUid(state.elements)
      renderAll()
      document.querySelector('.navbtn[data-view="design"]').click()
      toast('已载入「' + t.name + '」')
    })
    grid.appendChild(card)
  })
}

// ============================================================
//  图标 / 位图
// ============================================================
function initBitmap() {
  let img = null

  async function reprocess() {
    if (!img) return
    const w = +$('bmp-w').value, h = +$('bmp-h').value
    const t = +$('bmp-t').value
    const inv = $('bmp-inv').classList.contains('on')
    const bytes = imageToBitmap(img, w, h, t, inv)
    state.bmp = { img, bytes, w, h, inv }

    // 预览
    const cv = $('bmp-preview')
    const cvw = cv.width
    const z = Math.max(1, Math.floor(cvw / Math.max(w, h)))
    cv.height = h * z
    const g = cv.getContext('2d')
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, cv.width, cv.height)
    g.fillStyle = '#05080d'
    g.fillRect(0, 0, cv.width, cv.height)
    const bmpCv = bitmapToCanvas(bytes, w, h, THEMES[state.theme].ink, THEMES[state.theme].card)
    g.imageSmoothingEnabled = false
    g.drawImage(bmpCv, 0, 0, w * z, h * z)

    $('bmp-info').textContent =
      `${w}×${h} · ${bytes.length} 字节 · 每行 ${bytesPerRow(w)} 字节 · ${inv ? '已反色' : '未反色'}`
    $('bmp-code').value = bitmapToCode(bytes, 'bmp_data')
  }

  $('bmp-file').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0]
    if (!f) return
    try {
      img = await readImageFile(f)
      $('bmp-ctrl').style.display = 'block'
      const side = Math.min(64, Math.max(8, Math.round(Math.max(img.width, img.height) / 2)))
      $('bmp-w').value = side
      $('bmp-h').value = side
      $('bmp-wv').textContent = side
      $('bmp-hv').textContent = side
      await reprocess()
      toast('已载入图片')
    } catch (e) {
      toast(e.message, 3000)
    }
  })

  ;[['bmp-w', 'bmp-wv'], ['bmp-h', 'bmp-hv'], ['bmp-t', 'bmp-tv']].forEach(([id, label]) => {
    $(id).addEventListener('input', () => {
      $(label).textContent = $(id).value
      reprocess()
    })
  })

  $('bmp-inv').addEventListener('click', function () {
    this.classList.toggle('on')
    reprocess()
  })

  $('bmp-place').addEventListener('click', () => {
    if (!state.bmp) { toast('请先选择图片'); return }
    const b = state.bmp
    const e = makeElement(TYPE.BITMAP, {
      x: 8, y: 8, w: b.w, h: b.h, c: 'ink',
      _bitmapCanvas: bitmapToCanvas(b.bytes, b.w, b.h, THEMES[state.theme].ink, null),
      _bitmapBytes: b.bytes,
    })
    state.elements.push(e)
    state.selectedId = e.id
    syncUid(state.elements)
    renderAll()
    document.querySelector('.navbtn[data-view="design"]').click()
    toast('位图已放到画布')
  })

  $('bmp-download').addEventListener('click', () => {
    if (!state.bmp) { toast('请先选择图片'); return }
    const code = '#pragma once\n#include <Arduino.h>\n\n' +
      bitmapToCode(state.bmp.bytes, 'bmp_data') +
      `\n\n// 尺寸: ${state.bmp.w} x ${state.bmp.h}\n`
    download('bitmap.h', code)
  })
}

// ============================================================
//  配色工具
// ============================================================
function initPalette() {
  const common = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#00FFFF', '#FF00FF', '#808080', '#C0C0C0', '#800000', '#008000',
    '#000080', '#808000', '#008080', '#800080',
  ]
  const cbox = $('pal-common')
  common.forEach((c) => {
    const b = el('button', 'swatch')
    b.style.background = c
    b.title = c
    b.addEventListener('click', () => {
      $('pal-color').value = c
      updatePal()
    })
    cbox.appendChild(b)
  })

  const thRow = $('pal-themes')
  const listBox = $('pal-list')
  THEME_KEYS.forEach((k) => {
    const b = el('button', '', THEMES[k].label)
    b.addEventListener('click', () => {
      Array.from(thRow.children).forEach((c) => c.classList.remove('on'))
      b.classList.add('on')
      renderPalList(k)
    })
    thRow.appendChild(b)
  })
  renderPalList(state.theme)

  function renderPalList(k) {
    const t = THEMES[k]
    listBox.innerHTML = ''
    Object.keys(t).forEach((key) => {
      if (key === 'label') return
      const row = el('div', 'pal-row')
      row.innerHTML = `<span class="pal-sw" style="background:${t[key]}"></span>` +
        `<span class="pal-key">${key}</span>` +
        `<span class="pal-hex">${t[key]}</span>` +
        `<span class="pal-565">${to565(t[key])}</span>`
      row.addEventListener('click', () => {
        $('pal-color').value = t[key]
        updatePal()
      })
      listBox.appendChild(row)
    })
  }

  function updatePal() {
    const c = $('pal-color').value.toUpperCase()
    const n = parseInt(c.slice(1), 16)
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
    const v = to565(c)
    const back = rgb565ToHex(v)
    $('pal-info').innerHTML =
      `HEX ${c}<br>RGB (${r}, ${g}, ${b})<br>` +
      `RGB565 <b>${v}</b><br>` +
      `屏幕实际显示 ≈ <span style="color:${back}">${back}</span>`

    // 对比度检查
    const bgc = THEMES[state.theme].bg
    const ratio = contrast(c, bgc)
    const rate = ratio >= 4.5 ? ['优秀', '#3DD68C']
      : ratio >= 3 ? ['尚可', '#E8C35A']
      : ratio >= 1.8 ? ['偏弱', '#E8915A'] : ['不合格', '#FF6B6B']
    $('pal-contrast').innerHTML =
      `<div class="pal-row"><span class="pal-key">对主题背景</span>` +
      `<span class="pal-hex">${ratio.toFixed(1)} : 1</span>` +
      `<span class="pal-565" style="color:${rate[1]}">${rate[0]}</span></div>`
  }

  $('pal-color').addEventListener('input', updatePal)
  updatePal()
}

function rgb565ToHex(v565) {
  const v = parseInt(v565.slice(2), 16)
  const r = ((v >> 11) & 31) * 255 / 31
  const g = ((v >> 5) & 63) * 255 / 63
  const b = (v & 31) * 255 / 31
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function luma(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
function contrast(a, b) {
  const la = luma(a), lb = luma(b)
  const hi = Math.max(la, lb), lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

// ============================================================
//  代码生成
// ============================================================
function genCode() {
  const kind = state.codeKind
  let out = '', hint = ''
  const stamp = '// 由 ST7735 Studio 生成  ' + new Date().toLocaleString('zh-CN')

  if (kind === 'render') {
    out = stamp + '\n\n' +
      genPalette(state.theme) + '\n\n' +
      genElements(state.elements) + '\n\n' +
      genRenderFunc(state.elements)
    hint = '粘贴进你的工程。需要先定义 Elem 结构、drawIcon、drawCN、bindValue 等辅助函数（见「完整 .ino」）。'
  } else if (kind === 'full') {
    out = genFullSketch(state.elements, state.theme)
    hint = '完整可编译骨架。数据部分是占位，需接入你的真实数据源。'
  } else if (kind === 'json') {
    out = toJSON(state.elements)
    hint = '可用蓝牙发送给支持该协议的固件（见 firmware/ 目录）。'
  } else {
    out = stamp + '\n\n' + genPalette(state.theme)
    hint = '配色宏，可直接替换工程里的 #define。'
  }

  $('code-out').value = out
  $('code-hint').textContent = hint + '  共 ' + state.elements.length + ' 个元素。'
}

function initCode() {
  document.querySelectorAll('.codekind').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.codekind').forEach((x) => x.classList.remove('active'))
      b.classList.add('active')
      state.codeKind = b.dataset.kind
      genCode()
    })
  })
  $('code-gen').addEventListener('click', genCode)

  $('code-copy').addEventListener('click', async () => {
    genCode()
    const ok = await copyText($('code-out').value)
    toast(ok ? '✓ 已复制到剪贴板' : '复制失败，请手动全选复制', 2600)
  })

  $('code-download').addEventListener('click', () => {
    genCode()
    const ext = state.codeKind === 'json' ? 'json'
      : state.codeKind === 'palette' ? 'h' : 'ino'
    download('st7735_ui.' + ext, $('code-out').value)
  })
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ============================================================
//  备份 / 恢复
// ============================================================
function initBackup() {
  const KEY = 'st7735_studio_layouts'

  function slots() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch (e) { return [] }
  }
  function setSlots(a) { localStorage.setItem(KEY, JSON.stringify(a)) }

  function renderSlots() {
    const box = $('slots')
    box.innerHTML = ''
    const a = slots()
    if (!a.length) {
      box.appendChild(el('div', 'hint', '（暂无备份）'))
      return
    }
    a.forEach((s, i) => {
      const row = el('div', 'slot')
      row.innerHTML = `<span>${s.name} · ${s.elements.length}元素 · ${s.time}</span>`
      const use = el('button', '', '恢复')
      use.addEventListener('click', () => {
        state.elements = fromJSON({ elems: s.elements })
        syncUid(state.elements)
        state.selectedId = null
        if (s.theme) state.theme = s.theme
        renderAll()
        toast('✓ 已恢复')
      })
      const del = el('button', '', '删除')
      del.addEventListener('click', () => {
        const b = slots(); b.splice(i, 1); setSlots(b); renderSlots()
      })
      row.appendChild(use)
      row.appendChild(del)
      box.appendChild(row)
    })
  }

  $('btn-save').addEventListener('click', () => {
    const a = slots()
    a.unshift({
      name: '备份' + (a.length + 1),
      time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      theme: state.theme,
      elements: JSON.parse(JSON.stringify(state.elements.map((e) => {
        const o = { ...e }
        delete o._bitmapCanvas
        delete o._bitmapBytes
        return o
      }))),
    })
    if (a.length > 8) a.length = 8
    setSlots(a)
    renderSlots()
    toast('✓ 已保存到浏览器（共 ' + a.length + ' 份）')
  })

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('清空画布？备份不受影响。')) return
    state.elements = []
    state.selectedId = null
    renderAll()
  })

  renderSlots()
}

// ============================================================
//  启动
// ============================================================
function boot() {
  initUI()
  initTemplates()
  initBitmap()
  initPalette()
  initCode()
  initBackup()

  // 默认载入模板
  const r = loadTemplate('balance')
  state.elements = r.elements
  state.theme = r.theme
  renderAll()
}

boot()
