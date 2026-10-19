# 空手道與跆拳道動作識別系統 — Modern Minimalism UI/UX Refactoring Spec

**Date:** 2026-10-19
**Status:** Approved by User
**Target Workspace:** `c:\專題`

---

## 1. Brand & Identity Correction
- **Official Project Title:** `空手道與跆拳道動作識別系統` (Karate & Taekwondo Action Recognition System).
- Replace all generic occurrences of "武術" across `index.html`, header navigation, action selector, vault, and analysis report with precise Karate & Taekwondo terminology.

---

## 2. Design Direction: Modern Minimalism (現代化簡潔風)
1. **Color & Surface System:**
   - Neutral, low-fatigue dark zinc palette:
     - Background: `#09090b` (`zinc-950`) with zero grid lines or artificial neon gradients.
     - Elevated Card Surface: `#121215` (`bg-zinc-900/50`) with hairline border `border-white/[0.06]`.
     - Primary Interactive Accent: Clean high-contrast white (`bg-white text-zinc-950 hover:bg-zinc-200`) for primary actions, subtle zinc surfaces (`bg-zinc-800/80 text-zinc-200 hover:bg-zinc-800`) for secondary actions.
     - Semantic Data Colors (used sparingly): Emerald (`#10b981`) for standard compliance, Amber (`#f59e0b`) for measured curve, Rose (`#f43f5e`) for critical defects.
2. **Typography & Hierarchy:**
   - Clear typographic scale with generous padding (`p-6` to `p-8`) and breathing room (`gap-6` to `gap-8`).
   - Remove redundant English all-caps engineering jargon (`BIOMECHANICS FULL-BODY ZONE`, `OPTICAL CAPTURE WORKSPACE`, `PRO-LAB v2.0`).
3. **Layout Restructuring:**
   - **Left Primary Capture Area:**
     - Clean 16:9 viewport with subtle camera viewfinder corner marks (`1px` corner brackets) instead of heavy dashed boxes.
     - Single primary CTA inside empty state (`開啟攝影機`); secondary actions (`匯入影片`, `產生範例動作`) consolidated cleanly into a single bottom bar—no duplicate buttons.
   - **Right Action Selector:**
     - Minimalist radio-style card list showing Chinese action title (`正拳攻擊`, `迴旋踢`, `側踢`), discipline tag (`空手道`, `跆拳道`), and one concise description line.
   - **Technical Notes Demoted:**
     - Replace the bulky bottom-right technical explanation box with a discreet collapsible `<details>` disclosure (`系統架構與效能資訊`) at the bottom of the sidebar.
   - **Video Vault & Analysis Report:**
     - Vault header simplified to a clean title, filter pills, and primary action button.
     - Analysis Dashboard metrics streamlined into a minimalist 4-column typographic strip without heavy icon boxes.
