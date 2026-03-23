// state.js - Application state management

// Application state
let state = {
  notes: [],
  categories: [],
  currentCategoryId: 'all',
  apiUrl: '/api', // Use relative path for same-origin requests
  darkMode: localStorage.getItem('darkMode') === 'true' // Track dark mode state
};

// DOM element references
export const elements = {
  notesContainer: document.getElementById('notesContainer'),
  categoriesContainer: document.querySelector('.categories'),
  currentCategoryElement: document.querySelector('.current-category'),
  addNoteBtn: document.getElementById('addNoteBtn'),
  emptyAddNoteBtn: document.getElementById('emptyAddNoteBtn'),
  addCategoryBtn: document.getElementById('addCategoryBtn'),
  categoryModal: document.getElementById('categoryModal'),
  categoryModalHeader: document.getElementById('categoryModalHeader'),
  categoryInput: document.getElementById('categoryInput'),
  categoryIconInput: document.getElementById('categoryIconInput'),

  cancelCategoryBtn: document.getElementById('cancelCategoryBtn'),

  confirmCategoryBtn: document.getElementById('confirmCategoryBtn'),
  categoryEditId: document.getElementById('categoryEditId'),
  toast: document.getElementById('toast'),
  logoutBtn: document.getElementById('logoutBtn'),
  darkModeToggle: document.getElementById('darkModeToggle'),

  usernameDisplay: document.getElementById('usernameDisplay')
};

// Initialize state
export function initState() {
  // Initialize dark mode state
  if (state.darkMode) {
    document.body.classList.add('dark-mode');
    if (elements.darkModeToggle) {
      elements.darkModeToggle.checked = true;
    }
  }
  
  return state;
}

export function getCurrentUser() {
  return state.currentUser;
}

export function setCurrentUser(user) {
  state.currentUser = user;
}

// State getters
export function getNotes() {
  return state.notes;
}

export function getCategories() {
  return state.categories;
}

export function getCurrentCategoryId() {
  return state.currentCategoryId;
}

export function getApiUrl() {
  return state.apiUrl;
}

export function isDarkMode() {
  return state.darkMode;
}

// State setters
export function setNotes(notes) {
  state.notes = notes;
}

export function setCategories(categories) {
  state.categories = categories;
}

export function setCurrentCategoryId(categoryId) {
  state.currentCategoryId = categoryId;
}

export function setDarkMode(isDark) {
  state.darkMode = isDark;
  localStorage.setItem('darkMode', isDark.toString());
}

// Update a specific note in the state
export function updateNoteInState(noteId, content) {
  const noteIndex = state.notes.findIndex(note => note.id == noteId);
  if (noteIndex !== -1) {
    state.notes[noteIndex].content = content;
    return state.notes[noteIndex];
  }
  return null;
}

// Add a note to the state
export function addNoteToState(note) {
  state.notes.unshift(note);
}

// Remove a note from the state
export function removeNoteFromState(noteId) {
  state.notes = state.notes.filter(note => note.id != noteId);
}

// Add a category to the state
export function addCategoryToState(category) {
  state.categories.push(category);
}

// Update a category in the state
export function updateCategoryInState(categoryId, updatedCategory) {
  const categoryIndex = state.categories.findIndex(cat => cat.id.toString() === categoryId);
  if (categoryIndex !== -1) {
    state.categories[categoryIndex] = updatedCategory;
    return true;
  }
  return false;
}

// Remove a category from the state
export function removeCategoryFromState(categoryId) {
  state.categories = state.categories.filter(cat => cat.id.toString() !== categoryId);
}


// Helper function to check if modal elements exist and create them if needed
export function ensureModalElements() {
  // Check if we need to re-fetch the cancel button (might have been added dynamically)
  if (!elements.cancelCategoryBtn) {
    elements.cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
  }
  
  // Re-fetch other potentially missing elements
  if (!elements.categoryModal) {
    elements.categoryModal = document.getElementById('categoryModal');
  }
  
  if (!elements.categoryModalHeader) {
    elements.categoryModalHeader = document.getElementById('categoryModalHeader');
  }
  
  if (!elements.confirmCategoryBtn) {
    elements.confirmCategoryBtn = document.getElementById('confirmCategoryBtn');
  }
  
  if (!elements.categoryInput) {
    elements.categoryInput = document.getElementById('categoryInput');
  }
  
  if (!elements.categoryIconInput) {
    elements.categoryIconInput = document.getElementById('categoryIconInput');
  }
  
  if (!elements.categoryEditId) {
    elements.categoryEditId = document.getElementById('categoryEditId');
  }
}
