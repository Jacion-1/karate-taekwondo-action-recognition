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

---

## Phase 4：錄影與媒體
- `useMediaStream.ts`：先檢查 `navigator.mediaDevices?.getUserMedia` 是否存在，非安全環境直接顯示「需要 HTTPS 或 localhost 才能使用攝影機」；依 `NotAllowedError`、`NotFoundError`、`NotReadableError`、`OverconstrainedError` 對應明確繁體中文說明；加入遞增 `requestIdRef` 與 `mountedRef` 防止非同步競態導致背景攝影機軌道洩漏。
- WebM duration 與 seek 實測與修補（`src/shared/utils/webmDurationFix.ts`、`useMediaRecorder.ts`、`videoMedia.utils.ts`）：
  - **瀏覽器實測結果**：在 Chromium / Headless Chrome 下，`MediaRecorder` 串流產生的 `video/webm` 因 `Segment` 長度為未知（`0x01FFFFFFFFFFFFFF`）且 `Info`（`0x1549A966`）未寫入 `Duration`（`0x4489`），直接載入 `<video>` 時 `video.duration` 為 `Infinity`，導致時間軸無法正常 seek。
  - **修補方案**：實作零外部依賴的最小 EBML Duration 修補器 `fixWebmDuration(blob, durationSeconds)`，解析開頭 8 KB 標頭並在 `Info` 區段寫入 8-byte Float64 `Duration`（依 `TimecodeScale` 換算毫秒），再透過 `Blob.slice` 零拷貝拼接後續 `Cluster` 資料；同時於 `extractVideoMetadataAndThumbnail` 對外部匯入之未修補 WebM 加入 `currentTime = 1e101` 探測退路。經瀏覽器實測修補後的 WebM 載入即具備有限 `duration` 且可任意 seek。
- `useMediaRecorder.ts`：依實際 `mimeType` 動態決定副檔名（`.mp4` 或 `.webm`）；組件卸載時若仍在錄影自動停止並防止對已卸載組件 `setState`。
- `RecordWorkspace.tsx`：新增匯入限制常數 `MAX_IMPORT_SIZE_MB = 200`（200 MB）與 `MAX_IMPORT_DURATION_SEC = 60`（60 秒），超限時顯示明確錯誤 Toast；卸載時清理 3 秒倒數計時器。
- 儲存空間管理：於 `App.tsx` 啟動時呼叫 `navigator.storage.persist()`（忽略失敗），並於 `VideoVault.tsx` 標題旁顯示 `navigator.storage.estimate()` 本機儲存空間用量與配額百分比。

---

## Phase 5：播放同步與疊加層
- 播放時間同步：於 `AnalysisDashboard.tsx` 以 `requestVideoFrameCallback` 同步 `currentTime`（不支援時自動退回 `requestAnimationFrame`），取代原本 4Hz 的 `onTimeUpdate`。
- 圖表零重繪最佳化：將 `JointAngleChart.tsx` 拆分為 `StaticRechartsLayer`（`React.memo`，僅依賴 `chartData`、`jointDefects`、`onSeekToTime`，完全不依賴 `currentTime`）與輕量 `PlayheadCursor` 獨立游標元件，播放期間 Recharts 曲線與面積圖零重繪。
- 真實影格率逐幀步進：優先取 `requestVideoFrameCallback` 實測之影格率或契約 `analysis.fps`，皆無時預設 `30fps`，步進量固定為 `1/fps` 秒，並同步更新 `README.md` 說明。
- 移除寫死的假 SVG 路徑（`M 164 92 L 188 76 L 222 62`），改為 [`PoseCanvasOverlay.tsx`](../src/features/analysis/components/PoseCanvasOverlay.tsx)：
  - 透過 `computeContainedVideoRect` 與 `ResizeObserver` 對齊 `<video class="object-contain">` 實際顯示區域（扣除黑邊），包含 `9:16` 手機直式影片亦可精準對齊。
  - 有 `frames` 時繪製骨架、所選關節夾角扇形量角器與角度標籤，不合規時以紅色虛線圓環與紅線高亮。
  - **當沒有 `frames` 時完全不渲染疊加層，並隱藏左上角「角度標記」開關按鈕**。
- HUD 時序點匹配：`currentPointHud` 直接以 `currentTime` 比對最近時序點，移除原本先 `toFixed(1)` 四捨五入的失真作法。

---

## Phase 6：誠實呈現（Mock 標示、指標與出處）
- 模擬資料明確標示：當 `analysis.source === 'mock'` 時，`AnalysisDashboard.tsx` 頂部固定顯示醒目橫幅「模擬資料（非真實辨識結果）」；`VideoVault.tsx` 卡片與匯出之 JSON 亦完整標記 `source`（`mock` / `backend`）。
- 移除推算指標：`computeBiomechanicsMetrics` 保留由時序點實測計算的 `complianceRate` 與 `peakDeviationDeg`，移除原本以 `totalScore` 加減固定值推算的 `stabilityScore` 與 `explosivenessScore`；穩定度與爆發力僅在後端實際回傳 `analysis.metrics` 時透傳並顯示，否則自動隱藏。
- 閾值出處透明化：`ACTION_METADATA` 每一項動作新增 `provenance: { status: 'heuristic-unverified' | 'cited'; citation?: string }`，現階段全部設為 `'heuristic-unverified'` 並加註 `// TODO(使用者): 填入實際文獻或教練驗證來源`；動作圖譜卡片與報告頁皆標示「初始經驗閾值，待驗證」，並同步修正 `README.md` 描述。
- 拍攝視角通則提示：`RecordWorkspace.tsx` 依當前選擇之動作（或自動模式）顯示建議拍攝視角提示（如踢擊類建議側面拍攝、全身入鏡），並明確註明「單鏡頭 2D 角度會隨拍攝方向變形」。




