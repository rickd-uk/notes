# Category Display Cleanup — Design Spec

**Date:** 2026-03-23

---

## Goal

Three small UX improvements:
1. Hide the per-note category badge except in "All Notes" view (where it's informative).
2. Show the active category name in the notes header when the sidebar is not visible.
3. Add spacing between the Logout and Settings buttons in the sidebar footer.

---

## 1. Category Badge Visibility

### Current behaviour

Every note card renders a `.note-category` div (icon + category name) regardless of which category is being viewed. In a single-category view this is redundant — every badge shows the same thing.

### New behaviour

- **"All Notes" view** (`currentCategoryId === 'all'`): badges visible (notes may belong to different categories).
- **All other views**: badges hidden.

### Implementation

In `renderNotes()` (`frontend/js/ui.js`), after setting note-count classes on `notesContainer`, add or remove a `view-all` class:

```js
if (getCurrentCategoryId() === 'all') {
  notesContainer.classList.add('view-all');
} else {
  notesContainer.classList.remove('view-all');
}
```

`renderNotes()` is called after every `loadNotes()`, which covers both initial load and category switches — no additional call sites needed.

CSS rule (add to `frontend/css/note-category-selector.css`):

```css
/* Hide category badge when viewing a single category */
.notes-container:not(.view-all) .note-category {
  display: none;
}
```

---

## 2. Current Category in Header

### Current behaviour

`.notes-header` contains: hamburger button, username display, add-note button. No category context is shown.

`state.js` already has `currentCategoryElement: document.querySelector('.current-category')` (line 16) and `layout.css` already has base styles for `.current-category` — but the element has never been added to the HTML.

### New behaviour

A `<div class="current-category">` in `.notes-header` shows the active category's icon and name. Visibility:

| Situation | Visible? |
|-----------|----------|
| Desktop (≥1200px), sidebar expanded | No |
| Desktop (≥1200px), sidebar collapsed (`.sidebar.collapsed`) | Yes |
| Tablet / mobile (<1200px) | Yes (sidebar is a drawer, closed by default) |

Content: `{icon} {name}` — e.g. `💼 Work`, `📄 All Notes`, `📌 Uncategorized`.

### HTML change

Add to `.notes-header` in `frontend/index.html`, after the hamburger button:

```html
<button class="nav-toggle" id="navToggleBtn" aria-label="Toggle sidebar">&#9776;</button>
<div class="current-category"></div>
```

`elements.currentCategoryElement` in `state.js` will resolve correctly once the element exists in the static HTML (modules are imported after DOM parsing).

### JS: populate the element

Add `updateCurrentCategoryDisplay()` to `frontend/js/ui.js`:

```js
export function updateCurrentCategoryDisplay() {
  const el = elements.currentCategoryElement;
  if (!el) return;
  const categoryId = getCurrentCategoryId();
  if (categoryId === 'all') {
    el.textContent = '📄 All Notes';
  } else if (categoryId === 'uncategorized') {
    el.textContent = '📌 Uncategorized';
  } else {
    const cats = getCategories();
    const cat = cats.find(c => String(c.id) === String(categoryId));
    el.textContent = cat ? `${cat.icon || '📁'} ${cat.name}` : '';
  }
}
```

`getCategories()` must be imported from `state.js` (verify the export exists; it is the getter for the categories array in state).

Call `updateCurrentCategoryDisplay()` at the **end of `renderNotes()`** in `ui.js`. This covers both initial page load and every category switch, since `renderNotes()` is always called after `loadNotes()`.

### CSS: visibility rules

Add to `frontend/css/sidebar-collapse.css` (already loaded last, scoped to desktop):

```css
@media (min-width: 1200px) {
  /* Hide when sidebar is expanded */
  .current-category {
    display: none;
  }

  /* Show when sidebar is collapsed */
  .sidebar.collapsed ~ .main .current-category {
    display: block;
  }
}
```

**Tablet/mobile (< 1200px):** The existing `@media (max-width: 768px)` rule in `responsive.css` absolutely-positions `.current-category` centred in the header. Extend this rule to cover the full sub-desktop range by changing the media query from `max-width: 768px` to `max-width: 1199px`:

```css
/* responsive.css — extend existing .current-category block */
@media (max-width: 1199px) {
  .current-category {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    z-index: 1;
    pointer-events: none;
  }
}
```

This keeps `.current-category` centred in the header on all sub-desktop widths (tablet 769–1199px and mobile ≤768px), consistent with the existing mobile design, and avoids any flex-layout conflicts with `.user-info` and the other header children.

---

## 3. Logout / Settings Button Spacing

### Current behaviour

`.sidebar-footer` in `layout.css`:

```css
.sidebar-footer {
  padding: 10px 20px;
  margin-top: 10px;
  border-top: 1px solid #e0e0e0;
}
```

Buttons sit adjacent with no gap — easy to misclick.

### New behaviour

Add `display: flex` and `gap: 16px` so the buttons have clear separation:

```css
.sidebar-footer {
  padding: 10px 20px;
  margin-top: 10px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 16px;
}
```

---

## Files to Change

| File | Change |
|------|--------|
| `frontend/index.html` | Add `<div class="current-category"></div>` after `#navToggleBtn` in `.notes-header` |
| `frontend/js/ui.js` | Toggle `view-all` class in `renderNotes()`; add and call `updateCurrentCategoryDisplay()` |
| `frontend/css/note-category-selector.css` | Add `.notes-container:not(.view-all) .note-category { display: none; }` |
| `frontend/css/sidebar-collapse.css` | Add `.current-category` desktop visibility rules |
| `frontend/css/responsive.css` | Extend `.current-category` absolute-centering from `max-width: 768px` → `max-width: 1199px` |
| `frontend/css/layout.css` | Add `display: flex; align-items: center; gap: 16px` to `.sidebar-footer` |

---

## Out of Scope

- Changing the note-category badge design or content
- Animating the category label in/out
- Showing category in the title bar or page title
