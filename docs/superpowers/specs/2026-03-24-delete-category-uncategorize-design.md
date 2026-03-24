# Delete Category — Uncategorize by Default Design

**Date:** 2026-03-24

## Overview

Change single-category delete so it uncategorizes notes by default, with an optional checkbox to also delete the notes. Update the UI immediately without a server round-trip.

## Current Behavior

- `DELETE /api/categories/:id` nullifies `category_id` on notes, then deletes the category (notes are NOT deleted — correct backend behavior)
- The confirmation dialog misleadingly says "delete ALL notes in this category" but notes are just uncategorized
- After delete, frontend calls `loadNotes()` — a full server round-trip to reload

## Proposed Changes

### Backend — `backend/routes/categories.js`

`DELETE /:id` accepts an optional query parameter `?deleteNotes=true`.

- Default (no param / `deleteNotes=false`): current behavior — nullify `category_id`, delete category
- `deleteNotes=true`: delete notes belonging to that category for the user, then delete the category

### Frontend HTML — `frontend/index.html`

Add a checkbox section inside `#confirmModal`, hidden by default:

```html
<div id="confirmDeleteNotesSection" style="display:none">
  <label>
    <input type="checkbox" id="confirmDeleteNotesCheckbox" />
    Also delete all notes in this category
    <span>⚠ This cannot be undone</span>
  </label>
</div>
```

### Frontend CSS — `frontend/css/confirm-modal.css`

Styles for the checkbox section: bordered warning box, red accent, warning text.

### Frontend JS — `frontend/js/uiUtils.js`

New function `confirmDialogWithCheckbox(message, headerText, confirmBtnText, checkboxLabel)`:
- Shows `#confirmDeleteNotesSection` with the given `checkboxLabel`
- Returns `Promise<{ confirmed: boolean, deleteNotes: boolean }>`
- Hides + resets checkbox on close/cancel
- Existing `confirmDialog` is unchanged

### Frontend JS — `frontend/js/api.js`

`deleteCategory(id, deleteNotes = false)`:
- Appends `?deleteNotes=true` to the URL when flag is set
- Clears notes cache for `all`, `uncategorized`, and the specific `categoryId`

### Frontend JS — `frontend/js/eventHandlers.js`

`handleCategoryDelete(categoryId)`:
- Uses `confirmDialogWithCheckbox` with accurate message ("Notes will be moved to Uncategorized")
- Passes `deleteNotes` flag to `deleteCategory`
- **Immediate UI update** — no `loadNotes()` call:
  - `deleteNotes=false`: iterate notes in state, set `category_id = null` for affected notes
  - `deleteNotes=true`: filter affected notes out of state
  - Remove category from categories state
  - Call `renderNotes()` and `renderCategories()`

## Files Changed

| File | Change |
|------|--------|
| `backend/routes/categories.js` | Accept `?deleteNotes=true`, delete notes when set |
| `frontend/index.html` | Add checkbox section to `#confirmModal` |
| `frontend/css/confirm-modal.css` | Checkbox section styles |
| `frontend/js/uiUtils.js` | Add `confirmDialogWithCheckbox()` |
| `frontend/js/api.js` | Add `deleteNotes` param to `deleteCategory()` |
| `frontend/js/eventHandlers.js` | Use new dialog, immediate state update |
