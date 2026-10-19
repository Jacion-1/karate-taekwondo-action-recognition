# 前後端串接整備重構紀錄 (CHANGELOG-refactor)

## 基準狀態紀錄 (Baseline — Global Rule 1)
- `npm ci`：成功（212 packages）
- `npm run build`：成功（主 bundle `762.58 kB`，出現 `> 500 kB` 警告）
- `npx vitest run`：2 個測試檔、9 項測試通過
- `npm run lint`：失敗（尚未安裝 `eslint`）

---

## Phase 1：統一前後端契約
- 新增 `zod` 並建立單一真實來源 Schema [`src/contract/analysis.schema.ts`](../src/contract/analysis.schema.ts)，`src/types/martial-arts.types.ts` 中之回應型別全數改由 `z.infer` 產生。
- 統一唯一上傳分析端點為 `POST /api/v1/analyses`，Multipart 欄位固定為 `video`、`clientVideoId`、`duration` 與選填 `requestedActionType`（`auto` 時不傳送）。
- 移除所有偽造預設值（`actionType`、`confidence`、`strengths`、`jointName`、`keyframes` 等不再於缺漏時自動捏造），必填欄位缺漏或格式錯誤一律拋出 `ApiClientError('INVALID_PAYLOAD')` 並附帶 Zod 錯誤路徑。
- 新增 `docs/api/analysis-response.example.json` 與 `docs/api/openapi.yaml`，並於 `HttpRestAnalysisClient` 同時支援 `200 OK` 同步模式與 `202 Accepted` 非同步輪詢模式（`GET /api/v1/analyses/{analysisId}`）。
- 設計決策說明：輪詢 `GET /api/v1/analyses/{analysisId}` 當 `status === 'completed'` 時，同時相容頂層直接回傳完整 `ActionAnalysisResponse` 或包裹於 `{ status: 'completed', result: ActionAnalysisResponse }` 兩種常見後端實作慣例，並在 `openapi.yaml` 以 `oneOf` 明確定義。

---

## Phase 2：拆分「使用者鎖定動作」與「AI 辨識結果」
- `LocalVideoRecord` 移除混淆的 `actionType`，拆分為 `requestedActionType?: ActionType`（使用者鎖定專項，auto 時為 `undefined`）與 `recognizedActionType?: ActionType`（後端／模擬器辨識出的結果）。
- `MartialArtsDatabase` 新增 `version(2)` 並實作升級函式 `upgradeVideosV1ToV2`：舊紀錄若有 `analysisId` 則將 `actionType` 遷移至 `recognizedActionType`，若無則遷移至 `requestedActionType`。
- `videoRepository.saveAnalysisResult` 僅寫入 `recognizedActionType`，絕不覆寫 `requestedActionType`；`HttpRestAnalysisClient` 僅傳送 `requestedActionType`。
- 新增 `fake-indexeddb`（devDependency）與 `src/db/__tests__/video.repo.test.ts` 驗證 v1→v2 資料遷移與重新分析不污染鎖定狀態。

---

## Phase 3：錯誤處理、生命週期與狀態恢復
- `videoRepository.resetInterruptedAnalyses()`：於應用程式啟動時將殘留為 `uploading` 或 `processing` 的影片重置為 `failed`（`errorMessage: "上次分析被中斷，請重新送出"`）。
- `HttpRestAnalysisClient`：`xhr.upload.onprogress` 改為每跨過 10% 整數倍才寫入 IndexedDB；新增 `xhr.upload.onload` 在上傳串流結束、等待推論期間切換為 `processing`；所有背景 DB 寫入包裹 `try/catch`，避免 DB 寫入錯誤導致 XHR Promise 懸掛；請求完成後確實移除 `AbortSignal` 監聽器。
- `AnalysisDashboard`：`getAnalysisById` 補上 `.catch` 並區分 `loading`、`not_found` 與 `error`（提供重試按鈕）三種狀態；`videoEl.play()` 處理 Promise rejection；移除 `togglePlay` 手動 `setIsPlaying`，統一由 `<video>` 原生事件驅動。
- `VideoVault` 與 `App`：`handleQuickCreateAndAnalyze` 補上 `catch` 錯誤提示；`handleBatchUploadAllPending` 加入 `isBatchAnalyzing` 防重入鎖、進度顯示 `n/total` 與失敗彙整 Toast；移除以 `navigator.onLine` 誤擋區網後端與模擬引擎的邏輯，改以 `checkHealth()` 偵測（Mock 模式永遠為可用，HTTP 模式可點擊重新檢測）；頂部狀態膠囊在小螢幕保留顯示「模擬引擎／REST API」文字。

