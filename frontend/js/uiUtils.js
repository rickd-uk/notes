// uiUtils.js - UI utility functions
import { elements, getCategories } from './state.js';
import { handleNoteDelete } from './eventHandlers.js';

// Show toast notification
export function showToast(message, duration = 3000) {
  const toast = elements.toast;
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Function to physically remove all delete buttons except for expanded note
export function hideAllNoteButtons() {
  // Instead of hiding, completely detach from DOM
  document.querySelectorAll('.note:not(.expanded) .note-delete').forEach(btn => {
    if (btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
  });
}

// Function to recreate delete buttons when modals are closed
export function recreateAllNoteButtons() {
  document.querySelectorAll('.note').forEach(note => {
    // Only add if doesn't exist
    if (!note.querySelector('.note-delete')) {
      const newBtn = document.createElement('button');
      newBtn.className = 'note-delete';
      newBtn.title = 'Delete note';
      newBtn.innerHTML = '🗑️';
            
      const noteId = note.dataset.id;
      if (noteId) {
        newBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleNoteDelete(noteId);
        });
      }
      
      note.appendChild(newBtn);
    }
  });
}

// Function to check if we need to show the "no icons available" message
export function updateIconGridVisibility() {
  const iconGrid = document.getElementById('iconGrid');
  if (!iconGrid) return;
  
  // Count visible icons
  const visibleIcons = iconGrid.querySelectorAll('.icon-item:not([style*="display: none"])');
  
  // Remove any existing no-icons message
  const existingMessage = iconGrid.querySelector('.no-icons-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // If no icons are visible, add a message
  if (visibleIcons.length === 0) {
    const message = document.createElement('div');
    message.className = 'no-icons-message';
    message.textContent = 'All icons are in use. Delete a category to free up icons.';
    iconGrid.appendChild(message);
  }
}

// Helper function to get icons that are already in use
function getUsedIcons(excludeCategoryId = null) {
  const categories = getCategories();
  
  // Filter out icons from all categories except the one being edited
  return categories
    .filter(cat => cat.id && cat.id.toString() !== excludeCategoryId)
    .map(cat => cat.icon)
    .filter(icon => icon); // Remove any null/undefined icons
}

// Show category modal with modified buttons for multi-add
export function showCategoryModal(isEdit = false, categoryId = null, categoryName = '', categoryIcon = '📁') {
  const {
    categoryModal,
    categoryModalHeader,
    confirmCategoryBtn,
    categoryInput,
    categoryIconInput,
    categoryEditId
  } = elements;
  
  // Check if all required elements exist
  if (!categoryModal || !categoryModalHeader || !confirmCategoryBtn) {
    console.error('Missing required elements for category modal');
    return;
  }
  
  // HIDE ALL DELETE BUTTONS
  hideAllNoteButtons();
  
  // Change text based on mode
  categoryModalHeader.textContent = isEdit ? 'Edit Category' : 'Add Categories';
  confirmCategoryBtn.textContent = isEdit ? 'Update' : 'Add';

  // Set the mode for CSS targeting and state management
  categoryModal.dataset.mode = isEdit ? 'edit' : 'add';
  
  // Modify Cancel button's text and behavior in Add Categories mode if it exists
  const cancelCategoryBtn = elements.cancelCategoryBtn || document.getElementById('cancelCategoryBtn');
  if (cancelCategoryBtn) {
    if (!isEdit) {
      cancelCategoryBtn.textContent = 'Close';
    } else {
      cancelCategoryBtn.textContent = 'Cancel';
    }
  }
  
  // Filter out icons that are already in use
  const usedIcons = getUsedIcons(categoryId); // Skip the current category when editing
  
  // Reset icon selection - only show available icons
  const allIconItems = document.querySelectorAll('.icon-item');
  allIconItems.forEach(item => {
    const iconValue = item.dataset.icon;
    item.classList.remove('selected');
    
    // If this icon is already used by another category, hide it
    if (usedIcons.includes(iconValue) && !(isEdit && iconValue === categoryIcon)) {
      item.style.display = 'none';
    } else {
      // Otherwise, show it
      item.style.display = '';
    }
  });

  // Make sure category list content is empty
  const categorySelectionDiv = document.getElementById('categorySelectionList');
  if (categorySelectionDiv) {
    categorySelectionDiv.innerHTML = '';
  }
  
  // Check if we need to show the "no icons available" message
  updateIconGridVisibility();
  
  if (isEdit) {
    categoryEditId.value = categoryId;
    categoryInput.value = categoryName;
    
    // Set selected icon - this will always be visible because we excluded it in usedIcons
    const iconElement = document.querySelector(`.icon-item[data-icon="${categoryIcon}"]`);
    if (iconElement) {
      iconElement.classList.add('selected');
      categoryIconInput.value = categoryIcon;
    } else {
      // Find the first available icon if the current one doesn't exist
      const firstVisibleIcon = document.querySelector('.icon-item:not([style*="display: none"])');
      if (firstVisibleIcon) {
        firstVisibleIcon.classList.add('selected');
        categoryIconInput.value = firstVisibleIcon.dataset.icon;
      }
    }
  } else {
    // For new categories, select the first available icon
    const firstVisibleIcon = document.querySelector('.icon-item:not([style*="display: none"])');
    if (firstVisibleIcon) {
      firstVisibleIcon.classList.add('selected');
      categoryIconInput.value = firstVisibleIcon.dataset.icon;
    }
    
    categoryInput.value = '';
    categoryEditId.value = '';
  }
  
  // Ensure modal has high z-index and dark background
  categoryModal.style.zIndex = '9000';
  categoryModal.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
  
  // Set data attribute for CSS targeting
  categoryModal.dataset.mode = isEdit ? 'edit' : 'add';
  
  // Make modal content stand out
  const modalContent = categoryModal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.style.zIndex = '9001';
    modalContent.style.position = 'relative';
  }
  
  categoryModal.classList.add('active');
  categoryInput.focus();

  // Set up click outside handler
  categoryModal.onclick = function(e) {
    if (e.target === categoryModal) {
      hideCategoryModal();
    }
  };
}

// Hide category modal and restore buttons
export function hideCategoryModal() {
  const {
    categoryModal,
    categoryInput,
    categoryIconInput,
    categoryEditId
  } = elements;
  
  if (!categoryModal) return;
  
  categoryModal.classList.remove('active');
  
  if (categoryInput) categoryInput.value = '';
  if (categoryIconInput) categoryIconInput.value = '📁';
  if (categoryEditId) categoryEditId.value = '';
  
  // Reset cancel button text for other modals if it exists
  const cancelCategoryBtn = elements.cancelCategoryBtn || document.getElementById('cancelCategoryBtn');
  if (cancelCategoryBtn) {
    cancelCategoryBtn.textContent = 'Cancel';
  }
  
  // Remove data-mode attribute
  categoryModal.removeAttribute('data-mode');
  
  // Reset modal styles
  categoryModal.style = '';
  const modalContent = categoryModal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.style = '';
  }

  // Remove any category selection list content
  const categorySelectionDiv = document.getElementById('categorySelectionList');
  if (categorySelectionDiv) {
    categorySelectionDiv.innerHTML = '';
  }
  
  // Make sure these are visible for next use
  if (categoryInput) categoryInput.style.display = '';
  const iconSelector = document.querySelector('.icon-selector');
  if (iconSelector) iconSelector.style.display = '';
  
  // RESTORE ALL DELETE BUTTONS
  setTimeout(recreateAllNoteButtons, 50);

  // Remove click handler to prevent memory leaks
  categoryModal.onclick = null;
}

// Confirm dialog with custom modal (returns Promise)
export function confirmDialog(message, headerText = 'Confirm Delete', confirmBtnText = 'Delete All') {
  return new Promise((resolve) => {
    // Get modal elements
    const confirmModal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmModalMessage');
    const headerEl = document.getElementById('confirmModalHeader');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelConfirmBtn');
    
    // Set content
    messageEl.textContent = message;
    headerEl.textContent = headerText;
    confirmBtn.textContent = confirmBtnText;
    
    // Show the modal
    confirmModal.classList.add('active');
    
    // Set up event listeners
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };
    
    const handleOutsideClick = (e) => {
      if (e.target === confirmModal) {
        handleCancel();
      }
    };
    
    // Cleanup function to remove event listeners
    const cleanup = () => {
      confirmModal.classList.remove('active');
      cancelBtn.removeEventListener('click', handleCancel);
      confirmBtn.removeEventListener('click', handleConfirm);
      document.removeEventListener('keydown', handleKeydown);
      confirmModal.removeEventListener('click', handleOutsideClick);
    };
    
    // Add event listeners
    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);
    document.addEventListener('keydown', handleKeydown);
    confirmModal.addEventListener('click', handleOutsideClick);
  });
}

// Get category name by ID
export function getCategoryName(categoryId, categories) {
  if (categoryId === 'all') {
    return 'All Notes';
  } else if (categoryId === 'uncategorized') {
    return 'Uncategorized';
  } else {
    const category = categories.find(cat => cat.id.toString() === categoryId);
    return category ? category.name : 'Unknown Category';
  }
}

// Format date for note timestamp
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Handle proper button placement when window is resized
export function updateButtonPlacement() {
  const notesHeader = document.querySelector('.notes-header');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const addNoteBtn = document.getElementById('addNoteBtn');
  
  if (bulkDeleteBtn && notesHeader && addNoteBtn) {
    if (window.innerWidth <= 1199) {
      // Move to left side on mobile (after hamburger button)
      const navToggle = document.getElementById('navToggleBtn');
      const insertAfter = navToggle ? navToggle.nextSibling : notesHeader.firstChild;
      notesHeader.insertBefore(bulkDeleteBtn, insertAfter);
    } else {
      // Move between title and add button on desktop
      notesHeader.insertBefore(bulkDeleteBtn, addNoteBtn);
    }
  }
}

// Function to hide a specific icon in the modal
export function hideIconInModal(icon) {
  if (!icon) return;
  
  const iconElement = document.querySelector(`.icon-item[data-icon="${icon}"]`);
  if (iconElement) {
    iconElement.style.display = 'none';
    
    // If this was the selected icon, select another visible one
    if (iconElement.classList.contains('selected')) {
      selectFirstAvailableIcon();
    }
    
    // Update visibility to show message if needed
    updateIconGridVisibility();
  }
}

// Function to select the first available icon
export function selectFirstAvailableIcon() {
  // Clear all selections
  document.querySelectorAll('.icon-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Find and select first visible icon
  const firstVisibleIcon = document.querySelector('.icon-item:not([style*="display: none"])');
  if (firstVisibleIcon) {
    firstVisibleIcon.classList.add('selected');
    if (elements.categoryIconInput) {
      elements.categoryIconInput.value = firstVisibleIcon.dataset.icon;
    }
    return firstVisibleIcon.dataset.icon;
  }
  
  return null; // No visible icons found
}
