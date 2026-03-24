# Category Edit Toggle — Design Spec

## Overview

On mobile, category edit/delete buttons are permanently visible, cluttering the sidebar for users who rarely edit categories. This feature adds a compact ✏ toggle button next to "All Notes" that shows/hides edit and delete controls for all user-created categories. State persists in localStorage so each user's preference is remembered.

## Behaviour

- A small ✏ icon button is added to the right end of the "All Notes" category row
- **Default state: off** — category rows show only icon + name (bare, no controls)
- **Toggle on:** ✏ button gets filled purple background; all user-created category rows reveal their edit/delete buttons
- **Toggle off:** ✏ button returns to subtle style; edit/delete buttons hidden again
- Toggle state saved to `localStorage` key `categoryEditMode` (boolean string `'true'`/`'false'`)
- On page load, state is restored from localStorage (defaults to `false` if not set)

## Scope

- **Drawer/mobile only** (`max-width: 1199px`) — this is the breakpoint where the sidebar becomes a hidden drawer and hover is unavailable. Desktop (≥1200px) keeps existing hover behaviour unchanged.
- Affects user-created categories only. "All Notes" and "Uncategorized" have no edit/delete controls and are unaffected by the toggle.

## Visual Design

**Off state (default):**
```
📄  All Notes                    [✏]   ← subtle (rgba purple bg)
📌  Uncategorized
💻  Dev
🛒  Shopping
```

**On state:**
```
📄  All Notes                    [✏]   ← filled purple bg
📌  Uncategorized                      ← no controls (none exist)
💻  Dev                          ✏  🗑
🛒  Shopping                     ✏  🗑
```

The ✏ toggle button:
- Off: `background: rgba(98,0,238,0.12)`, `color: #6200ee`, border-radius 6px, ~28×28px tap target
- On: `background: #6200ee`, `color: #fff`

## Files Changed

| File | Change |
|------|--------|
| `frontend/index.html` | No change to the "All Notes" div (it is re-rendered by JS). The toggle button is injected by `renderCategories()`. |
| `frontend/js/ui.js` | Update `renderCategories()` to include `<button id="categoryEditToggle">✏</button>` in the "All Notes" row template, and re-apply active style from localStorage after each render |
| `frontend/css/categories.css` | Add `@media (max-width: 1199px)` block: hide `.category-controls` by default (`display: none`), show under `.categories.edit-mode .category-controls` (`display: flex`); style the `#categoryEditToggle` button |
| `frontend/css/responsive.css` | Remove/replace the existing `opacity: 0.5` rule for `.category .category-controls` at `max-width: 768px` — superseded by the new `display: none` approach in `categories.css` |
| `frontend/js/eventHandlers.js` | Wire up toggle button click: use event delegation on `.categories` container (since button is re-rendered); toggle `.edit-mode` class on `.categories`; update button style; write to localStorage |

## CSS Approach

The existing `responsive.css` rule at `max-width: 768px` sets `.category .category-controls { opacity: 0.5 }`, making controls semi-visible. The new design replaces this with `display: none` at `max-width: 1199px`, controlled by the `.edit-mode` class:

```css
/* categories.css */
@media (max-width: 1199px) {
  .category-controls {
    display: none;
  }
  /* Suppress the base hover rule inside the drawer breakpoint so it
     cannot fight the display:none via opacity changes */
  .category:hover .category-controls {
    opacity: 0;
  }
  .categories.edit-mode .category-controls {
    display: flex;
  }
  #categoryEditToggle {
    background: rgba(98,0,238,0.12);
    color: #6200ee;
    border: none;
    border-radius: 6px;
    padding: 4px 7px;
    font-size: 14px;
    cursor: pointer;
  }
  #categoryEditToggle.active {
    background: #6200ee;
    color: #fff;
  }
}
```

The `responsive.css` `opacity: 0.5` rule for `.category .category-controls` at `max-width: 768px` must be removed to avoid conflict.

## Data Flow

1. **Page load** → `renderCategories()` runs → injects ✏ button into "All Notes" row → **immediately after the `innerHTML` assignment and before the `querySelectorAll` listener loop**, reads `localStorage.getItem('categoryEditMode')` → if `'true'`, adds `.edit-mode` to `.categories` container and `.active` class to the freshly-injected `#categoryEditToggle` button
2. **User taps ✏** → event delegation in `setupEventListeners()` (called once on startup) uses `document.querySelector('.categories')` — this element is present in the static `index.html` (line 88) so it exists at setup time — catches clicks where `e.target.id === 'categoryEditToggle'` → toggles `.edit-mode` on `.categories` → toggles `.active` on `e.target` → writes new state to localStorage
3. **Re-render** (category add/edit/delete triggers `renderCategories()`) → button is re-injected → active state re-applied from localStorage (step 1 logic runs again) → event delegation on the stable `.categories` container survives because the `.categories` element itself is never replaced, only its `innerHTML`

## Non-Goals

- No change to desktop/tablet (≥1200px) behaviour
- No server-side persistence of this preference
- No animation on show/hide
