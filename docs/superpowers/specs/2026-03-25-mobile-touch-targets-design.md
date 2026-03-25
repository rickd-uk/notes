# Mobile Touch Target Improvements — Design Spec

## Overview

Several interactive controls are too small for comfortable use on mobile phones. This spec brings all touch targets to the 44×44px minimum (Apple HIG / Material Design standard) at `max-width: 768px`. Desktop and tablet behaviour is unchanged.

## Scope

- **Mobile only:** `max-width: 768px`
- **CSS-only change** — no JS required
- Does not affect the expanded note nav bar (`.mobile-nav-btn`) which is already 44×44px

## Elements Changed

### 1. Note card delete button (`button.note-delete`)

**Current** (`notes.css` lines 93–127 — all properties `!important`):
```
width: 30px !important; height: 30px !important;
top: 6px !important; right: 6px !important;
font-size: 18px !important; line-height: 18px !important;
padding: 6px !important; border-radius: 4px !important;
```

> **Important:** Every property on `button.note-delete` uses `!important`. Any mobile override **must also use `!important`** on changed properties, otherwise the base declarations win regardless of the media query.

**Proposed** (`@media (max-width: 768px)` block in `notes.css`):
```
width: 44px !important; height: 44px !important;
top: 0 !important; right: 0 !important;
font-size: 20px !important; line-height: 44px !important;
padding: 0 !important; border-radius: 4px !important;  /* border-radius unchanged */
```

Position adjusted to `top: 0; right: 0` to keep button flush with card corner. `line-height` updated to match new height.

### 2. Note card expand button (`.note-expand`)

**Current** (`notes.css` lines 138–156):
```
position: absolute !important; top: auto !important;
right: 10px !important; bottom: 10px !important; left: auto !important;
width: 28px; height: 28px; font-size: 18px;
```

> **Important:** `position`, `top`, `right`, `bottom`, `left` all use `!important` on `.note-expand`. The mobile override must use `!important` on `right` and `bottom`. The other position properties (`position: absolute`, `top: auto`, `left: auto`) are unchanged and do not need to appear in the override block — their base `!important` declarations stand.

**Proposed** (`@media (max-width: 768px)` block in `notes.css`):
```
width: 44px; height: 44px; font-size: 20px;
right: 0 !important; bottom: 0 !important;
```

Position adjusted to `bottom: 0; right: 0` to flush with card corner.

> **Existing opacity rules:** `notes.css` already has a `@media (max-width: 768px)` block (lines 290–307) that sets `.note-delete, .note-expand { opacity: 0.7; }`. `responsive.css` also has a `@media (max-width: 768px)` block that sets opacity `0.5` on the same selectors. These are pre-existing and unaffected by this spec — size changes go into the `notes.css` block alongside the existing opacity rule.

### 3. Category edit/delete buttons (`.btn-edit`, `.btn-delete`)

**Current** (`categories.css` line 53–61):
`padding: 4px` only — no explicit width/height

**Proposed** (`@media (max-width: 768px)` block in `categories.css`):
```
min-width: 44px; min-height: 44px;
font-size: 18px;
display: flex; align-items: center; justify-content: center;
```

These controls are revealed by `.categories.edit-mode` at `max-width: 1199px` (tablet + phone). The size increase is applied only at `max-width: 768px` (phone). This is intentional — on tablets controls are already comfortable; the larger targets are for phone use only.

### 4. Category edit toggle button (`#categoryEditToggle`)

**Current** (`categories.css` inside the `@media (max-width: 1199px)` block, lines 192–207):
`min-width: 28px; min-height: 28px`

**Proposed** — add a `@media (max-width: 768px)` block **after** the existing `@media (max-width: 1199px)` block in `categories.css`:
```
#categoryEditToggle { min-width: 44px; min-height: 44px; }
```

> **Placement:** The new `@media (max-width: 768px)` block must appear after the `@media (max-width: 1199px)` block in `categories.css` (i.e., append to the end of the file). This ensures cascade order is correct — the 768px override sits on top of the 1199px base.

This button (✏ pencil toggle next to "All Notes") is always visible in the sidebar on mobile and is the primary affordance for entering category edit mode. It falls below the 44px standard.

### 5. Logout button (`.logout-btn`)

**Current** (`components.css`): `padding: 8px 16px` — no explicit height; effective ~36px depending on inherited font-size

**Proposed** (`@media (max-width: 768px)` block in `components.css`):
```
min-height: 44px; display: flex; align-items: center;
```

Existing `padding: 8px 16px` is kept. `display: flex` + `align-items: center` is added to ensure text stays vertically centred within the taller tap target.

> Context: `.logout-btn` lives inside the sidebar drawer (hidden by default on mobile, opened via the hamburger menu). It is still a touch target and should meet the standard when the drawer is open.

### 6. Settings gear button (`.settings-btn`)

**Current** (`settings-modal.css` lines 4–14):
`padding: 6px 8px; font-size: 22px; line-height: 1` — effective ~34px tap target

**Proposed** (`@media (max-width: 768px)` block in `settings-modal.css`):
```
min-width: 44px; min-height: 44px;
display: flex; align-items: center; justify-content: center;
padding: 6px 8px;  /* explicitly carried forward unchanged */
```

> **Note:** The base `.settings-btn` rule does not set `display: flex`. Adding it in the mobile override changes the layout model to flex container on mobile — this is safe and necessary for centered alignment at 44px. The existing `padding: 6px 8px` is explicitly retained.

## Files Changed

| File | Elements |
|------|----------|
| `frontend/css/notes.css` | `button.note-delete`, `.note-expand` inside existing `@media (max-width: 768px)` block |
| `frontend/css/categories.css` | `.btn-edit`, `.btn-delete`, `#categoryEditToggle` — append new `@media (max-width: 768px)` block after existing `@media (max-width: 1199px)` block |
| `frontend/css/components.css` | `.logout-btn` inside `@media (max-width: 768px)` |
| `frontend/css/settings-modal.css` | `.settings-btn` inside `@media (max-width: 768px)` |

All changes are additive overrides inside existing or new `@media (max-width: 768px)` blocks. No base styles are modified.

## Non-Goals

- No change to desktop (≥769px) behaviour
- No animation or visual redesign
- No JS changes
