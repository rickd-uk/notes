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
- The username in the main header wastes space and clutters the top bar on mobile
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

**Current behaviour:** `.expanded-note-controls` is a standalone `<div>` at the bottom of `<body>` (positioned fixed at `top: 15px; right: 60px`). `addExpandedNoteControls()` in `noteControls.js` locates it via `document.querySelector(".expanded-note-controls")`, populates it with buttons, and adds the `active` class to display it. The element is shared/reused across note expansions.

**New behaviour on mobile:** Instead of restructuring the shared element, inject a new `<div class="mobile-note-nav">` directly into the expanded note element as its first child. This keeps the existing shared `.expanded-note-controls` mechanism intact for desktop and avoids touching the teardown/restore logic. On mobile, the `.expanded-note-controls` element is hidden via CSS (`display: none` inside the `@media (max-width: 768px)` block), and the injected `.mobile-note-nav` is shown instead.

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

- `←` (back/collapse): far left — collapses the expanded note
- `T` (toolbar toggle): shows/hides the Quill formatting toolbar
- `Aa` (spellcheck toggle): toggles spellcheck
- `✏️ / 👁` (lock toggle): switches between editable and view-only
- `🔐` (encrypt toggle): shown only when `isEncryptionUiEnabled()` returns true
- `🗑` (delete): far right

**Button sizing:**
- Each button: `min-width: 44px; min-height: 44px; font-size: 20px`
- Gap between buttons: `8px`
- Bar height: `56px`
- Bar background: `var(--surface-color)` (works in both light and dark mode — no additional dark-mode override needed as the CSS variable handles it)
- Bar separator: `border-bottom: 1px solid var(--border-color)` (also theme-aware via CSS variable)

**Back button wiring:** The back button's click handler calls `toggleNoteExpansion(noteElement)` imported directly from `ui.js` inside `noteControls.js`. This is safe because `noteControls.js` already imports from `ui.js` (for `addEncryptedOverlay` / `removeEncryptedOverlay`). No new import needed; no circular dependency is introduced.

**Existing circular import note:** The existing circular import risk (documented at line 14–17 of `noteControls.js`) is between `noteControls.js` and `eventHandlers.js`. The back button does not involve `eventHandlers.js` — it calls `ui.js` directly, which is already a safe static import.

**The `.mobile-note-nav` is removed on collapse** in the same place where `removeExpandedNoteControls()` tears down the shared `.expanded-note-controls`. Add a line: `noteElement.querySelector('.mobile-note-nav')?.remove()`.

**Quill toolbar:** Sits naturally below the nav bar — no overlap. Because `.mobile-note-nav` is in document flow as the first child of the expanded note, the Quill toolbar (when visible) pushes content down as expected.

**Delete button on mobile expanded view:** The existing `.note.expanded button.note-delete` rule has `position: fixed !important; opacity: 1 !important`. On mobile it must be suppressed inside `@media (max-width: 768px)`:
```css
@media (max-width: 768px) {
  .note.expanded button.note-delete {
    display: none !important;
  }
}
```
The `🗑` button in `.mobile-note-nav` takes over this role and calls the same delete handler.

**Conflicting responsive rule:** `responsive.css` has `@media (max-width: 768px) { .note.expanded { width: 90%; height: 80%; } }` (lines 131–133). This must be removed — it conflicts with the full-screen rules in `notes.css` (lines 294–304) which set `width: 100%; height: 100%; top: 0; left: 0; transform: none`. The `notes.css` rules are the correct ones.

**The note-expand button on cards:** `.note-expand` (bottom-right of each card) remains as the tap target to open a note. No change needed. The collapse action on mobile is exclusively the `←` button in `.mobile-note-nav`.

**Implementation touch-points:**
- `noteControls.js` — `addExpandedNoteControls()`: after populating the shared `.expanded-note-controls` as today, additionally inject `.mobile-note-nav` as first child of `noteElement` with all the same buttons plus the back button
- `noteControls.js` — `removeExpandedNoteControls()` (or equivalent teardown): call `noteElement.querySelector('.mobile-note-nav')?.remove()`
- `note-controls.css` — add `.mobile-note-nav` styles; add `display: none` override for `.expanded-note-controls` at `@media (max-width: 768px)`
- `notes.css` — add `display: none !important` for `.note.expanded button.note-delete` at `@media (max-width: 768px)`; remove or ensure the full-screen expanded note rules win (the `notes.css` rules already exist, just ensure no conflicts)
- `responsive.css` — remove the conflicting `.note.expanded { width: 90%; height: 80%; }` rule at `@media (max-width: 768px)` (lines 131–133)

---

### 2. Relative Dates — Everywhere

**Applies to:** All screen sizes.

**Current behaviour:** Raw ISO/locale timestamp strings rendered in note card footers via `ui.js` (in `renderNotes()` at the `.note-timestamp` element). The expanded note reuses the same DOM element — there is no separate render path for the expanded note footer timestamp. Only one change location is needed.

**New behaviour:** A utility function `formatRelativeDate(dateString)` in `ui.js` replaces the current timestamp formatting. It is used wherever `.note-timestamp` is set.

**Rules:**

| Condition | Display |
|-----------|---------|
| `diff < 60s` | "just now" |
| `60s ≤ diff < 3600s` | "X min ago" |
| `3600s ≤ diff < 86400s` | "X hours ago" |
| `86400s ≤ diff < 172800s` | "yesterday" |
| `172800s ≤ diff < 604800s` | "X days ago" |
| `604800s ≤ diff < 2592000s` | "X weeks ago" |
| `diff ≥ 2592000s`, same calendar year | "Mar 15" |
| `diff ≥ 2592000s`, different calendar year | "Mar 15, 2024" |

Boundary semantics: thresholds are inclusive on the lower end. For example, exactly 86400s (24 hours) is "yesterday", not "24 hours ago". Exactly 604800s (7 days) is "1 week ago". Exactly 2592000s (30 days) uses the month/day format.

**Implementation touch-points:**
- `frontend/js/ui.js` — add `formatRelativeDate(dateString)` function; replace the timestamp string passed to `.note-timestamp` in `renderNotes()`

---

### 3. Username Moves to Sidebar Top

**Applies to:** All screen sizes.

**Current behaviour:** `#usernameDisplay` lives inside `.user-info` in `.notes-header` (main top bar). On mobile the header has several CSS rules compensating for this element's presence.

**New behaviour:** Username is displayed at the very top of the sidebar, above the categories list, in a `<div class="sidebar-username">` block. On desktop the sidebar is always visible, so the username is always accessible. On mobile, the username is only visible when the sidebar drawer is open — this is the intended behaviour (the header is already cleaner without it).

**HTML change:**
- Remove `<div class="user-info"><span class="username-display" id="usernameDisplay">Loading...</span></div>` from `.notes-header`
- Add `<div class="sidebar-username"><span id="usernameDisplay"></span></div>` as the first child of `.sidebar`, before `.sidebar-scrollable`

**Sidebar structure (top → bottom):**
```
┌─────────────────────┐
│  rick               │  ← .sidebar-username: 14px, muted colour, bottom border
├─────────────────────┤
│  (categories list)  │  ← existing .sidebar-scrollable
│  …                  │
└─────────────────────┘
```

**JS change:** None — `#usernameDisplay` ID is unchanged. All existing JS that sets `document.getElementById('usernameDisplay').textContent` continues to work.

**CSS cleanup** — remove these rules that were compensating for the username in the header:
- `responsive.css`: `.notes-header .user-info { max-width: calc(50% - 80px); ... }` (lines 99–108)
- `note-controls.css`: `.notes-header .user-info { margin-right: 30px; }` at `@media (max-width: 768px)` (line 258–260)
- `note-controls.css`: `.notes-header .user-info { margin-bottom: 5px; }` at `@media (max-width: 480px)`
- `note-controls.css`: `.notes-header .username-display { max-width: 100px; ... }` at `@media (max-width: 480px)` (lines 315–323)

**Implementation touch-points:**
- `frontend/index.html` — move `#usernameDisplay` element to sidebar top
- `frontend/css/categories.css` (or `sidebar.css` if it exists) — add `.sidebar-username` styles
- `frontend/css/responsive.css` — remove username header compensation rules
- `frontend/css/note-controls.css` — remove username header compensation rules

---

## Files to Change

| File | Change |
|------|--------|
| `frontend/index.html` | Move `#usernameDisplay` to sidebar; add `.sidebar-username` div |
| `frontend/js/noteControls.js` | Inject `.mobile-note-nav` into expanded note on open; remove it on collapse |
| `frontend/js/ui.js` | Add `formatRelativeDate()`; use it in note card footer render |
| `frontend/css/note-controls.css` | Add `.mobile-note-nav` styles; hide `.expanded-note-controls` on mobile; remove username compensation rules |
| `frontend/css/notes.css` | Hide fixed delete button on mobile expanded note |
| `frontend/css/responsive.css` | Remove conflicting `.note.expanded` size rule; remove username compensation rules |
| `frontend/css/categories.css` | Add `.sidebar-username` styles |

## Non-Goals / Constraints

- Do not change any desktop styles (guard all mobile changes behind `@media (max-width: 768px)`)
- Do not alter note card grid layout
- Do not alter the Quill toolbar itself — only its position relative to the new nav bar
- The encrypt button must remain hidden when `isEncryptionUiEnabled()` returns false (existing logic unchanged)
- Do not change the shared `.expanded-note-controls` mechanism — only suppress it on mobile via CSS and add the parallel `.mobile-note-nav` element
