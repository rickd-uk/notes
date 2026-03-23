# Sidebar Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move infrequent sidebar actions (Dark Mode, Change Password, Delete All Categories) into a settings modal/bottom-sheet opened by a ⚙ icon, while keeping Logout and the Toolbar/Spell Check toggles directly in the sidebar with a sticky footer.

**Architecture:** A new `#settingsModal` follows the existing `.modal` / `.modal-content` / `.active` pattern. On mobile (< 768px) it renders as a bottom sheet (slides up from the bottom); on desktop (≥ 768px) it's a centered dialog. The sidebar gets a `.sidebar-scrollable` wrapper for the category list and toggles, with a sticky `sidebar-footer` pinned at the bottom containing only Logout and the ⚙ gear icon.

**Tech Stack:** Vanilla HTML, CSS, JavaScript (ES modules). No build step. No test framework — verification is manual in the browser.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/css/settings-modal.css` | **Create** | All styles for the settings modal/bottom-sheet, gear icon button, section labels, danger button |
| `frontend/index.html` | **Modify** | Add CSS link; wrap sidebar content in scrollable div; replace sidebar footer; add settings modal HTML; move darkModeToggle into modal |
| `frontend/css/components.css` | **Modify** | Remove `.delete-all-btn` and `.change-password-link` styles; update `.sidebar-footer` to flex-row; fix `.logout-btn` width |
| `frontend/js/eventHandlers.js` | **Modify** | Remove dynamic button injection; wire settings modal open/close/escape; wire static deleteAllCategoriesBtn |

---

## Task 1: Create `frontend/css/settings-modal.css`

**Files:**
- Create: `frontend/css/settings-modal.css`

- [ ] **Step 1: Create the file**

```css
/* settings-modal.css - Settings modal / bottom-sheet */

/* Gear icon button in sidebar footer */
.settings-btn {
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 22px;
    cursor: pointer;
    padding: 6px 8px;
    opacity: 0.65;
    transition: opacity 0.2s;
    line-height: 1;
}

.settings-btn:hover {
    opacity: 1;
}

/* Modal header row */
.settings-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.settings-modal-title {
    font-size: 18px;
    font-weight: 600;
}

.settings-modal-close {
    background: none;
    border: none;
    color: #888;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.2s;
}

.settings-modal-close:hover {
    color: var(--text-color);
}

/* Section */
.settings-section {
    margin-bottom: 20px;
}

.settings-section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #888;
    margin-bottom: 10px;
}

.settings-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
}

/* Account link button */
.settings-link-btn {
    display: block;
    width: 100%;
    padding: 10px 12px;
    background-color: transparent;
    color: var(--text-color);
    border: 1px solid #e0e0e0;
    border-radius: var(--border-radius);
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    text-decoration: none;
    transition: background-color 0.2s;
    box-sizing: border-box;
}

.settings-link-btn:hover {
    background-color: rgba(0, 0, 0, 0.04);
}

/* Danger zone button */
.settings-danger-btn {
    width: 100%;
    padding: 10px 12px;
    background-color: transparent;
    color: #f44336;
    border: 1px solid #f44336;
    border-radius: var(--border-radius);
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    transition: background-color 0.2s;
}

.settings-danger-btn:hover {
    background-color: rgba(244, 67, 54, 0.05);
}

/* Dark mode overrides */
body.dark-mode .settings-link-btn {
    border-color: #444;
}

body.dark-mode .settings-link-btn:hover {
    background-color: rgba(255, 255, 255, 0.05);
}

body.dark-mode .settings-danger-btn {
    color: #ff6b6b;
    border-color: #ff6b6b;
}

body.dark-mode .settings-danger-btn:hover {
    background-color: rgba(255, 107, 107, 0.1);
}

/* Desktop: standard centered modal — .modal-content defaults from modals.css apply */
#settingsModal .modal-content {
    max-width: 360px;
}

/* Drag handle bar — hidden on desktop, shown on mobile */
.modal-drag-handle {
    display: none;
    width: 36px;
    height: 4px;
    background-color: #555;
    border-radius: 2px;
    margin: 0 auto 16px;
}

/* Mobile: bottom sheet */
@media (max-width: 768px) {
    #settingsModal {
        align-items: flex-end;
    }

    #settingsModal .modal-content {
        max-width: 100%;
        width: 100%;
        border-radius: 12px 12px 0 0;
        transform: translateY(40px);
        padding-bottom: 28px;
    }

    #settingsModal.active .modal-content {
        transform: translateY(0);
    }

    .modal-drag-handle {
        display: block;
    }
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls frontend/css/settings-modal.css
```
Expected: file exists.

---

## Task 2: Update `frontend/index.html`

**Files:**
- Modify: `frontend/index.html`

Read `frontend/index.html` before editing.

- [ ] **Step 1: Add the CSS link**

Add after the last `<link>` in `<head>` (currently line 71, after `note-controls.css`):

```html
    <link rel="stylesheet" href="css/settings-modal.css" />
```

- [ ] **Step 2: Wrap scrollable sidebar content**

The sidebar currently has these direct children in order:
1. `.frontpage-image`
2. `.categories`
3. `.add-category`
4. `.toolbar-toggle`
5. `.spellcheck-toggle`
6. `.dark-mode-toggle`
7. `.sidebar-footer`

Wrap items 2–5 (`.categories` through `.spellcheck-toggle`) in a new `<div class="sidebar-scrollable">`. Remove the `.dark-mode-toggle` div entirely (it moves into the modal). The result inside `.sidebar` should be:

```html
    <div class="sidebar">
      <div class="frontpage-image">
        <!--  <img src="images/simple-notes.png" alt="Simple Notes"
        onerror="this.outerHTML='<div class=\'fallback-text\'>Welcome to Simple Notes!</div>'" >

         -->
      </div>

      <div class="sidebar-scrollable">
        <div class="categories">
          <div class="category active" data-id="all">
            <div class="category-icon">📄</div>
            <div class="category-name">All Notes</div>
          </div>
          <div class="category" data-id="uncategorized">
            <div class="category-icon">📌</div>
            <div class="category-name">Uncategorized</div>
          </div>
          <!-- Custom categories will be added here -->
        </div>
        <div class="add-category">
          <button class="add-category-btn" id="addCategoryBtn">
            + Add Category
          </button>
        </div>

        <!-- Toolbar Toggle (Main Page Only) -->
        <div class="toolbar-toggle">
          <span class="toolbar-label">Toolbar</span>
          <label class="switch">
            <input type="checkbox" id="sidebarToolbarToggle" />
            <span class="slider"></span>
          </label>
        </div>

        <!-- Spell Check Toggle (Main Page Only) -->
        <div class="spellcheck-toggle">
          <span class="spellcheck-label">Spell Check</span>
          <label class="switch">
            <input type="checkbox" id="sidebarSpellCheckToggle" />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="sidebar-footer">
        <button id="logoutBtn" class="logout-btn">Logout</button>
        <button id="settingsBtn" class="settings-btn" title="Settings">⚙</button>
      </div>
    </div>
```

- [ ] **Step 3: Add the settings modal HTML**

Add the following block immediately after the closing `</div>` of `#confirmModal` (currently around line 301):

```html
    <!-- Settings Modal -->
    <div class="modal" id="settingsModal">
      <div class="modal-content">
        <div class="modal-drag-handle"></div>
        <div class="settings-modal-header">
          <span class="settings-modal-title">⚙ Settings</span>
          <button class="settings-modal-close" id="settingsModalCloseBtn">✕</button>
        </div>

        <!-- Appearance -->
        <div class="settings-section">
          <div class="settings-section-label">Appearance</div>
          <div class="settings-row">
            <span>🌙 Dark Mode</span>
            <label class="switch">
              <input type="checkbox" id="darkModeToggle" />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- Account -->
        <div class="settings-section">
          <div class="settings-section-label">Account</div>
          <a href="/change-password.html" class="settings-link-btn">🔑 Change Password</a>
        </div>

        <!-- Danger Zone -->
        <div class="settings-section">
          <div class="settings-section-label" style="color: #f44336;">Danger Zone</div>
          <button id="deleteAllCategoriesBtn" class="settings-danger-btn">🗑 Delete All Categories</button>
        </div>
      </div>
    </div>
```

- [ ] **Step 4: Verify HTML structure looks correct**

Open `frontend/index.html` and confirm:
- `.sidebar-scrollable` wraps `.categories`, `.add-category`, `.toolbar-toggle`, `.spellcheck-toggle`
- `.dark-mode-toggle` div is gone from the sidebar
- `.sidebar-footer` contains only `#logoutBtn` and `#settingsBtn`
- `#settingsModal` exists after `#confirmModal`
- `id="darkModeToggle"` is now inside `#settingsModal`
- `settings-modal.css` link is in `<head>`

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/css/settings-modal.css
git -c commit.gpgsign=false commit -m "feat: add settings modal HTML and CSS"
```

---

## Task 3: Update `frontend/css/components.css`

**Files:**
- Modify: `frontend/css/components.css`

Read `frontend/css/components.css` before editing.

- [ ] **Step 1: Remove `.delete-all-btn` styles**

Remove the entire block from `/* Delete All Categories button */` through the dark mode rules (approximately lines 97–130):

```css
/* Delete All Categories button */
.delete-all-btn {
    width: 100%;
    padding: 8px 0;
    background-color: transparent;
    color: #f44336;
    border: 1px solid #f44336;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.2s;
    font-weight: 600;
    margin-bottom: 10px;
}

.delete-all-btn:hover {
    background-color: rgba(244, 67, 54, 0.05);
}

/* To add spacing between buttons */
.sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

/* Dark mode support */
body.dark-mode .delete-all-btn {
    color: #ff6b6b;
    border-color: #ff6b6b;
}

body.dark-mode .delete-all-btn:hover {
    background-color: rgba(255, 107, 107, 0.1);
}
```

- [ ] **Step 2: Add updated `.sidebar-footer` and `.logout-btn` styles**

In place of the removed `.sidebar-footer` block, add:

```css
/* Sidebar sticky footer */
.sidebar-footer {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
```

Also update `.logout-btn` — change `width: 100%` to `width: auto` and add `flex: 1` so it fills remaining space beside the gear icon:

Old:
```css
.logout-btn {
    width: 100%;
    padding: 8px 0;
    background-color: transparent;
    color: #f44336;
    border: 1px solid #f44336;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.2s;
    font-weight: 600;
}
```

New:
```css
.logout-btn {
    flex: 1;
    padding: 8px 0;
    background-color: transparent;
    color: #f44336;
    border: 1px solid #f44336;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.2s;
    font-weight: 600;
}
```

- [ ] **Step 3: Remove `.change-password-link` styles**

Remove the block (approximately lines 258–273):

```css
/* Change Password Link */
.change-password-link {
    display: block;
    text-align: center;
    padding: 8px 0;
    color: var(--text-color);
    text-decoration: none;
    font-size: 14px;
    opacity: 0.8;
    transition: opacity 0.2s;
}

.change-password-link:hover {
    opacity: 1;
    text-decoration: underline;
}
```

- [ ] **Step 4: Add `.sidebar-scrollable` styles**

Add at the end of `components.css`:

```css
/* Sidebar scrollable content area */
.sidebar-scrollable {
    flex: 1;
    overflow-y: auto;
    min-height: 0; /* Required for flex children to scroll */
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/css/components.css
git -c commit.gpgsign=false commit -m "refactor: update sidebar footer and cleanup removed styles"
```

---

## Task 4: Update `frontend/js/eventHandlers.js`

**Files:**
- Modify: `frontend/js/eventHandlers.js`

Read `frontend/js/eventHandlers.js` before editing.

- [ ] **Step 1: Remove the dynamic `deleteAllCategoriesBtn` injection**

In `setupEventListeners()`, remove lines 154–174 entirely:

```javascript
  if (sidebarFooter) {
    // Check if the button already exists
    if (!document.getElementById("deleteAllCategoriesBtn")) {
      const deleteAllCategoriesBtn = document.createElement("button");
      deleteAllCategoriesBtn.id = "deleteAllCategoriesBtn";
      deleteAllCategoriesBtn.className = "delete-all-btn";
      deleteAllCategoriesBtn.innerHTML = "Delete All Categories";
      deleteAllCategoriesBtn.addEventListener(
        "click",
        handleDeleteAllCategories,
      );

      // Add the button to the sidebar footer
      const logoutBtnElement = document.getElementById("logoutBtn");
      if (logoutBtnElement) {
        sidebarFooter.insertBefore(deleteAllCategoriesBtn, logoutBtnElement);
      } else {
        sidebarFooter.appendChild(deleteAllCategoriesBtn);
      }
    }
  }
```

- [ ] **Step 2: Wire the settings modal and static buttons**

After the logout button listener (currently around line 181), add:

```javascript
  // Settings modal
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const settingsModalCloseBtn = document.getElementById("settingsModalCloseBtn");
  const deleteAllCategoriesBtn = document.getElementById("deleteAllCategoriesBtn");

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener("click", () => {
      settingsModal.classList.add("active");
    });
  }

  if (settingsModalCloseBtn && settingsModal) {
    settingsModalCloseBtn.addEventListener("click", () => {
      settingsModal.classList.remove("active");
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove("active");
      }
    });
  }

  if (deleteAllCategoriesBtn) {
    deleteAllCategoriesBtn.addEventListener("click", handleDeleteAllCategories);
  }
```

- [ ] **Step 3: Add settings modal to the Escape key handler**

The existing Escape handler (lines 134–152) checks `categoryModal`. Extend it to also close `settingsModal`. Replace the existing `keydown` handler with:

```javascript
  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Close settings modal
      const settingsModal = document.getElementById("settingsModal");
      if (settingsModal && settingsModal.classList.contains("active")) {
        settingsModal.classList.remove("active");
        return;
      }

      // Close category modal
      if (
        categoryModal &&
        categoryModal.classList.contains("active")
      ) {
        handleCategoryModalCancel();
        return;
      }

      // Close expanded note
      const expandedNote = document.querySelector(".note.expanded");
      if (expandedNote) {
        toggleNoteExpansion(expandedNote);
        e.preventDefault();
      }
    }
  });
```

- [ ] **Step 4: Remove `sidebarFooter` from the destructured elements in `setupEventListeners`**

At the top of `setupEventListeners()`, `sidebarFooter` is destructured from `elements` but is no longer used. Remove it:

Old:
```javascript
  const {
    addNoteBtn,
    addCategoryBtn,
    categoryModal,
    categoryInput,
    cancelCategoryBtn, // This might be null
    confirmCategoryBtn,
    sidebarFooter,
    logoutBtn,
    darkModeToggle,
  } = elements;
```

New:
```javascript
  const {
    addNoteBtn,
    addCategoryBtn,
    categoryModal,
    categoryInput,
    cancelCategoryBtn, // This might be null
    confirmCategoryBtn,
    logoutBtn,
    darkModeToggle,
  } = elements;
```

- [ ] **Step 5: Commit**

```bash
git add frontend/js/eventHandlers.js
git -c commit.gpgsign=false commit -m "feat: wire settings modal, remove dynamic button injection"
```

---

## Task 5: Manual Verification

No automated test framework exists in this project. Verify in the browser by running the app (`docker compose up` or your local dev server).

- [ ] **Desktop checks**
  - Sidebar shows: categories, + Add Category, Toolbar toggle, Spell Check toggle
  - Sidebar footer shows: Logout button (left) + ⚙ icon (right), pinned at bottom
  - Dark Mode toggle is **not** in the sidebar
  - Clicking ⚙ opens a centered modal with Appearance / Account / Danger Zone sections
  - Dark Mode toggle in modal works (applies dark class to body, persists on reload)
  - "Change Password" link navigates to `/change-password.html`
  - "Delete All Categories" triggers existing confirm dialog, then deletes on confirm
  - Pressing Escape closes the settings modal
  - Clicking backdrop closes the settings modal
  - Clicking ✕ closes the settings modal
  - Logout button still works
  - Category modal still works (open, add, escape closes it)

- [ ] **Mobile checks (resize browser to < 768px or use DevTools)**
  - Settings modal appears as a bottom sheet (slides up from bottom, rounded top corners, drag handle bar visible)
  - Sidebar scrolls if many categories are present; footer stays pinned at the bottom throughout
  - All settings modal actions work the same as desktop

- [ ] **Final commit (if any last fixes)**

```bash
git -c commit.gpgsign=false commit -am "fix: post-verification adjustments"
```
