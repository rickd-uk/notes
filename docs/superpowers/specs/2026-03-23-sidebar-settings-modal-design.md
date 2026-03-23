# Sidebar Settings Modal — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Problem

The sidebar footer contains infrequently-used actions (Change Password, Delete All Categories) alongside frequently-used ones (Logout, Toolbar toggle, Spell Check toggle). This clutters the sidebar, especially on small smartphone screens where the sidebar is a slide-out drawer.

---

## Goals

- Remove infrequent actions from the sidebar
- Keep frequently-used controls immediately accessible
- Work well on both mobile (small smartphone screens) and desktop
- Sidebar footer must be sticky — always visible regardless of category list length

---

## What Moves Where

### Stays in the sidebar (scrollable area)
- Category list
- + Add Category button
- Toolbar toggle
- Spell Check toggle

### Sticky sidebar footer (always visible)
- Logout button
- ⚙ icon (opens Settings)

### Moves to Settings modal/sheet
- Dark Mode toggle (Appearance section)
- Change Password (Account section)
- Delete All Categories (Danger Zone section)

**Rationale:** Toolbar and Spell Check are used often during active note-taking. Logout needs to be immediately reachable. Dark Mode, Change Password, and Delete All Categories are infrequent enough to live one tap deeper.

---

## Sidebar Layout

The sidebar is a slide-out drawer on mobile and a fixed panel on desktop. Its internal layout uses CSS flexbox:

```
sidebar (display: flex; flex-direction: column; height: 100%)
├── scrollable area (flex: 1; overflow-y: auto)
│   ├── category list
│   ├── + Add Category button
│   ├── Toolbar toggle
│   └── Spell Check toggle
└── sticky footer (flex-shrink: 0; position: sticky; bottom: 0)
    ├── Logout button
    └── ⚙ icon
```

The sticky footer uses `flex-shrink: 0` within the flex column so it never gets squeezed out. A top border separates it visually from the scrollable content.

---

## Settings Modal / Bottom Sheet

A single component that renders differently based on screen width:

- **Mobile (< 768px):** Bottom sheet — slides up from the bottom of the screen, rounded top corners, drag handle visual at the top. Dismissed by tapping the backdrop or the ✕ button.
- **Desktop (≥ 768px):** Centered modal — standard overlay with backdrop, centered on screen, same content.

### Sections

**Appearance**
- Dark Mode toggle

**Account**
- Change Password (navigates to `/change-password.html`, existing behaviour)

**Danger Zone**
- Delete All Categories button (red border/text, triggers existing confirm dialog before acting)

### Trigger
The ⚙ icon in the sidebar sticky footer opens the settings modal/sheet.

---

## Implementation Scope

- Modify `frontend/index.html` — restructure sidebar footer, add ⚙ icon, add settings modal HTML
- Modify `frontend/js/eventHandlers.js` — wire ⚙ icon click, move Dark Mode toggle handler into modal, keep existing Delete All Categories and Change Password logic
- Modify `frontend/css/components.css` — sidebar sticky footer styles
- Add `frontend/css/settings-modal.css` — new stylesheet for the settings modal/bottom sheet, responsive breakpoint at 768px

### Out of Scope
- Backend changes (none required)
- Changes to the Change Password page itself
- Changes to note card layout or mobile header (separate future task)

---

## Files Affected

| File | Change |
|------|--------|
| `frontend/index.html` | Restructure sidebar footer; add settings modal markup |
| `frontend/js/eventHandlers.js` | Wire settings modal open/close; move dark mode toggle |
| `frontend/css/components.css` | Sidebar sticky footer styles |
| `frontend/css/settings-modal.css` | New — settings modal + bottom sheet styles |
