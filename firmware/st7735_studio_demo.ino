// ============================================================
//  ST7735 Studio — 参考固件
//
//  用途：演示如何接收 ST7735 Studio 发送的布局 JSON 并实时渲染。
//        这不是完整产品，而是协议实现示例，可移植到你自己的工程。
//
//  硬件：ESP32-C3 / ESP32 + ST7735S 160x128
//  接线：CS=10 DC=9 RST=8 MOSI=7 SCLK=6 BL=3（按需修改）
//  编译：ESP32C3 Dev Module / 4MB / DIO / 40MHz
//
//  BLE 协议：
//    服务 d5f10001-6f2a-4b6f-9a2a-8b0e2b7f9c01
//    ├ d5f10005 ... 命令特征（写）
//    │   LAYOUT      查询布局（返回总片数 + 第 0 片）
//    │   LAYOUT:N    返回第 N 片
//    └ d5f10007 ... 设置特征（写）
//        分片格式 <seq>|<total>|<内容>
//        收齐后解析 {"elems":[...]} 并重绘
// ============================================================
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

// ---------------- 引脚 ----------------
#define TFT_CS    10
#define TFT_DC     9
#define TFT_RST    8
#define TFT_MOSI   7
#define TFT_SCLK   6
#define BL_PIN     3

#define SCR_W 160
#define SCR_H 128

Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);

// ---------------- 配色（与 ST7735 Studio 主题对应） ----------------
#define P_BG     0xCE16   // #C9C2B0
#define P_BAR    0xF79C   // #F5F1E6
#define P_CARD   0xF79C
#define P_CARD2  0x9CB0   // #9C9482
#define P_DIV    0xB5B6   // #B5B2AD
#define P_ACC    0x8AC5   // #8C5A2B
#define P_INK    0x18C2   // #1F1B14
#define P_INK2   0x4A27   // #4E4638
#define P_OK     0x2B47   // #2F6B3A
#define P_BAD    0x9944   // #9E2B24

// ---------------- 元素模型（与 Studio 一致） ----------------
enum { T_TEXT, T_RECT, T_ROUND, T_CIRCLE, T_TRI, T_LINE,
       T_ICON, T_BITMAP, T_PROGRESS, T_HBAR };
enum { D_NONE, D_BALANCE, D_DELTA, D_USED, D_TOKENS, D_POLLS, D_SSID, D_TIME,
       D_AVAIL, D_PCT, D_TOKEN_M, D_WIFI_FULL, D_PWD, D_GRANTED, D_TOPUP,
       D_CURRENCY, D_IP, D_RSSI };
enum { I_NONE, I_DOT, I_UP, I_DOWN, I_CHECK, I_CROSS, I_WARN, I_RING,
       I_WIFI, I_CLOCK, I_BATTERY, I_BOLT, I_STAR, I_WHALE };

#define MAX_ELEMS 24

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

static Elem elems[MAX_ELEMS];
static uint8_t elemCount = 0;

// ---------------- 演示数据（替换为你的真实数据源） ----------------
float    curTotal    = 96.50f;
float    usedAmount  = 12.34f;
float    baseBalance = 100.0f;
uint32_t estTokens   = 518211416UL;
uint32_t pollCount   = 1527;
String   runSsid     = "MyWiFi";
String   runPwd      = "password";
bool     curAvailable = true;
float    curDelta    = -0.02f;
float    curGranted  = 10.00f;
float    curToppedUp = 86.50f;
const char* curCurrency = "CNY";

Preferences prefs;

// ---------------- BLE ----------------
#define BLE_NAME          "ST7735-Studio"
#define UUID_SERVICE      "d5f10001-6f2a-4b6f-9a2a-8b0e2b7f9c01"
#define UUID_CMD          "d5f10005-6f2a-4b6f-9a2a-8b0e2b7f9c01"
#define UUID_STATUS       "d5f10006-6f2a-4b6f-9a2a-8b0e2b7f9c01"
#define UUID_SETTINGS     "d5f10007-6f2a-4b6f-9a2a-8b0e2b7f9c01"

static BLECharacteristic* gStatus = nullptr;
volatile bool needRedraw = false;

// 分片缓冲
#define FRAG_SIZE 4096
static char     fragBuf[FRAG_SIZE];
static uint16_t fragLen = 0;
static uint8_t  fragTotal = 0;
static uint8_t  fragGot = 0;
static uint32_t fragLast = 0;

// ---------------- 前置声明 ----------------
void renderScreen();
void drawChart(int x, int y, int w, int h);
void drawIcon(uint8_t icon, int x, int y, int w, int h, uint16_t col);

// ============================================================
//  数据取值
// ============================================================
String timeNow() {
  struct tm t;
  if (!getLocalTime(&t, 100)) return "--:--:--";
  char b[12];
  snprintf(b, sizeof(b), "%02d:%02d:%02d", t.tm_hour, t.tm_min, t.tm_sec);
  return String(b);
}

void formatTokens(uint32_t v, char* out, size_t n) {
  if (v >= 100000000UL) {
    // 「亿」字用 UTF-8 字节直接写
    snprintf(out, n, "%lu\xE4\xBA\xBF%04lu",
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
  int pct = (baseBalance > 0)
    ? constrain((int)(usedAmount * 100 / baseBalance), 0, 100) : 0;
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
    case D_CURRENCY:  snprintf(out, n, "%s", curCurrency); break;
    case D_IP:        snprintf(out, n, "%s", WiFi.localIP().toString().c_str()); break;
    case D_RSSI:      snprintf(out, n, "%d dBm", WiFi.RSSI()); break;
    default:          out[0] = 0; break;
  }
}

// ============================================================
//  绘图
// ============================================================
// 简易中英混排（英文用 GFX 内置字体，中文需自备字库）
void drawCN(const char* s, int x, int y, uint16_t color, uint8_t scale) {
  tft.setTextSize(scale ? scale : 1);
  tft.setTextColor(color);
  tft.setCursor(x, y);
  tft.print(s);
}

void drawIcon(uint8_t icon, int x, int y, int w, int h, uint16_t col) {
  int cx = x + w / 2, cy = y + h / 2;
  int r = (w < h ? w : h) / 2;
  if (r < 1) r = 1;

  switch (icon) {
    case I_DOT:  tft.fillCircle(cx, cy, r, col); break;
    case I_UP:   tft.fillTriangle(cx, y, x + w - 1, y + h - 1, x, y + h - 1, col); break;
    case I_DOWN: tft.fillTriangle(cx, y + h - 1, x, y, x + w - 1, y, col); break;

    case I_CHECK:
      for (int t = 0; t < 2; t++) {
        tft.drawLine(x, cy + t, x + w / 3, y + h - 1 + t, col);
        tft.drawLine(x + w / 3, y + h - 1 + t, x + w - 1, y + t, col);
      }
      break;

    case I_CROSS:
      for (int t = 0; t < 2; t++) {
        tft.drawLine(x + t, y, x + w - 1 + t, y + h - 1, col);
        tft.drawLine(x + w - 1 - t, y, x - t, y + h - 1, col);
      }
      break;

    case I_WARN:
      tft.drawTriangle(cx, y, x + w - 1, y + h - 1, x, y + h - 1, col);
      tft.drawFastVLine(cx, y + h / 3, h / 4, col);
      tft.drawPixel(cx, y + h - 3, col);
      break;

    case I_RING:
      tft.drawCircle(cx, cy, r - 1, col);
      if (r > 3) tft.drawCircle(cx, cy, r - 2, col);
      break;

    case I_WIFI: {
      int bx = x + w / 6, by = y + h - 2;
      tft.fillCircle(bx, by, 1, col);
      for (int ring = 1; ring <= 3; ring++) {
        int rr = ring * (w * 2 / 3) / 3;
        if (rr < 2) continue;
        for (int a = -52; a <= 52; a += 5) {
          float rad = (a - 90) * 3.14159f / 180.0f;
          int px = bx + (int)(rr * cos(rad));
          int py = by + (int)(rr * sin(rad));
          tft.drawPixel(px, py, col);
          tft.drawPixel(px, py - 1, col);
        }
      }
      break;
    }

    case I_CLOCK:
      tft.drawCircle(cx, cy, r - 1, col);
      tft.drawLine(cx, cy, cx, cy - r + 3, col);
      tft.drawLine(cx, cy, cx + r / 2, cy + r / 5, col);
      break;

    case I_BATTERY:
      tft.drawRect(x, y + 1, w - 4, h - 2, col);
      tft.fillRect(x + w - 3, y + h / 2 - 2, 2, 4, col);
      tft.fillRect(x + 3, y + 4, (w - 8) * 2 / 3, h - 6, col);
      break;

    case I_BOLT:
      tft.fillTriangle(cx + w / 6, y, x + w - 1, y + h * 42 / 100, x + w / 4, y + h * 42 / 100, col);
      tft.fillTriangle(cx - w / 6, y + h * 58 / 100, x + w * 3 / 4, y + h * 58 / 100, x, y + h - 1, col);
      tft.fillRect(x + w / 4, y + h * 38 / 100, w / 2, h * 24 / 100, col);
      break;

    case I_STAR:
      for (int i = 0; i < 5; i++) {
        float a1 = (-90 + i * 144) * 3.14159f / 180.0f;
        float a2 = (-90 + (i + 2) * 144) * 3.14159f / 180.0f;
        tft.drawLine(cx + r * cos(a1), cy + r * sin(a1),
                     cx + r * cos(a2), cy + r * sin(a2), col);
      }
      break;

    case I_WHALE: {
      int s = r / 4; if (s < 1) s = 1;
      tft.fillRect(x + w / 4, cy - s, w / 2 + 2, s * 2, col);
      tft.fillCircle(x + w / 4, cy, s * 2, col);
      tft.fillCircle(cx + w / 6, cy, s * 2, col);
      tft.fillTriangle(cx + w / 5, cy, x + w - 1, cy - s * 2, x + w - 1, cy + s / 2, col);
      tft.fillTriangle(cx - w / 12, cy - s, cx, y + 1, cx + w / 12, cy - s, col);
      tft.fillCircle(x + w / 4 - s, cy - s / 2, 1, P_BG);
      break;
    }

    default: break;
  }
}

void drawChart(int x, int y, int w, int h) {
  // 占位：三条基线 + 随机波形（替换为你的历史数据）
  for (int i = 0; i <= 2; i++) {
    tft.drawFastHLine(x + 4, y + 4 + (h - 8) / 2 * i, w - 8, P_DIV);
  }
  int prevX = -1, prevY = -1;
  for (int i = 0; i < 30; i++) {
    int px = x + 4 + i * (w - 8) / 29;
    int py = y + 4 + (h - 8) - (int)((sin(i * 0.5) * 0.5 + 0.5) * (h - 8));
    if (prevX >= 0) tft.drawLine(prevX, prevY, px, py, P_ACC);
    prevX = px; prevY = py;
  }
}

void renderScreen() {
  tft.fillScreen(P_BG);
  int16_t x1, y1; uint16_t tw, th;
  char buf[48];

  for (uint8_t i = 0; i < elemCount; i++) {
    const Elem& e = elems[i];
    if (!e.on) continue;
    uint16_t col = (e.color == 0xFFFF) ? P_INK : e.color;

    switch (e.type) {
      case T_RECT:  tft.fillRect(e.x, e.y, e.w, e.h, col); break;
      case T_ROUND: tft.fillRoundRect(e.x, e.y, e.w, e.h, e.radius ? e.radius : 4, col); break;
      case T_CIRCLE: tft.fillCircle(e.x + e.w / 2, e.y + e.h / 2,
                                    (e.w < e.h ? e.w : e.h) / 2, col); break;
      case T_TRI:   tft.fillTriangle(e.x + e.w / 2, e.y, e.x + e.w, e.y + e.h,
                                     e.x, e.y + e.h, col); break;
      case T_LINE:  tft.fillRect(e.x, e.y, e.w, e.h > 0 ? e.h : 1, col); break;
      case T_ICON:  drawIcon(e.icon, e.x, e.y, e.w, e.h, col); break;

      case T_PROGRESS: {
        tft.fillRect(e.x, e.y, e.w, e.h, P_CARD2);
        int pct = (baseBalance > 0)
          ? constrain((int)(usedAmount * 100 / baseBalance), 0, 100) : 0;
        int fw = e.w * pct / 100;
        if (fw > 0) tft.fillRect(e.x, e.y, fw, e.h, col);
        int mx = constrain(e.x + fw, e.x + 3, e.x + e.w - 3);
        tft.fillCircle(mx, e.y + e.h / 2, 2, col);
        break;
      }

      case T_HBAR: drawChart(e.x, e.y, e.w, e.h); break;

      case T_TEXT: {
        if (e.bind != D_NONE) {
          if (e.bind == D_TIME) {
            drawCN(timeNow().c_str(), e.x, e.y, col, e.sz);
          } else {
            bindValue(e.bind, buf, sizeof(buf));
            if (e.sz > 1) {
              tft.setTextSize(e.sz);
              tft.setTextColor(col);
              tft.getTextBounds(buf, 0, 0, &x1, &y1, &tw, &th);
              tft.setCursor(e.x + (e.w - (int16_t)tw) / 2, e.y);
              tft.print(buf);
            } else {
              drawCN(buf, e.x, e.y, col, 1);
            }
          }
        } else if (e.text[0]) {
          drawCN(e.text, e.x, e.y, col, e.sz);
        }
        break;
      }
    }
  }
}

// ============================================================
//  JSON 解析
// ============================================================
uint16_t paletteByName(const char* name) {
  if (!name || !name[0]) return 0xFFFF;
  if (name[0] == '#') {
    long v = strtol(name + 1, NULL, 16);
    uint8_t r = (v >> 16) & 0xFF, g = (v >> 8) & 0xFF, b = v & 0xFF;
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
  }
  if (!strcmp(name, "bg"))    return P_BG;
  if (!strcmp(name, "bar"))   return P_BAR;
  if (!strcmp(name, "card"))  return P_CARD;
  if (!strcmp(name, "card2")) return P_CARD2;
  if (!strcmp(name, "div"))   return P_DIV;
  if (!strcmp(name, "acc"))   return P_ACC;
  if (!strcmp(name, "ink"))   return P_INK;
  if (!strcmp(name, "ink2"))  return P_INK2;
  if (!strcmp(name, "ok"))    return P_OK;
  if (!strcmp(name, "bad"))   return P_BAD;
  return 0xFFFF;
}

bool applyLayout(const String& js) {
  JsonDocument d;
  if (deserializeJson(d, js) != DeserializationError::Ok) return false;
  JsonArray arr = d["elems"].as<JsonArray>();
  if (arr.isNull()) return false;

  uint8_t n = 0;
  for (JsonObject o : arr) {
    if (n >= MAX_ELEMS) break;
    Elem& e = elems[n++];
    memset(&e, 0, sizeof(Elem));
    e.type   = o["t"]      | 0;
    e.x      = o["x"]      | 0;
    e.y      = o["y"]      | 0;
    e.w      = o["w"]      | 0;
    e.h      = o["h"]      | 0;
    e.sz     = o["sz"]     | 1;
    e.radius = o["r"]      | 0;
    e.bind   = o["bind"]   | 0;
    e.icon   = o["icon"]   | 0;
    e.on     = (o["on"]    | 1) != 0;
    if (o["c"].is<const char*>()) e.color = paletteByName(o["c"].as<const char*>());
    else                          e.color = o["c"] | 0xFFFF;
    snprintf(e.text, sizeof(e.text), "%s", (const char*)(o["text"] | ""));
  }
  elemCount = n;
  return true;
}

String layoutToJson() {
  String s = "{\"elems\":[";
  for (uint8_t i = 0; i < elemCount; i++) {
    const Elem& e = elems[i];
    if (i) s += ",";
    s += "{\"t\":" + String(e.type) + ",\"x\":" + String(e.x) + ",\"y\":" + String(e.y) +
         ",\"w\":" + String(e.w) + ",\"h\":" + String(e.h) +
         ",\"c\":" + String(e.color) + ",\"sz\":" + String(e.sz) +
         ",\"r\":" + String(e.radius) + ",\"bind\":" + String(e.bind) +
         ",\"icon\":" + String(e.icon) + ",\"on\":" + String(e.on ? 1 : 0) +
         ",\"text\":\"" + String(e.text) + "\"}";
  }
  s += "]}";
  return s;
}

void saveLayout() {
  Preferences w; w.begin("layout", false);
  w.putUChar("cnt", elemCount);
  w.putBytes("els", elems, sizeof(Elem) * elemCount);
  w.end();
}

void loadLayout() {
  Preferences r; r.begin("layout", true);
  uint8_t cnt = r.getUChar("cnt", 0);
  if (cnt > 0 && cnt <= MAX_ELEMS) {
    size_t got = r.getBytes("els", elems, sizeof(Elem) * cnt);
    elemCount = (got == sizeof(Elem) * cnt) ? cnt : 0;
  }
  r.end();
}

// ============================================================
//  分片接收
// ============================================================
void fragReset() { fragLen = 0; fragTotal = 0; fragGot = 0; fragBuf[0] = 0; }

bool fragFeed(const String& v) {
  uint32_t now = millis();
  if (now - fragLast > 10000) fragReset();
  fragLast = now;

  int p1 = v.indexOf('|');
  if (p1 <= 0 || p1 > 3) return false;
  int p2 = v.indexOf('|', p1 + 1);
  if (p2 <= p1) return false;

  int seq = v.substring(0, p1).toInt();
  int total = v.substring(p1 + 1, p2).toInt();
  String body = v.substring(p2 + 1);

  if (seq == 0) { fragReset(); fragTotal = total; }
  if (fragLen + body.length() + 1 < FRAG_SIZE) {
    memcpy(&fragBuf[fragLen], body.c_str(), body.length());
    fragLen += body.length();
    fragBuf[fragLen] = 0;
  }
  fragGot++;
  return (fragTotal > 0 && fragGot >= fragTotal);
}

// ============================================================
class CfgCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* ch) override {
    String v = String(ch->getValue().c_str());
    String u = String(ch->getUUID().toString().c_str());

    if (u == UUID_CMD) {
      if (v == "LAYOUT") {
        String j = layoutToJson();
        uint8_t total = (j.length() + 179) / 180;
        if (total < 1) total = 1;
        String head = "0|" + String(total) + "|" + j.substring(0, 180);
        if (gStatus) gStatus->setValue((uint8_t*)head.c_str(), head.length());
        Serial.printf("[BLE] LAYOUT total=%u len=%u\n", total, j.length());
      } else if (v.startsWith("LAYOUT:")) {
        int idx = v.substring(7).toInt();
        String j = layoutToJson();
        uint8_t total = (j.length() + 179) / 180;
        if (total < 1) total = 1;
        if (idx < 0) idx = 0;
        if (idx >= total) idx = total - 1;
        String piece = String(idx) + "|" + String(total) + "|" +
                       j.substring(idx * 180, (idx + 1) * 180);
        if (gStatus) gStatus->setValue((uint8_t*)piece.c_str(), piece.length());
      } else if (v == "PING") {
        if (gStatus) gStatus->setValue("PONG");
      }
    } else if (u == UUID_SETTINGS) {
      String payload = v;
      if (v.indexOf('|') >= 0 && v.indexOf('|') < 4) {
        if (fragFeed(v)) { payload = String(fragBuf); fragReset(); }
        else return;
      }
      if (payload.indexOf("\"elems\"") >= 0) {
        if (applyLayout(payload)) {
          saveLayout();
          needRedraw = true;
          String ok = "{\"ok\":1,\"count\":" + String(elemCount) + "}";
          if (gStatus) gStatus->setValue((uint8_t*)ok.c_str(), ok.length());
          Serial.printf("[BLE] layout applied: %u elems\n", elemCount);
        } else {
          if (gStatus) gStatus->setValue("SET_FAIL");
        }
      }
    }
  }
};

// ============================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(BL_PIN, OUTPUT);
  digitalWrite(BL_PIN, HIGH);

  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_BLACKTAB);
  tft.setRotation(3);
  tft.fillScreen(P_BG);

  loadLayout();
  if (elemCount == 0) {
    // 默认演示：标题 + 一行提示
    tft.setTextColor(P_INK);
    tft.setTextSize(2);
    tft.setCursor(10, 30);
    tft.print("ST7735");
    tft.setTextSize(1);
    tft.setCursor(10, 55);
    tft.print("Studio Ready");
    tft.setCursor(10, 72);
    tft.print("Connect via BLE");
    tft.setCursor(10, 89);
    tft.print(BLE_NAME);
  } else {
    renderScreen();
  }

  BLEDevice::init(BLE_NAME);
  BLEDevice::setMTU(517);
  BLEServer* srv = BLEDevice::createServer();
  BLEService* svc = srv->createService(UUID_SERVICE);

  BLECharacteristic* chCmd = svc->createCharacteristic(
    UUID_CMD, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  BLECharacteristic* chSt = svc->createCharacteristic(
    UUID_STATUS, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  BLECharacteristic* chSet = svc->createCharacteristic(
    UUID_SETTINGS, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);

  chSt->addDescriptor(new BLE2902());
  chSt->setValue("READY");
  gStatus = chSt;

  CfgCallbacks* cb = new CfgCallbacks();
  chCmd->setCallbacks(cb);
  chSet->setCallbacks(cb);
  svc->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(UUID_SERVICE);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  Serial.printf("\n=== ST7735 Studio Demo ===\nBLE: %s\n", BLE_NAME);
}

void loop() {
  if (needRedraw) {
    needRedraw = false;
    renderScreen();
  }
  delay(20);
}
