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
