# Category Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to reorder categories via drag-and-drop on desktop and up/down arrow buttons on mobile, with order persisted to the database.

**Architecture:** Add a `sort_order` integer column to the `categories` table. The backend GET endpoint returns categories ordered by `sort_order`. A new PATCH `/reorder` endpoint accepts a batch of `{id, sort_order}` pairs. The frontend renders ▲▼ arrow buttons in edit mode (mobile-friendly) and adds HTML5 drag-and-drop on desktop. Both write to the same API endpoint.

**Tech Stack:** PostgreSQL (ALTER TABLE migration), Express.js (new route), vanilla JS (drag events + click handlers), CSS (drag visual feedback)

---

## File Structure

- **Modify:** `backend/routes/categories.js` — add PATCH `/reorder` route, update GET to ORDER BY sort_order, update POST to assign sort_order
- **Modify:** `frontend/js/api.js` — add `reorderCategories(order)` function
- **Modify:** `frontend/js/ui.js` — update `renderCategories()` to add ▲▼ buttons and `draggable` attributes
- **Modify:** `frontend/js/eventHandlers.js` — add arrow click handlers and drag-and-drop event handlers
- **Modify:** `frontend/css/categories.css` — styles for drag state and arrow buttons

---

### Task 1: Database migration — add sort_order column

**Files:**
- Modify: database (run SQL directly on VPS)

- [ ] **Step 1: Run the migration on the VPS database**

SSH into VPS and run:
```sql
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
UPDATE categories SET sort_order = id WHERE sort_order = 0;
```

The `UPDATE` seeds existing categories with their current id as the order (preserves current visual order roughly). Note: `sort_order` values only need to be ordered correctly per-user — they don't need to be globally unique. The GET query filters by `user_id`, so ordering is always user-scoped.

- [ ] **Step 2: Verify column exists**

```sql
SELECT id, name, sort_order FROM categories LIMIT 5;
```

Expected: rows show a `sort_order` column with non-zero values.

- [ ] **Step 3: Commit a note about the migration**

```bash
git commit --allow-empty -m "chore: applied sort_order migration to categories table"
```

---

### Task 2: Backend — update GET and POST, add PATCH /reorder

**Files:**
- Modify: `backend/routes/categories.js`

**Context:** The file has a GET `/` that returns all user categories without ordering, and a POST `/` that inserts without setting sort_order. Need to:
1. Add `ORDER BY sort_order ASC, id ASC` to GET queries
2. In POST, query `MAX(sort_order)` for the user and set `sort_order = max + 1`
3. Add a new `PATCH /reorder` route

- [ ] **Step 1: Update GET `/` to order by sort_order**

In `backend/routes/categories.js`, change both GET queries:

```js
// admin branch:
const result = await db.query('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');

// regular user branch:
const result = await db.query(
  'SELECT * FROM categories WHERE user_id = $1 ORDER BY sort_order ASC, id ASC',
  [userId]
);
```

- [ ] **Step 2: Update POST `/` to assign sort_order**

In the POST route, before inserting, query the max sort_order:

```js
// admin branch:
const maxResult = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max FROM categories');
const sortOrder = maxResult.rows[0].max + 1;
const result = await db.query(
  'INSERT INTO categories (name, icon, sort_order) VALUES ($1, $2, $3) RETURNING *',
  [name, icon, sortOrder]
);

// regular user branch:
const maxResult = await db.query(
  'SELECT COALESCE(MAX(sort_order), 0) AS max FROM categories WHERE user_id = $1',
  [userId]
);
const sortOrder = maxResult.rows[0].max + 1;
const result = await db.query(
  'INSERT INTO categories (name, icon, user_id, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
  [name, icon, userId, sortOrder]
);
```

- [ ] **Step 3: Add PATCH `/reorder` route**

Add before `module.exports`:

```js
// Reorder categories — accepts [{id, sort_order}, ...]
router.patch('/reorder', async (req, res) => {
  const { order } = req.body; // array of {id, sort_order}
  const userId = req.user.userId;

  if (!Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ error: 'order must be a non-empty array' });
  }

  try {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      for (const { id, sort_order } of order) {
        if (userId === 'admin') {
          await client.query(
            'UPDATE categories SET sort_order = $1 WHERE id = $2',
            [sort_order, id]
          );
        } else {
          await client.query(
            'UPDATE categories SET sort_order = $1 WHERE id = $2 AND user_id = $3',
            [sort_order, id, userId]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Order saved' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error reordering categories:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 4: Restart server and manually test**

```bash
pm2 restart notes
```

Test with curl or browser: GET /api/categories should return categories in sort_order.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/categories.js
git commit -m "feat(backend): add sort_order to categories GET/POST, add PATCH /reorder"
```

---

### Task 3: Frontend API — add reorderCategories()

**Files:**
- Modify: `frontend/js/api.js`

**Context:** `api.js` exports functions like `createCategory`, `updateCategory`, `deleteCategory`. Every function calls `const apiUrl = getApiUrl();` as its first line — follow this pattern exactly. Add `reorderCategories` after `deleteCategory`.

- [ ] **Step 1: Add reorderCategories function**

In `frontend/js/api.js`, add after `deleteCategory`:

```js
// Save new category order to the server
export async function reorderCategories(order) {
  const apiUrl = getApiUrl();  // required — same pattern as all other api.js functions
  try {
    const response = await fetch(`${apiUrl}/categories/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ order }),
    });
    if (!response.ok) throw new Error('Failed to save category order');
    return true;
  } catch (err) {
    console.error('Error saving category order:', err);
    showToast('Failed to save category order');
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/api.js
git commit -m "feat(api): add reorderCategories() function"
```

---

### Task 4: Frontend UI — add ▲▼ arrows and draggable attributes

**Files:**
- Modify: `frontend/js/ui.js`

**Context:** `renderCategories()` builds the custom categories HTML as a string. The category HTML currently has `.category-controls` with edit and delete buttons. Need to:
1. Add `draggable="true"` to each custom category div
2. Add ▲▼ buttons inside `.category-controls` (only visible in edit mode via CSS)

- [ ] **Step 1: Update the category HTML in renderCategories()**

In `frontend/js/ui.js`, change the `customCategoriesHTML` map to:

```js
const customCategoriesHTML = categories
  .map(
    (category, index) => `
<div class="category${currentCategoryId === category.id.toString() ? " active" : ""}" data-id="${category.id}" draggable="true">
<div class="category-icon">${category.icon || "📁"}</div>
<div class="category-name">${category.name}</div>
<div class="category-controls">
<button class="btn-move-up" title="Move up" data-id="${category.id}" ${index === 0 ? 'disabled' : ''}>▲</button>
<button class="btn-move-down" title="Move down" data-id="${category.id}" ${index === categories.length - 1 ? 'disabled' : ''}>▼</button>
<button class="btn-edit" title="Edit category">✏️</button>
<button class="btn-delete" title="Delete category">🗑️</button>
</div>
</div>
`,
  )
  .join("");
```

- [ ] **Step 2: Guard arrow clicks in the per-element click listener in renderCategories()**

Also in `renderCategories()`, find where click listeners are attached to each `.category` element (around line 380). It currently guards `#categoryEditToggle` — add a guard for the arrow buttons too, otherwise clicking ▲▼ will also trigger `handleCategoryClick` (the event reaches the `.category` listener before `stopPropagation` fires on the container):

```js
categoryElem.addEventListener("click", (e) => {
  if (e.target.id === 'categoryEditToggle') return;
  if (e.target.closest('.btn-move-up') || e.target.closest('.btn-move-down')) return;  // add this line
  handleCategoryClick(categoryElem.dataset.id);
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/ui.js
git commit -m "feat(ui): add draggable attribute and move up/down buttons to category items"
```

---

### Task 5: Frontend event handlers — arrows and drag-and-drop

**Files:**
- Modify: `frontend/js/eventHandlers.js`

**Context:** Event listeners are set up in `setupEventListeners()`. There is already a delegated `click` listener on `categoriesContainer` (for `#categoryEditToggle`). **Do not add a second click listener** — extend the existing one. Both `getCategories` and `setCategories` are already imported from `state.js` (check lines 2–16 and ~44). `renderCategories` is already imported from `./ui.js`.

- [ ] **Step 1: Import reorderCategories**

At the top of `eventHandlers.js`, add to the existing api.js import line:

```js
import { reorderCategories } from "./api.js";
```

- [ ] **Step 2: Add saveAndRerenderCategories helper after imports**

Add this module-level helper after the import block. It also updates the category cache so stale data doesn't flicker on next load. Check that `saveCategoriesToCache` is exported from `cache.js` and import it — look for how `loadCategories` in `api.js` calls it to find the correct import path.

```js
import { saveCategoriesToCache } from "./cache.js";

async function saveAndRerenderCategories(newOrder) {
  const order = newOrder.map((cat, index) => ({ id: cat.id, sort_order: index }));
  setCategories(newOrder);
  saveCategoriesToCache(newOrder);  // keep cache coherent with new order
  renderCategories();
  await reorderCategories(order);
}
```

- [ ] **Step 3: Extend the existing click listener on categoriesContainer**

Find the existing `categoriesContainer.addEventListener('click', ...)` in `setupEventListeners()`. Add the up/down logic **inside** it, before the existing handler logic, so both run in one listener:

```js
categoriesContainer.addEventListener('click', async (e) => {
  // --- Reorder arrows ---
  const upBtn = e.target.closest('.btn-move-up');
  const downBtn = e.target.closest('.btn-move-down');

  if (upBtn) {
    e.stopPropagation();
    const id = upBtn.dataset.id;
    const cats = getCategories();
    const index = cats.findIndex(c => c.id.toString() === id);
    if (index <= 0) return;
    const newOrder = [...cats];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await saveAndRerenderCategories(newOrder);
    return;
  }

  if (downBtn) {
    e.stopPropagation();
    const id = downBtn.dataset.id;
    const cats = getCategories();
    const index = cats.findIndex(c => c.id.toString() === id);
    if (index < 0 || index >= cats.length - 1) return;
    const newOrder = [...cats];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await saveAndRerenderCategories(newOrder);
    return;
  }

  // ... existing handler logic continues below (categoryEditToggle, etc.) ...
});
```

- [ ] **Step 4: Add drag-and-drop handlers**

Drag is desktop-only. Gate `dragstart` so it only fires when edit mode is active — this prevents accidental drags when simply clicking to select a category.

Add a module-level variable and four drag listeners inside `setupEventListeners()`:

```js
let dragSrcId = null;

categoriesContainer.addEventListener('dragstart', (e) => {
  // Only allow drag in edit mode
  if (!categoriesContainer.classList.contains('edit-mode')) return;
  const category = e.target.closest('.category[draggable]');
  if (!category) return;
  dragSrcId = category.dataset.id;
  category.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
});

categoriesContainer.addEventListener('dragend', () => {
  categoriesContainer.querySelectorAll('.category').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
  });
  dragSrcId = null;
});

categoriesContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  const category = e.target.closest('.category[draggable]');
  if (!category || category.dataset.id === dragSrcId) return;
  categoriesContainer.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
  category.classList.add('drag-over');
});

categoriesContainer.addEventListener('drop', async (e) => {
  e.preventDefault();
  const target = e.target.closest('.category[draggable]');
  if (!target || !dragSrcId || target.dataset.id === dragSrcId) return;

  const cats = getCategories();
  const srcIndex = cats.findIndex(c => c.id.toString() === dragSrcId);
  const tgtIndex = cats.findIndex(c => c.id.toString() === target.dataset.id);
  if (srcIndex < 0 || tgtIndex < 0) return;

  const newOrder = [...cats];
  const [moved] = newOrder.splice(srcIndex, 1);
  newOrder.splice(tgtIndex, 0, moved);
  await saveAndRerenderCategories(newOrder);
});
```

- [ ] **Step 5: Commit**

```bash
git add frontend/js/eventHandlers.js
git commit -m "feat(events): add arrow reorder and drag-and-drop for categories"
```

---

### Task 6: CSS — styles for drag state and arrow buttons

**Files:**
- Modify: `frontend/css/categories.css`

- [ ] **Step 1: Add arrow button styles**

The ▲▼ buttons should only be visible in edit mode (`.categories.edit-mode`). Add:

```css
/* Arrow reorder buttons — only visible in edit mode */
.btn-move-up,
.btn-move-down {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-color);
  padding: 2px 4px;
  opacity: 0.6;
  line-height: 1;
}

.btn-move-up:disabled,
.btn-move-down:disabled {
  opacity: 0.2;
  cursor: default;
}

.categories.edit-mode .btn-move-up,
.categories.edit-mode .btn-move-down {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2: Add drag state styles**

```css
/* Drag-and-drop visual feedback */
.category.dragging {
  opacity: 0.4;
}

.category.drag-over {
  background-color: rgba(98, 0, 238, 0.1);
  border-left: 3px solid var(--primary-color);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/css/categories.css
git commit -m "feat(css): add styles for category reorder arrows and drag-and-drop"
```

---

### Task 7: End-to-end test

- [ ] **Step 1: Test desktop drag-and-drop**
  - Open app in browser
  - Add 3+ categories
  - Drag one category above another
  - Verify visual feedback (opacity + highlight)
  - Refresh page — verify new order persists

- [ ] **Step 2: Test mobile arrows**
  - Open app in browser mobile emulator
  - Enable edit mode (✏ toggle)
  - Verify ▲▼ buttons appear on each category
  - Verify ▲ is disabled on first category, ▼ on last
  - Tap ▲ on second category — it should move up
  - Refresh page — verify new order persists

- [ ] **Step 3: Test new categories append to end**
  - Reorder existing categories
  - Add a new category
  - Verify it appears at the bottom of the list (highest sort_order)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix: category reorder edge cases"
```
