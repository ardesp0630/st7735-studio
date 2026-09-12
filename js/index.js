/**
 * ST7735 Studio — 模块统一出口
 *
 * 所有模块从这里导出，避免循环依赖问题。
 */

export {
  TYPE, TYPE_NAME, BIND, BIND_NAME, ICON, ICON_LIST,
  SCREEN, makeElement, syncUid, toJSON, fromJSON,
  DEMO_DATA, formatTokens, bindText,
} from './elements.js'

export {
  THEMES, THEME_KEYS, resolveColor, to565,
  drawElement, renderScreen, hitTest, handleHit,
} from './canvas.js'

export { listTemplates, loadTemplate } from './templates.js'

export {
  genPalette, genElements, genRenderFunc, genFullSketch, copyText,
} from './codegen.js'

export {
  imageToBitmap, bitmapToBase64, base64ToBitmap, bytesPerRow,
  bitmapToCanvas, bitmapToCode, readImageFile,
} from './bitmap.js'
