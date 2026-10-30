# Impeccable 安裝與稽核紀錄 (Phase 0 & Phase 2)

本文件記錄 `karate-taekwondo-action-recognition` 專案於第一版前端美化任務中，由主控代理（Master Reviewer）親自執行之 Impeccable 官方來源驗證、版本資訊、安裝路徑稽核與 `detect` 前後對照結果。

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
- **路徑變更說明**：舊版曾使用 `dist/antigravity/.agent`，但在 `02523aec3e4c4580102d996d1b6a71fbe062e03f` (`v4.8.0`) 中，官方已將各工具建置產物直接置於倉庫根目錄對應資料夾（Antigravity 為 `.agent/skills/impeccable`）。
- **最終安裝位置（全域）**：`~/.gemini/config/skills/impeccable`（Windows 實體路徑：`C:\Users\iamad\.gemini\config\skills\impeccable`），遵循「代理設定不進 GitHub」原則，未污染專案工作樹。
- **安裝後子代理健檢**：另開 `flash_coder` 子代理任務（Conversation ID: `eab7384f-fd31-4dac-9a91-8874c07beefe`）執行「列出目前可用的技能／指令」，確認成功載入 `impeccable (v4.8.0)` 並識別 `init`、`critique`、`audit`、`typeset`、`colorize`、`layout`、`adapt`、`polish` 等完整子指令。

---

## 二、 Impeccable Detector (`detect src/ --json`) 前後對照

### 1. 美化前基準（Before Phase 1）
執行指令：
```bash
~/.gemini/config/skills/impeccable/scripts/impeccable detect src/ --json
```
輸出結果（共 **1** 項違規）：
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

### 2. 美化後結果（After Phase 1）
*(將於 Phase 2 驗收時更新)*
