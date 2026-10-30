# 專題設計系統 Token 規範 (Design Tokens)

本文件由 `docs/design-brief.md` 萃取轉化而成，定義「空手道與跆拳道動作識別系統」之全站色彩（含深色模式預設與淺色模式對照）、繁體中文字級階層、間距、圓角與陰影變數。所有元件應統一透過 CSS Custom Properties 與 `tailwind.config.js` 之語意化類別引用，禁止在元件內硬寫零散色碼或過小字級（如 `text-[10px]`）。

---

## 一、 色彩系統 (Color Tokens：深色模式與淺色模式完整定義)

本系統預設採用 **Comfort Slate-Navy（深海石板藍深色模式）** 以配合道場拍攝與影片慢動作檢視，並同步定義完整的 **淺色模式（Light Mode，`[data-theme="light"]`）** 色票供日後主題切換擴充。

### 1. 基礎背景、表面與邊框色票對照表

| 語意角色 | CSS 變數名稱 | Tailwind 類別對應 | 深色模式 (Dark Default) | 淺色模式 (Light `[data-theme="light"]`) | 用途說明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **底層畫布** | `--bg-canvas` | `bg-app-canvas` | `#0D131D` | `#F4F7FB` | 全頁最底層背景（取代原本死黑 `#09090b`） |
| **頂部導覽列** | `--bg-header` | `bg-app-header` | `rgba(13, 19, 29, 0.88)` | `rgba(255, 255, 255, 0.90)` | 具毛玻璃效果之置頂導覽列 |
| **主要卡片表面** | `--bg-surface` | `bg-app-surface` | `#151E2D` | `#FFFFFF` | 面板、圖表容器、列表卡片主體 |
| **浮起／次要表面** | `--bg-elevated` | `bg-app-elevated` | `#1D293D` | `#EEF2F8` | 卡片 Hover、選中項目、次級控制區 |
| **內凹數據井** | `--bg-well` | `bg-app-well` | `#090E16` | `#E2E8F0` | 攝影機取景窗底色、代碼／公式區塊 |
| **細緻分隔線** | `--border-subtle` | `border-app-subtle` | `#1E2B3E` | `#E2E8F0` | 表格列分隔、卡片內部分隔線 |
| **標準卡片邊框** | `--border-default` | `border-app-border` | `#26354D` | `#CBD5E1` | 一般卡片與輸入框外框 |
| **高亮／選中邊框** | `--border-strong` | `border-app-strong` | `#3B82F6` | `#2563EB` | 當前選中卡片、Focus 外框 |

### 2. 文字階層色票對照表（確保高對比可讀性）

| 語意角色 | CSS 變數名稱 | Tailwind 類別對應 | 深色模式 (Dark Default) | 淺色模式 (Light) | 對比度與用途說明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **主要文字** | `--text-primary` | `text-app-primary` | `#F8FAFC` | `#0F172A` | 標題、核心數據、動作名稱（對比度 > 14:1） |
| **次要內文** | `--text-secondary` | `text-app-secondary` | `#CBD5E1` | `#334155` | 動作說明、教練講評、處方內文（對比度 > 9:1） |
| **輔助說明文字** | `--text-muted` | `text-app-muted` | `#94A3B8` | `#64748B` | 欄位標籤、時間碼、羅馬拼音（對比度 > 5.2:1，淘汰原本過暗的 `#71717a`） |

### 3. 品牌主色、強調色與語意狀態色票

| 語意角色 | CSS 變數名稱 | Tailwind 類別對應 | 深色模式 (Dark Default) | 淺色模式 (Light) | 用途說明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **主操作色 (Hudl Blue)** | `--brand-primary` | `bg-brand-primary` / `text-brand-primary` | `#2563EB` | `#1D4ED8` | 主要 CTA 按鈕（開啟攝影機、開始錄影、立即識別） |
| **主操作 Hover** | `--brand-primary-hover` | `hover:bg-brand-hover` | `#3B82F6` | `#2563EB` | 主要按鈕懸停狀態 |
| **活力強調色 (Strava Orange)** | `--brand-accent` | `text-brand-accent` / `bg-brand-accent` | `#F97316` | `#EA580C` | 圖表時間游標、重點標籤、活躍狀態指示 |
| **空手道流派色** | `--discipline-karate` | `text-discipline-karate` | `#FB7185` | `#E11D48` | 空手道專屬徽章與左側色條 |
| **跆拳道流派色** | `--discipline-tkd` | `text-discipline-tkd` | `#22D3EE` | `#0891B2` | 跆拳道專屬徽章與左側色條 |
| **達標／正常 (Success)** | `--status-success` | `text-status-success` | `#34D399` (`#10B981` 實心) | `#059669` | 角度達標、連線正常、高信心度 |
| **警告／模擬／待驗證 (Warning)** | `--status-warning` | `text-status-warning` | `#FBBF24` (`#F59E0B` 實心) | `#D97706` | **「模擬資料」橫幅、「初始經驗閾值，待驗證」標籤** |
| **偏差／錯誤 (Danger)** | `--status-danger` | `text-status-danger` | `#FB7185` (`#F43F5E` 實心) | `#E11D48` | 顯著角度偏差、錄影中狀態、錯誤提示 |

---

## 二、 字體與繁體中文字級階層 (Typography Scale)

### 1. 字體堆疊 (Font Family)
- **無襯線主字體 (`--font-sans` / `font-sans`)**：
  `'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', 'Heiti TC', -apple-system, BlinkMacSystemFont, sans-serif`
- **數據等寬字體 (`--font-mono` / `font-mono`)**：
  `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`（強制搭配 `font-variant-numeric: tabular-nums`）

### 2. 繁體中文字級階層表（淘汰 `< 12px` 微小字，提升中文閱讀舒適度）

| 階層代號 | Tailwind 擴充類別 | 字級大小 (`font-size`) | 行高 (`line-height`) | 字重 (`font-weight`) | 適用元件 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Metric** | `text-metric-lg` | `1.875rem` (`30px`) | `1.2` | `700` (Bold) | 分析報告總分 (`83`)、達成率 (`85%`)、最大偏差 (`6°`) |
| **Page Heading** | `text-heading-lg` | `1.25rem` (`20px`) | `1.35` | `700` (Bold) | 頁面主標題、識別動作主名稱（「迴旋踢／橫踢」） |
| **Section Heading** | `text-heading-md` | `1.0625rem` (`17px`) | `1.45` | `600` (Semibold) | 區塊主標題（「識別模式與動作技術圖譜」、「關鍵特徵時序曲線」） |
| **Card Title** | `text-title-sm` | `0.9375rem` (`15px`) | `1.5` | `600` (Semibold) | 動作卡片標題（「正拳突」）、瑕疵處方關節標題 |
| **Body Base** | `text-body` | `0.875rem` (`14px`) | `1.65` | `400` / `500` | 動作技術說明、教練評估總結、修正處方建議內文 |
| **Caption / Meta** | `text-caption` | `0.75rem` (`12px`) | `1.5` | `500` (Medium) | 徽章標籤、時間碼、「初始經驗閾值，待驗證」標示（**全站最小字級下限**） |

---

## 三、 間距、圓角與陰影規範 (Spacing, Radius & Elevation)

### 1. 間距基礎單位（8px 網格節奏）
- **頁面主容器 (`main`)**：桌面版 `max-w-6xl mx-auto px-6 py-8`，手機版 `px-4 py-5`。
- **大區塊間距 (`section gap`)**：桌面版 `gap-7` (`28px`) / `space-y-6` (`24px`)，手機版 `gap-5` (`20px`)。
- **卡片內距 (`card padding`)**：主要面板 `p-5 sm:p-6` (`20px` / `24px`)，列表子項目 `p-4` (`16px`)。
- **表單與按鈕觸控高度**：主要與次要按鈕統一 `min-h-[40px]`（行動端友善點擊高度）、內距 `px-4 py-2`。

### 2. 圓角規範（兼具運動儀器俐落感與現代感，不再全部使用 `rounded-full`）
- **主面板與大卡片 (`rounded-card`)**：`0.875rem` (`14px`)
- **次要卡片與互動區塊 (`rounded-panel`)**：`0.625rem` (`10px`)
- **按鈕與分頁切換器 (`rounded-control`)**：`0.5rem` (`8px`) —— 取代舊版氾濫的 `rounded-full` 藥丸按鈕
- **狀態徽章 (`rounded-badge`)**：`0.375rem` (`6px`)

### 3. 陰影與表面光澤 (`box-shadow`)
- **`shadow-card`**：`0 4px 20px -2px rgba(5, 10, 20, 0.45), 0 1px 0 0 rgba(255, 255, 255, 0.05) inset`
- **`shadow-elevated`**：`0 8px 28px -4px rgba(5, 10, 20, 0.6), 0 1px 0 0 rgba(255, 255, 255, 0.08) inset`
- **`shadow-brand`（主按鈕微光）**：`0 2px 10px rgba(37, 99, 235, 0.35)`

---

## 四、 圖表配色邏輯 (Chart Palette：Strava / Hudl 單一主色漸層法)

- **網格線 (`CartesianGrid`)**：`#1E2B3E`（虛線 `3 3`，清晰但不過度搶眼）
- **座標軸文字 (`XAxis` / `YAxis`)**：`#94A3B8`，字級 `12px`
- **實測關節角度曲線 (`actualAngle`)**：亮電光藍 `#38BDF8`（線寬 `2.5px`），搭配下方微漸層或清晰節點（取代原本單調的純白細線）
- **標準角度範圍帶 (`standardBand`)**：翠綠 `#10B981`（填色透明度 `0.16`，邊界虛線 `#34D399` 透明度 `0.5`）
- **時間軸播放游標 (`PlayheadCursor`)**：競技暖橘 `#F97316` 虛線 + `#F97316` 膠囊時間碼
- **瑕疵偏差標記點 (`ReferenceDot`)**：緋紅 `#F43F5E` 圓點搭配深色外框 `#0D131D`
- **長期歷史走勢圖 (`MemberHistorySection`)**：主曲線使用 `#3B82F6`，面積漸層由 `rgba(59, 130, 246, 0.32)` 至 `rgba(59, 130, 246, 0.02)`
