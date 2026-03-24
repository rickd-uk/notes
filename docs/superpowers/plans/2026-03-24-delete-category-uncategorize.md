# Delete Category — Uncategorize by Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change single-category delete to uncategorize notes by default, with an optional "also delete notes" checkbox, and update the UI immediately without a server reload.

**Architecture:** Backend gains an optional `?deleteNotes=true` query param. Frontend adds a `confirmDialogWithCheckbox()` helper that reuses the existing `#confirmModal` with a new hidden checkbox section. `handleCategoryDelete` uses the new dialog, then immediately mutates local state and re-renders rather than calling `loadNotes()`.

**Tech Stack:** Node.js/Express (backend), vanilla JS ES modules, HTML/CSS (no build step, no test framework — verification is manual in the browser).

**Spec:** `docs/superpowers/specs/2026-03-24-delete-category-uncategorize-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/routes/categories.js` | Modify | Accept `?deleteNotes=true`; delete notes when set, else nullify |
| `frontend/index.html` | Modify | Add hidden `#confirmDeleteNotesSection` inside `#confirmModal` |
| `frontend/css/confirm-modal.css` | Modify | Style the checkbox warning section |
| `frontend/js/uiUtils.js` | Modify | Add `confirmDialogWithCheckbox()` |
| `frontend/js/api.js` | Modify | Add `deleteNotes` param to `deleteCategory()` |
| `frontend/js/eventHandlers.js` | Modify | Use new dialog; immediate state + render, no `loadNotes()` |

---

## Task 1: Backend — support `?deleteNotes=true`

**Files:**
- Modify: `backend/routes/categories.js` (the `router.delete('/:id', ...)` handler, ~line 225)

- [ ] **Step 1: Add `deleteNotes` query param handling**

In `backend/routes/categories.js`, find the `router.delete('/:id', ...)` handler. After the `const { id } = req.params;` line, add:

```js
const deleteNotes = req.query.deleteNotes === 'true';
```

- [ ] **Step 2: Update the admin branch**

Replace the two lines in the `if (userId === 'admin')` block that currently do:
```js
await client.query('UPDATE notes SET category_id = NULL WHERE category_id = $1', [id]);
```
with:
```js
if (deleteNotes) {
  await client.query('DELETE FROM notes WHERE category_id = $1', [id]);
} else {
  await client.query('UPDATE notes SET category_id = NULL WHERE category_id = $1', [id]);
}
```

- [ ] **Step 3: Update the regular-user branch**

Replace the lines that do:
```js
await client.query(
  'UPDATE notes SET category_id = NULL WHERE category_id = $1 AND user_id = $2',
  [id, numericUserId]
);
```
with:
```js
if (deleteNotes) {
  await client.query(
    'DELETE FROM notes WHERE category_id = $1 AND user_id = $2',
    [id, numericUserId]
  );
} else {
  await client.query(
    'UPDATE notes SET category_id = NULL WHERE category_id = $1 AND user_id = $2',
    [id, numericUserId]
  );
}
```

- [ ] **Step 4: Manual verify — uncategorize (default)**

```bash
# Find a category ID that has notes, then:
curl -s -X DELETE http://localhost:3012/api/categories/<ID> \
  -H "Cookie: <your session cookie>" | jq .
```
Expected: `{"message":"Category deleted"}`. Notes should still exist, now uncategorized.

- [ ] **Step 5: Manual verify — delete notes**

```bash
curl -s -X DELETE "http://localhost:3012/api/categories/<ID>?deleteNotes=true" \
  -H "Cookie: <your session cookie>" | jq .
```
Expected: `{"message":"Category deleted"}`. Notes in that category should be gone.

---

## Task 2: HTML — add checkbox section to `#confirmModal`

**Files:**
- Modify: `frontend/index.html` (inside `#confirmModal`, after `.modal-message`, ~line 248)

- [ ] **Step 1: Add the hidden checkbox section**

Inside `#confirmModal`, after the closing `</div>` of `.modal-message` and before `.modal-actions`, add:

```html
<!-- Optional: delete notes with category -->
<div id="confirmDeleteNotesSection" style="display:none; margin-bottom: 20px;">
  <label id="confirmDeleteNotesLabel" style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
    <input type="checkbox" id="confirmDeleteNotesCheckbox" style="margin-top: 3px; flex-shrink: 0;" />
    <span>
      Also delete all notes in this category
      <span id="confirmDeleteNotesWarning" style="display:block; margin-top: 3px;">
        ⚠ This cannot be undone
      </span>
    </span>
  </label>
</div>
```

---

## Task 3: CSS — style the checkbox section

**Files:**
- Modify: `frontend/css/confirm-modal.css`

- [ ] **Step 1: Add styles for the checkbox section**

Append to `frontend/css/confirm-modal.css`:

```css
/* Delete-notes checkbox section */
#confirmDeleteNotesSection {
    border: 1px solid rgba(244, 67, 54, 0.3);
    border-radius: 8px;
    background: rgba(244, 67, 54, 0.05);
    padding: 12px 14px;
}

#confirmDeleteNotesLabel {
    font-size: 14px;
    line-height: 1.5;
    color: inherit;
}

#confirmDeleteNotesCheckbox {
    accent-color: #f44336;
    width: 15px;
    height: 15px;
}

#confirmDeleteNotesWarning {
    font-size: 12px;
    color: #f44336;
    font-weight: 500;
}

body.dark-mode #confirmDeleteNotesSection {
    border-color: rgba(255, 107, 107, 0.35);
    background: rgba(255, 107, 107, 0.07);
}

body.dark-mode #confirmDeleteNotesWarning {
    color: #ff6b6b;
}
```

---

## Task 4: uiUtils.js — add `confirmDialogWithCheckbox()`

**Files:**
- Modify: `frontend/js/uiUtils.js` (add after `confirmDialog`, ~line 323)

- [ ] **Step 1: Add the new function**

After the closing `}` of `confirmDialog`, add:

```js
// Confirm dialog with an optional "also delete notes" checkbox.
// Returns Promise<{ confirmed: boolean, deleteNotes: boolean }>
export function confirmDialogWithCheckbox(message, headerText = 'Confirm Delete', confirmBtnText = 'Delete') {
  return new Promise((resolve) => {
    const confirmModal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmModalMessage');
    const headerEl = document.getElementById('confirmModalHeader');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelConfirmBtn');
    const checkboxSection = document.getElementById('confirmDeleteNotesSection');
    const checkbox = document.getElementById('confirmDeleteNotesCheckbox');

    // Set content
    messageEl.textContent = message;
    headerEl.textContent = headerText;
    confirmBtn.textContent = confirmBtnText;

    // Show checkbox section and reset it
    checkbox.checked = false;
    checkboxSection.style.display = 'block';

    // Show modal
    confirmModal.classList.add('active');

    const cleanup = () => {
      confirmModal.classList.remove('active');
      checkboxSection.style.display = 'none';
      checkbox.checked = false;
      cancelBtn.removeEventListener('click', handleCancel);
      confirmBtn.removeEventListener('click', handleConfirm);
      document.removeEventListener('keydown', handleKeydown);
      confirmModal.removeEventListener('click', handleOutsideClick);
    };

    const handleCancel = () => {
      cleanup();
      resolve({ confirmed: false, deleteNotes: false });
    };

    const handleConfirm = () => {
      const deleteNotes = checkbox.checked;
      cleanup();
      resolve({ confirmed: true, deleteNotes });
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') handleCancel();
      else if (e.key === 'Enter') handleConfirm();
    };

    const handleOutsideClick = (e) => {
      if (e.target === confirmModal) handleCancel();
    };

    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);
    document.addEventListener('keydown', handleKeydown);
    confirmModal.addEventListener('click', handleOutsideClick);
  });
}
```

- [ ] **Step 2: Export check**

The function is already exported via the `export` keyword. Verify the import in `eventHandlers.js` will work in Task 6.

---

## Task 5: api.js — add `deleteNotes` param to `deleteCategory()`

**Files:**
- Modify: `frontend/js/api.js` (the `deleteCategory` function, ~line 372)

- [ ] **Step 1: Update function signature and URL**

Replace the existing `deleteCategory` function:

```js
// Delete a category
export async function deleteCategory(id, deleteNotes = false) {
  try {
    const apiUrl = getApiUrl();
    const url = deleteNotes
      ? `${apiUrl}/categories/${id}?deleteNotes=true`
      : `${apiUrl}/categories/${id}`;
    const response = await fetch(url, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to delete category");

    // Clear all notes caches since category assignments changed
    clearNotesCache("all");
    clearNotesCache("uncategorized");
    clearNotesCache(id.toString());
    getCategories().forEach((cat) => {
      clearNotesCache(cat.id.toString());
    });

    return true;
  } catch (error) {
    console.error("Error deleting category:", error);
    return false;
  }
}
```

---

## Task 6: eventHandlers.js — use new dialog + immediate UI update

**Files:**
- Modify: `frontend/js/eventHandlers.js`

- [ ] **Step 1: Import `confirmDialogWithCheckbox`**

In the import block from `./uiUtils.js` (~line 33), add `confirmDialogWithCheckbox` to the import list:

```js
import {
  showToast,
  showCategoryModal,
  hideCategoryModal,
  confirmDialog,
  confirmDialogWithCheckbox,
  getCategoryName,
  updateButtonPlacement,
  hideIconInModal,
} from "./uiUtils.js";
```

- [ ] **Step 2: Replace `handleCategoryDelete`**

Replace the entire `handleCategoryDelete` function (~line 571):

```js
// Handle category delete
export async function handleCategoryDelete(categoryId) {
  const categories = getCategories();
  const categoryName = getCategoryName(categoryId, categories);

  const { confirmed, deleteNotes } = await confirmDialogWithCheckbox(
    `Delete "${categoryName}"? Notes in this category will be moved to Uncategorized.`,
    "Delete Category",
    "Delete Category",
  );

  if (!confirmed) return;

  const success = await deleteCategory(categoryId, deleteNotes);

  if (success) {
    // Update local state immediately — no round-trip needed
    if (deleteNotes) {
      // Remove notes that belonged to this category
      const remaining = getNotes().filter(
        (note) => note.category_id?.toString() !== categoryId
      );
      setNotes(remaining);
    } else {
      // Uncategorize notes that belonged to this category
      getNotes().forEach((note) => {
        if (note.category_id?.toString() === categoryId) {
          note.category_id = null;
        }
      });
    }

    removeCategoryFromState(categoryId);

    // If viewing the deleted category, switch to all notes
    if (getCurrentCategoryId() === categoryId) {
      setCurrentCategoryId("all");
    }

    await renderNotes();
    renderCategories();
    showToast("Category deleted");
  }
}
```

Note: `setNotes` must be imported — check that it is already in the import block from `./state.js` (it is, at line 11).

---

## Task 7: Verify end-to-end and commit

- [ ] **Step 1: Restart the backend**

```bash
cd /home/rick/Documents/D/WEB/_LIVE_/MAIN/notes
# Restart however you normally do (e.g. pm2 restart, node restart, etc.)
```

- [ ] **Step 2: Browser smoke test — uncategorize (default)**

1. Open the app, create a category with a couple of notes
2. Click the delete icon on the category
3. Confirm dialog should say "Delete [name]? Notes will be moved to Uncategorized" with the checkbox **unchecked**
4. Click "Delete Category" without checking the box
5. Notes should immediately appear in "Uncategorized" / "All Notes" — no page reload

- [ ] **Step 3: Browser smoke test — delete notes too**

1. Create another category with notes
2. Click delete, this time **check** the checkbox ("Also delete all notes in this category — ⚠ This cannot be undone")
3. Confirm
4. Notes should be gone from the UI immediately

- [ ] **Step 4: Browser smoke test — cancel**

Click delete, open dialog, then click Cancel or press Escape. Nothing should change.

- [ ] **Step 5: Dark mode check**

Switch to dark mode, open the delete dialog — checkbox section border and warning text should use the red dark-mode variants.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/categories.js \
        frontend/index.html \
        frontend/css/confirm-modal.css \
        frontend/js/uiUtils.js \
        frontend/js/api.js \
        frontend/js/eventHandlers.js
git commit -m "feat(categories): uncategorize notes on delete by default, add option to delete notes"
```
