# Toolbar Trim & Desktop Sidebar Collapse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trim the Quill toolbar to 7 tools, and add a desktop-only sidebar collapse that reduces it to a 48px emoji icon strip.

**Architecture:** Two independent changes. Toolbar trim is a one-line config replacement. Sidebar collapse adds a new CSS file + JS module wired into `main.js`; an inline synchronous script in `index.html` restores collapsed state before first paint to prevent flash.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step), Quill.js 1.3.6 (CDN), localStorage for state persistence.

**Spec:** `docs/superpowers/specs/2026-03-23-toolbar-trim-sidebar-collapse-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `frontend/js/quillEditor.js` | Modify lines 21–29 | Replace toolbar config |
| `frontend/css/base.css` | Modify | Add `--sidebar-collapsed-width` variable |
| `frontend/css/sidebar-collapse.css` | Create | All collapsed-state styles |
| `frontend/index.html` | Modify | Add buttons, inline script, stylesheet link |
| `frontend/js/sidebarCollapse.js` | Create | Click handlers + localStorage sync |
| `frontend/js/main.js` | Modify | Import and init sidebarCollapse |

---

## Task 1: Trim the Quill toolbar

**Files:**
- Modify: `frontend/js/quillEditor.js:21-29`

This is a pure config replacement. No logic changes.

- [ ] **Step 1: Open `frontend/js/quillEditor.js` and locate the toolbar config**

  It's at lines 21–29:
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

- [ ] **Step 2: Replace with the trimmed config**

  ```js
  const quillToolbarOptions = [
    ["bold", "italic", "underline"],
    [{ header: 1 }, { header: 2 }],
    [{ list: "ordered" }],
    [{ color: [] }],
  ];
  ```

- [ ] **Step 3: Verify in the browser**

  Open the app. Open or create a note. The toolbar should show: **B I U | H1 H2 | 1. | A▾** — nothing else. The existing "Toolbar" checkbox in the sidebar should still show/hide this trimmed toolbar.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/js/quillEditor.js
  git commit -m "feat: trim Quill toolbar to bold/italic/underline/h1/h2/ordered-list/color"
  ```

---

## Task 2: Add CSS variable for collapsed width

**Files:**
- Modify: `frontend/css/base.css:4`

- [ ] **Step 1: Open `frontend/css/base.css` and add the variable**

  The `:root` block currently ends at line 11. Add `--sidebar-collapsed-width` on the line after `--sidebar-width`:

  ```css
  :root {
    --sidebar-width: 220px;
    --sidebar-collapsed-width: 48px;   /* ← add this line */
    --primary-color: #6200ee;
    ...
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/css/base.css
  git commit -m "feat: add --sidebar-collapsed-width CSS variable"
  ```

---

## Task 3: Create sidebar-collapse.css

**Files:**
- Create: `frontend/css/sidebar-collapse.css`

All rules are scoped to `@media (min-width: 1200px)` so they never affect mobile/tablet. The `overflow: hidden` on `.sidebar` ensures the width transition clips content smoothly instead of snapping.

- [ ] **Step 1: Create the file with all collapsed-state rules**

  ```css
  /* sidebar-collapse.css — Desktop-only sidebar collapse (icon strip mode) */
  /* All rules scoped to min-width: 1200px — no effect on tablet/mobile */

  @media (min-width: 1200px) {
    /* Enable smooth width transition; overflow:hidden clips content during animation */
    .sidebar {
      overflow: hidden;
      transition: width 0.25s ease;
    }

    /* Collapse button — shown in expanded state */
    .sidebar-collapse-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 8px 0;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-color);
      opacity: 0.5;
      font-size: 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    .sidebar-collapse-btn:hover {
      opacity: 1;
    }

    /* Expand arrow — hidden by default, shown when collapsed */
    .sidebar-expand-btn {
      display: none;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 8px 0;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-color);
      opacity: 0.5;
      font-size: 20px;
      margin-top: auto;
    }

    .sidebar-expand-btn:hover {
      opacity: 1;
    }

    /* ── Collapsed state ─────────────────────────────────── */

    .sidebar.collapsed {
      width: var(--sidebar-collapsed-width);
      padding: 12px 0;
    }

    /* Hide all text/control content */
    .sidebar.collapsed .category-name,
    .sidebar.collapsed .category-controls,
    .sidebar.collapsed .add-category,
    .sidebar.collapsed .toolbar-toggle,
    .sidebar.collapsed .spellcheck-toggle,
    .sidebar.collapsed .sidebar-footer,
    .sidebar.collapsed .frontpage-image {
      display: none;
    }

    /* Prevent scrollbar on the icon strip */
    .sidebar.collapsed .sidebar-scrollable {
      overflow: hidden;
    }

    /* Show category icons centered */
    .sidebar.collapsed .category-icon {
      display: flex;
      justify-content: center;
      width: 100%;
      padding: 8px 0;
      font-size: 20px;
      cursor: pointer;
    }

    /* Swap buttons */
    .sidebar.collapsed .sidebar-collapse-btn {
      display: none;
    }

    .sidebar.collapsed .sidebar-expand-btn {
      display: flex;
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/css/sidebar-collapse.css
  git commit -m "feat: add sidebar-collapse.css for desktop icon-strip mode"
  ```

---

## Task 4: Update index.html

**Files:**
- Modify: `frontend/index.html`

Three changes:
1. Add `<link>` for `sidebar-collapse.css` as the last stylesheet (line 72, after `settings-modal.css`)
2. Add a `<script>` block as the first child of `<body>` (before `<div class="sidebar">`) for flash-free state restore
3. Add collapse/expand buttons to `.sidebar`, just before `.sidebar-footer`

- [ ] **Step 1: Add the stylesheet link**

  In `<head>`, after the `settings-modal.css` line (currently line 72):
  ```html
  <link rel="stylesheet" href="css/settings-modal.css" />
  <link rel="stylesheet" href="css/sidebar-collapse.css" />   <!-- ← add -->
  ```

- [ ] **Step 2: Add flash-prevention inline script**

  Insert as the **first child inside `<div class="sidebar">`** (not before it). Placing the script inside the element means `document.currentScript.parentElement` reliably refers to `.sidebar` at parse time — no `querySelector`, no `DOMContentLoaded`, no race:

  ```html
  <div class="sidebar">
    <script>
      if (localStorage.getItem('sidebarCollapsed') === 'true') {
        document.currentScript.parentElement.classList.add('collapsed');
      }
    </script>
    <div class="frontpage-image">
  ```

  This runs synchronously as the browser parses `.sidebar`, before any layout paint and before ES modules execute. No null-dereference risk.

- [ ] **Step 3: Add collapse/expand buttons**

  Find the `.sidebar-footer` div (currently around line 118). Insert a new `div.sidebar-collapse-controls` immediately before it:

  ```html
      <div class="sidebar-collapse-controls">
        <button class="sidebar-collapse-btn" id="sidebarCollapseBtn" title="Collapse sidebar">&#8249;</button>
        <button class="sidebar-expand-btn" id="sidebarExpandBtn" title="Expand sidebar">&#8250;</button>
      </div>
      <div class="sidebar-footer">
  ```

  (`&#8249;` = ‹, `&#8250;` = ›)

- [ ] **Step 4: Verify structure**

  The sidebar HTML should now read (in order):
  1. `.frontpage-image`
  2. `.sidebar-scrollable` → `.categories`, `.add-category`, `.toolbar-toggle`, `.spellcheck-toggle`
  3. `.sidebar-collapse-controls` → `#sidebarCollapseBtn`, `#sidebarExpandBtn`
  4. `.sidebar-footer` → logout + settings buttons

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/index.html
  git commit -m "feat: add sidebar collapse/expand buttons and flash-prevention script"
  ```

---

## Task 5: Create sidebarCollapse.js

**Files:**
- Create: `frontend/js/sidebarCollapse.js`

This module only handles click events. Initial state is already applied by the inline script in `index.html`.

- [ ] **Step 1: Create the file**

  ```js
  // sidebarCollapse.js — Desktop sidebar collapse/expand logic
  // Initial collapsed state is restored by the inline script in index.html.
  // This module only wires up the toggle buttons.

  const STORAGE_KEY = 'sidebarCollapsed';

  function setSidebarCollapsed(collapsed) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed', collapsed);
    localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false');
  }

  export function initSidebarCollapse() {
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    const expandBtn = document.getElementById('sidebarExpandBtn');

    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => setSidebarCollapsed(true));
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', () => setSidebarCollapsed(false));
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/js/sidebarCollapse.js
  git commit -m "feat: add sidebarCollapse.js module"
  ```

---

## Task 6: Wire sidebarCollapse into main.js

**Files:**
- Modify: `frontend/js/main.js`

- [ ] **Step 1: Add the import at the top of `main.js`**

  After the existing imports (around line 16):
  ```js
  import { initSidebarToggles } from "./sidebarToggles.js";
  import { initSidebarCollapse } from "./sidebarCollapse.js";   // ← add
  ```

- [ ] **Step 2: Call `initSidebarCollapse()` inside `DOMContentLoaded`**

  Add it at the **top level of the `DOMContentLoaded` handler** — not inside any `setTimeout`. The buttons exist in the HTML from the start, so no delay is needed. Place it after the `setupMobileNavigation()` call (around line 74):

  ```js
  // Set up mobile navigation
  setupMobileNavigation();

  // Initialize desktop sidebar collapse (no delay — buttons are in HTML at parse time)
  initSidebarCollapse();   // ← add

  await updateUsernameDisplay();
  ```

- [ ] **Step 3: Verify end-to-end in the browser**

  - On a viewport **≥ 1200px**: clicking ‹ collapses the sidebar to a narrow icon strip; clicking › expands it. Category emoji icons are visible and clickable. Toolbar/spellcheck toggles, footer, and add-category button are hidden. State persists on page reload.
  - On a viewport **< 1200px**: the collapse/expand buttons are not visible; the hamburger drawer works as before. Resizing between breakpoints has no broken state.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/js/main.js
  git commit -m "feat: wire sidebar collapse into main.js init"
  ```

---

## Done

After all 6 tasks are committed:
- Quill toolbar is trimmed; existing toolbar visibility toggle still works.
- Desktop sidebar collapses to 48px icon strip; state persists across reloads; mobile/tablet unaffected.
