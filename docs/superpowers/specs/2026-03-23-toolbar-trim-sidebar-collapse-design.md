# Toolbar Trim & Desktop Sidebar Collapse — Design Spec

**Date:** 2026-03-23

---

## Goal

Two independent UI improvements:
1. Trim the Quill rich-text toolbar to a minimal, useful set of tools.
2. Add a collapse/expand toggle to the desktop sidebar that reduces it to an icon strip.

---

## 1. Toolbar Trim

### Current toolbar config (`frontend/js/quillEditor.js` lines 21–29)

```js
const quillToolbarOptions = [
  ["bold", "italic", "underline", "strike"],
  ["blockquote", "code-block"],
  [{ header: 1 }, { header: 2 }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ color: [] }, { background: [] }],
  ["link"],
  ["clean"],
];
```

### Target toolbar

```js
const quillToolbarOptions = [
  ["bold", "italic", "underline"],
  [{ header: 1 }, { header: 2 }],
  [{ list: "ordered" }],
  [{ color: [] }],
];
```

**Kept:** Bold, Italic, Underline, H1, H2, Ordered list, Text color (Quill built-in dropdown)
**Removed:** Strike, Blockquote, Code block, Bullet list, Background color, Link, Clean

### Toolbar visibility toggle

The existing "Toolbar" checkbox in the sidebar (`#sidebarToolbarToggle`) is **unchanged** — it shows or hides the toolbar. The only change is what that toolbar contains.

---

## 2. Desktop Sidebar Collapse

### Scope

Desktop only — viewport width **≥ 1200px**. On tablet/mobile (< 1200px) the sidebar is already a slide-in drawer; this feature does not affect that behaviour.

### Collapsed state — Icon strip

When collapsed, the sidebar shrinks to **48px wide** and shows:
- Each category's emoji icon (`.category-icon`) centered, one per category, vertically stacked
- A **expand arrow** (→ or ›) anchored to the bottom of the strip
- No text labels, no category controls, no sidebar footer content

Clicking any icon navigates to that category (same as clicking the full category row).

### Expanded state

Default state — sidebar at full `--sidebar-width` (220px), normal appearance.

### Toggle control

- A **collapse button** (‹ chevron or similar) at the bottom of the expanded sidebar triggers collapse.
- The expand arrow at the bottom of the icon strip triggers expansion.
- Both buttons are visible only on desktop (≥ 1200px).

### Persistence

Collapsed/expanded state stored in `localStorage` under key `sidebarCollapsed`. Restored on page load before first render to avoid layout flash.

### CSS approach

- `.sidebar.collapsed` class controls the visual state.
- `width` transitions from `var(--sidebar-width)` → `var(--sidebar-collapsed-width)` with `transition: width 0.25s ease`. Define `--sidebar-collapsed-width: 48px` in `base.css` alongside `--sidebar-width`.
- Add `overflow: hidden` to `.sidebar` so content is naturally clipped as the width animates — no jarring snap.
- Hidden when collapsed (all via `display: none`):
  - `.sidebar.collapsed .category-name`
  - `.sidebar.collapsed .category-controls`
  - `.sidebar.collapsed .add-category`
  - `.sidebar.collapsed .toolbar-toggle`
  - `.sidebar.collapsed .spellcheck-toggle`
  - `.sidebar.collapsed .sidebar-footer`
  - `.sidebar.collapsed .frontpage-image`
- `.sidebar.collapsed` overrides sidebar padding to `padding: 12px 0` (removes horizontal padding so `48px` width is usable).
- `.sidebar.collapsed .category-icon` → always visible, centered (`display: flex; justify-content: center; width: 100%`).
- `.sidebar.collapsed .sidebar-scrollable` → `overflow: hidden` (prevents scrollbar appearing on the strip).
- All `.sidebar.collapsed` rules live inside `@media (min-width: 1200px)` — they are inert on tablet/mobile regardless of the class being present.
- If the viewport resizes below 1200px while `.collapsed` is set, the CSS media query scoping means the drawer behaviour from `responsive.css` takes over unaffected. No JS cleanup needed.
- `.main` does **not** need a margin-left change — it uses `flex-grow: 1` and expands naturally as the sidebar shrinks.

### CSS load order

Add `<link rel="stylesheet" href="css/sidebar-collapse.css" />` as the **last** stylesheet entry in `<head>`, after `settings-modal.css`. This ensures collapsed-state rules win any specificity ties.

### localStorage restoration — avoiding layout flash

Add an **inline synchronous `<script>` block** as the **first child inside `<div class="sidebar">`**. This is the only placement where `.sidebar` is guaranteed to be in the DOM at script parse time. Use `document.currentScript.parentElement` to reference it directly — no `querySelector`, no `DOMContentLoaded`:

```html
<div class="sidebar">
  <script>
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      document.currentScript.parentElement.classList.add('collapsed');
    }
  </script>
  <div class="frontpage-image">
```

This runs synchronously as the browser parses `.sidebar`, before any layout paint and before ES modules execute. The async ES module (`sidebarCollapse.js`) handles click events only — not initial state restoration.

### Category icon click delegation

In `ui.js`, click listeners are attached directly to each `.category` element (not via a parent delegate). Since `.category-icon` is a child of `.category`, clicks bubble up and fire the existing listener. **No new click listener needed.**

Note: `.category-controls` buttons inside each `.category` call `e.stopPropagation()`, but those controls are `display: none` in collapsed mode, so they cannot be clicked — no conflict.

### Collapse/expand button visibility during transition

No cross-fade required. The collapse button (shown in expanded state) gets `display: none` in `.sidebar.collapsed`. The expand arrow (shown in collapsed state) gets `display: none` by default and `display: flex` in `.sidebar.collapsed`. Simple instantaneous swap — the `overflow: hidden` on `.sidebar` keeps the transition visually clean.

### Files to change

| File | Change |
|------|--------|
| `frontend/js/quillEditor.js` | Replace `quillToolbarOptions` array |
| `frontend/css/base.css` | Add `--sidebar-collapsed-width: 48px` CSS custom property |
| `frontend/index.html` | Add collapse button to sidebar footer; add expand arrow (hidden by default, shown when collapsed); add inline script as first child inside `.sidebar`; add `<link>` for `sidebar-collapse.css` as last stylesheet |
| `frontend/js/sidebarCollapse.js` | New file — collapse/expand logic, localStorage sync |
| `frontend/js/main.js` | Import and init `sidebarCollapse.js` |
| `frontend/css/sidebar-collapse.css` | New file — collapsed state styles |

---

## Out of scope

- Mobile/tablet sidebar behaviour — unchanged
- Sidebar toggle checkbox — unchanged
- Any other toolbar buttons beyond the listed removals
- Icon tooltips on hover (nice-to-have, not in this spec)
