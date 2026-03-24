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
  deleteEmptyCategories,
  deleteEmptyNotes,
  createCategory,
  updateCategory,
  deleteCategory,
  loadNotes,
  loadCategories,
  logout,
} from "./api.js";
import { renderNotes, renderCategories, toggleNoteExpansion } from "./ui.js";
import {
  showToast,
  showCategoryModal,
  hideCategoryModal,
  confirmDialog,
  confirmDialogWithCheckbox,
  confirmDialogWithForgotPassword,
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
  handleNoteCategoryConfirm,
  updateNoteCategoryDisplay,
  changeNoteCategory,
} from "./noteCategoryManager.js";
import {
  loadEncryptionSetup, hasEncryptionPassword, isUnlocked,
  setEncryptionPassword, removeEncryptionPassword, removeEncryptionPasswordForgotten, unlockWithPassword,
  unlockWithRecoveryKey, isEncryptionUiEnabled, setEncryptionUiEnabled,
  isEncryptionFeatureEnabled, setEncryptionFeatureEnabled
} from './encryptionManager.js';
// NOTE: saveEncryptionPassword and removeEncryptionPasswordApi are called internally
// by encryptionManager.js — do NOT import them here.

export function showUnlockModal(onSuccess) {
  const modal = document.getElementById('unlockEncryptionModal');
  document.getElementById('unlockPasswordInput').value = '';
  modal.classList.add('active');

  // Re-query inside cleanup to avoid stale references after replaceWith.
  const cleanup = () => {
    modal.classList.remove('active');
    const cb = document.getElementById('confirmUnlockBtn');
    const cancel = document.getElementById('cancelUnlockBtn');
    if (cb) cb.replaceWith(cb.cloneNode(true));
    if (cancel) cancel.replaceWith(cancel.cloneNode(true));
  };

  document.getElementById('cancelUnlockBtn').addEventListener('click', cleanup);

  document.getElementById('unlockPasswordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirmUnlockBtn').click();
  });

  document.getElementById('confirmUnlockBtn').addEventListener('click', async () => {
    const input = document.getElementById('unlockPasswordInput').value.trim();
    if (!input) { showToast('Please enter your password or recovery key'); return; }

    let ok = await unlockWithPassword(input);
    if (!ok) ok = await unlockWithRecoveryKey(input);

    if (ok) {
      cleanup();
      showToast('Notes unlocked for this session');
      if (onSuccess) onSuccess();
    } else {
      showToast('Incorrect password or recovery key');
    }
  });
}

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

  // Suggested names for icons (used when name input is empty)
  const ICON_NAMES = {
    '🛒': 'Shop', '🏋️': 'Fitness', '📚': 'Study', '💻': 'Dev', '💡': 'Ideas',
    '💼': 'Work', '✈️': 'Travel', '💰': 'Finance', '🎵': 'Music', '🎮': 'Gaming',
    '🍔': 'Food', '❤️': 'Health', '📝': 'Notes', '🏠': 'Home', '📱': 'Mobile',
    '🎬': 'Movies', '🔬': 'Science', '🎓': 'School', '🚗': 'Cars', '⭐': 'Favorites',
    '🏆': 'Goals', '🧠': 'Brain', '🍕': 'Pizza', '🚀': 'Space', '🌍': 'World',
    '📋': 'Tasks', '⏰': 'Schedule', '💪': 'Strength', '🌱': 'Garden', '📷': 'Photos',
    '🎸': 'Guitar', '☕': 'Coffee', '🏖️': 'Beach', '🔒': 'Private', '🎯': 'Goals',
  };

  // Icon selection
  document.querySelectorAll(".icon-item").forEach((iconItem) => {
    iconItem.addEventListener("click", () => {
      document.querySelectorAll(".icon-item").forEach((item) => {
        item.classList.remove("selected");
      });
      document.querySelectorAll(".suggestion-item").forEach((s) => {
        s.classList.remove("selected");
      });
      iconItem.classList.add("selected");
      elements.categoryIconInput.value = iconItem.dataset.icon;
      // Auto-fill name from icon's data-name
      const nameInput = elements.categoryInput;
      if (nameInput) {
        const suggested = iconItem.dataset.name || ICON_NAMES[iconItem.dataset.icon];
        if (suggested) nameInput.value = suggested;
      }
    });
  });

  // Suggestion chip selection
  document.querySelectorAll(".suggestion-item").forEach((suggestion) => {
    suggestion.addEventListener("click", () => {
      const icon = suggestion.dataset.icon;
      const name = suggestion.dataset.name;
      // Select matching icon in grid (if visible)
      document.querySelectorAll(".icon-item").forEach((item) => {
        item.classList.toggle("selected", item.dataset.icon === icon && item.style.display !== 'none');
      });
      document.querySelectorAll(".suggestion-item").forEach((s) => s.classList.remove("selected"));
      suggestion.classList.add("selected");
      if (elements.categoryIconInput) elements.categoryIconInput.value = icon;
      // Always fill name when picking a suggestion
      if (elements.categoryInput) elements.categoryInput.value = name;
      elements.categoryInput?.focus();
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

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
    });
  }

  // Settings modal elements — declared here so the Escape handler can close over them
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const settingsModalCloseBtn = document.getElementById("settingsModalCloseBtn");
  const deleteAllCategoriesBtn = document.getElementById("deleteAllCategoriesBtn");
  const deleteEmptyCategoriesBtn = document.getElementById("deleteEmptyCategoriesBtn");
  const deleteEmptyNotesBtn = document.getElementById("deleteEmptyNotesBtn");
  const deleteEverythingBtn = document.getElementById("deleteEverythingBtn");

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Close settings modal
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

  if (deleteEmptyNotesBtn) {
    deleteEmptyNotesBtn.addEventListener("click", handleDeleteEmptyNotes);
  }

  if (deleteEverythingBtn) {
    deleteEverythingBtn.addEventListener("click", handleDeleteEverything);
  }

  if (deleteEmptyCategoriesBtn) {
    deleteEmptyCategoriesBtn.addEventListener("click", handleDeleteEmptyCategories);
  }

  if (deleteAllCategoriesBtn) {
    deleteAllCategoriesBtn.addEventListener("click", handleDeleteAllCategories);
  }

  // Load encryption setup and update UI (settings modal + sidebar toggle)
  async function updateEncryptionUI() {
    await loadEncryptionSetup();
    const featureToggle = document.getElementById('encryptionFeatureToggle');
    const details = document.getElementById('encryptionDetails');
    const noPassword = document.getElementById('encryptionNoPassword');
    const hasPassword = document.getElementById('encryptionHasPassword');

    const featureOn = isEncryptionFeatureEnabled();
    if (featureToggle) featureToggle.checked = featureOn;
    if (details) details.style.display = featureOn ? '' : 'none';

    if (featureOn && noPassword && hasPassword) {
      const has = hasEncryptionPassword();
      noPassword.style.display = has ? 'none' : '';
      hasPassword.style.display = has ? '' : 'none';
      if (has) {
        const toggle = document.getElementById('encryptionEnabledToggle');
        const notice = document.getElementById('encryptionDisabledNotice');
        if (toggle) toggle.checked = isEncryptionUiEnabled();
        if (notice) notice.style.display = isEncryptionUiEnabled() ? 'none' : '';
      }
    }

    // Keep sidebar "Show Encrypted" row in sync
    syncSidebarEncryptionToggle();
  }

  function syncSidebarEncryptionToggle() {
    const row = document.getElementById('strictDecryptToggleRow');
    if (!row) return;
    const visible = isEncryptionFeatureEnabled() && hasEncryptionPassword();
    row.style.display = visible ? '' : 'none';
  }

  updateEncryptionUI();

  // Feature-level toggle (enable/disable encryption entirely)
  document.getElementById('encryptionFeatureToggle')?.addEventListener('change', e => {
    setEncryptionFeatureEnabled(e.target.checked);
    const details = document.getElementById('encryptionDetails');
    if (details) details.style.display = e.target.checked ? '' : 'none';
    syncSidebarEncryptionToggle();
  });

  // Controls-on-notes toggle
  document.getElementById('encryptionEnabledToggle')?.addEventListener('change', e => {
    const enabled = e.target.checked;
    setEncryptionUiEnabled(enabled);
    const notice = document.getElementById('encryptionDisabledNotice');
    if (notice) notice.style.display = enabled ? 'none' : '';
  });

  const setEncryptionPasswordBtn = document.getElementById('setEncryptionPasswordBtn');
  const cancelSetEncryptionBtn = document.getElementById('cancelSetEncryptionBtn');
  const confirmSetEncryptionBtn = document.getElementById('confirmSetEncryptionBtn');
  const setEncryptionModal = document.getElementById('setEncryptionModal');

  function openSetEncryptionModal() {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) settingsModal.classList.remove('active');
    document.getElementById('encNewPassword').value = '';
    document.getElementById('encConfirmPassword').value = '';
    setEncryptionModal.classList.add('active');
  }

  if (setEncryptionPasswordBtn) setEncryptionPasswordBtn.addEventListener('click', openSetEncryptionModal);
  if (cancelSetEncryptionBtn) cancelSetEncryptionBtn.addEventListener('click', () => setEncryptionModal.classList.remove('active'));

  ['encNewPassword', 'encConfirmPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmSetEncryptionBtn?.click();
    });
  });

  if (confirmSetEncryptionBtn) {
    confirmSetEncryptionBtn.addEventListener('click', async () => {
      const pwd = document.getElementById('encNewPassword').value;
      const confirm = document.getElementById('encConfirmPassword').value;
      if (!pwd) { showToast('Please enter a password'); return; }
      if (pwd !== confirm) { showToast('Passwords do not match'); return; }
      if (pwd.length < 6) { showToast('Password must be at least 6 characters'); return; }

      confirmSetEncryptionBtn.disabled = true;
      confirmSetEncryptionBtn.textContent = 'Setting up…';
      try {
        const recoveryKey = await setEncryptionPassword(pwd);
        setEncryptionModal.classList.remove('active');
        document.getElementById('recoveryKeyDisplay').textContent = recoveryKey;
        document.getElementById('recoveryKeyModal').classList.add('active');
        updateEncryptionUI();
      } catch (err) {
        showToast('Error setting encryption password');
        console.error(err);
      } finally {
        confirmSetEncryptionBtn.disabled = false;
        confirmSetEncryptionBtn.textContent = 'Set Password';
      }
    });
  }

  document.getElementById('copyRecoveryKeyBtn')?.addEventListener('click', () => {
    const key = document.getElementById('recoveryKeyDisplay').textContent;
    navigator.clipboard.writeText(key).then(() => showToast('Recovery key copied'));
  });

  document.getElementById('savedRecoveryKeyBtn')?.addEventListener('click', () => {
    document.getElementById('recoveryKeyModal').classList.remove('active');
    showToast('Encryption password set');
  });

  document.getElementById('removeEncryptionPasswordBtn')?.addEventListener('click', async () => {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) settingsModal.classList.remove('active');

    const { confirmed, forgotPassword } = await confirmDialogWithForgotPassword(
      'This will decrypt all your encrypted notes and remove the encryption password. Are you sure?',
      'Remove Encryption Password',
      'Remove'
    );
    if (!confirmed) return;

    if (forgotPassword) {
      try {
        await removeEncryptionPasswordForgotten();
        await loadNotes();
        updateEncryptionUI();
        showToast('Encrypted notes deleted and encryption password removed');
      } catch (err) {
        showToast('Error removing encryption password');
        console.error(err);
      }
      return;
    }

    if (!isUnlocked()) {
      showToast('Please unlock your notes first before removing encryption');
      showUnlockModal();
      return;
    }

    try {
      await removeEncryptionPassword();
      await loadNotes();
      updateEncryptionUI();
      showToast('Encryption password removed');
    } catch (err) {
      showToast('Error removing encryption password');
      console.error(err);
    }
  });

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
    await renderNotes();

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
  // Skip saving if note is encrypted or read-only
  const noteEl = document.querySelector(`.note[data-id="${noteId}"]`);
  if (noteEl && (noteEl.dataset.encrypted === 'true' || noteEl.dataset.readOnly === 'true')) return;

  // Update locally for immediate feedback
  const note = updateNoteInState(noteId, content);
  if (!note) return;

  // Debounce the API call to avoid too many requests while typing
  clearTimeout(note.saveTimeout);
  note.saveTimeout = setTimeout(async () => {
    // Re-check: note may have been encrypted/locked in the 500ms window
    const el = document.querySelector(`.note[data-id="${noteId}"]`);
    if (el && (el.dataset.encrypted === 'true' || el.dataset.readOnly === 'true')) return;
    await updateNote(noteId, content, note.category_id);
  }, 500); // Wait 500ms after typing stops
}

// Handle note deletion
export async function handleNoteDelete(noteId) {
  const noteEl = document.querySelector(`.note[data-id="${noteId}"]`);
  if (noteEl && noteEl.dataset.encrypted === "true") {
    showToast("Decrypt the note before deleting it");
    return;
  }
  if (noteEl && noteEl.dataset.readOnly === "true") {
    showToast("Cannot delete a read-only note");
    return;
  }

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
    await renderNotes();
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

  // Close sidebar on mobile and tablet
  if (window.innerWidth <= 1199) {
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
      setNotes(getNotes().filter(
        (note) => note.category_id?.toString() !== categoryId
      ));
    } else {
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
      await renderNotes();

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

    // Hide the used icon immediately in the modal (auto-selects next icon)
    hideIconInModal(icon);

    // Fill name for the next auto-selected icon
    const nextIcon = elements.categoryIconInput.value;
    const nextIconEl = nextIcon ? document.querySelector(`.icon-item[data-icon="${nextIcon}"]`) : null;
    elements.categoryInput.value = nextIconEl?.dataset.name || '';

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
  // Close settings modal before showing confirm dialog (never stack modals)
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) settingsModal.classList.remove("active");

  const confirmed = await confirmDialog(
    "Are you sure?",
    "Delete All Categories",
    "Yes",
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

// Handle deletion of everything — all notes and all categories
export async function handleDeleteEverything() {
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) settingsModal.classList.remove("active");

  const confirmed = await confirmDialog(
    "This will permanently delete ALL your notes and ALL categories. This cannot be undone.",
    "Delete Everything",
    "Delete Everything",
  );

  if (confirmed) {
    showToast("Deleting everything…");

    await deleteAllNotesInCategory("all");
    await deleteAllCategories();

    setCategories([]);
    setCurrentCategoryId("all");
    await loadCategories();
    await loadNotes();

    showToast("Everything deleted");
  }
}

// Handle deletion of empty notes
export async function handleDeleteEmptyNotes() {
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) settingsModal.classList.remove("active");

  const confirmed = await confirmDialog(
    "Remove all notes that are empty or contain only whitespace?",
    "Remove Empty Notes",
    "Remove",
  );

  if (confirmed) {
    const result = await deleteEmptyNotes();

    if (!result.error) {
      if (result.count === 0) {
        showToast("No empty notes found");
        return;
      }

      await loadNotes();
      showToast(`Removed ${result.count} empty note${result.count === 1 ? "" : "s"}`);
    }
  }
}

// Handle deletion of empty categories
export async function handleDeleteEmptyCategories() {
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) settingsModal.classList.remove("active");

  const categories = getCategories();
  if (categories.length === 0) {
    showToast("No categories to remove");
    return;
  }

  const confirmed = await confirmDialog(
    "Remove all categories that have no notes?",
    "Remove Empty Categories",
    "Remove",
  );

  if (confirmed) {
    const result = await deleteEmptyCategories();

    if (!result.error) {
      if (result.count === 0) {
        showToast("No empty categories found");
        return;
      }

      // Switch to all-notes view first, then reload fresh data from server
      setCurrentCategoryId("all");
      await loadCategories();
      await loadNotes();

      showToast(`Removed ${result.count} empty categor${result.count === 1 ? "y" : "ies"}`);
    }
  }
}
