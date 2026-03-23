// eventHandlers.js - Event handler functions with modal category selection
import {
  getCurrentCategoryId,
  setCurrentCategoryId,
  updateNoteInState,
  removeNoteFromState,
  addNoteToState,
  addCategoryToState,
  updateCategoryInState,
  removeCategoryFromState,
  setNotes,
  getNotes,
  setDarkMode,
  setCategories,
  elements,
} from "./state.js";
import {
  createNote,
  updateNote,
  deleteNote,
  deleteAllNotesInCategory,
  deleteAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  loadNotes,
  logout,
} from "./api.js";
import { renderNotes, renderCategories, toggleNoteExpansion } from "./ui.js";
import {
  showToast,
  showCategoryModal,
  hideCategoryModal,
  confirmDialog,
  getCategoryName,
  updateButtonPlacement,
  hideIconInModal,
} from "./uiUtils.js";
import { getCategories } from "./state.js";
import {
  destroyQuillEditor,
  focusQuillEditor,
  applyToolbarVisibility,
} from "./quillEditor.js";
import { toggleDarkMode } from "./darkMode.js";
import {
  showNoteCategoryModal,
  hideNoteCategoryModal,
  handleNoteCategoryConfirm,
  updateNoteCategoryDisplay,
  changeNoteCategory,
} from "./noteCategoryManager.js";

// Setup all event listeners with null check for cancelCategoryBtn
export function setupEventListeners() {
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

  // Add note button
  if (addNoteBtn) {
    addNoteBtn.addEventListener("click", createNewNote);
  }

  // Add category button
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener("click", () => {
      showCategoryModal();
    });
  }

  // Dark mode toggle
  if (darkModeToggle) {
    darkModeToggle.addEventListener("change", handleDarkModeToggle);
  }

  // Icon selection
  document.querySelectorAll(".icon-item").forEach((iconItem) => {
    iconItem.addEventListener("click", () => {
      // Remove selected class from all icons
      document.querySelectorAll(".icon-item").forEach((item) => {
        item.classList.remove("selected");
      });

      // Add selected class to clicked icon
      iconItem.classList.add("selected");

      // Update hidden input value
      elements.categoryIconInput.value = iconItem.dataset.icon;
    });
  });

  // Handle Enter key in category modal
  if (categoryInput) {
    categoryInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Prevent form submission if inside a form
        if (elements.categoryEditId.value) {
          handleCategoryUpdate();
        } else {
          handleCategoryCreate(); // Add category but keep modal open
        }
      }
    });
  }

  // Category modal buttons - Add null check for cancelCategoryBtn
  if (cancelCategoryBtn) {
    cancelCategoryBtn.addEventListener("click", handleCategoryModalCancel);
  }

  if (confirmCategoryBtn) {
    confirmCategoryBtn.addEventListener("click", handleCategoryModalConfirm);
  }

  // Close modal when clicking outside
  if (categoryModal) {
    categoryModal.addEventListener("click", (e) => {
      if (e.target === categoryModal) {
        handleCategoryModalCancel();
      }
    });
  }

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

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
    });
  }

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

  // Handle window resize
  window.addEventListener("resize", updateButtonPlacement);

  // Make category functions available globally for the UI
  window.showNoteCategoryModal = showNoteCategoryModal;
  window.updateNoteCategoryDisplay = updateNoteCategoryDisplay;
  window.changeNoteCategory = changeNoteCategory;
}

// Handle dark mode toggle
export function handleDarkModeToggle(event) {
  const isDarkMode = event.target.checked;
  setDarkMode(isDarkMode);
  toggleDarkMode(event);
  showToast(isDarkMode ? "Dark mode enabled" : "Light mode enabled");
}

// Create a new note
export async function createNewNote() {
  const currentCategoryId = getCurrentCategoryId();
  const createdNote = await createNote(currentCategoryId);

  if (createdNote) {
    addNoteToState(createdNote);
    renderNotes();

    // Focus on the new note - now uses Quill
    setTimeout(() => {
      // Focus on the Quill editor of the first note
      const firstNote = document.querySelector(".note");
      if (firstNote) {
        const noteId = firstNote.dataset.id;

        // Apply current toolbar visibility setting to the new note
        applyToolbarVisibility(noteId);

        focusQuillEditor(noteId);
      }
    }, 100); // Slightly longer delay to ensure Quill is fully initialized
  }
}

// Handle note input (debounced)
export function handleNoteInput(noteId, content) {
  // Update locally for immediate feedback
  const note = updateNoteInState(noteId, content);
  if (!note) return;

  // Debounce the API call to avoid too many requests while typing
  clearTimeout(note.saveTimeout);
  note.saveTimeout = setTimeout(async () => {
    await updateNote(noteId, content, note.category_id);
  }, 500); // Wait 500ms after typing stops
}

// Handle note deletion
export async function handleNoteDelete(noteId) {
  const success = await deleteNote(noteId);

  if (success) {
    // Check if deleted note was expanded
    const expandedNote = document.querySelector(".note.expanded");
    if (expandedNote && expandedNote.dataset.id == noteId) {
      // remove expanded note from DOM
      expandedNote.remove();

      // also remove the overlay
      const overlay = document.querySelector(".note-overlay");
      if (overlay) {
        overlay.classList.remove("active");
      }

      // restore body scrolling
      document.body.style.overflow = "";
    }

    // Clean up Quill editor instance
    destroyQuillEditor(noteId);

    removeNoteFromState(noteId);
    renderNotes();
    showToast("Note deleted");
  }
}

// Handle note expansion
export function handleNoteExpand(noteElement) {
  toggleNoteExpansion(noteElement);
}

// Handle category selection
export async function handleCategoryClick(newCategoryId) {
  const currentCategoryId = getCurrentCategoryId();
  if (newCategoryId === currentCategoryId) return; // Skip if already active

  setCurrentCategoryId(newCategoryId);
  document
    .querySelectorAll(".category")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelector(`.category[data-id="${newCategoryId}"]`)
    ?.classList.add("active");

  await loadNotes();
  renderCategories(); // Update header

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector(".sidebar");
    const sidebarOverlay = document.querySelector(".sidebar-overlay");

    sidebar.classList.remove("active");
    sidebarOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// Handle category edit
export function handleCategoryEdit(categoryId) {
  const categories = getCategories();
  const category = categories.find((cat) => cat.id.toString() === categoryId);

  if (category) {
    showCategoryModal(true, categoryId, category.name, category.icon);
  }
}

// Handle category delete
export async function handleCategoryDelete(categoryId) {
  const categories = getCategories();
  const categoryName = getCategoryName(categoryId, categories);

  const confirmed = await confirmDialog(
    `Are you sure you want to delete ALL notes in "${categoryName}"? This action cannot be undone.`,
    "Confirm Delete",
    "Delete All",
  );

  if (confirmed) {
    const success = await deleteCategory(categoryId);

    if (success) {
      removeCategoryFromState(categoryId);

      // If current category is being deleted, switch to all notes
      if (getCurrentCategoryId() === categoryId) {
        setCurrentCategoryId("all");
      }

      await loadNotes(); // Reload notes to get updated category assignments
      renderCategories();
      showToast("Category deleted");
    }
  }
}

// Handle bulk delete of notes
export async function handleBulkDelete() {
  const categoryId = getCurrentCategoryId();
  const categories = getCategories();
  const categoryName = getCategoryName(categoryId, categories);

  const confirmed = await confirmDialog(
    `Are you sure you want to delete ALL notes in "${categoryName}"? This action cannot be undone.`,
  );

  if (confirmed) {
    // If there are no notes, show message and return
    if (getNotes().length === 0) {
      showToast("No notes to delete");
      return;
    }

    // Show loading message
    showToast("Deleting notes...");

    const result = await deleteAllNotesInCategory(categoryId);

    if (!result.error) {
      // Clean up all Quill editor instances for the notes being deleted
      const notes = getNotes();
      notes.forEach((note) => {
        destroyQuillEditor(note.id);
      });

      // Clear notes array
      setNotes([]);

      // Check if any notes were expanded
      const expandedNote = document.querySelector(".note.expanded");
      if (expandedNote) {
        // Remove expanded note from DOM
        expandedNote.remove();

        // Also remove the overlay
        const overlay = document.querySelector(".note-overlay");
        if (overlay) {
          overlay.classList.remove("active");
        }

        // Restore body scrolling
        document.body.style.overflow = "";
      }

      // Render empty notes container
      renderNotes();

      // Show success message with count if available
      if (result.count !== undefined) {
        showToast(`Deleted ${result.count} notes from "${categoryName}"`);
      } else {
        showToast(`All notes in "${categoryName}" deleted`);
      }
    }
  }
}

// Handle category creation - modified for multiple additions
export async function handleCategoryCreate() {
  const name = elements.categoryInput.value.trim();
  let icon = elements.categoryIconInput.value.trim();

  if (!name) {
    showToast("Please enter a category name");
    return;
  }

  // Default icon if none provided
  if (!icon) {
    icon = "📁";
  }

  const newCategory = await createCategory(name, icon);

  if (newCategory) {
    // Add to state and update UI
    addCategoryToState(newCategory);
    renderCategories();

    // Hide the used icon immediately in the modal
    hideIconInModal(icon);

    // Clear the input field for next category
    elements.categoryInput.value = "";

    // Focus on the input field for next category
    elements.categoryInput.focus();

    // Show success toast
    showToast("Category added");
  }
}

// Handle category update
export async function handleCategoryUpdate() {
  const id = elements.categoryEditId.value;
  const name = elements.categoryInput.value.trim();
  let icon = elements.categoryIconInput.value.trim();

  if (!name) {
    showToast("Please enter a category name");
    return;
  }

  // Default icon if none provided
  if (!icon) {
    icon = "📁";
  }

  // Get the original category to check if icon is changing
  const categories = getCategories();
  const originalCategory = categories.find((cat) => cat.id.toString() === id);
  const originalIcon = originalCategory ? originalCategory.icon : null;

  const updatedCategory = await updateCategory(id, name, icon);

  if (updatedCategory) {
    updateCategoryInState(id, updatedCategory);
    renderCategories();
    hideCategoryModal();
    showToast("Category updated");
  }
}

// Handle category modal confirm based on mode
function handleCategoryModalConfirm() {
  const categoryModal = document.getElementById("categoryModal");
  if (categoryModal.dataset.mode === "note-category") {
    handleNoteCategoryConfirm();
  } else if (elements.categoryEditId.value) {
    handleCategoryUpdate();
  } else {
    handleCategoryCreate();
  }
}

// Modified cancel button handler for category modal
export function handleCategoryModalCancel() {
  // Just call hideCategoryModal which has null checks
  hideCategoryModal();
}

// Handle deletion of all categories
export async function handleDeleteAllCategories() {
  const confirmed = await confirmDialog(
    "Are you sure you want to delete ALL categories? All notes will be moved to Uncategorized. This action cannot be undone.",
    "Delete All Categories",
    "Delete All",
  );

  if (confirmed) {
    // If there are no categories, show message and return
    if (getCategories().length === 0) {
      showToast("No categories to delete");
      return;
    }

    // Show loading message
    showToast("Deleting all categories...");

    // Call the API to delete all categories
    const result = await deleteAllCategories();

    if (!result.error) {
      // Clear categories array
      setCategories([]);

      // Switch to all notes view
      setCurrentCategoryId("all");

      // Reload notes to reflect changes
      await loadNotes();

      // Re-render categories
      renderCategories();

      // Show success message
      if (result.count !== undefined) {
        showToast(`Deleted ${result.count} categories`);
      } else {
        showToast("All categories deleted");
      }
    }
  }
}
