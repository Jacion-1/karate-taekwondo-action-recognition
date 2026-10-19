# Karate & Taekwondo Pro Sports-Tech UI & Closed-Loop Coaching Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the "空手道與跆拳道動作識別系統" into a professional sports-tech platform inspired by Sensei AI, JAB AI / HITAI, Uplift Labs / formAIsion, and Kinovea while preserving strict Modern Minimalism and automatic database action recognition.

**Architecture:**
1. Extend `DefectItem` and `ActionAnalysisResponse` in `martial-arts.types.ts` and `apiClient.interface.ts` to support structured JAB AI / Sensei AI coaching feedback (`prescription` actionable drill cue, `strengths` list, and `keyframes` phase timestamps: `preparation`, `impact`, `recovery`).
2. Rebalance `RecordWorkspace.tsx` into an 8-col / 4-col layout: Left 8-col Uplift Labs minimalist viewfinder + one-click "立即識別並查看報告" closed-loop banner; Right 4-col Sensei AI "識別模式（預設：AI 自動比對識別）與資料庫標準動作圖譜" cards + collapsible architecture summary.
3. Upgrade `AnalysisDashboard.tsx` and `DefectTimelineList.tsx` with a Kinovea-style toggleable SVG Goniometer & Fault Highlight HUD overlay on the video player, keyframe phase jump pills (`蓄力期`, `擊打頂點`, `收勢回防`), JAB AI strengths + actionable coaching prescription cards, and a Sensei AI "再次拍攝驗證 (閉環訓練)" button in the top bar.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Dexie.js, Recharts, Vitest, Playwright

**Spec:** Approved inline in conversation on 2026-10-19.

## Global Constraints
- Keep strict Modern Minimalism (`#09090b` background, `border-white/[0.06]` hairline borders, high whitespace, neutral zinc palette).
- Preserve all 3 core performance protections (`RecordingTimer` leaf isolation, `MediaStreamTrack` + `ObjectURL` cleanup, IndexedDB `Blob` storage).
- Preserve automatic action recognition (`actionType?: ActionType` optional before analysis, with `"auto"` as the default recognition mode in `RecordWorkspace`).

## Review Focus
- Backend responses omitting optional `strengths`, `keyframes`, or defect `prescription` fields must normalize cleanly with sensible defaults in `validateAnalysisResponse`.

---

### Task 1: Structured Coaching Feedback, Strengths & Keyframes Data Contract (TDD)

**Files:**
- Modify: `src/types/martial-arts.types.ts`
- Modify: `src/services/apiClient.interface.ts`
- Modify: `src/services/mockAnalysis.service.ts`
- Test: `src/services/__tests__/apiClient.interface.test.ts`

**Interfaces:**
- Produces:
  - `DefectItem.prescription?: string` (actionable coaching drill/cue)
  - `ActionKeyframes { preparation: number; impact: number; recovery: number }`
  - `ActionAnalysisResponse.strengths?: string[]`
  - `ActionAnalysisResponse.keyframes?: ActionKeyframes`

- [x] **Step 1: Write the failing test in `src/services/__tests__/apiClient.interface.test.ts`**
- [x] **Step 2: Run `npx vitest run` to verify it fails**
- [x] **Step 3: Implement types, normalizer defaults in `validateAnalysisResponse`, and rich coaching data in `mockAnalysisService`**
- [x] **Step 4: Run `npx vitest run` to verify all tests pass**

---

### Task 2: Sensei AI & Uplift Labs 8/4 Dual-Column `RecordWorkspace` with Closed-Loop Instant Analyze

**Files:**
- Modify: `src/features/recorder/RecordWorkspace.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `ACTION_METADATA`, `analysisClientFactory.getClient().uploadAndAnalyzeVideo`
- Produces: `RecordWorkspaceProps { onNavigateToVault: () => void; onOpenAnalysis: (videoId: string, analysisId: string) => void; }`

- [x] **Step 1: Update `RecordWorkspace.tsx` to 8/4 layout with Sensei AI Action Atlas (defaulting to `AI 自動比對識別` mode + clickable reference cards showing target angles & biomechanics focus) and one-click `立即識別並查看報告` button**
- [x] **Step 2: Wire `onOpenAnalysis` and `onReverifyAction` in `src/app/App.tsx`**

---

### Task 3: Kinovea Vector Goniometer Overlay, Keyframe Phase Jumpers & JAB AI Coaching Prescriptions in `AnalysisDashboard`

**Files:**
- Modify: `src/features/analysis/AnalysisDashboard.tsx`
- Modify: `src/features/analysis/components/defects/DefectTimelineList.tsx`

**Interfaces:**
- Consumes: `ActionAnalysisResponse.strengths`, `ActionAnalysisResponse.keyframes`, `DefectItem.prescription`

- [x] **Step 1: Enhance `DefectTimelineList.tsx` to display structured `問題診斷` + `教練修正建議 (Prescription)`**
- [x] **Step 2: Enhance `AnalysisDashboard.tsx` with Kinovea SVG angle arc/fault ring overlay toggle, phase jump buttons (`蓄力期`, `擊打頂點`, `收勢回防`), JAB AI `表現亮點 (Strengths)` & `教練總評`, and Sensei AI `再次拍攝驗證` button**
- [x] **Step 3: Verify `npx vitest run` and `npm run build` pass with 0 errors, then capture headless browser screenshots**
