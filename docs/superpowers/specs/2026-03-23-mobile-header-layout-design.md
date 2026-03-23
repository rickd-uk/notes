# Mobile Header & Layout Improvements — Design Spec (Spec A)

**Date:** 2026-03-23
**Status:** Approved

---

## Problem

Several mobile and responsive layout issues degrade usability:

1. The hamburger button is a fixed-position overlay that visually collides with the open sidebar's "All Notes" item
2. Search, sort, and username in the top bar are too small to tap/read comfortably on mobile — and also undersized on desktop
3. On screens narrower than 1200px, 3-column note grids look squashed
4. On mobile, notes are too short — 3+ are visible but too small to be useful; 2 larger notes is better

---

## Goals

- Hamburger button integrated into the header bar (no fixed overlay)
- Search, sort, and username comfortably sized on all screen sizes
- Max 2 note columns below 1200px, max 3 at or above 1200px
- Mobile notes sized so exactly 2 fill the screen (~45vh each)

---

## Breakpoints

| Label | Range | Sidebar behaviour |
|-------|-------|-------------------|
| Mobile | ≤ 768px | Sidebar is a hidden drawer; hamburger visible |
| Tablet | 769px – 1199px | Sidebar is a hidden drawer; hamburger visible |
| Desktop | ≥ 1200px | Sidebar always visible; hamburger hidden |

---

## Header Redesign

### Hamburger button

**Current:** Dynamically created in `responsive.js`, appended to `<body>`, fixed position `top: 10px; left: 10px`. Overlaps open sidebar.

**New:** Static HTML button `#navToggleBtn` placed as the **first child** of `.notes-header` in `index.html`. Shown on mobile and tablet (≤ 1199px), hidden on desktop (≥ 1200px) via CSS. Remove dynamic creation from `responsive.js` entirely — wire the click handler to `#navToggleBtn` by ID instead.

### Search & sort buttons

Currently small and inconsistently styled. Both are injected into `.notes-header` by `searchNotes.js` and `sortNotes.js`.

**New:** 38×38px circular buttons with `background: rgba(255,255,255,0.07)` background, 17px icon size. Applied via CSS targeting their existing classes/IDs — no JS changes required.

### Username badge

Currently `font-size: 12px`, `max-width: 100px` on mobile, heavily truncated.

**New:** `font-size: 13px` on mobile, `font-size: 14px` on tablet+, `max-width: 120px` on mobile, `max-width: 160px` on tablet+. Same purple badge style, just more readable.

### Header height

Increase `.notes-header` height to **56px** on all screen sizes (currently varies). Consistent and touch-friendly.

---

## Notes Grid Column Rules

| Screen | Max columns | Change |
|--------|-------------|--------|
| ≤ 768px | 1 column | Unchanged |
| 769px – 1199px | **2 columns max** | Was allowing 3 |
| ≥ 1200px | 3 columns max | Unchanged |

All `note-count-*` classes that currently set 3 columns (e.g. `note-count-5`, `note-count-6`, `note-count-7` etc.) must be overridden with 2-column layouts in a new `@media (max-width: 1199px)` block in `layout.css`.

---

## Mobile Note Height

On mobile (≤ 768px), notes currently have `min-height: 35vh`. Change to `min-height: 45vh` so exactly 2 notes fill the viewport, giving each note enough room to be readable.

The `note-count-1` special case (single note fills screen at `min-height: 60vh`) remains unchanged.

---

## Implementation Scope

- Modify `frontend/index.html` — add `#navToggleBtn` as first child of `.notes-header`
- Modify `frontend/js/responsive.js` — remove dynamic button creation; wire click handler to `#navToggleBtn` by ID
- Modify `frontend/css/responsive.css` — hamburger show/hide by breakpoint; header height; search/sort/username sizing; remove old fixed-position nav-toggle rules
- Modify `frontend/css/components.css` — remove `.nav-toggle` fixed-position styles (now handled in responsive.css); update `.username-display` sizes
- Modify `frontend/css/layout.css` — add `@media (max-width: 1199px)` block capping all note-count grids at 2 columns; change mobile `min-height` from 35vh to 45vh

### Out of Scope
- Spec B features (toolbar trim, sidebar collapse)
- Admin panel or other pages
- Any backend changes

---

## Files Affected

| File | Change |
|------|--------|
| `frontend/index.html` | Add `#navToggleBtn` button inside `.notes-header` |
| `frontend/js/responsive.js` | Remove dynamic button creation; wire to `#navToggleBtn` |
| `frontend/css/responsive.css` | Breakpoint show/hide for hamburger; header sizing; search/sort/username sizing |
| `frontend/css/components.css` | Remove `.nav-toggle` fixed-position block; update `.username-display` |
| `frontend/css/layout.css` | 2-column cap below 1200px; 45vh mobile note height |
