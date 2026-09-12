/**
 * ST7735 Studio — Arduino 代码生成器
 *
 * 把元素数组转换成可直接编译的 Arduino 代码。
 * 生成的原语与 Adafruit_GFX 一一对应。
 */

import {
  TYPE, ICON, BIND, SCREEN, THEMES, resolveColor, to565,
} from './index.js'

const IND = '  '

/** 图标枚举名（与固件一致） */
const ICON_ENUM = {
  [ICON.DOT]: 'I_DOT', [ICON.UP]: 'I_UP', [ICON.DOWN]: 'I_DOWN',
  [ICON.CHECK]: 'I_CHECK', [ICON.CROSS]: 'I_CROSS', [ICON.WARN]: 'I_WARN',
  [ICON.RING]: 'I_RING', [ICON.WIFI]: 'I_WIFI', [ICON.CLOCK]: 'I_CLOCK',
  [ICON.BATTERY]: 'I_BATTERY', [ICON.BOLT]: 'I_BOLT', [ICON.STAR]: 'I_STAR',
  [ICON.WHALE]: 'I_WHALE',
}

const BIND_ENUM = {
  [BIND.BALANCE]: 'D_BALANCE', [BIND.DELTA]: 'D_DELTA', [BIND.USED]: 'D_USED',
  [BIND.TOKENS]: 'D_TOKENS', [BIND.POLLS]: 'D_POLLS', [BIND.SSID]: 'D_SSID',
  [BIND.TIME]: 'D_TIME', [BIND.AVAIL]: 'D_AVAIL', [BIND.PCT]: 'D_PCT',
  [BIND.TOKEN_M]: 'D_TOKEN_M', [BIND.WIFI_FULL]: 'D_WIFI_FULL',
  [BIND.PWD]: 'D_PWD', [BIND.GRANTED]: 'D_GRANTED', [BIND.TOPUP]: 'D_TOPUP',
  [BIND.CURRENCY]: 'D_CURRENCY', [BIND.IP]: 'D_IP', [BIND.RSSI]: 'D_RSSI',
}

const TYPE_ENUM = {
  [TYPE.TEXT]: 'T_TEXT', [TYPE.RECT]: 'T_RECT', [TYPE.ROUND]: 'T_ROUND',
  [TYPE.CIRCLE]: 'T_CIRCLE', [TYPE.TRI]: 'T_TRI', [TYPE.LINE]: 'T_LINE',
  [TYPE.ICON]: 'T_ICON', [TYPE.BITMAP]: 'T_BITMAP',
  [TYPE.PROGRESS]: 'T_PROGRESS', [TYPE.HBAR]: 'T_HBAR',
}

/** 转义 C 字符串 */
function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * 生成配色宏
 */
export function genPalette(themeKey) {
  const t = THEMES[themeKey] || THEMES.paper
  const map = {
    P_BG: t.bg, P_BAR: t.bar, P_CARD: t.card, P_CARD2: t.card2,
    P_DIV: t.div, P_ACC: t.acc, P_INK: t.ink, P_INK2: t.ink2,
    P_OK: t.ok, P_BAD: t.bad,
  }
  const lines = ['// ---------- 配色（' + t.label + '） ----------']
  for (const k in map) {
    lines.push(`#define ${k.padEnd(8)} ${to565(map[k])}   // ${map[k]}`)
  }
  return lines.join('\n')
}

/**
 * 生成元素数组定义
 */
export function genElements(elements) {
  const lines = []
  lines.push('// ---------- 界面元素 ----------')
  lines.push(`#define ELEM_COUNT ${elements.length}`)
  lines.push('')
  lines.push('static Elem elems[ELEM_COUNT] = {')
  elements.forEach((e, i) => {
    const col = e.c && e.c.charAt(0) === '#' ? to565(e.c) : 'C_' + String(e.c || 'ink').toUpperCase()
    const parts = [
      TYPE_ENUM[e.t] || 'T_TEXT',
      String(e.x), String(e.y), String(e.w), String(e.h),
      col,
      String(e.sz || 1),
      e.r ? String(e.r) : '0',
      e.bind ? (BIND_ENUM[e.bind] || 'D_NONE') : 'D_NONE',
      e.t === TYPE.ICON ? (ICON_ENUM[e.icon] || 'I_NONE') : 'I_NONE',
      e.on ? '1' : '0',
      '"' + esc(e.text || '') + '"',
    ]
    const comment = '  // ' + (i + 1)
    lines.push(`  { ${parts.join(', ')} }${i < elements.length - 1 ? ',' : ''}${comment}`)
  })
  lines.push('};')
  return lines.join('\n')
}

/**
 * 生成 renderScreen() 函数（硬编码坐标版，适合不接收 JSON 的场景）
 */
export function genRenderFunc(elements, indent = '') {
  const I = indent
  const L = []
  L.push(I + 'void renderScreen() {')
  L.push(I + IND + 'int16_t x1, y1; uint16_t w, h;')
  L.push(I + IND + 'char buf[48];')
  L.push(I + IND + 'tft.fillScreen(P_BG);')
  L.push('')

  elements.forEach((e) => {
    if (!e.on) return
    const c = e.c && e.c.charAt(0) === '#' ? to565(e.c) : 'C_' + String(e.c || 'ink').toUpperCase()
    const { x, y, w, h } = e

    switch (e.t) {
      case TYPE.RECT:
        L.push(I + IND + `tft.fillRect(${x}, ${y}, ${w}, ${h}, ${c});`)
        break
      case TYPE.ROUND:
        L.push(I + IND + `tft.fillRoundRect(${x}, ${y}, ${w}, ${h}, ${e.r || 4}, ${c});`)
        break
      case TYPE.CIRCLE:
        L.push(I + IND + `tft.fillCircle(${x + Math.floor(w / 2)}, ${y + Math.floor(h / 2)}, ${Math.floor(Math.min(w, h) / 2)}, ${c});`)
        break
      case TYPE.TRI:
        L.push(I + IND + `tft.fillTriangle(${x + Math.floor(w / 2)}, ${y}, ${x + w}, ${y + h}, ${x}, ${y + h}, ${c});`)
        break
      case TYPE.LINE:
        L.push(I + IND + `tft.fillRect(${x}, ${y}, ${w}, ${Math.max(1, h)}, ${c});`)
        break
      case TYPE.ICON:
        L.push(I + IND + `drawIcon(${ICON_ENUM[e.icon] || 'I_NONE'}, ${x}, ${y}, ${w}, ${h}, ${c});`)
        break
      case TYPE.PROGRESS:
        L.push(I + IND + `// 进度条 @(${x},${y})`)
        L.push(I + IND + `tft.fillRect(${x}, ${y}, ${w}, ${h}, P_CARD2);`)
        L.push(I + IND + `{`)
        L.push(I + IND + IND + `int pct = (baseBalance > 0) ? constrain((int)(usedAmount * 100 / baseBalance), 0, 100) : 0;`)
        L.push(I + IND + IND + `int fw = ${w} * pct / 100;`)
        L.push(I + IND + IND + `if (fw > 0) tft.fillRect(${x}, ${y}, fw, ${h}, ${c});`)
        L.push(I + IND + IND + `int mx = constrain(${x} + fw, ${x + 3}, ${x + w - 3});`)
        L.push(I + IND + IND + `tft.fillCircle(mx, ${y + Math.floor(h / 2)}, 2, ${c});`)
        L.push(I + IND + `}`)
        break
      case TYPE.HBAR:
        L.push(I + IND + `// 柱状图 @(${x},${y})`)
        L.push(I + IND + `drawChart(${x}, ${y}, ${w}, ${h});`)
        break
      case TYPE.TEXT: {
        if (e.bind) {
          const be = BIND_ENUM[e.bind] || 'D_NONE'
          if (e.bind === BIND.TIME) {
            L.push(I + IND + `tft.setTextSize(${e.sz || 1}); tft.setTextColor(${c});`)
            L.push(I + IND + `tft.setCursor(${x}, ${y}); tft.print(timeNow());`)
          } else {
            L.push(I + IND + `bindValue(${be}, buf, sizeof(buf));`)
            if ((e.sz || 1) > 1) {
              L.push(I + IND + `tft.setTextSize(${e.sz});`)
              L.push(I + IND + `tft.setTextColor(${c});`)
              // 居中
              L.push(I + IND + `tft.getTextBounds(buf, 0, 0, &x1, &y1, &w, &h);`)
              L.push(I + IND + `tft.setCursor(${x} + (${w} - (int16_t)w) / 2, ${y});`)
              L.push(I + IND + `tft.print(buf);`)
            } else {
              L.push(I + IND + `drawCN(buf, ${x}, ${y}, ${c});`)
            }
          }
        } else if (e.text) {
          L.push(I + IND + `drawCN("${esc(e.text)}", ${x}, ${y}, ${c});`)
        }
        break
      }
      case TYPE.BITMAP:
        L.push(I + IND + `// 位图 @(${x},${y}) ${w}x${h}`)
        L.push(I + IND + `tft.drawBitmap(${x}, ${y}, bmp_data, ${w}, ${h}, ${c}, P_BG);`)
        break
    }
  })

  L.push(I + '}')
  return L.join('\n')
}

/**
 * 生成完整 .ino 骨架
 */
export function genFullSketch(elements, themeKey, opt = {}) {
  const { title = 'ST7735 Studio 生成的界面', includeData = true } = opt
  const t = THEMES[themeKey] || THEMES.paper

  return `// ============================================================
//  ${title}
//  由 ST7735 Studio 生成  —  https://github.com/ardesp0630/st7735-studio
//
//  硬件：ESP32 + ST7735S 160x128
//  依赖：Adafruit GFX / Adafruit ST7735
// ============================================================
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>

// ---------- 引脚（按需修改） ----------
#define TFT_CS    10
#define TFT_DC     9
#define TFT_RST    8
#define TFT_MOSI   7
#define TFT_SCLK   6

Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);

${genPalette(themeKey)}

// ---------- 元素结构 ----------
enum { T_TEXT, T_RECT, T_ROUND, T_CIRCLE, T_TRI, T_LINE, T_ICON, T_BITMAP, T_PROGRESS, T_HBAR };
enum { D_NONE, D_BALANCE, D_DELTA, D_USED, D_TOKENS, D_POLLS, D_SSID, D_TIME,
       D_AVAIL, D_PCT, D_TOKEN_M, D_WIFI_FULL, D_PWD, D_GRANTED, D_TOPUP,
       D_CURRENCY, D_IP, D_RSSI };
enum { I_NONE, I_DOT, I_UP, I_DOWN, I_CHECK, I_CROSS, I_WARN, I_RING,
       I_WIFI, I_CLOCK, I_BATTERY, I_BOLT, I_STAR, I_WHALE };

struct Elem {
  uint8_t  type;
  int16_t  x, y, w, h;
  uint16_t color;
  uint8_t  sz;
  uint8_t  radius;
  uint8_t  bind;
  uint8_t  icon;
  uint8_t  on;
  char     text[24];
};

${genElements(elements)}

${includeData ? genDataStubs() : ''}

// ============================================================
void setup() {
  Serial.begin(115200);
  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_BLACKTAB);
  tft.setRotation(3);          // 180° 翻转，按需调整
  renderScreen();
}

void loop() {
  // 在这里更新数据后调用 renderScreen()
  delay(1000);
}
`
}

/** 生成数据占位（用户自行接入真实数据源） */
function genDataStubs() {
  return `// ============================================================
//  数据源（按需替换为真实数据）
// ============================================================
float    curTotal   = 96.50f;      // 余额
float    usedAmount = 12.34f;      // 累计消耗
float    baseBalance = 100.0f;     // 基准余额（用于进度条）
uint32_t estTokens  = 518211416UL; // 累计 Token
uint32_t pollCount  = 1527;        // 查询次数
String   runSsid    = "MyWiFi";    // WiFi 名
String   runPwd     = "password";  // WiFi 密码
bool     curAvailable = true;      // 可用状态
float    curDelta   = -0.02f;      // 涨跌
float    curGranted = 10.00f;
float    curToppedUp = 86.50f;
float    curCurrency = 0;          // 占位

String timeNow() {
  struct tm t;
  if (!getLocalTime(&t, 100)) return "--:--:--";
  char b[12];
  snprintf(b, sizeof(b), "%02d:%02d:%02d", t.tm_hour, t.tm_min, t.tm_sec);
  return String(b);
}

void formatTokens(uint32_t v, char* out, size_t n) {
  if (v >= 100000000UL) {
    snprintf(out, n, "%lu\\xE4\\xBA\\xBF%04lu",
             (unsigned long)(v / 100000000UL),
             (unsigned long)((v % 100000000UL) / 10000UL));
  } else if (v >= 10000UL) {
    snprintf(out, n, "%lu.%02lu", (unsigned long)(v / 10000UL),
             (unsigned long)((v % 10000UL) / 100UL));
  } else {
    snprintf(out, n, "%lu", (unsigned long)v);
  }
}

void bindValue(uint8_t b, char* out, size_t n) {
  int pct = (baseBalance > 0) ? constrain((int)(usedAmount * 100 / baseBalance), 0, 100) : 0;
  switch (b) {
    case D_BALANCE:   snprintf(out, n, "%.2f", curTotal); break;
    case D_DELTA:     snprintf(out, n, "%s%.2f", curDelta >= 0 ? "+" : "", curDelta); break;
    case D_USED:      snprintf(out, n, "%.2f", usedAmount); break;
    case D_TOKENS:    snprintf(out, n, "%lu", (unsigned long)estTokens); break;
    case D_POLLS:     snprintf(out, n, "%lu", (unsigned long)pollCount); break;
    case D_SSID:      snprintf(out, n, "%s", runSsid.c_str()); break;
    case D_TIME:      snprintf(out, n, "%s", timeNow().c_str()); break;
    case D_AVAIL:     snprintf(out, n, "%s", curAvailable ? "OK" : "LOW"); break;
    case D_PCT:       snprintf(out, n, "%d%%", pct); break;
    case D_TOKEN_M:   formatTokens(estTokens, out, n); break;
    case D_WIFI_FULL: snprintf(out, n, "WiFi %s", runSsid.c_str()); break;
    case D_PWD:       snprintf(out, n, "%s", runPwd.c_str()); break;
    case D_GRANTED:   snprintf(out, n, "%.2f", curGranted); break;
    case D_TOPUP:     snprintf(out, n, "%.2f", curToppedUp); break;
    default:          out[0] = 0; break;
  }
}

void drawIcon(uint8_t icon, int x, int y, int w, int h, uint16_t col) {
  int cx = x + w / 2, cy = y + h / 2;
  int r = (w < h ? w : h) / 2;
  if (r < 1) r = 1;
  switch (icon) {
    case I_DOT:  tft.fillCircle(cx, cy, r, col); break;
    case I_UP:   tft.fillTriangle(cx, y, x + w - 1, y + h - 1, x, y + h - 1, col); break;
    case I_DOWN: tft.fillTriangle(cx, y + h - 1, x, y, x + w - 1, y, col); break;
    case I_RING: tft.drawCircle(cx, cy, r - 1, col); break;
    case I_WARN:
      tft.drawTriangle(cx, y, x + w - 1, y + h - 1, x, y + h - 1, col);
      tft.drawFastVLine(cx, y + h / 3, h / 4, col);
      break;
    default: break;
  }
}

void drawCN(const char* s, int x, int y, uint16_t color) {
  tft.setTextSize(1);
  tft.setTextColor(color);
  tft.setCursor(x, y);
  tft.print(s);       // 英文；中文需自备字库，见 README
}

void drawChart(int x, int y, int w, int h) {
  // 占位：画三条基线
  for (int i = 0; i <= 2; i++) {
    tft.drawFastHLine(x + 4, y + 4 + (h - 8) / 2 * i, w - 8, P_DIV);
  }
}

`
}

/** 复制到剪贴板的辅助 */
export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  return false
}
