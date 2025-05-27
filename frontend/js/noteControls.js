// noteControls.js - Controls for expanded note mode
import { getQuillEditor, getAllQuillEditors } from "./quillEditor.js";
import {
  toggleToolbars,
  getToolbarsVisible,
  setToolbarsVisible,
} from "./toolbarToggle.js";

// Track spell check state globally - default to enabled
let spellCheckEnabled = false;
/**
 * Create and add controls to an expanded note
 * @param {HTMLElement} noteElement - The expanded note element
 */
export function addExpandedNoteControls(noteElement) {
  const noteId = noteElement.dataset.id;

  // Create controls container
  const controlsContainer = document.querySelector(".expanded-note-controls");

  if (!controlsContainer) {
    console.error(
      "CRITICAL: .expanded-note-controls container not found in DOM!",
    );
    return;
  }

  // Clear any previous buttons from the container to prevent duplicates
  controlsContainer.innerHTML = "";

  // Get current states - ensure toolbar is visible by default in expanded view
  const wasVisible = getToolbarsVisible();
  if (!wasVisible) {
    setToolbarsVisible(true); // Turn on toolbars when expanding
  }

  // Add toolbar toggle button with improved icon
  const toolbarToggleBtn = document.createElement("button");
  toolbarToggleBtn.className = `expanded-control-btn`;

  if (getToolbarsVisible()) {
    // Set 'active' based on actual current state
    toolbarToggleBtn.classList.add("active");
  }

  toolbarToggleBtn.innerHTML = `
    <span style="font-weight: bold;">T</span>
    <span class="tooltip">Toggle Formatting Toolbar</span>
  `;
  toolbarToggleBtn.addEventListener("click", () => {
    const newState = toggleToolbars();
    toolbarToggleBtn.classList.toggle("active", newState);
  });

  // Add spell check toggle button - enabled by default
  const spellCheckBtn = document.createElement("button");
  spellCheckBtn.className = `expanded-control-btn active`; // Active by default
  spellCheckBtn.innerHTML = `
    <span style="font-weight: bold;">Aa</span>
    <span class="tooltip">Toggle Spell Check</span>
  `;

  spellCheckBtn.addEventListener("click", () => {
    toggleSpellCheck();
    spellCheckBtn.classList.toggle("active", spellCheckEnabled);
  });

  // Add buttons to container
  controlsContainer.appendChild(toolbarToggleBtn);
  controlsContainer.appendChild(spellCheckBtn);

  // Add container to the document body - needs to be at body level because note is positioned fixed
  document.body.appendChild(controlsContainer);

  // Ensure spell check is on when expanding a note
  if (!spellCheckEnabled) {
    toggleSpellCheck();
    //spellCheckBtn.classList.add("active");
  }

  // Apply current spell check state to all editors for consistency
  applySpellCheckToAll(spellCheckEnabled);
}

/**
 * Remove expanded note controls when note is collapsed
 */
export function removeExpandedNoteControls() {
  const controlsContainer = document.querySelector(".expanded-note-controls");
  if (controlsContainer) {
    controlsContainer.innerHTML = ""; // Clear the buttons
  }
}

/**
 * Toggle spell check for all editors
 */
export function toggleSpellCheck() {
  spellCheckEnabled = !spellCheckEnabled;
  applySpellCheckToAll(spellCheckEnabled);

  // Save preference to localStorage
  localStorage.setItem("spellCheckEnabled", spellCheckEnabled.toString());

  // Update any UI elements that show spell check state
  updateSpellCheckButtonState();

  return spellCheckEnabled;
}

/**
 * Apply spell check setting to a specific editor
 * @param {string} noteId - ID of the note to apply spell check to
 * @param {boolean} enabled - Whether spell check should be enabled
 */
function applySpellCheck(noteId, enabled) {
  const quill = getQuillEditor(noteId);
  if (!quill) return;

  const editorElement = quill.root;

  // Set or remove the spellcheck attribute on the editor element
  if (enabled) {
    editorElement.setAttribute("spellcheck", "true");
  } else {
    editorElement.setAttribute("spellcheck", "false");
  }

  // Force redraw of the editor to apply spelling changes
  // This is a hack, but it works to refresh the spell checker
  const originalDisplay = editorElement.style.display;
  editorElement.style.display = "none";

  // Force reflow
  void editorElement.offsetHeight;

  // Restore original display
  editorElement.style.display = originalDisplay;
}

/**
 * Initialize spell check from saved preferences
 * Call this when the application starts
 */
export function initSpellCheck() {
  // Load preference from localStorage
  const savedPreference = localStorage.getItem("spellCheckEnabled");
  if (savedPreference !== null) {
    spellCheckEnabled = savedPreference === "true";
  } else {
    // Default to enabled if no preference saved
    spellCheckEnabled = false;
    localStorage.setItem("spellCheckEnabled", "true");
  }
}

/**
 * Get current spell check state
 * @returns {boolean} Whether spell check is enabled
 */
export function isSpellCheckEnabled() {
  return spellCheckEnabled;
}

/**
 * Apply spell check to all editors
 * @param {boolean} enabled - Whether spell check should be enabled
 */
export function applySpellCheckToAll(enabled) {
  // Apply to all existing editors
  const editors = getAllQuillEditors();
  for (const noteId in editors) {
    applySpellCheck(noteId, enabled);
  }
}

/**
 * Update the state of any spell check toggle buttons
 */
/**
 * Update the state of any spell check toggle buttons
 */
function updateSpellCheckButtonState() {
  // Update the expanded view button if it exists
  const expandedControlsContainer = document.getElementById(
    "expandedNoteControls",
  );
  if (expandedControlsContainer) {
    const spellCheckBtn = expandedControlsContainer.querySelector(
      "button:nth-child(2)",
    );
    if (spellCheckBtn) {
      spellCheckBtn.classList.toggle("active", spellCheckEnabled);
    }
  }

  // Update the main view button if it exists
  const mainSpellCheckToggle = document.getElementById("mainSpellCheckToggle");
  if (mainSpellCheckToggle) {
    mainSpellCheckToggle.classList.toggle("active", spellCheckEnabled);
  }
}
