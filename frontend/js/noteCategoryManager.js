// noteCategoryManager.js - Simplified category selection modal

import { getCategories, getCurrentCategoryId } from "./state.js";
import { updateNote } from "./api.js";
import { showToast } from "./uiUtils.js";
import { loadNotes } from "./api.js";
import { getQuillEditor } from "./quillEditor.js"; // Import the function to get Quill editors

// Store the current note being edited for category
let currentEditNoteId = null;

// Show the category modal for selecting a note's category
export function showNoteCategoryModal(noteId) {
  // Store the note ID being edited
  currentEditNoteId = noteId;

  const noteElement = document.querySelector(`.note[data-id="${noteId}"]`);
  if (!noteElement) return;

  const categorySelector = noteElement.querySelector(".note-category");
  const currentNoteCategoryId = categorySelector
    ? categorySelector.dataset.categoryId
    : "null";

  const categoryModal = document.getElementById("categoryModal");
  const categoryModalHeader = document.getElementById("categoryModalHeader");
  const confirmCategoryBtn = document.getElementById("confirmCategoryBtn");
  const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");

  // Set modal title and mode
  categoryModalHeader.textContent = "Choose Category";
  categoryModal.dataset.mode = "note-category"; // Use this attribute to style/hide elements

  // --- Hide elements not needed for category selection ---
  document.getElementById("categoryEditId").value = ""; // Clear edit ID if reusing modal
  const categoryInput = document.getElementById("categoryInput");
  if (categoryInput) categoryInput.style.display = "none"; // Hide category name input

  const iconSelector = document.querySelector(".icon-selector");
  if (iconSelector) iconSelector.style.display = "none"; // Hide icon selector

  // --- Hide the 'Confirm' button specifically for this mode ---
  if (confirmCategoryBtn) confirmCategoryBtn.style.display = "none";

  // Create/find the category selection list container
  let categorySelectionDiv = document.getElementById("categorySelectionList");
  if (!categorySelectionDiv) {
    categorySelectionDiv = document.createElement("div");
    categorySelectionDiv.id = "categorySelectionList";
    categorySelectionDiv.className = "category-selection-list"; // Add class for styling

    const modalContent = categoryModal.querySelector(".modal-content");
    const modalActions = categoryModal.querySelector(".modal-actions"); // Find actions div
    if (modalActions) {
      modalContent.insertBefore(categorySelectionDiv, modalActions); // Insert list before buttons
    } else {
      modalContent.appendChild(categorySelectionDiv); // Fallback if no actions div
    }
  }

  // --- UPDATED: Create a container div for the two-column grid layout ---
  let categoryOptionsHTML = '<div class="category-selection-options">';

  // Always add "Uncategorized" option and mark if current
  const isCurrentlyUncategorized =
    !currentNoteCategoryId || currentNoteCategoryId === "null";
  categoryOptionsHTML += `
<div class="category-option${isCurrentlyUncategorized ? " selected" : ""}" data-category-id="null">
<div class="category-option-icon">📌</div>
<div class="category-option-name">Uncategorized</div>
</div>
`;

  // Add all available custom categories and mark if current
  const categories = getCategories();
  categories.forEach((category) => {
    const categoryId = category.id.toString();
    const isCurrent = categoryId === currentNoteCategoryId;
    categoryOptionsHTML += `
<div class="category-option${isCurrent ? " selected" : ""}" data-category-id="${categoryId}">
<div class="category-option-icon">${category.icon || "📁"}</div>
<div class="category-option-name">${category.name}</div>
</div>
`;
  });

  // Close the container div
  categoryOptionsHTML += "</div>";

  // Set the HTML with our two-column container
  categorySelectionDiv.innerHTML = categoryOptionsHTML;

  // --- Add event listeners to category options ---
  document.querySelectorAll(".category-option").forEach((option) => {
    option.addEventListener("click", async () => {
      if (!currentEditNoteId) return;

      const selectedCategoryId = option.dataset.categoryId;
      const noteIdToUpdate = currentEditNoteId;

      hideNoteCategoryModal();

      try {
        await changeNoteCategory(noteIdToUpdate, selectedCategoryId);
      } catch (error) {
        console.error("Failed to change category on click:", error);
        showToast("Error changing category");
      }
    });
  });

  // Show the modal
  categoryModal.classList.add("active");

  // Add click outside to close event handler
  categoryModal.onclick = function (e) {
    if (e.target === categoryModal) {
      hideNoteCategoryModal();
    }
  };
}

// Handle confirm button click in category selection mode
export async function handleNoteCategoryConfirm() {
  const categoryModal = document.getElementById("categoryModal");
  // Check if NOT in note-category mode OR if currentEditNoteId is null
  if (!currentEditNoteId || !categoryModal.dataset.mode === "note-category")
    return;

  // Get the selected category
  const selectedCategoryId = categoryModal.dataset.selectedCategoryId;
  if (!selectedCategoryId) {
    hideNoteCategoryModal();
    return;
  }

  const noteId = currentEditNoteId;

  // Close the modal
  hideNoteCategoryModal();

  // Change the note's category
  await changeNoteCategory(noteId, selectedCategoryId);
}

// Hide the category modal after selection - WITH PROPER RESET
export function hideNoteCategoryModal() {
  const categoryModal = document.getElementById("categoryModal");
  const iconSelector = document.querySelector(".icon-selector");
  const confirmCategoryBtn = document.getElementById("confirmCategoryBtn");
  const categoryInput = document.getElementById("categoryInput");

  if (!categoryModal) return;

  categoryModal.classList.remove("active");
  categoryModal.onclick = null;
  currentEditNoteId = null;

  // Restore hidden elements AFTER the fade-out transition (200ms) to avoid flash
  setTimeout(() => {
    categoryModal.removeAttribute("data-mode");
    if (categoryInput) categoryInput.style.display = "";
    if (iconSelector) iconSelector.style.display = "";
    if (confirmCategoryBtn) confirmCategoryBtn.style.display = "";
    const categorySelectionDiv = document.getElementById("categorySelectionList");
    if (categorySelectionDiv) categorySelectionDiv.innerHTML = "";
  }, 200);
}

// Change a note's category
export async function changeNoteCategory(noteId, categoryId) {
  try {
    // Get current content from the note
    const noteElement = document.querySelector(`.note[data-id="${noteId}"]`);
    if (!noteElement) return false;

    // Get content from Quill editor if available - FIXED: Use the proper function to get Quill editors
    let content = "";
    const quillEditor = getQuillEditor(noteId); // Use our imported function to get the editor

    if (quillEditor) {
      content = quillEditor.root.innerHTML;
    } else {
      // Fallback to textarea content
      const textarea = noteElement.querySelector(".note-content");
      content = textarea ? textarea.value : "";
    }

    // Make sure we have content
    if (!content || content.trim() === "") {
      console.warn(
        "Note content appears to be empty, trying to preserve existing content",
      );
      // Try to get content from note's data attribute as a last resort
      const contentPlaceholder = noteElement.querySelector(
        ".note-content-placeholder",
      );
      if (contentPlaceholder && contentPlaceholder.dataset.content) {
        content = decodeURIComponent(contentPlaceholder.dataset.content);
      }
    }

    console.log(
      `Updating note ${noteId} with content length: ${content.length}`,
    );

    // Prepare the category ID for the API
    // null for uncategorized, actual ID for categories
    const apiCategoryId = categoryId === "null" ? null : categoryId;

    // Call API to update the note with new category
    await updateNote(noteId, content, apiCategoryId);

    // Update the note category display
    updateNoteCategoryDisplay(noteElement, categoryId);

    // If we're in a specific category view and the note no longer belongs,
    // we may need to remove it from the current view
    const currentViewCategory = getCurrentCategoryId();

    if (
      currentViewCategory !== "all" &&
      currentViewCategory !== categoryId &&
      !(
        currentViewCategory === "uncategorized" &&
        (!categoryId || categoryId === "null")
      )
    ) {
      // If note is expanded, close it properly
      if (noteElement.classList.contains("expanded")) {
        // Remove expanded class
        noteElement.classList.remove("expanded");

        // Remove overlay
        const overlay = document.querySelector(".note-overlay");
        if (overlay) {
          overlay.classList.remove("active");
        }

        // Restore body scrolling
        document.body.style.overflow = "";
      }

      // Apply a fade-out effect before removal
      noteElement.style.transition = "opacity 0.5s";
      noteElement.style.opacity = "0";

      // Remove note after animation completes
      setTimeout(() => {
        if (noteElement.parentNode) {
          noteElement.parentNode.removeChild(noteElement);

          // If this was the last note, reload notes to show empty state
          const notesContainer = document.getElementById("notesContainer");
          if (notesContainer && !notesContainer.querySelector(".note")) {
            loadNotes();
          }
        }
      }, 500);
    }

    // Get category name for success message
    let categoryName = "Uncategorized";
    if (categoryId && categoryId !== "null") {
      const categories = getCategories();
      const category = categories.find(
        (cat) => cat.id.toString() === categoryId,
      );
      if (category) {
        categoryName = category.name;
      }
    }

    // Show success toast
    showToast(`Note moved to ${categoryName}`);

    return true;
  } catch (error) {
    console.error("Error changing note category:", error);
    showToast("Error changing category");
    return false;
  }
}

// Update a note's category display in the UI
export function updateNoteCategoryDisplay(noteElement, categoryId) {
  const categories = getCategories();
  const noteCategoryElement = noteElement.querySelector(".note-category");

  if (!noteCategoryElement) return;

  let categoryName, categoryIcon;

  if (!categoryId || categoryId === "null") {
    categoryName = "Uncategorized";
    categoryIcon = "📌";
  } else {
    const category = categories.find((c) => c.id.toString() === categoryId);
    categoryName = category ? category.name : "Uncategorized";
    categoryIcon = category ? category.icon : "📌";
  }

  noteCategoryElement.innerHTML = `
<div class="note-category-icon">${categoryIcon}</div>
<!-- <div class="note-category-name">${categoryName}</div> -->
`;

  // Update data attribute for reference
  noteCategoryElement.dataset.categoryId = categoryId || "null";
}
