# Mobile Touch Target Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all interactive touch targets to 44×44px minimum on mobile (`max-width: 768px`) via CSS-only additive overrides.

**Architecture:** Four files each get a new or extended `@media (max-width: 768px)` block. No base styles are modified. No JS changes. Desktop behaviour is completely unchanged.

**Tech Stack:** Plain CSS, media queries, browser DevTools device emulation for verification.

**Spec:** `docs/superpowers/specs/2026-03-25-mobile-touch-targets-design.md`

---

## File Map

| File | What changes |
|------|-------------|
| `frontend/css/notes.css` | Add `button.note-delete` and `.note-expand` overrides to the existing `@media (max-width: 768px)` block (lines 290–307) |
| `frontend/css/categories.css` | Append a new `@media (max-width: 768px)` block at end of file for `.btn-edit`, `.btn-delete`, `#categoryEditToggle` |
| `frontend/css/components.css` | Add `.logout-btn` override to the second `@media (max-width: 768px)` block (lines 226–247) |
| `frontend/css/settings-modal.css` | Append a new `@media (max-width: 768px)` block at end of file for `.settings-btn` |

---

## Verification Setup (do this once before Task 1)

- [ ] Open the app in Chrome/Firefox
- [ ] Open DevTools → Toggle device toolbar (Ctrl+Shift+M) → set device to **iPhone SE** or manually set width to **375px**
- [ ] Keep DevTools open throughout — each task includes a specific verification step

---

## Task 1: Note card delete and expand buttons (`notes.css`)

**Files:**
- Modify: `frontend/css/notes.css` — extend the existing `@media (max-width: 768px)` block at lines 290–307

**Background:** `button.note-delete` has every property declared `!important` in the base rule (lines 93–127). The mobile overrides must also use `!important` on any changed property. `.note-expand` uses `!important` only on its position properties (`position`, `top`, `right`, `bottom`, `left`); `right` and `bottom` must use `!important` in the mobile override too.

- [ ] **Step 1: Open `frontend/css/notes.css` and locate the mobile block**

  The block starts at line 290:
  ```css
  /* Mobile adjustments */
  @media (max-width: 768px) {
    .note.expanded { ... }

    /* Always show control buttons on mobile */
    .note-delete,
    .note-expand {
      opacity: 0.7;
    }
  }
  ```

- [ ] **Step 2: Add the touch target overrides inside that block**

  Append the following two rules inside the `@media (max-width: 768px)` block, after the existing `opacity` rule:

  ```css
  /* Touch target: delete button — 44×44px on mobile */
  button.note-delete {
    width: 44px !important;
    height: 44px !important;
    font-size: 20px !important;
    line-height: 44px !important;
    padding: 0 !important;
    top: 0 !important;
    right: 0 !important;
    border-radius: 4px !important;
  }

  /* Touch target: expand button — 44×44px on mobile */
  .note-expand {
    width: 44px;
    height: 44px;
    font-size: 20px;
    right: 0 !important;
    bottom: 0 !important;
  }
  ```

  The block should now look like:
  ```css
  @media (max-width: 768px) {
    .note.expanded {
      width: 100%;
      height: 100%;
      max-height: 100%;
      max-width: 100%;
      border-radius: 0;
      top: 0;
      left: 0;
      transform: none;
    }

    /* Always show control buttons on mobile */
    .note-delete,
    .note-expand {
      opacity: 0.7;
    }

    /* Touch target: delete button — 44×44px on mobile */
    button.note-delete {
      width: 44px !important;
      height: 44px !important;
      font-size: 20px !important;
      line-height: 44px !important;
      padding: 0 !important;
      top: 0 !important;
      right: 0 !important;
      border-radius: 4px !important;
    }

    /* Touch target: expand button — 44×44px on mobile */
    .note-expand {
      width: 44px;
      height: 44px;
      font-size: 20px;
      right: 0 !important;
      bottom: 0 !important;
    }
  }
  ```

- [ ] **Step 3: Verify in browser (375px width)**

  - Reload the app at 375px
  - Hover over a note card (or just look — on mobile the buttons are already visible at 0.7 opacity)
  - The delete button (🗑) should be 44×44px, flush with the **top-right** corner of the card
  - The expand button (⊡) should be 44×44px, flush with the **bottom-right** corner of the card
  - Both icons should be visibly larger than before
  - Switch DevTools to desktop width (1200px) — buttons should look unchanged (30px delete, 28px expand)

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/css/notes.css
  git commit -m "style(mobile): increase note delete/expand buttons to 44×44px on mobile"
  ```

---

## Task 2: Category edit/delete buttons and edit toggle (`categories.css`)

**Files:**
- Modify: `frontend/css/categories.css` — append new `@media (max-width: 768px)` block at end of file (after line 213)

**Background:** `.btn-edit` and `.btn-delete` currently have only `padding: 4px` — no explicit width/height. `#categoryEditToggle` is sized at `min-width: 28px; min-height: 28px` inside the `@media (max-width: 1199px)` block. The new `@media (max-width: 768px)` block must appear **after** the `@media (max-width: 1199px)` block so it cascades on top.

The `.categories.edit-mode` class must be active for `.btn-edit`/`.btn-delete` to be visible — you can toggle edit mode by tapping the ✏ button next to "All Notes" in the sidebar.

- [ ] **Step 1: Open `frontend/css/categories.css` and go to the end of file (line 213)**

  Confirm the file ends with the closing `}` of the `@media (max-width: 1199px)` block.

- [ ] **Step 2: Append the new block at the end of the file**

  ```css

  /* Mobile touch targets — phone only (≤768px) */
  @media (max-width: 768px) {
    .btn-edit,
    .btn-delete {
      min-width: 44px;
      min-height: 44px;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #categoryEditToggle {
      min-width: 44px;
      min-height: 44px;
    }
  }
  ```

- [ ] **Step 3: Verify in browser (375px width)**

  - Open the sidebar (tap the hamburger menu)
  - The ✏ toggle button next to "All Notes" should have a tappable area of at least 44×44px (inspect in DevTools to confirm `min-width: 44px; min-height: 44px`)
  - Tap ✏ to enter edit mode — each category row should now show edit (✏️) and delete (🗑) buttons that are 44×44px
  - Switch to desktop (1200px) — the ✏ toggle button should not be visible (it is hidden via `display: none` on desktop); hover over categories to see edit/delete controls at their original size

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/css/categories.css
  git commit -m "style(mobile): increase category edit/delete and toggle buttons to 44px on mobile"
  ```

---

## Task 3: Logout button (`components.css`)

**Files:**
- Modify: `frontend/css/components.css` — add `.logout-btn` override to the second `@media (max-width: 768px)` block (lines 226–247)

**Background:** `.logout-btn` currently has `padding: 8px 16px` and no explicit height — effective ~36px. Adding `min-height: 44px` and `display: flex` with centering gives the larger tap target without altering the visual appearance.

- [ ] **Step 1: Open `frontend/css/components.css` and locate the second `@media (max-width: 768px)` block**

  It starts at line 226 and contains `.notes-header`, `.user-info`, `.username-display` rules.

- [ ] **Step 2: Add the logout button override inside that block**

  Append the following rule inside the `@media (max-width: 768px)` block at line 226, before its closing `}`:

  ```css
  /* Touch target: logout button */
  .logout-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  ```

- [ ] **Step 3: Verify in browser (375px width)**

  - Open the sidebar
  - The "Logout" button should be visibly taller (44px height minimum)
  - Text should remain vertically centered
  - The button border and red colour should be unchanged
  - Switch to desktop — logout button should look unchanged

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/css/components.css
  git commit -m "style(mobile): increase logout button to 44px min-height on mobile"
  ```

---

## Task 4: Settings gear button (`settings-modal.css`)

**Files:**
- Modify: `frontend/css/settings-modal.css` — append new `@media (max-width: 768px)` block at end of file

**Background:** `.settings-btn` currently has `padding: 6px 8px; font-size: 22px; line-height: 1` — effective ~34px. The base rule has no `display: flex`. Adding it in the mobile override changes the display model to flex on mobile, which is safe and necessary for centering at 44px. Existing padding is explicitly retained.

- [ ] **Step 1: Open `frontend/css/settings-modal.css` and go to the end of the file**

- [ ] **Step 2: Append the new block at the end of the file**

  ```css

  /* Mobile touch target for settings gear button */
  @media (max-width: 768px) {
    .settings-btn {
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px 8px;
    }
  }
  ```

- [ ] **Step 3: Verify in browser (375px width)**

  - Open the sidebar
  - The ⚙ settings button should have a tappable area of at least 44×44px
  - The icon should be centered within the button
  - The 0.65 opacity and hover effect should remain unchanged
  - Switch to desktop — the settings button should look unchanged

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/css/settings-modal.css
  git commit -m "style(mobile): increase settings gear button to 44×44px on mobile"
  ```

---

## Final Verification

- [ ] Set DevTools to 375px width (iPhone SE)
- [ ] Check all 6 touch targets meet 44px:
  - Note delete button: flush top-right corner, 44×44px
  - Note expand button: flush bottom-right corner, 44×44px
  - Category edit toggle (✏): 44×44px
  - Category edit/delete buttons (in edit mode): 44×44px
  - Logout button: 44px tall
  - Settings button: 44×44px
- [ ] Set DevTools to 1200px — confirm nothing changed on desktop
- [ ] Dark mode: toggle dark mode and confirm button colours use CSS custom properties correctly (no hardcoded colours introduced)
