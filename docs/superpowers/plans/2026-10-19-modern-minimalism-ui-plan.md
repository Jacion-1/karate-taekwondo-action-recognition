# 空手道與跆拳道動作識別系統 — Modern Minimalism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the entire frontend into a refined Modern Minimalism product interface titled "空手道與跆拳道動作識別系統", eliminating visual clutter, duplicate buttons, and heavy borders while preserving all features and React performance guarantees.

**Architecture:** Maintain the existing feature-sliced React + TypeScript + Dexie + Adapter architecture, updating styling tokens in `index.css` and refactoring view components (`App.tsx`, `RecordWorkspace.tsx`, `CameraPreview.tsx`, `RecordingTimer.tsx`, `VideoVault.tsx`, `AnalysisDashboard.tsx`, `JointAngleChart.tsx`, `DefectTimelineList.tsx`, `ApiConnectionDrawer.tsx`).

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, Dexie.js, Recharts, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-modern-minimalism-ui-spec.md`

---

### Task 1: Update Brand Terminology, Global Minimalist Styles & Header Navigation

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Modify: `src/types/martial-arts.types.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/shared/components/ApiConnectionDrawer.tsx`
- Modify: `src/shared/components/ToastContainer.tsx`

- [ ] **Step 1: Update `index.html` title to `空手道與跆拳道動作識別系統` and `src/index.css` to use neutral `#09090b` background without grid lines and clean `.surface-card` utilities**
- [ ] **Step 2: Refine `ACTION_METADATA` in `src/types/martial-arts.types.ts` with clean Karate & Taekwondo labels**
- [ ] **Step 3: Refactor `src/app/App.tsx`, `ApiConnectionDrawer.tsx`, and `ToastContainer.tsx` into a minimalist header and drawer**

---

### Task 2: Refactor RecordWorkspace, CameraPreview & RecordingTimer (Eliminate Duplicate Buttons & Clutter)

**Files:**
- Modify: `src/features/recorder/components/RecordingTimer.tsx`
- Modify: `src/features/recorder/components/CameraPreview.tsx`
- Modify: `src/features/recorder/RecordWorkspace.tsx`
- Modify: `src/services/mockAnalysis.service.ts`

- [ ] **Step 1: Simplify `RecordingTimer.tsx` and `CameraPreview.tsx` (clean corner brackets viewfinder, single primary CTA in empty state, no duplicate buttons)**
- [ ] **Step 2: Refactor `RecordWorkspace.tsx` (consolidated bottom bar, clean right-hand radio cards, collapsible `<details>` for technical info)**
- [ ] **Step 3: Update synthetic canvas colors in `mockAnalysis.service.ts` to match the calm zinc minimalist palette**

---

### Task 3: Refactor VideoVault & AnalysisDashboard to Modern Minimalism

**Files:**
- Modify: `src/features/vault/VideoVault.tsx`
- Modify: `src/features/analysis/AnalysisDashboard.tsx`
- Modify: `src/features/analysis/components/charts/JointAngleChart.tsx`
- Modify: `src/features/analysis/components/defects/DefectTimelineList.tsx`

- [ ] **Step 1: Refactor `VideoVault.tsx` into a clean gallery with subtle filter pills and minimalist cards**
- [ ] **Step 2: Refactor `AnalysisDashboard.tsx`, `JointAngleChart.tsx`, and `DefectTimelineList.tsx` with a clean typographic metric strip, uncluttered chart, and refined defect items**
- [ ] **Step 3: Run `npx vitest run` and `npm run build`, then capture live browser screenshots of all views**
