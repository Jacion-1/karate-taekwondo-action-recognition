# Impeccable 安裝、執行與主控驗收稽核紀錄 (Phase 0 – Phase 2)

本文件記錄 `karate-taekwondo-action-recognition` 專案於「第一版前端美化」任務中，由主控代理（Master Reviewer）親自執行之 Impeccable 官方來源驗證、版本資訊、安裝路徑稽核、8 步驟執行摘要，以及 `detect` 前後對照與 Phase 2 主控驗收結果。

---

## 一、 Phase 0：官方來源與版本稽核

| 稽核項目 | 驗證指令 / 依據 | 實際輸出 / 結果 |
| :--- | :--- | :--- |
| **官方來源 URL** | `git -C /tmp/impeccable-src remote get-url origin` | `https://github.com/pbakaus/impeccable.git` |
| **Commit Hash** | `git -C /tmp/impeccable-src rev-parse HEAD` | `02523aec3e4c4580102d996d1b6a71fbe062e03f` |
| **Commit 時間** | `git -C /tmp/impeccable-src log -1 --format=%ci` | `2026-10-30 02:41:44 +0800` |
| **技能版本** | `.agent/skills/impeccable/SKILL.md` | `4.8.0` (Apache 2.0) |
| **安裝方式** | 唯讀 Clone + 複製預建置檔案（未執行 `npx impeccable install`） | 已完成並清除 `/tmp/impeccable-src` |

### 安裝路徑差異說明（對照官方 `README.md`）
- **查核段落**：官方 `README.md` 第 128–162 行 `## Installation` 下方之 `<details><summary><b>Manual copy, no Node required</b></summary>` 表格（第 140 行）：
  ```markdown
  | Tool | Repo folder | Global skills folder |
  | Google Antigravity | `.agent/` | `~/.gemini/config/skills/` |
  ```
- **路徑變更說明**：先前舊版路徑為 `dist/antigravity/.agent`，但在 `02523aec3e4c4580102d996d1b6a71fbe062e03f` (`v4.8.0`) 中，官方已將各工具建置產物直接置於倉庫根目錄對應資料夾（Google Antigravity 對應為 `.agent/skills/impeccable`）。
- **最終安裝位置（全域）**：`~/.gemini/config/skills/impeccable`（Windows 實體路徑：`C:\Users\iamad\.gemini\config\skills\impeccable`），遵循「代理設定不進 GitHub」原則，未污染專案工作樹。
- **安裝後子代理健檢**：另開 `flash_coder` 子代理任務（Conversation ID: `eab7384f-fd31-4dac-9a91-8874c07beefe`）執行「列出目前可用的技能／指令」，確認成功載入 `impeccable (v4.8.0)` 並識別 `/impeccable init`、`critique`、`audit`、`typeset`、`colorize`、`layout`、`adapt`、`polish` 等完整子指令。

---

## 二、 Impeccable Detector (`detect src/ --json`) 前後對照

原始 JSON 檔案亦同步保存於同目錄下：
- 美化前：[impeccable-detect-before.json](./impeccable-detect-before.json)
- 美化後：[impeccable-detect-after.json](./impeccable-detect-after.json)

| 規則 ID (`antipattern`) | 類別 (`category`) | 嚴重度 (`severity`) | 美化前違規數 (Before) | 美化後違規數 (After) | 變化 |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `overused-font` (`Inter` at `src/index.css:7`) | `slop` | `warning` | 1 | 0 | **-1 (已消除)** |
| 其他 61 項規則 | `slop` / `quality` | `warning` / `error` | 0 | 0 | 0 |
| **總計** | — | — | **1** | **0** | **-1 (零違規)** |

### 1. 美化前基準 JSON（`docs/impeccable-detect-before.json`）
```json
[
  {
    "antipattern": "overused-font",
    "name": "Overused font",
    "description": "Inter, Roboto, Fraunces, Geist, Plus Jakarta Sans, and Space Grotesk are used on so many sites they no longer feel distinctive. Each new wave of AI-generated UIs converges on the same handful of faces. Choose a face that gives your interface personality.",
    "severity": "warning",
    "category": "slop",
    "file": "C:\\專題\\src\\index.css",
    "line": 7,
    "snippet": "font-family: 'Inter"
  }
]
```

### 2. 美化後結果 JSON（`docs/impeccable-detect-after.json`）
```json
[]
```

---

## 三、 Phase 1 & Phase 2 各步驟 Commit 紀錄與退回重做紀錄

| 階段 / 步驟 | 指令 | Commit Hash | 摘要 |
| :--- | :--- | :--- | :--- |
| **Step 1 (`01-init`)** | `/impeccable init` | `786fd9e` | 建立 `PRODUCT.md`（逐字納入產品受眾與 6 項限制） |
| **Step 2 (`02-critique`)** | `/impeccable critique` | `c4dc1e3` | 產出 `docs/impeccable-critique-report.md` UX 啟發式評分報告 |
| **Step 3 (`03-audit`)** | `/impeccable audit` | `57b62a7` | 產出 `docs/impeccable-audit-report.md` 五維度技術品質報告 |
| **Step 4 (`04-typeset`)** | `/impeccable typeset` | `51b7dce` | 替換 `Inter` 為 `Noto Sans TC` / `PingFang TC` / `Microsoft JhengHei` 繁中字體堆疊，移除中文標題 `tracking-tight` |
| **Step 5 (`05-colorize`)** | `/impeccable colorize` | `7734f46` | 導入運動生物力學深色表面層次與流派/判讀語意色彩 Token |
| **Step 6 (`06-layout`)** | `/impeccable layout` | `d897923` | 消除嵌套卡片樣板感，重整錄影工作區與分析指標列版面節奏 |
| **Step 7 (`07-adapt`)** | `/impeccable adapt` | `8ca776c` | 強化行動瀏覽器觸控目標（`40px`–`44px` + `touch-manipulation`）與窄螢幕適配 |
| **Step 8 (`08-polish`)** | `/impeccable polish` | `9c3e949` | 全域 `:focus-visible` 鍵盤無障礙焦點環與按鈕微互動收斂 |
| **Phase 2 主控退回重做** | Rework Round 1 | `25708e1` | 修正主控截圖審查發現之「逆突／正拳」斷字、手機版待機面板與頂部 HUD 重疊、瑕疵處方卡片標題斷字與手機版指標列對稱問題 |
