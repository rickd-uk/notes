# Category Edit Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ✏ icon button to the "All Notes" sidebar row that toggles category edit/delete controls on mobile (≤1199px), hidden by default, state persisted in localStorage.

**Architecture:** CSS hides `.category-controls` at ≤1199px via `display:none`; a `.edit-mode` class on the `.categories` container re-shows them. The ✏ button is injected by `renderCategories()` (which rebuilds innerHTML on every render) and re-activates from localStorage each time. Event delegation on the stable `.categories` DOM node handles clicks across re-renders.

**Tech Stack:** Vanilla JS ES modules, CSS media queries, localStorage

---

### Task 1: CSS — hide controls on mobile, add toggle button styles

**Files:**
- Modify: `frontend/css/categories.css`
- Modify: `frontend/css/responsive.css`

- [ ] **Step 1: Add base + mobile CSS to `categories.css`**

Append at the end of `frontend/css/categories.css`:

```css
/* Hide the edit toggle button on desktop — injected by JS unconditionally */
#categoryEditToggle {
  display: none;
}

/* Mobile/drawer: hide category controls by default, show in edit mode */
@media (max-width: 1199px) {
  .category-controls {
    display: none;
  }

  /* Suppress base hover rule so it can't fight display:none */
  .category:hover .category-controls {
    opacity: 0;
  }

  .categories.edit-mode .category-controls {
    display: flex;
    opacity: 1;
  }

  #categoryEditToggle {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    background: rgba(98, 0, 238, 0.12);
    color: #6200ee;
    border: none;
    border-radius: 6px;
    padding: 4px 7px;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    min-width: 28px;
    min-height: 28px;
  }

  #categoryEditToggle.active {
    background: #6200ee;
    color: #fff;
  }
}
```

- [ ] **Step 2: Remove conflicting opacity rules from `responsive.css`**

In `frontend/css/responsive.css`, find and remove these lines (currently around lines 122–129 inside `@media (max-width: 768px)`):

```css
  .category .category-controls {
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .category:active .category-controls {
    opacity: 1;
  }
```

- [ ] **Step 3: Verify visually in browser**

At ≤1199px (DevTools mobile emulation):
- Category rows show only icon + name — no edit/delete buttons visible
- No layout gaps where buttons used to be

At ≥1200px (desktop):
- ✏ button does NOT appear in the "All Notes" row
- Category controls still appear on hover as before (opacity-driven, not affected by this change)

- [ ] **Step 4: Commit**

```bash
git add frontend/css/categories.css frontend/css/responsive.css
git commit -m "style(categories): hide controls on mobile by default, add edit-mode CSS"
```

---

### Task 2: Inject ✏ button in `renderCategories()` and restore localStorage state

**Files:**
- Modify: `frontend/js/ui.js` (function `renderCategories`, lines ~296–389)

- [ ] **Step 1: Add ✏ button to the "All Notes" row template**

In `frontend/js/ui.js`, inside `renderCategories()`, find the `innerHTML` assignment (around line 318). Change the "All Notes" row from:

```js
  categoriesContainer.innerHTML = `
<div class="category${currentCategoryId === "all" ? " active" : ""}" data-id="all">
  <div class="category-icon">📄</div>
  <div class="category-name">All Notes</div>
</div>
```

to:

```js
  categoriesContainer.innerHTML = `
<div class="category${currentCategoryId === "all" ? " active" : ""}" data-id="all">
  <div class="category-icon">📄</div>
  <div class="category-name">All Notes</div>
  <button id="categoryEditToggle" title="Toggle category editing">✏</button>
</div>
```

- [ ] **Step 2: Restore localStorage state immediately after the innerHTML assignment**

Still in `renderCategories()`, add this block **immediately after** the `categoriesContainer.innerHTML = ...` assignment (before the `querySelectorAll` listener loop at ~line 368):

```js
  // Restore edit-mode toggle state from localStorage
  const editModeActive = localStorage.getItem('categoryEditMode') === 'true';
  if (editModeActive) {
    categoriesContainer.classList.add('edit-mode');
    const toggleBtn = document.getElementById('categoryEditToggle');
    if (toggleBtn) toggleBtn.classList.add('active');
  } else {
    categoriesContainer.classList.remove('edit-mode');
  }
```

- [ ] **Step 3: Verify in browser**

Resize to ≤1199px. Confirm:
- The ✏ button appears at the right end of the "All Notes" row
- Button is styled with subtle purple background (off state)
- No controls visible on other categories (toggle is off by default)

Set `localStorage.setItem('categoryEditMode', 'true')` in DevTools console, then reload. Confirm:
- ✏ button has filled purple background
- Edit/delete buttons are visible on all user-created categories

- [ ] **Step 4: Commit**

```bash
git add frontend/js/ui.js
git commit -m "feat(ui): inject category edit toggle button and restore state in renderCategories"
```

---

### Task 3: Wire up toggle click in `setupEventListeners()`

**Files:**
- Modify: `frontend/js/eventHandlers.js` (function `setupEventListeners`, line ~104)

- [ ] **Step 1: Add event delegation for the toggle button**

In `frontend/js/eventHandlers.js`, inside `setupEventListeners()` (line 104), add the following block after the existing event listener setups (e.g. after the `addCategoryBtn` block):

```js
  // Category edit mode toggle (mobile only — button is injected by renderCategories)
  const categoriesContainer = document.querySelector('.categories');
  if (categoriesContainer) {
    categoriesContainer.addEventListener('click', (e) => {
      if (e.target.id !== 'categoryEditToggle') return;
      e.stopPropagation();
      const isActive = categoriesContainer.classList.toggle('edit-mode');
      e.target.classList.toggle('active', isActive);
      localStorage.setItem('categoryEditMode', String(isActive));
    });
  }
```

- [ ] **Step 2: Verify the full toggle flow in browser**

Resize to ≤1199px. Confirm:
1. ✏ button is subtle (off state) on page load
2. Tap ✏ → button turns filled purple, edit/delete controls appear on all user-created categories
3. Tap ✏ again → button returns to subtle style, controls hide
4. Refresh page → state is restored (if was on, stays on; if was off, stays off)
5. Add a new category while edit mode is on → new category immediately shows its controls
6. Resize to ≥1200px → ✏ button is not visible; hover over a category row → edit/delete controls appear as normal

- [ ] **Step 3: Commit**

```bash
git add frontend/js/eventHandlers.js
git commit -m "feat(eventHandlers): wire category edit mode toggle with localStorage persistence"
```
