# 空手道與跆拳道動作識別評估系統 (Karate & Taekwondo Action Recognition & Biomechanics Evaluation System)

> **專題前端儲存庫** — 採用 **React 18 + TypeScript + Vite + Tailwind CSS + Dexie.js (IndexedDB) + Recharts** 建構的現代化運動生物力學視覺分析平台。
> 借鑒 **Sensei AI**（閉環教練流程與動作技術圖譜）、**JAB AI**（回合式評分與教練處方）、**Uplift Labs**（單鏡頭時序角度曲線）與 **Kinovea**（視覺量角器疊加與三階段關鍵幀定位）之設計精髓。

---

## 一、系統核心流程（為什麼這樣設計？）

本系統的核心理念為 **「透過骨骼時序特徵與標準動作資料庫進行自動比對識別，並給出可執行的運動生物力學修正建議」**：

```mermaid
flowchart LR
    A["1. 拍攝與輸入\n(WebRTC 實機拍攝 / 匯入 MP4 / 合成範例)"] --> B["2. 本地離線保險箱\n(IndexedDB 零掉幀暫存)"]
    B --> C["3. AI 資料庫動作比對與時序分析\n(Mock 模擬引擎 / HTTP 實機後端)"]
    C --> D["4. 視覺化分析報告\n(動作識別信心度 + 角度曲線 + Kinovea 量角器 + 修正處方)"]
    D -->|點擊「再次拍攝驗證」| A
```

1. **不需要事先強制死板綁定動作**：使用者在「拍攝與輸入」錄製或匯入影片後，預設採用 **「AI 自動比對識別 (`auto`)」**，由後端／分析引擎比對資料庫判定使用者正在做哪一個空手道或跆拳道動作（亦可點擊右側圖譜鎖定單一專項訓練）。
2. **離線優先（Offline-First）**：所有拍攝或匯入的視訊 Blob 會先寫入瀏覽器本地 IndexedDB（`Dexie.js`），即使展示現場網路不穩也不會遺失任何影片。
3. **前後端解耦（Adapter Pattern）**：前端已內建完整的 **Mock 生物力學模擬引擎** 與 **HTTP 實機串接介面**。在後端尚未完成前，前端即可獨立在筆電大螢幕向教授 Demo 全流程；後端完成後，只需在右上角 **「API 連線與規格」** 抽屜切換為 `HTTP 實機後端` 即可無縫串接。

---

## 二、快速啟動指南

### 1. 環境需求
- **Node.js** `>= 18.x`（建議 `20.x LTS`）
- **npm** `>= 9.x`

### 2. 安裝與執行指令

```bash
# 1. 安裝相依套件
npm install

# 2. 啟動本地開發伺服器 (預設 http://localhost:5173)
npm run dev

# 3. 執行程式碼靜態檢查 (ESLint)
npm run lint

# 4. 執行單元測試 (驗證 API 資料合約、Dexie 遷移、HTTP Client 與生物力學指標計算)
npx vitest run

# 5. 打包正式環境版本 (含 TypeScript 嚴格型別檢查與 Code Splitting)
npm run build
```

---

## 三、前端已完成功能與三大核心畫面

### 1. 拍攝與輸入工作台 (`src/features/recorder/RecordWorkspace.tsx`)
- **Uplift Labs 風格極簡大取景窗**：
  - 支援筆電鏡頭與手機前後鏡頭切換（`FlipHorizontal`）、**3 秒倒數開拍**（方便操作者退回鏡頭中央擺好架勢）、以及 **取景全身對位參考線**。
  - **錄影期間零重繪（Zero Re-render）效能保護**：計時器封裝於獨立葉子組件 [`RecordingTimer.tsx`](src/features/recorder/components/RecordingTimer.tsx)，避免每秒狀態更新導致 `<video>` 預覽閃爍或掉幀。
- **多元影像來源**：
  - **實機鏡頭錄製**（自動偵測 `video/webm;codecs=vp9` 或 `video/mp4`，並內建 WebM EBML Duration 標頭修補器確保录影後可拖曳時間軸）
  - **匯入本地影片**（支援 `.mp4` / `.webm` / `.mov`，單檔上限 `200 MB`、長度上限 `60 秒`，自動擷取影片時長與中間幀縮圖）
  - **一鍵產生範例影片**（利用 Canvas 動態渲染含骨骼關鍵點與角度標記的合成測試影片，無須開鏡頭也能測試全套流程）
- **Sensei AI 閉環捷徑列**：拍攝或匯入完成後，底部立即浮現 **「立即識別並查看報告」** 按鈕，一鍵完成分析並跳轉至報告頁。
- **Sensei AI 識別模式與動作技術圖譜**：
  - 預設為 **「AI 自動比對識別」**。
  - 提供 **`全部 8` | `空手道 5` | `跆拳道 5`** 分類篩選，點擊任一動作卡片可檢視其標準關節角度區間、建議拍攝視角（`cameraViewHint`）與評估重點，或鎖定該動作進行專項練習。

### 2. 動作影片庫 (`src/features/vault/VideoVault.tsx`)
- 自動透過 `useLiveQuery` 即時監聽本地 IndexedDB `videos` 資料表，並顯示瀏覽器儲存配額估算。
- 顯示影片來源（`實機拍攝` / `檔案匯入` / `範例模擬`）、報告來源標籤（`模擬` / `後端`）、檔案大小、拍攝時間、以及五種狀態燈號（`待分析`、`上傳中`、`辨識中`、`已完成`、`失敗`）。
- 支援依 **動作類別（含「待識別動作」與 8 項標準動作）** 及 **分析狀態** 進行篩選，並支援具備防重入鎖與批次進度顯示之 **「批次識別與評估」** 與原片預覽。

### 3. 視覺化分析報告儀表板 (`src/features/analysis/AnalysisDashboard.tsx`)
- **模擬資料醒目標示**：當報告來源 `source === 'mock'` 時，於報告頁頂部固定顯示 **「模擬資料（非真實辨識結果）」** 提示橫幅；影片庫卡片與匯出之 JSON 亦完整標記 `source`。
- **JAB AI 回合式極簡數據指標列（Metric Strip）**：
  - 顯示由時序資料實測計算之：**資料庫比對識別動作（含信心度 `%`）**、**動作總評分與等級（`Grade A–D`）**、**標準角度達成率（`%`）** 與 **最大角度偏差（`°`）**；**核心軸線穩定度** 與 **動作爆發力** 僅在後端實際回傳 `metrics` 時顯示，絕不由前端加減常數推算。
- **Kinovea 慢動作角度疊加檢視器**：
  - 內建 **Kinovea 風格骨架與關節量角器 Canvas 疊加層**（精準對齊 `<video object-contain>` 實際影像區域並扣除黑邊；當後端回傳 `frames` 關鍵點時可於左上角自由切換 `角度標記 開/關`，無 `frames` 時自動隱藏不顯示假圖形）。
  - 左下角即時顯示當前影格的 **實際關節角度 vs. 資料庫標準區間** 與正負偏差度數。
  - **動作三階段關鍵幀快速定位（Keyframes）**：一鍵跳轉至 **`蓄力期 (Preparation)`**、**`擊打頂點 (Impact)`**、**`收勢回防 (Recovery)`**。
  - 支援 `0.25x` / `0.5x` / `1x` 慢動作倍速切換、$\pm 1/\text{fps}$ 真實逐幀步進（優先取 `requestVideoFrameCallback` 回報之影格率或契約 `fps`，兩者皆無時預設 `30fps`，亦支援鍵盤 `Space` 播放/暫停、`←` / `→` 逐幀步進）。
- **Uplift Labs 關節角度時序曲線圖 (`JointAngleChart.tsx`)**：
  - 使用 Recharts `ComposedChart` 繪製 **綠色標準角度區間帶（Standard Band）**、**白色實際關節角度曲線**、**目前播放時間垂直同步線** 與 **紅色瑕疵標記點**（靜態圖表層與獨立播放游標分離渲染，播放時保持 60fps 流暢度）。
  - 點擊圖表上任一時間點或下方瑕疵卡片，左側影片會自動同步跳轉（Seek）至該影格。
- **Sensei AI / JAB AI 教練評估總結、表現亮點與具體修正處方 (`DefectTimelineList.tsx`)**：
  - 除了列出異常時間點與角度數值外，每一項瑕疵皆附帶 **具體可執行的「修正建議（Prescription）」**（告訴使用者身體哪個部位該如何調整）。
  - 右上角提供 **「再次拍攝驗證」** 按鈕，點擊後帶著該動作鎖定狀態返回拍攝頁，形成完整的「拍攝 $\rightarrow$ 診斷 $\rightarrow$ 修正 $\rightarrow$ 再驗證」閉環體驗。

---

## 四、內建 8 大空手道與跆拳道標準動作資料庫 (`ACTION_METADATA`)

定義於 [`src/types/martial-arts.types.ts`](src/types/martial-arts.types.ts)。目前各動作之角度區間皆標註為 **`初始經驗閾值，待驗證`（`provenance.status = 'heuristic-unverified'`）**，待後續填入實際文獻或教練實測驗證來源後再切換為 `cited`：

| 動作代碼 (`ActionType`) | 動作名稱 | 國際術語 (日 / 韓文) | 所屬武術 | 類別 | 主要觀測關節 (`primaryJoints`) | 標準峰值角度區間 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `straight_punch` | **正拳攻擊** | *Gyaku-Zuki* / 逆突き | 空手道 | 直線拳法 | `right_elbow`, `torso`, `hip` | 右肘伸展 `165°–178°` |
| `age_uke` | **上段格擋** | *Jodan Age-Uke* / 上段揚げ受け | 空手道 | 防禦格擋 | `right_elbow`, `left_elbow`, `torso` | 格擋肘角 `92°–112°` |
| `gedan_barai` | **下段格擋** | *Gedan-Barai* / 下段払い | 空手道 | 防禦格擋 | `left_elbow`, `hip`, `torso` | 終點肘角 `150°–168°` |
| `front_kick` | **前踢** | *Mae-Geri* / *Ap-Chagi* (앞차기) | 空手道・跆拳道 | 直線腿法 | `right_knee`, `hip`, `torso` | 彈踢膝伸展 `165°–178°` |
| `roundhouse_kick` | **迴旋踢** | *Dollyo-Chagi* (돌려차기) / *Mawashi-Geri* | 跆拳道 | 迴旋腿法 | `right_knee`, `hip`, `torso` | 鞭甩膝伸展 `160°–176°` |
| `side_kick` | **側踢** | *Yeop-Chagi* (옆차기) / *Yoko-Geri* | 空手道・跆拳道 | 直線腿法 | `left_knee`, `hip`, `torso` | 側踹膝伸展 `162°–177°` |
| `back_kick` | **轉身後踢** | *Dwit-Chagi* (뒷차기) / *Ushiro-Geri* | 跆拳道 | 旋轉腿法 | `right_knee`, `hip`, `torso` | 後踹膝伸展 `160°–175°` |
| `axe_kick` | **下壓踢** | *Naeryeo-Chagi* (내려차기) / *Kakato-Otoshi* | 跆拳道 | 高空劈腿 | `right_knee`, `hip`, `torso` | 劈落膝伸展 `165°–179°` |

---

## 五、專案目錄結構說明

```text
karate-taekwondo-action-recognition/
├── docs/
│   ├── CHANGELOG-refactor.md             # 7-Phase 重構變更摘要與設計決策紀錄
│   └── api/
│       ├── openapi.yaml                  # OpenAPI 3.1.0 前後端契約規格
│       └── analysis-response.example.json # 完整回應 JSON 範例（通過 Zod Schema 驗證）
├── src/
│   ├── app/
│   │   └── App.tsx                       # 頂部導覽列、Hash 路由同步與懶載入工作區管理
│   ├── contract/
│   │   └── analysis.schema.ts            # 【單一真實來源】前後端交換規格之 Zod Schema 與推導型別
│   ├── types/
│   │   └── martial-arts.types.ts         # 動作設定字典 (ACTION_METADATA) 與 IndexedDB 本地紀錄型別
│   ├── db/
│   │   ├── database.ts                   # Dexie.js 本地 IndexedDB 資料庫定義 (含 v1->v2 雙欄位遷移)
│   │   └── repositories/
│   │       └── video.repo.ts             # 封裝影片與分析報告的 CRUD 操作與中斷恢復
│   ├── services/
│   │   ├── apiClient.interface.ts        # IAnalysisApiClient 統一介面、嚴格 Zod 驗證器與生物力學計算函式
│   │   ├── analysisClient.factory.ts     # 雙模式工廠 (動態切換 Mock 模擬引擎 / HTTP 實機後端，持久化於 localStorage)
│   │   ├── mockAnalysis.service.ts       # 內建 8 大動作生物力學時序模擬引擎與 Canvas 合成骨架範例產生器
│   │   ├── httpAnalysis.client.ts        # 實機後端 HTTP Client (支援 200 同步與 202 非同步輪詢)
│   │   └── __tests__/                    # Vitest 單元測試
│   ├── features/
│   │   ├── recorder/                     # 【畫面 1】拍攝與輸入工作台 (CameraPreview, RecordingTimer, useMediaStream, useMediaRecorder)
│   │   ├── vault/                        # 【畫面 2】動作影片庫 (VideoVault)
│   │   └── analysis/                     # 【畫面 3】視覺化分析報告儀表板 (AnalysisDashboard, PoseCanvasOverlay, JointAngleChart, DefectTimelineList)
│   ├── shared/
│   │   ├── components/
│   │   │   ├── ApiConnectionDrawer.tsx   # 右上角「API 連線與規格」抽屜 (一鍵切換 Mock/HTTP 與複製 JSON 規格)
│   │   │   └── ToastContainer.tsx        # 全域無障礙通知組件 (role="status" aria-live="polite")
│   │   ├── hooks/
│   │   │   ├── useHashRoute.ts           # Hash 路由管理 (#/record, #/vault, #/report/:analysisId)
│   │   │   ├── useNetworkStatus.ts       # 即時偵測 Online / Offline 狀態
│   │   │   └── useObjectUrl.ts           # 嚴格管理 Blob URL 生命週期，防止記憶體洩漏 (Memory Leak)
│   │   └── utils/
│   │       ├── videoMedia.utils.ts       # 匯入影片時自動解析時長與擷取縮圖工具
│   │       └── webmDurationFix.ts        # 零依賴 WebM EBML Duration 標頭修補器
│   ├── main.tsx                          # React 掛載入口
│   └── index.css                         # Modern Minimalism 深色中性設計系統樣式
└── package.json
```

---

## 六、給後端／AI 組員的 API 串接規格（Backend API Contract）

完整 OpenAPI 3.1.0 規格檔位於 [`docs/api/openapi.yaml`](docs/api/openapi.yaml)，完整回應範例位於 [`docs/api/analysis-response.example.json`](docs/api/analysis-response.example.json)，前端執行期驗證 Schema 定義於 [`src/contract/analysis.schema.ts`](src/contract/analysis.schema.ts)。

當後端（例如 Python FastAPI / Flask + MediaPipe / YOLOv8-Pose + DTW / ST-GCN）開發完成後，請實作以下端點，即可在前端右上角點擊 **「API 連線與規格」** 切換為 **「遠端 REST API」** 直接連通：

### 1. 健康檢查端點：`GET /api/v1/health`
- **回應 (`200 OK`)**：
```json
{
  "status": "ok",
  "message": "Pose estimation & action recognition backend ready"
}
```

### 2. 影片上傳與動作識別評估端點：`POST /api/v1/analyses`
- **Request 格式**：`multipart/form-data`
  - `video` (`Binary File`, **必填**)：使用者拍攝或匯入的 `.webm` / `.mp4` / `.mov` 影片檔
  - `clientVideoId` (`string`, **必填**)：前端產生的影片唯一識別碼
  - `duration` (`string`, **必填**)：影片秒數（例如 `"3.2"`）
  - `requestedActionType` (`ActionType`, **選填**)：僅在使用者手動鎖定特定專項動作時傳送（如 `"roundhouse_kick"`）；若為預設的 **AI 自動比對識別 (`auto`)** 則**不傳送**此欄位。

- **回應模式 A — 同步模式 (`200 OK`, `application/json`)**：
  直接回傳符合 `ActionAnalysisResponse` 結構之完整分析結果（見下方範例）。

- **回應模式 B — 非同步 Job 模式 (`202 Accepted`, `application/json`)**：
  若後端推論耗時較長，可先回傳 `202 Accepted`：
  ```json
  {
    "analysisId": "ana-20261019-001",
    "status": "processing"
  }
  ```
  前端收到 `202` 後，會自動以 **1.5 秒** 間隔輪詢 `GET /api/v1/analyses/{analysisId}`（受設定之 `timeoutMs` 與 `AbortSignal` 取消控制）：
  - 若 `status` 為 `"processing"`：繼續等待下一次輪詢。
  - 若 `status` 為 `"failed"`：回傳 `{ "analysisId": "...", "status": "failed", "errorMessage": "錯誤原因" }`，前端即標記為失敗並顯示錯誤原因。
  - 若 `status` 為 `"completed"`：可回傳 `{ "analysisId": "...", "status": "completed", "result": { ...完整報告... } }` 或直接於頂層回傳完整 `ActionAnalysisResponse` 物件。

- **完整分析報告結構 (`ActionAnalysisResponse`)**：
  前端 [`validateAnalysisResponse()`](src/services/apiClient.interface.ts) 採用嚴格驗證：**必填欄位（`analysisId`、`source`、`actionType`、`totalScore`、`defects`、`angleTimeSeries`）若缺漏或型別不符，將直接拋出 `INVALID_PAYLOAD` 錯誤，絕不以假資料填充**；選填欄位若未提供則保持 `undefined`，由前端自動隱藏對應區塊。

```json
{
  "analysisId": "ana-20261019-001",
  "videoId": "vid-1729327200",
  "source": "backend",
  "modelVersion": "mediapipe-stgcn-v1.0",
  "fps": 30,
  "actionType": "roundhouse_kick",
  "confidence": 95.8,
  "totalScore": 88,
  "grade": "A",
  "duration": 3.2,
  "feedbackSummary": "系統經資料庫特徵比對識別為「跆拳道・迴旋踢 (Dollyo-Chagi)」（信心度 95.8%）。提膝高度充足，但在彈踢瞬間右膝伸展角度差約 6 度。",
  "strengths": [
    "起腿提膝（Chamber）高度與摺疊角度精準達標，具備良好隱蔽性",
    "上半身防禦架勢於起腿階段保持穩定，未出現大幅後仰失衡"
  ],
  "keyframes": {
    "preparation": 0.8,
    "impact": 1.6,
    "recovery": 2.3
  },
  "metrics": {
    "stability": 89,
    "explosiveness": 86
  },
  "frames": [
    {
      "t": 1.6,
      "keypoints": [
        { "name": "hip", "x": 0.4531, "y": 0.5694, "visibility": 0.99 },
        { "name": "right_knee", "x": 0.5688, "y": 0.4083, "visibility": 0.96 },
        { "name": "right_ankle", "x": 0.6906, "y": 0.3306, "visibility": 0.95 }
      ]
    }
  ],
  "defects": [
    {
      "id": "def-1",
      "timestamp": 1.6,
      "jointName": "right_knee",
      "currentValue": 154,
      "standardRange": [160, 176],
      "message": "踢擊瞬間小腿鞭甩延伸不足，膝關節角度低於標準下限。",
      "prescription": "修正建議：在支撐腳腳掌旋轉至 150° 後再啟動小腿鞭甩，利用股四頭肌爆發收縮將膝角延伸至 165° 以上。",
      "severity": "moderate"
    }
  ],
  "angleTimeSeries": {
    "jointName": "right_knee",
    "points": [
      { "time": 0.0, "actualAngle": 72, "standardMin": 60, "standardMax": 78 },
      { "time": 0.8, "actualAngle": 118, "standardMin": 110, "standardMax": 128 },
      { "time": 1.6, "actualAngle": 154, "standardMin": 160, "standardMax": 176 },
      { "time": 2.3, "actualAngle": 104, "standardMin": 95, "standardMax": 115 }
    ]
  },
  "allJointSeries": [
    {
      "jointName": "right_knee",
      "points": [
        { "time": 0.0, "actualAngle": 72, "standardMin": 60, "standardMax": 78 },
        { "time": 0.8, "actualAngle": 118, "standardMin": 110, "standardMax": 128 },
        { "time": 1.6, "actualAngle": 154, "standardMin": 160, "standardMax": 176 },
        { "time": 2.3, "actualAngle": 104, "standardMin": 95, "standardMax": 115 }
      ]
    }
  ]
}
```

#### 支援的欄位列舉值：
- **`source`**：`'backend'` | `'mock'`
- **`actionType`**：`'straight_punch'` | `'age_uke'` | `'gedan_barai'` | `'front_kick'` | `'roundhouse_kick'` | `'side_kick'` | `'back_kick'` | `'axe_kick'`
- **`jointName`**：`'left_elbow'` | `'right_elbow'` | `'left_knee'` | `'right_knee'` | `'hip'` | `'torso'`
- **`severity`**：`'minor'` | `'moderate'` | `'critical'`
- **`grade`**：`'A'` | `'B'` | `'C'` | `'D'`
- **`frames[].keypoints[]`**：座標 `x`、`y` 為相對影片畫面寬高之 `0–1` 正規化數值。

---

## 七、部署注意事項（Deployment & Security Checklist）

1. **HTTPS 安全上下文限制（攝影機存取必要條件）**：
   - 瀏覽器 `navigator.mediaDevices.getUserMedia` 規範強制要求網頁必須執行於 **Secure Context**（即 `https://` 或本機 `http://localhost` / `http://127.0.0.1`）。
   - 若透過區網 IP（如 `http://192.168.x.x:5173`）在手機或平板上開啟，瀏覽器會移除 `navigator.mediaDevices`。部署至測試或正式環境時，請務必設定 TLS 憑證（例如 Cloudflare Tunnel、ngrok、Caddy 或 Nginx + Let's Encrypt）。
2. **CORS 跨來源資源共用白名單設定**：
   - 若前端與後端部署於不同網域或埠號，後端（如 FastAPI `CORSMiddleware`）需明確設定 `allow_origins` 白名單（切勿於正式環境使用 `*` 搭配憑證），並允許 `GET`、`POST`、`OPTIONS` 方法及 `Authorization`、`Content-Type` 標頭。
3. **上傳檔案大小與 `Content-Type` 驗證**：
   - 前端已限制匯入影片上限為 `200 MB`、時長 `60 秒`，但後端與反向代理（如 Nginx `client_max_body_size`）仍須強制檢查請求大小與 MIME 類型（僅接受 `video/webm`、`video/mp4`、`video/quicktime`），並使用暫存目錄與隨機檔名儲存上傳檔案，防止路徑穿越（Path Traversal）或磁碟耗盡攻擊。
4. **API 速率限制（Rate Limiting）與金鑰安全**：
   - 骨骼擷取與動作推論屬於高 GPU/CPU 負載任務，後端應針對 `/api/v1/analyses` 實施 IP 或 Token 級別的速率限制（Rate Limiting）與任務佇列（Task Queue）上限。
   - 前端「API 連線與規格」抽屜中之 `API Key` 僅供開發與本地測試階段以 `Authorization: Bearer <token>` 傳遞，並以明文暫存於瀏覽器 `localStorage`；正式環境切勿於前端寫死高權限密鑰，應改由後端 Session / HttpOnly Cookie 或短期簽章 Token 進行授權驗證。


