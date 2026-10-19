# Martial Arts Action Evaluator — Pro-Lab Frontend & Backend-Ready Upgrade Design Spec

**Date:** 2026-10-19
**Status:** Approved by User
**Target Workspace:** `c:\專題`

---

## 1. Intent & Why
The primary objective of Phase 1 is to deliver an impressive, high-precision **Tactical Biomechanics Lab** frontend suitable for:
1. **Immediate Stage:** Live demonstration on a laptop connected to a large screen/projector for professors during academic project evaluation.
2. **Next Stage:** Field deployment on mobile devices mounted on tripods in a martial arts dojo (Karate / Taekwondo), followed by seamless integration with a real backend AI pose-estimation service.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Professional-Grade Design System ("Tactical Biomechanics Lab"):**
   - Cohesive dark-lab color palette (`#060911` base, `#0f172a` elevated surfaces, glassmorphic HUD cards, subtle tactical grid background).
   - Google Fonts integration (`Inter` for crisp UI typography + `JetBrains Mono` with `tabular-nums` for angles, timers, frame numbers, and telemetry).
   - Responsive layout supporting 1080p/4K laptop demo screens and mobile touch viewports, with keyboard accessibility (`Space` play/pause, `←`/`→` frame stepping, `Escape` modal dismissal).
2. **Complete Functional Experience:**
   - **3-Way Video Input in RecordWorkspace:**
     1. Live Camera with **3-Second Countdown Overlay** (`3 -> 2 -> 1 -> REC`) and live stream resolution/FPS telemetry badge.
     2. **Local Video File Import (`.mp4`, `.webm`, `.mov`)** via drag-and-drop or file picker, automatically extracting video duration and first-frame thumbnail before saving to IndexedDB.
     3. **Enhanced Synthetic Biomechanics Video Generator** with dynamic joint angle HUD rendered on canvas.
   - **Upgraded Offline Video Vault:**
     - Automatic **Video Thumbnail Generation** (`thumbnailDataUrl?: string`) stored in `LocalVideoRecord` so cards display visual previews without creating heavy video `Blob` URLs until played.
     - Filtering by `ActionType` and `UploadStatus`, search/sort controls, and global **Toast Notification System**.
   - **Rich Analysis Dashboard:**
     - Biomechanical sub-metrics breakdown (`stabilityScore`, `explosivenessScore`, `standardComplianceRate` calculated from time-series points within `[standardMin, standardMax]`).
     - Live Angle Telemetry HUD overlaid on the synchronized video player showing the real-time measured angle vs. standard range at `currentTime`.
     - **Export Analysis JSON** button for academic inspection.
3. **Maximum Backend Connectivity:**
   - Unified `IAnalysisApiClient` contract with runtime configuration stored in `localStorage` (`mode: 'mock' | 'http'`, `baseUrl`, `timeoutMs`).
   - Full `HttpRestAnalysisClient` supporting `XMLHttpRequest` multipart upload (`POST /api/v1/analyses`) with real `onUploadProgress` callbacks, `AbortController` cancellation, structured `ApiClientError`, health check (`GET /api/v1/health`), and response payload validation/normalization.
   - Interactive **Backend API Contract & Connection Drawer** in the header so the presenter can show professors the exact REST API specification, test backend connectivity, and switch between Mock and HTTP modes live.

### Non-Goals
- Real-time WebRTC streaming (reserved for Phase 2).
- Backend server implementation (frontend provides the complete client adapter and contract).

### Anti-Goals (Failure Conditions)
- Violating the 3 React performance constraints (lifting `RecordingTimer` state into `RecordWorkspace`, leaking `MediaStreamTrack` or `ObjectURL`, or storing raw video `Blob` in global React state).
- Layout shift when high-frequency numbers (timers, angles) update.

---

## 3. Architecture & File Structure

```text
src/
├── types/
│   └── martial-arts.types.ts              # Extended types + API config & sub-metrics
├── services/
│   ├── apiClient.interface.ts             # IAnalysisApiClient, ApiConfig, ApiClientError, validateAnalysisResponse
│   ├── httpAnalysis.client.ts             # Real REST API client (XHR multipart upload progress, health check, timeout/abort)
│   ├── mockAnalysis.service.ts            # Enhanced mock engine + thumbnail extraction helper
│   └── analysisClient.factory.ts          # Dynamic switcher between Mock and HTTP client + config persistence
├── shared/
│   ├── components/
│   │   ├── ToastContainer.tsx             # Global non-blocking toast notifications
│   │   └── ApiConnectionDrawer.tsx        # Professor Demo tool: API mode switcher, endpoint tester & OpenAPI-style contract viewer
│   ├── hooks/
│   │   ├── useObjectUrl.ts                # Strict ObjectURL lifecycle
│   │   └── useNetworkStatus.ts            # Online/Offline + simulation toggle
│   └── utils/
│       └── videoMedia.utils.ts            # Extract video duration & JPEG thumbnail DataURL from any video Blob/File
├── features/
│   ├── recorder/
│   │   ├── RecordWorkspace.tsx            # Camera + 3s Countdown + Local Video File Dropzone + Synthetic Demo
│   │   ├── components/
│   │   │   ├── CameraPreview.tsx          # Memoized preview + countdown overlay + stream resolution HUD
│   │   │   └── RecordingTimer.tsx         # Isolated leaf timer component
│   │   └── hooks/
│   │       ├── useMediaStream.ts
│   │       └── useMediaRecorder.ts
│   ├── vault/
│   │   └── VideoVault.tsx                 # Thumbnail cards, Action/Status filters, batch queue, retry & delete
│   └── analysis/
│       ├── AnalysisDashboard.tsx          # Keyboard shortcuts, live angle HUD, sub-metrics radar/bars, JSON export
│       └── components/
│           ├── charts/JointAngleChart.tsx
│           └── defects/DefectTimelineList.tsx
└── test/                                  # Vitest unit & integration tests for data flow, API client, and validators
```
