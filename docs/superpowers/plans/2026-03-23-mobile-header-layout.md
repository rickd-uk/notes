# Mobile Header & Layout Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the hamburger button into the header bar, make search/sort/username larger on all screens, cap note grids at 2 columns below 1200px, and set mobile note height to 45vh so exactly 2 fit on screen.

**Architecture:** Pure CSS and minimal JS changes — no new files needed. The hamburger moves from a dynamically-created fixed element to a static HTML button shown/hidden by a single CSS media query at 1199px. Grid caps and height changes are a new `@media (max-width: 1199px)` block in `layout.css`. Control sizing is updated in `note-controls.css` and `components.css`.

**Tech Stack:** Vanilla HTML, CSS, JavaScript (ES modules). No build step. No automated test suite — verification is manual in the browser.

---

## File Map

| File | Change |
|------|--------|
| `frontend/index.html` | Add `#navToggleBtn` as first child of `.notes-header` |
| `frontend/js/responsive.js` | Remove dynamic button creation; wire to `#navToggleBtn`; fix breakpoints to 1199px; remove inline style.display |
| `frontend/js/eventHandlers.js` | Update `handleCategoryClick` sidebar-close check from 768 to 1199 |
| `frontend/css/components.css` | Remove entire `.nav-toggle` block; update `.username-display` sizes |
| `frontend/css/responsive.css` | Remove `.nav-toggle` from 768px block; add single rule at 1199px; set header min-height 56px |
| `frontend/css/note-controls.css` | Increase `.header-control-btn` from 32px to 38px, font-size 16px to 18px |
| `frontend/css/layout.css` | Replace `@media (max-width: 1200px)` with comprehensive `@media (max-width: 1199px)` 2-column cap; change mobile note height 35vh → 45vh |

---

## Task 1: Add hamburger to HTML and fix responsive.js

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/js/responsive.js`
- Modify: `frontend/js/eventHandlers.js`

Read all three files before editing.

- [ ] **Step 1: Add `#navToggleBtn` to `index.html`**

Inside `.notes-header`, add the button as the **first child**, before the `.user-info` div:

```html
<div class="notes-header">
  <button class="nav-toggle" id="navToggleBtn" aria-label="Toggle sidebar">&#9776;</button>
  <div class="user-info">
    <span class="username-display" id="usernameDisplay">Loading...</span>
  </div>
  <button class="add-note-btn" id="addNoteBtn">+</button>
</div>
```

- [ ] **Step 2: Update `setupMobileNavigation()` in `responsive.js`**

Remove the dynamic button creation block (the `if (!document.querySelector('.nav-toggle'))` block, lines 7–13). The overlay creation stays. Change the `navToggle` reference from `document.querySelector('.nav-toggle')` to `document.getElementById('navToggleBtn')`.

Also update `closeSidebarAfterSelection()` (line 96) — change `window.innerWidth <= 768` to `window.innerWidth <= 1199` so the sidebar also closes on tablet after category selection.

Also update `setupCategoryClickEvents()` (line 64) — change `window.innerWidth <= 768` to `window.innerWidth <= 1199`.

The full updated `setupMobileNavigation()`:

```javascript
export function setupMobileNavigation() {
  // Create sidebar overlay if it doesn't exist
  if (!document.querySelector('.sidebar-overlay')) {
    const sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'sidebar-overlay';
    document.body.appendChild(sidebarOverlay);
  }

  const sidebar = document.querySelector('.sidebar');
  const navToggle = document.getElementById('navToggleBtn');
  const sidebarOverlay = document.querySelector('.sidebar-overlay');

  function toggleSidebar() {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
  }

  if (navToggle) {
    navToggle.addEventListener('click', toggleSidebar);
  }
  sidebarOverlay.addEventListener('click', toggleSidebar);

  setupCategoryClickEvents();

  let previousWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const currentWidth = window.innerWidth;
    if ((previousWidth <= 1199 && currentWidth > 1199) ||
        (previousWidth > 1199 && currentWidth <= 1199)) {
      sidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    previousWidth = currentWidth;
  });
}
```

Updated `closeSidebarAfterSelection()`:

```javascript
function closeSidebarAfterSelection() {
  if (window.innerWidth <= 1199) {
    setTimeout(() => {
      const sidebar = document.querySelector('.sidebar');
      const sidebarOverlay = document.querySelector('.sidebar-overlay');
      if (sidebar && sidebarOverlay) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    }, 100);
  }
}
```

Updated `setupCategoryClickEvents()` — change the guard condition:

```javascript
export function setupCategoryClickEvents() {
  if (window.innerWidth <= 1199) {
    // ... rest unchanged
```

- [ ] **Step 3: Update `handleScreenResize()` in `responsive.js`**

Replace the function body. Remove the `navToggle.style.display` inline manipulation — CSS handles show/hide now. Update the `isMobile` check to 1199px:

```javascript
export function handleScreenResize() {
  const isMobile = window.innerWidth <= 1199;
  document.body.classList.toggle('mobile-view', isMobile);
  setupCategoryClickEvents();
}
```

- [ ] **Step 4: Fix `handleCategoryClick` in `eventHandlers.js`**

In `handleCategoryClick()` (around line 290), the sidebar close check uses `window.innerWidth <= 768`. Change to `<= 1199` so the sidebar closes on tablet too:

Find:
```javascript
  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
```

Replace with:
```javascript
  // Close sidebar on mobile and tablet
  if (window.innerWidth <= 1199) {
```

- [ ] **Step 5: Verify structure looks correct**

Open `frontend/index.html` and confirm `#navToggleBtn` is the first child of `.notes-header`. Open `responsive.js` and confirm there is no `document.createElement` for the nav toggle.

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html frontend/js/responsive.js frontend/js/eventHandlers.js
git -c commit.gpgsign=false commit -m "feat: move hamburger to header bar, fix breakpoints to 1199px"
```

---

## Task 2: CSS — Hamburger show/hide and header height

**Files:**
- Modify: `frontend/css/components.css`
- Modify: `frontend/css/responsive.css`

Read both files before editing.

- [ ] **Step 1: Remove `.nav-toggle` block from `components.css`**

Remove the entire `.nav-toggle` CSS block including the `@media (max-width: 768px)` override. The block looks like this (remove all of it):

```css
/* Nav toggle for mobile */
.nav-toggle {
    display: none;
    position: fixed;
    top: 10px;
    left: 10px;
    width: 40px;
    height: 40px;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 50%;
    z-index: 100;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    align-items: center;
    justify-content: center;
    font-size: 20px;
}
```

And in the `@media (max-width: 768px)` block further down:
```css
    /* Show the nav toggle for mobile */
    .nav-toggle {
        display: flex;
    }
```

Remove both of these.

- [ ] **Step 2: Add new `.nav-toggle` rules to `responsive.css`**

Remove the existing `.nav-toggle { display: flex; }` line from inside the `@media (max-width: 768px)` block in `responsive.css`.

Then add a new block at the **top** of `responsive.css` (before the `@media (max-width: 768px)` block), giving the canonical base + show rules:

```css
/* Hamburger button — hidden on desktop, shown on tablet and mobile */
.nav-toggle {
    display: none;
    width: 40px;
    height: 40px;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

@media (max-width: 1199px) {
    .nav-toggle {
        display: flex;
    }
}
```

- [ ] **Step 3: Set header min-height and flex alignment**

In `responsive.css`, inside the existing `@media (max-width: 768px)` block, the `.notes-header` rule has `padding-left: 50px` to leave space for the old fixed hamburger. Remove that padding — the hamburger is now inline in the flex row. Update the `.notes-header` rule:

```css
  .notes-header {
    position: relative;
    justify-content: space-between;
    align-items: center;
    padding: 0 12px;
    min-height: 56px;
  }
```

Also add a base (non-media-query) rule for `.notes-header` min-height at the top of `responsive.css`:

```css
.notes-header {
    min-height: 56px;
    align-items: center;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/css/components.css frontend/css/responsive.css
git -c commit.gpgsign=false commit -m "refactor: move nav-toggle CSS to responsive.css, show at 1199px, set header height 56px"
```

---

## Task 3: CSS — Bigger search/sort buttons and username badge

**Files:**
- Modify: `frontend/css/note-controls.css`
- Modify: `frontend/css/components.css`

Read both files before editing.

- [ ] **Step 1: Increase `.header-control-btn` size in `note-controls.css`**

Find the `.header-control-btn` base rule (lines 5–21). Change `width`/`height` from `32px` to `38px` and `font-size` from `16px` to `18px`:

```css
.header-control-btn {
  background: none;
  border: none;
  cursor: pointer;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 4px;
  font-size: 18px;
  color: var(--text-color);
  transition:
    background-color 0.2s,
    color 0.2s;
}
```

Also check the `@media (max-width: 768px)` and `@media (max-width: 480px)` overrides for `.header-control-btn` in `note-controls.css` (lines 245 and 283) — if they set smaller sizes, update them to also use `38px`/`18px` or remove the overrides if they were only reducing from the old 32px.

- [ ] **Step 2: Update `.username-display` in `components.css`**

Find the mobile `@media (max-width: 768px)` block that sets `.username-display`. Change:
- `font-size: 12px` → `font-size: 13px`
- `max-width: 100px` → `max-width: 120px`
- `padding: 4px 8px` → `padding: 5px 10px`

Also update the base `.username-display` rule (not inside a media query):
- `font-size: 14px` (was `14px` — confirm and keep or increase slightly)
- `max-width: 150px` → `max-width: 160px`

For the `@media (max-width: 480px)` override:
- `max-width: 80px` → `max-width: 100px`

- [ ] **Step 3: Add background to `.header-controls-group` for visibility**

In `note-controls.css`, the `.header-controls-group` has `background-color: rgba(0, 0, 0, 0.03)`. This is nearly invisible. Update to use a slightly more visible background that works in both light and dark mode:

```css
.header-controls-group {
  display: flex;
  align-items: center;
  margin-right: 12px;
  background-color: rgba(128, 128, 128, 0.08);
  padding: 4px 6px;
  border-radius: 10px;
  gap: 2px;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/css/note-controls.css frontend/css/components.css
git -c commit.gpgsign=false commit -m "feat: increase header control buttons to 38px, larger username badge"
```

---

## Task 4: CSS — Notes grid 2-column cap and mobile note height

**Files:**
- Modify: `frontend/css/layout.css`

Read `frontend/css/layout.css` before editing.

- [ ] **Step 1: Replace `@media (max-width: 1200px)` block**

Find and remove the existing `@media (max-width: 1200px)` block (currently around line 248):

```css
/* Medium screen optimization */
@media (max-width: 1200px) {
    /* Three notes: 2 on top, 1 on bottom */
    .notes-container.note-count-3 {
        grid-template-columns: 1fr 1fr;
    }

    .notes-container.note-count-3 .note:nth-child(3) {
        grid-column: 1 / 3;
    }
}
```

Replace it with a comprehensive `@media (max-width: 1199px)` block that caps **all** note-count classes at 2 columns, including `note-count-many`:

```css
/* Tablet and below: max 2 columns */
@media (max-width: 1199px) {
    .notes-container.note-count-3 {
        grid-template-columns: 1fr 1fr !important;
        grid-template-rows: auto !important;
    }

    .notes-container.note-count-3 .note:nth-child(3) {
        grid-column: 1 / span 2 !important;
    }

    .notes-container.note-count-4,
    .notes-container.note-count-5,
    .notes-container.note-count-6,
    .notes-container.note-count-7,
    .notes-container.note-count-8,
    .notes-container.note-count-9 {
        grid-template-columns: 1fr 1fr !important;
        grid-template-rows: auto !important;
    }

    .notes-container.note-count-many {
        grid-template-columns: repeat(2, 1fr) !important;
    }

    /* Reset any 3-col nth-child spans */
    .notes-container.note-count-5 .note:nth-child(4),
    .notes-container.note-count-5 .note:nth-child(5) {
        grid-column: auto !important;
    }
}
```

- [ ] **Step 2: Update mobile note height from 35vh to 45vh**

In the `@media (max-width: 768px)` block (around line 298), find:

```css
    .notes-container.note-count-2 .note,
    .notes-container.note-count-3 .note,
    .notes-container.note-count-4 .note,
    .notes-container.note-count-5 .note,
    .notes-container.note-count-6 .note,
    .notes-container.note-count-7 .note,
    .notes-container.note-count-8 .note,
    .notes-container.note-count-9 .note,
    .notes-container.note-count-many .note {
        min-height: 35vh !important;
    }
```

Change `35vh` to `45vh`:

```css
    .notes-container.note-count-2 .note,
    .notes-container.note-count-3 .note,
    .notes-container.note-count-4 .note,
    .notes-container.note-count-5 .note,
    .notes-container.note-count-6 .note,
    .notes-container.note-count-7 .note,
    .notes-container.note-count-8 .note,
    .notes-container.note-count-9 .note,
    .notes-container.note-count-many .note {
        min-height: 45vh !important;
    }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/css/layout.css
git -c commit.gpgsign=false commit -m "feat: cap note grid at 2 columns below 1200px, 45vh note height on mobile"
```

---

## Task 5: Manual Verification

No automated test suite. Verify in the browser (run `docker compose up` or your local dev server).

- [ ] **Mobile (≤ 768px) — DevTools or phone**
  - Hamburger ≡ appears inside the header bar (not floating over content)
  - No overlap between hamburger and category list when sidebar opens
  - Tapping hamburger opens/closes sidebar
  - Tapping a category closes the sidebar
  - Search 🔍 and sort ↕ buttons are 38px circular targets, easy to tap
  - Username badge is readable (not truncated after 80px)
  - Notes: exactly 2 fill the screen height comfortably
  - Notes: single-column layout

- [ ] **Tablet (769px – 1199px) — DevTools resize**
  - Hamburger still visible in header
  - Sidebar is a slide-out drawer (not always visible)
  - Notes show max 2 columns
  - Tapping a category closes the sidebar

- [ ] **Desktop (≥ 1200px)**
  - Hamburger is hidden (no button in header)
  - Sidebar always visible (no drawer)
  - Notes show up to 3 columns
  - Search/sort buttons larger than before
  - Username badge more readable

- [ ] **Edge case: resize across 1200px threshold**
  - Widen from tablet to desktop: sidebar resets (closes drawer state)
  - Narrow from desktop to tablet: hamburger reappears
