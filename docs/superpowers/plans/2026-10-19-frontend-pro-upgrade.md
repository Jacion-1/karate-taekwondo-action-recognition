# Martial Arts Action Evaluator — Pro-Lab Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Martial Arts Action Evaluator frontend to a professional "Tactical Biomechanics Lab" design system, add 3-second countdown recording, local video file import with thumbnail extraction, rich biomechanical analytics, and a dual-mode (`Mock` / `HTTP REST`) backend API integration layer with an interactive API Contract Drawer.

**Architecture:** Feature-sliced React 18 + TypeScript architecture backed by Dexie.js IndexedDB for binary `Blob` storage, an Adapter/Factory pattern (`IAnalysisApiClient`) for zero-friction switching between the simulated biomechanics engine and a real `multipart/form-data` REST backend, and strict state colocation (`React.memo` + leaf timer components) to guarantee 60fps video performance.

**Tech Stack:** Vite 6, React 18, TypeScript 5.6, Tailwind CSS 3.4, Dexie.js 4, Recharts 2.15, Lucide React, Vitest (for unit testing API contracts, validators, and analytics calculations).

**Spec:** `docs/superpowers/specs/2026-10-19-frontend-pro-upgrade-design.md`

## Global Constraints

- Preserve all 3 React performance rules from the project specification:
  1. `RecordingTimer` state must remain isolated in its leaf component; `CameraPreview` must remain wrapped in `React.memo`.
  2. All `MediaStreamTrack` instances must call `.stop()` on unmount/switch, and all `URL.createObjectURL` calls must be paired with `URL.revokeObjectURL`.
  3. Video `Blob` instances must be written directly to IndexedDB (`db.videos`) and never stored in global reactive React state.
- Maintain strict TypeScript (`tsc -b`) with zero unused variables or implicit `any`.

## Review Focus

1. Malformed or partial backend JSON response in `validateAnalysisResponse` — must throw a descriptive `ApiClientError` instead of crashing Recharts during render.
2. Time-series compliance rate calculation when `points` is empty — `computeBiomechanicsMetrics` must return `0` safely without `NaN` division-by-zero.
3. Importing an unsupported or zero-byte video file — `videoMedia.utils.ts` must resolve with fallback duration/thumbnail instead of hanging forever if metadata fails to load.
4. Switching API configuration (`mock` <-> `http`) — must persist to `localStorage` and normalize trailing slashes on `baseUrl`.
5. Keyboard shortcuts (`Space`, `ArrowLeft`, `ArrowRight`) on `AnalysisDashboard` — must ignore key events when focus is inside an `<input>` or `<select>` element.

---

### Task 1: Vitest Setup, Extended Data Contracts, Biomechanics Metrics & Response Validator

**Files:**
- Modify: `package.json`
- Modify: `src/types/martial-arts.types.ts`
- Create: `src/services/apiClient.interface.ts`
- Create: `src/services/__tests__/apiClient.interface.test.ts`

**Interfaces:**
- Produces:
  - `ApiMode = 'mock' | 'http'`
  - `ApiConnectionConfig { mode: ApiMode; baseUrl: string; timeoutMs: number; apiKey?: string }`
  - `BiomechanicsSubMetrics { complianceRate: number; stabilityScore: number; explosivenessScore: number; peakDeviationDeg: number }`
  - `computeBiomechanicsMetrics(response: ActionAnalysisResponse): BiomechanicsSubMetrics`
  - `validateAnalysisResponse(raw: unknown, fallbackVideoId?: string): ActionAnalysisResponse`
  - `ApiClientError` class with `code: 'NETWORK_ERROR' | 'TIMEOUT' | 'HTTP_ERROR' | 'INVALID_PAYLOAD' | 'ABORTED'`

- [ ] **Step 1: Add Vitest to `package.json` and write the failing test `src/services/__tests__/apiClient.interface.test.ts`**
- [ ] **Step 2: Run `npx vitest run` to verify it fails**
- [ ] **Step 3: Implement extended types in `src/types/martial-arts.types.ts` and validator/metrics in `src/services/apiClient.interface.ts`**
- [ ] **Step 4: Run `npx vitest run` to verify all tests pass**

---

### Task 2: Dual-Mode Backend Connectivity (`HttpRestAnalysisClient`, `AnalysisClientFactory`, Thumbnail Utils)

**Files:**
- Create: `src/shared/utils/videoMedia.utils.ts`
- Create: `src/services/httpAnalysis.client.ts`
- Modify: `src/services/mockAnalysis.service.ts`
- Create: `src/services/analysisClient.factory.ts`
- Create: `src/services/__tests__/analysisClient.factory.test.ts`

**Interfaces:**
- Consumes: `IAnalysisApiClient`, `ApiConnectionConfig`, `validateAnalysisResponse`, `ApiClientError` from Task 1.
- Produces:
  - `extractVideoMetadataAndThumbnail(blob: Blob, fallbackDuration?: number): Promise<{ duration: number; thumbnailDataUrl?: string }>`
  - `analysisClientFactory.getConfig(): ApiConnectionConfig`
  - `analysisClientFactory.saveConfig(partial: Partial<ApiConnectionConfig>): ApiConnectionConfig`
  - `analysisClientFactory.getClient(): IAnalysisApiClient`
  - `analysisClientFactory.checkBackendHealth(): Promise<{ ok: boolean; latencyMs: number; message: string; mode: ApiMode }>`

- [ ] **Step 1: Write the failing test `src/services/__tests__/analysisClient.factory.test.ts` testing URL normalization, config persistence, and mock/http client switching**
- [ ] **Step 2: Run `npx vitest run` to verify it fails**
- [ ] **Step 3: Implement `videoMedia.utils.ts`, `httpAnalysis.client.ts`, update `mockAnalysis.service.ts`, and implement `analysisClient.factory.ts`**
- [ ] **Step 4: Run `npx vitest run` to verify all tests pass**

---

### Task 3: Pro-Lab Design System, Toast System & Interactive Backend API Contract Drawer

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Create: `src/shared/components/ToastContainer.tsx`
- Create: `src/shared/components/ApiConnectionDrawer.tsx`

**Interfaces:**
- Consumes: `analysisClientFactory` from Task 2.
- Produces:
  - `useToast()` hook and `<ToastProvider>`
  - `<ApiConnectionDrawer isOpen={boolean} onClose={() => void} />`

- [ ] **Step 1: Upgrade `index.html` with `Inter` & `JetBrains Mono` Google Fonts and update `src/index.css` with Tactical Biomechanics Lab utility classes, custom glassmorphism, and subtle grid background**
- [ ] **Step 2: Implement `ToastContainer.tsx` and `ApiConnectionDrawer.tsx` (featuring live Mock/HTTP toggle, Base URL config, Health Check ping button, and copyable cURL/JSON schema specs for professors)**
- [ ] **Step 3: Run `npm run build` to verify zero TypeScript or CSS errors**

---

### Task 4: Upgraded RecordWorkspace (3s Countdown, Local Video File Dropzone, Telemetry HUD) & VideoVault (Thumbnails, Filters, Search)

**Files:**
- Modify: `src/features/recorder/components/CameraPreview.tsx`
- Modify: `src/features/recorder/hooks/useMediaStream.ts`
- Modify: `src/features/recorder/hooks/useMediaRecorder.ts`
- Modify: `src/features/recorder/RecordWorkspace.tsx`
- Modify: `src/features/vault/VideoVault.tsx`

**Interfaces:**
- Consumes: `extractVideoMetadataAndThumbnail`, `analysisClientFactory`, `useToast`.
- Produces:
  - 3-second countdown mode (`0s` immediate or `3s` delayed start) in `RecordWorkspace`
  - Local `.mp4`/`.webm`/`.mov` drag-and-drop / file picker import directly into IndexedDB with thumbnail & duration extraction
  - Upgraded `VideoVault` with thumbnail previews, action/status filter pills, and unified `analysisClientFactory.getClient().uploadAndAnalyze(...)` execution

- [ ] **Step 1: Update `useMediaStream.ts`, `useMediaRecorder.ts`, and `CameraPreview.tsx` to display resolution telemetry, countdown overlay (`3..2..1`), and automatic thumbnail capture**
- [ ] **Step 2: Upgrade `RecordWorkspace.tsx` with 3-Way Input Tabs/Actions (Camera Record, Import Video File, AI Synthetic Skeleton Generator) and Toast feedback**
- [ ] **Step 3: Upgrade `VideoVault.tsx` with Thumbnail display, ActionType & Status filters, retry support, and `analysisClientFactory` integration**
- [ ] **Step 4: Run `npm run build` to verify compilation**

---

### Task 5: Upgraded AnalysisDashboard (Biomechanics Sub-Metrics, Live Angle HUD, Keyboard Shortcuts, JSON Export) & App Integration

**Files:**
- Modify: `src/features/analysis/AnalysisDashboard.tsx`
- Modify: `src/features/analysis/components/charts/JointAngleChart.tsx`
- Modify: `src/features/analysis/components/defects/DefectTimelineList.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `computeBiomechanicsMetrics`, `ApiConnectionDrawer`, `ToastProvider`.
- Produces:
  - Complete Pro-Lab `AnalysisDashboard` with real-time angle telemetry overlay on video, keyboard frame-stepping (`Space`, `←`, `→`), 4-metric biomechanical scorecard, and JSON export.

- [ ] **Step 1: Upgrade `AnalysisDashboard.tsx`, `JointAngleChart.tsx`, and `DefectTimelineList.tsx`**
- [ ] **Step 2: Update `src/app/App.tsx` to integrate `ToastProvider`, header API Status badge, and `ApiConnectionDrawer`**
- [ ] **Step 3: Run `npx vitest run` and `npm run build` to verify all unit tests and production bundle succeed**
- [ ] **Step 4: Launch Vite dev server and inspect/screenshot all views in the browser**
