// ui.js - UI rendering functions with toolbar toggle integration
import {
  getNotes,
  getCategories,
  getCurrentCategoryId,
  elements,
} from "./state.js";
import {
  createNewNote,
  handleNoteInput,
  handleNoteDelete,
  handleNoteExpand,
  handleCategoryClick,
  handleCategoryEdit,
  handleCategoryDelete,
  handleBulkDelete,
} from "./eventHandlers.js";
import {
  createQuillEditor,
  clearQuillEditors,
  focusQuillEditor,
  updateQuillEditorLayout,
  setEditorReadOnly,
} from "./quillEditor.js";
import { hideAllNoteButtons, recreateAllNoteButtons, showToast } from "./uiUtils.js";
import { showNoteCategoryModal } from "./noteCategoryManager.js";

/**
 * Format a date string as a human-readable relative time.
 * @param {string} dateString - ISO date string (e.g. note.updated_at)
 * @returns {string} e.g. "just now", "5 min ago", "yesterday", "Mar 15", "Mar 15, 2024"
 */
function formatRelativeDate(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60)           return 'just now';
  if (diff < 3600)         return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)        return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? '' : 's'} ago`;
  if (diff < 172800)       return 'yesterday';
  if (diff < 604800)       return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000)      return `${Math.floor(diff / 604800)} week${Math.floor(diff / 604800) === 1 ? '' : 's'} ago`;

  const opts = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString(undefined, opts);
}

export function addEncryptedOverlay(noteElement) {
  removeEncryptedOverlay(noteElement);
  const overlay = document.createElement('div');
  overlay.className = 'encrypted-overlay';
  overlay.textContent = '🔐';
  noteElement.appendChild(overlay);
}

export function removeEncryptedOverlay(noteElement) {
  noteElement.querySelector('.encrypted-overlay')?.remove();
}

// Render notes in the UI
export async function renderNotes() {
  // Clear existing Quill editors
  clearQuillEditors();

  const notes = getNotes();
  const notesContainer = elements.notesContainer;
  const categories = getCategories();

  if (notes.length === 0) {
    notesContainer.innerHTML = `
<div class="empty-state">
  <div class="empty-icon">🗒️</div>
  <div class="empty-title">Nothing here yet</div>
  <div class="empty-message">Your ideas deserve a home — add your first note!</div>
  <button class="empty-action" id="emptyAddNoteBtn">✏️ Write your first note</button>
</div>
`;
    document
      .getElementById("emptyAddNoteBtn")
      .addEventListener("click", createNewNote);
  } else {
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    notes.forEach((note) => {
      const noteElement = document.createElement("div");
      noteElement.className = 'note'
        + (note.read_only ? ' note--locked' : '')
        + (note.encrypted ? ' note--encrypted' : '');
      noteElement.dataset.id = note.id;
      noteElement.dataset.readOnly = note.read_only ? "true" : "false";
      noteElement.dataset.encrypted = note.encrypted ? 'true' : 'false';

      const formattedDate = formatRelativeDate(note.updated_at);

      // Get category information for this note
      let categoryName = "Uncategorized";
      let categoryIcon = "📌";
      let categoryId = null;

      if (note.category_id) {
        const category = categories.find((c) => c.id == note.category_id);
        if (category) {
          categoryName = category.name;
          categoryIcon = category.icon || "📁";
          categoryId = category.id.toString();
        }
      }

      // Create placeholder with properly encoded content
      // Make sure to properly sanitize and encode HTML content to prevent XSS
      noteElement.innerHTML = `
<div class="note-content-placeholder" data-content="${encodeURIComponent(note.content || "")}"></div>
<div class="note-footer">
  <div class="note-timestamp">${formattedDate}</div>
  <div class="note-category" data-category-id="${categoryId || "null"}">
    <div class="note-category-icon">${categoryIcon}</div>
  </div>
</div>
${note.read_only && !note.encrypted ? '<div class="note-lock-badge" title="View-only">👁</div>' : ''}
${note.encrypted ? '<div class="note-encrypted-badge" title="Encrypted — expand the note and click 🔐 to decrypt for editing">🔐</div>' : ''}
${note.encrypted ? '' : '<button class="note-delete" title="Delete note">🗑</button>'}
<div class="note-expand" title="Expand/collapse note">
  <span class="expand-icon">⤢</span>
</div>
`;
      fragment.appendChild(noteElement);
    });

    // Clear and append in a single operation
    notesContainer.innerHTML = "";
    notesContainer.appendChild(fragment);

    // Initialize Quill editors for each note
    for (const noteElement of document.querySelectorAll(".note")) {
      const noteId = noteElement.dataset.id;
      const placeholder = noteElement.querySelector(
        ".note-content-placeholder",
      );
      let content = placeholder ? decodeURIComponent(placeholder.dataset.content) : '';

      let showEncryptedOverlay = false;
      if (noteElement.dataset.encrypted === 'true') {
        // Dynamic import to avoid circular dependency risk
        const { isUnlocked, decryptNoteContent } = await import('./encryptionManager.js');
        noteElement.dataset.encryptedContent = decodeURIComponent(placeholder?.dataset.content || '');
        if (isUnlocked()) {
          const decrypted = await decryptNoteContent(content);
          if (decrypted) {
            content = decrypted;
          } else {
            // Render-time decryption failure — show overlay, don't pollute note content.
            // The user can try manually via expand + 🔐. Only mark permanently failed
            // if the manual decrypt in the expanded view also fails.
            content = '';
            showEncryptedOverlay = true;
          }
        } else {
          content = '';
          showEncryptedOverlay = true;
        }
      }

      // Create Quill editor for this note
      createQuillEditor(noteElement, noteId, content);
      if (noteElement.dataset.readOnly === "true") {
        setEditorReadOnly(noteId, true);
      }

      // Show centered overlay for locked/undecrytable encrypted notes
      if (showEncryptedOverlay) {
        addEncryptedOverlay(noteElement);
      }

      // Hint when user tries to type in a still-encrypted note
      if (noteElement.dataset.encrypted === 'true') {
        const editorEl = noteElement.querySelector('.ql-editor');
        if (editorEl) {
          editorEl.addEventListener('click', () => {
            showToast('Expand the note and click 🔐 to decrypt it for editing');
          });
        }
      }

      // Add event listeners
      const deleteBtn = noteElement.querySelector(".note-delete");
      const expandBtn = noteElement.querySelector(".note-expand");
      const categoryBtn = noteElement.querySelector(".note-category");

      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleNoteDelete(noteId);
        });
      }

      expandBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleNoteExpand(noteElement);
      });

      // Add category selection event listener using modal
      if (categoryBtn) {
        categoryBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showNoteCategoryModal(noteId);
        });
      }
    }
  }

  // Fix for delete button position
  // Updated fixDeleteButtons function in ui.js
  function fixDeleteButtons() {
    console.log("Using simplified button handler");
  }

  // Call this with a longer delay to ensure Quill is fully initialized
  setTimeout(fixDeleteButtons, 500);

  // Call this after your notes are rendered
  setTimeout(fixDeleteButtons, 100);

  // Update classes for dynamic layout based on note count
  const notesCount = notes.length;

  // Remove all possible layout classes
  notesContainer.classList.remove(
    "note-count-1",
    "note-count-2",
    "note-count-3",
    "note-count-4",
    "note-count-5",
    "note-count-6",
    "note-count-7",
    "note-count-8",
    "note-count-9",
    "note-count-many",
    "notes-count-1",
    "notes-count-2",
    "notes-count-3",
    "notes-count-many",
  );

  // Add appropriate class based on number of notes
  if (notesCount === 0) {
    // Empty state - no special class needed
  } else if (notesCount === 1) {
    notesContainer.classList.add("note-count-1");
    notesContainer.classList.add("notes-count-1");
  } else if (notesCount === 2) {
    notesContainer.classList.add("note-count-2");
    notesContainer.classList.add("notes-count-2");
  } else if (notesCount === 3) {
    notesContainer.classList.add("note-count-3");
    notesContainer.classList.add("notes-count-3");
  } else if (notesCount === 4) {
    notesContainer.classList.add("note-count-4");
    notesContainer.classList.add("notes-count-many");
  } else if (notesCount === 5) {
    notesContainer.classList.add("note-count-5");
    notesContainer.classList.add("notes-count-many");
  } else if (notesCount === 6) {
    notesContainer.classList.add("note-count-6");
    notesContainer.classList.add("notes-count-many");
  } else if (notesCount === 7) {
    notesContainer.classList.add("note-count-7");
    notesContainer.classList.add("notes-count-many");
  } else if (notesCount === 8) {
    notesContainer.classList.add("note-count-8");
    notesContainer.classList.add("notes-count-many");
  } else if (notesCount === 9) {
    notesContainer.classList.add("note-count-9");
    notesContainer.classList.add("notes-count-many");
  } else {
    notesContainer.classList.add("note-count-many");
    notesContainer.classList.add("notes-count-many");
  }

  // Toggle view-all class for category badge visibility
  if (getCurrentCategoryId() === 'all') {
    notesContainer.classList.add('view-all');
  } else {
    notesContainer.classList.remove('view-all');
  }

  updateCurrentCategoryDisplay();
}

export function updateCurrentCategoryDisplay() {
  const el = elements.currentCategoryElement;
  if (!el) return;
  const categoryId = getCurrentCategoryId();
  if (categoryId === 'all') {
    el.textContent = '📄 All Notes';
  } else if (categoryId === 'uncategorized') {
    el.textContent = '📌 Uncategorized';
  } else {
    const cats = getCategories();
    const cat = cats.find(c => String(c.id) === String(categoryId));
    el.textContent = cat ? `${cat.icon || '📁'} ${cat.name}` : '';
  }
}

// Render categories in the UI
export function renderCategories() {
  const categories = getCategories();
  const currentCategoryId = getCurrentCategoryId();
  const categoriesContainer = elements.categoriesContainer;
  const currentCategoryElement = elements.currentCategoryElement;

  const customCategoriesHTML = categories
    .map(
      (category) => `
<div class="category${currentCategoryId === category.id.toString() ? " active" : ""}" data-id="${category.id}">
<div class="category-icon">${category.icon || "📁"}</div>
<div class="category-name">${category.name}</div>
<div class="category-controls">
<button class="btn-edit" title="Edit category">✏️</button>
<button class="btn-delete" title="Delete category">🗑️</button>
</div>
</div>
`,
    )
    .join("");

  // Update the existing system categories and add custom ones
  categoriesContainer.innerHTML = `
<div class="category${currentCategoryId === "all" ? " active" : ""}" data-id="all">
  <div class="category-icon">📄</div>
  <div class="category-name">All Notes</div>
</div>
<div class="category${currentCategoryId === "uncategorized" ? " active" : ""}" data-id="uncategorized">
  <div class="category-icon">📌</div>
  <div class="category-name">Uncategorized</div>
</div>
${customCategoriesHTML}
`;

  // Update current category label
  /*  if (currentCategoryId === 'all') {
    currentCategoryElement.textContent = 'All Notes';
  } else if (currentCategoryId === 'uncategorized') {
    currentCategoryElement.textContent = 'Uncategorized';
  } else {
    const category = categories.find(cat => cat.id.toString() === currentCategoryId);
    if (category) {
      currentCategoryElement.textContent = category.name;
    }
  }
  */

  // Add bulk delete button to notes header if not already present
  // const notesHeader = document.querySelector('.notes-header');
  // let bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  //
  // if (!bulkDeleteBtn) {
  //   bulkDeleteBtn = document.createElement('button');
  //   bulkDeleteBtn.id = 'bulkDeleteBtn';
  //   bulkDeleteBtn.className = 'bulk-delete-btn';
  //   bulkDeleteBtn.title = 'Delete all notes in this category';
  //   bulkDeleteBtn.innerHTML = '🗑️ Delete All';
  //
  //   // On mobile, ensure proper button placement
  //   if (window.innerWidth <= 1199) {
  //     // Insert at the beginning of the header (left side)
  //     notesHeader.insertBefore(bulkDeleteBtn, notesHeader.firstChild);
  //   } else {
  //     // On desktop, add button between the category title and add note button
  //     notesHeader.insertBefore(bulkDeleteBtn, document.getElementById('addNoteBtn'));
  //   }
  //
  //   // Add event listener to bulk delete button
  //   bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  // }

  // Add event listeners to categories
  document.querySelectorAll(".category").forEach((categoryElem) => {
    categoryElem.addEventListener("click", () => {
      handleCategoryClick(categoryElem.dataset.id);
    });

    const editBtn = categoryElem.querySelector(".btn-edit");
    const deleteBtn = categoryElem.querySelector(".btn-delete");

    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleCategoryEdit(categoryElem.dataset.id);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleCategoryDelete(categoryElem.dataset.id);
      });
    }
  });
}

// Toggle note expansion - UPDATED VERSION WITH FIX
// Update to toggleNoteExpansion function in ui.js

export function toggleNoteExpansion(noteElement) {
  // Create overlay if it doesn't exist yet
  let overlay = document.querySelector(".note-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "note-overlay";
    document.body.appendChild(overlay);

    // Add click event to close expanded note when clicking outside
    overlay.addEventListener("click", () => {
      const expandedNote = document.querySelector(".note.expanded");
      if (expandedNote) {
        toggleNoteExpansion(expandedNote);
      }
    });
  }

  const expandedNoteControls = document.querySelector(
    ".expanded-note-controls",
  ); // Get the toolbar element
  const noteId = noteElement.dataset.id;
  const isExpanding = !noteElement.classList.contains("expanded");

  if (isExpanding) {
    // Save position so we can restore it on collapse
    noteElement._prevNextSibling = noteElement.nextSibling;

    // REMOVE ALL DELETE BUTTONS EXCEPT FOR THIS NOTE
    hideAllNoteButtons();

    // Expand note
    noteElement.classList.add("expanded");
    overlay.classList.add("active");

    // Add inline styles to maximize size
    noteElement.style.cssText = `
position: fixed;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
width: 95%;
max-width: 1200px;
height: 90%;
max-height: 900px;
z-index: 9001;
background-color: var(--surface-color);
`;

    // Apply mobile styles if needed
    if (window.innerWidth <= 1199) {
      noteElement.style.cssText = `
position: fixed;
top: 0;
left: 0;
width: 100%;
height: 100%;
transform: none;
border-radius: 0;
z-index: 9001;
background-color: var(--surface-color);
`;
    }

    // Move to body to ensure proper positioning and z-index
    document.body.appendChild(noteElement);

    // Prevent scrolling on main container
    document.body.style.overflow = "hidden";

    // Make overlay darker
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.95)";
    overlay.style.zIndex = "9000";

    // Show the expanded note controls toolbar
    if (expandedNoteControls) {
      expandedNoteControls.classList.add("active");
    }

    // Add expanded note controls
    import("./noteControls.js").then((module) => {
      module.addExpandedNoteControls(noteElement);
    });

    // Focus on editor
    focusQuillEditor(noteId);
  } else {
    // Collapse note
    noteElement.classList.remove("expanded");
    overlay.classList.remove("active");

    // Remove inline styles
    noteElement.style = "";

    // Reset overlay style
    overlay.style = "";

    // Return note to its original position in the container
    const sibling = noteElement._prevNextSibling;
    if (sibling && sibling.parentElement === elements.notesContainer) {
      elements.notesContainer.insertBefore(noteElement, sibling);
    } else {
      elements.notesContainer.appendChild(noteElement);
    }
    noteElement._prevNextSibling = null;
    // Scroll the note into view so it's visible after collapse
    setTimeout(() => noteElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

    // Allow scrolling on main container again
    document.body.style.overflow = "";

    // Hide the expanded note controls toolbar and restore saved settings
    if (expandedNoteControls) {
      expandedNoteControls.classList.remove("active");
    }
    import("./noteControls.js").then((module) => {
      module.removeExpandedNoteControls();
    });

    // RESTORE ALL DELETE BUTTONS
    setTimeout(recreateAllNoteButtons, 50);
  }

  // Update Quill editor layout after expanding/collapsing
  updateQuillEditorLayout(noteId);
}
