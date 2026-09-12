/**
 * ST7735 Studio — 位图工具
 *
 * 图片 → 1-bit 点阵（横向打包，每行 ceil(w/8) 字节）
 * 与 Adafruit_GFX::drawBitmap 的格式一致。
 */

/** 每行占用字节数 */
export function bytesPerRow(w) {
  return Math.ceil(w / 8)
}

/**
 * 图片转 1-bit 位图
 * @param {HTMLImageElement|HTMLCanvasElement} img 源图
 * @param {number} tw 目标宽
 * @param {number} th 目标高
 * @param {number} threshold 二值化阈值 0-255
 * @param {boolean} invert 是否反色
 * @returns {Uint8Array} 打包后的位图数据
 */
export function imageToBitmap(img, tw, th, threshold = 128, invert = false) {
  const cv = document.createElement('canvas')
  cv.width = tw
  cv.height = th
  const g = cv.getContext('2d')
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, tw, th)

  const d = g.getImageData(0, 0, tw, th).data
  const bpr = bytesPerRow(tw)
  const out = new Uint8Array(bpr * th)

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const i = (y * tw + x) * 4
      const a = d[i + 3]
      // 透明像素视为背景（白）
      const lum = a < 40 ? 255 : (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
      let on = lum < threshold
      if (invert) on = !on
      if (on) out[y * bpr + (x >> 3)] |= (0x80 >> (x & 7))
    }
  }
  return out
}

/** Uint8Array → base64 */
export function bitmapToBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

/** base64 → Uint8Array */
export function base64ToBitmap(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * 位图 → Canvas（用于预览）
 * @param {Uint8Array} bytes
 * @param {number} w
 * @param {number} h
 * @param {string} fg 前景色
 * @param {string} bg 背景色（透明则传 null）
 */
export function bitmapToCanvas(bytes, w, h, fg = '#000000', bg = null) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')

  const f = hexToRgb(fg)
  const img = g.createImageData(w, h)
  const bpr = bytesPerRow(w)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = (bytes[y * bpr + (x >> 3)] >> (7 - (x & 7))) & 1
      const i = (y * w + x) * 4
      if (on) {
        img.data[i] = f[0]; img.data[i + 1] = f[1]; img.data[i + 2] = f[2]; img.data[i + 3] = 255
      } else if (bg) {
        const b = hexToRgb(bg)
        img.data[i] = b[0]; img.data[i + 1] = b[1]; img.data[i + 2] = b[2]; img.data[i + 3] = 255
      } else {
        img.data[i + 3] = 0
      }
    }
  }
  g.putImageData(img, 0, 0)
  return cv
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * 生成 Arduino PROGMEM 数组代码
 */
export function bitmapToCode(bytes, name = 'bmp_data') {
  const lines = []
  lines.push(`// 1-bit 位图，共 ${bytes.length} 字节`)
  lines.push(`static const uint8_t ${name}[] PROGMEM = {`)
  for (let i = 0; i < bytes.length; i += 16) {
    const row = []
    for (let j = i; j < Math.min(i + 16, bytes.length); j++) {
      row.push('0x' + bytes[j].toString(16).toUpperCase().padStart(2, '0'))
    }
    lines.push('  ' + row.join(', ') + (i + 16 < bytes.length ? ',' : ''))
  }
  lines.push('};')
  return lines.join('\n')
}

/**
 * 读取本地图片文件
 */
export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片载入失败'))
    img.src = url
  })
}
