# Mobile UX Improvements — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Problem

On a Pixel 6a (and similar mobile screens) the notes app has several usability issues:

- The note card expand button (28×28px, `opacity: 0.7`) is too small to tap comfortably
- The expanded note controls (T, Aa, ✏️, 🔐) shrink to 26×26px / font-size 14px on mobile
- The encrypt button (🔐) is sometimes not visible due to positioning conflicts
- Controls are tightly packed with little separation
- There is no clear "back" affordance to close an expanded note on mobile
- The username in the main header wastes space and clutters the top bar
- Timestamps show raw datetime strings rather than human-readable relative times

## Goals

1. Make the expanded note experience feel like a native mobile app
2. Ensure all tap targets meet the 44×44px minimum
3. Move the username out of the header and into the sidebar
4. Show relative timestamps everywhere

## Out of Scope

- Any changes to desktop layout (≥769px)
- Changes to the note card grid layout
- Changes to the sidebar categories or settings toggles

---

## Design

### 1. Mobile Expanded Note — Top Nav Bar

**Applies to:** `@media (max-width: 768px)` only. Desktop is unchanged.

**Current behaviour:** `.expanded-note-controls` is `position: fixed; top: 15px; right: 60px` — a floating pill that competes with the delete button and can be obscured.

**New behaviour:** The controls become a proper top nav bar that is part of the expanded note's document flow. Since the expanded note is already `position: fixed; top: 0; left: 0; width: 100%; height: 100%` on mobile, the bar becomes its first child element.

**Layout (left → right):**

```
┌──────────────────────────────────────────┐
│  ←    T    Aa   ✏️   🔐              🗑   │  56px tall
├──────────────────────────────────────────┤
│  Bold  Italic  …  (Quill toolbar, if on) │
├──────────────────────────────────────────┤
│                                          │
│         note content / editor            │
│                                          │
└──────────────────────────────────────────┘
```

- `←` (back/collapse): far left, closes the expanded note and returns to the grid
- `T` (toolbar toggle): shows/hides the Quill formatting toolbar
- `Aa` (spellcheck toggle): toggles spellcheck
- `✏️ / 👁` (lock toggle): switches between editable and view-only
- `🔐` (encrypt toggle): shown only when encryption UI is enabled
- `🗑` (delete): far right

**Button sizing:**
- Each button: `min-width: 44px; min-height: 44px; font-size: 20px`
- Gap between buttons: `8px`
- Bar height: `56px`
- Bar has a subtle `border-bottom: 1px solid var(--border-color)`

**Quill toolbar:** Sits naturally below the nav bar — no overlap. Because the nav bar is in document flow, the Quill toolbar (when visible) pushes content down as expected.

**Delete button on mobile:** The existing `position: fixed` delete button (top-right corner) is hidden on mobile expanded view; the `🗑` in the top bar takes its role.

**The collapse/expand icon on note cards:** The `.note-expand` button (currently bottom-right of each card) remains as the tap target to open a note. Its icon changes to `↗` or similar "expand" arrow on mobile. The close action is always the `←` in the expanded top bar — there is no in-card collapse icon on mobile.

**Implementation touch-points:**
- `noteControls.js` — `addExpandedNoteControls()`: inject the back button; adjust rendering for mobile
- `note-controls.css` — add `.mobile-note-nav` styles; override `.expanded-note-controls` positioning on mobile
- `notes.css` — on mobile, hide the fixed delete button when note is expanded; add `padding-top: 56px` or a flex column structure to the expanded note
- `eventHandlers.js` — wire the back button click to the existing collapse logic

---

### 2. Relative Dates — Everywhere

**Applies to:** All screen sizes.

**Current behaviour:** Raw ISO/locale timestamp strings in note card footers and expanded note footers.

**New behaviour:** A utility function `formatRelativeDate(dateString)` formats timestamps as human-readable relative strings.

**Rules:**

| Age | Display |
|-----|---------|
| < 1 minute | "just now" |
| < 1 hour | "X min ago" |
| < 24 hours | "X hours ago" |
| 1–2 days | "yesterday" |
| 2–7 days | "X days ago" |
| 7–30 days | "X weeks ago" |
| Same year, older | "Mar 15" |
| Different year | "Mar 15, 2024" |

**Implementation touch-points:**
- New utility function in `ui.js` (or a dedicated `dateUtils.js` if preferred)
- Replace the existing timestamp rendering in:
  - `ui.js` — note card footer render
  - `noteControls.js` or wherever the expanded note footer timestamp is set

---

### 3. Username Moves to Sidebar Top

**Applies to:** All screen sizes.

**Current behaviour:** `#usernameDisplay` lives inside `.user-info` in `.notes-header` (main top bar).

**New behaviour:** Username is displayed at the top of the sidebar, above the categories list, inside a small styled block with a bottom divider.

**Sidebar structure (top → bottom):**
```
┌─────────────────────┐
│  rick               │  ← username, 14px, muted colour
├─────────────────────┤
│  All Notes          │
│  Uncategorized      │
│  Work               │
│  …                  │
```

**HTML change:** Remove `<div class="user-info">…</div>` from `.notes-header`. Add a `<div class="sidebar-username">` at the top of `.sidebar` (before `.sidebar-scrollable` or as first item inside it).

**CSS cleanup:** Remove the mobile header rules that were compensating for the username's presence:
- `max-width: calc(50% - 80px)` on `.notes-header .user-info`
- `margin-right: 30px` on `.notes-header .user-info` (mobile)
- `margin-bottom: 5px` on `.notes-header .user-info` (480px)
- `max-width: 100px` on `.username-display` (480px)

**JS change:** `#usernameDisplay` element moves to the sidebar; `main.js` / `state.js` code that sets `usernameDisplay.textContent` requires no logic change — just the element's new location.

---

## Files to Change

| File | Change |
|------|--------|
| `frontend/index.html` | Move `#usernameDisplay` to sidebar; add `.sidebar-username` div |
| `frontend/js/noteControls.js` | Add back button; adjust `addExpandedNoteControls` for mobile nav bar |
| `frontend/js/ui.js` | Add `formatRelativeDate()`; use it in note card footer render |
| `frontend/css/note-controls.css` | Add `.mobile-note-nav` styles; override expanded controls on mobile |
| `frontend/css/notes.css` | Hide fixed delete button on mobile expanded; adjust expanded note structure |
| `frontend/css/responsive.css` | Remove username-related header compensation rules |
| `frontend/css/categories.css` or new `.sidebar-username` rule | Style the username at sidebar top |

## Non-Goals / Constraints

- Do not change any desktop styles (guard all mobile changes behind `@media (max-width: 768px)`)
- Do not alter note card grid layout
- Do not alter the Quill toolbar itself — only its position relative to the new nav bar
- The encrypt button must remain hidden when encryption UI is disabled (existing logic unchanged)
