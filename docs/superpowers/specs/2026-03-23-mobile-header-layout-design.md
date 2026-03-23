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

**New:** Static HTML button placed as the **first child** of `.notes-header` in `index.html`:

```html
<button class="nav-toggle" id="navToggleBtn" aria-label="Toggle sidebar">&#9776;</button>
```

- Shown on mobile and tablet (≤ 1199px), hidden on desktop (≥ 1200px) via CSS
- Base rule: `display: none` (desktop default)
- Shown via: `@media (max-width: 1199px) { .nav-toggle { display: flex; } }` — single rule in `responsive.css`, canonical location
- Remove the `.nav-toggle` block entirely from `components.css` (both base and the `@media (max-width: 768px)` override)

**`responsive.js` changes:**
- Remove the dynamic button creation block (`setupMobileNavigation` creates and appends the button — remove that part only)
- Wire the click handler to `document.getElementById('navToggleBtn')` instead
- Update `handleScreenResize()`: it currently checks `window.innerWidth <= 768` and calls `navToggle.style.display` with inline styles — change the breakpoint check to `<= 1199px` and **remove the `style.display` manipulation entirely** (CSS handles show/hide; inline styles would override it)
- The resize handler's sidebar-reset logic (closing sidebar when window widens) should trigger at `>= 1200px` instead of `> 768px`

### Search & sort buttons

Currently small and inconsistently styled. Both are injected into `.notes-header` by `searchNotes.js` and `sortNotes.js`.

**New:** 38×38px circular buttons with `background: rgba(255,255,255,0.07)`, `border-radius: 50%`, 17–18px icon/font size. Applied via CSS targeting their existing classes/IDs in `responsive.css` — no JS changes required.

### Username badge

Currently `font-size: 12px`, `max-width: 100px` on mobile, heavily truncated.

**New:** `font-size: 13px` on mobile, `font-size: 14px` on tablet+, `max-width: 120px` on mobile, `max-width: 160px` on tablet+. Same purple badge style, just more readable.

### Header height

Increase `.notes-header` min-height to **56px** on all screen sizes. Consistent and touch-friendly.

---

## Notes Grid Column Rules

| Screen | Max columns | Change |
|--------|-------------|--------|
| ≤ 768px | 1 column | Unchanged |
| 769px – 1199px | **2 columns max** | Was allowing 3 |
| ≥ 1200px | 3 columns max | Unchanged |

**Implementation:** Replace the existing `@media (max-width: 1200px)` block in `layout.css` (which only partially addresses this) with a `@media (max-width: 1199px)` block that caps **all** multi-column note-count classes at 2 columns, including `note-count-many` which uses `repeat(auto-fill, minmax(...))` and must also be capped. The existing block at `max-width: 1200px` must be removed to avoid the 1px edge case at exactly 1200px.

Classes to cap at 2 columns in the `@media (max-width: 1199px)` block:
`note-count-3`, `note-count-4`, `note-count-5`, `note-count-6`, `note-count-7`, `note-count-8`, `note-count-9`, `note-count-many`

---

## Mobile Note Height

On mobile (≤ 768px), notes currently have `min-height: 35vh`. Change to `min-height: 45vh` so exactly 2 notes fill the viewport, giving each note enough room to be readable.

The `note-count-1` special case (single note fills screen at `min-height: 60vh`) remains unchanged.

---

## Implementation Scope

- Modify `frontend/index.html` — add `#navToggleBtn` as first child of `.notes-header`
- Modify `frontend/js/responsive.js` — remove dynamic button creation; wire click handler to `#navToggleBtn`; update `handleScreenResize()` to use 1199px breakpoint and remove inline `style.display` manipulation
- Modify `frontend/css/responsive.css` — single `@media (max-width: 1199px)` rule for hamburger `display: flex`; header min-height 56px; search/sort 38px circular buttons; username badge sizing
- Modify `frontend/css/components.css` — remove entire `.nav-toggle` block (base + 768px override); update `.username-display` base sizes
- Modify `frontend/css/layout.css` — replace existing `@media (max-width: 1200px)` block with `@media (max-width: 1199px)` capping all note-count classes at 2 columns including `note-count-many`; change mobile `min-height` from 35vh to 45vh

### Out of Scope
- Spec B features (toolbar trim, sidebar collapse)
- Admin panel or other pages
- Any backend changes

---

## Files Affected

| File | Change |
|------|--------|
| `frontend/index.html` | Add `#navToggleBtn` as first child of `.notes-header` with `aria-label` and `&#9776;` content |
| `frontend/js/responsive.js` | Remove dynamic creation; wire to `#navToggleBtn`; fix `handleScreenResize()` breakpoint to 1199px; remove inline style.display calls |
| `frontend/css/responsive.css` | Single hamburger show rule at ≤1199px; header min-height 56px; search/sort/username sizing |
| `frontend/css/components.css` | Remove entire `.nav-toggle` block; update `.username-display` sizes |
| `frontend/css/layout.css` | Replace `max-width: 1200px` block with `max-width: 1199px`; cap all note-count classes at 2 cols; 45vh mobile note height |
