// sidebarToggles.js - Handle sidebar toggles for main page (non-expanded view)

import { toggleToolbars, getToolbarsVisible } from './toolbarToggle.js';
import { toggleSpellCheck, isSpellCheckEnabled } from './noteControls.js';

/**
 * Initialize the sidebar toggles for toolbar and spell check (main page only)
 */
export function initSidebarToggles() {
  console.log('[sidebarToggles.js] Initializing sidebar toggles...');
  
  // Get the sidebar toggle checkboxes
  const sidebarToolbarToggle = document.getElementById('sidebarToolbarToggle');
  const sidebarSpellCheckToggle = document.getElementById('sidebarSpellCheckToggle');
  
  if (!sidebarToolbarToggle || !sidebarSpellCheckToggle) {
    console.error('[sidebarToggles.js] Sidebar toggle elements not found in DOM');
    return;
  }
  
  // Set initial states from localStorage (both should be off by default)
  const toolbarVisible = getToolbarsVisible();
  const spellCheckEnabled = isSpellCheckEnabled();
  
  sidebarToolbarToggle.checked = toolbarVisible;
  sidebarSpellCheckToggle.checked = spellCheckEnabled;
  
  console.log(`[sidebarToggles.js] Initial states - Toolbar: ${toolbarVisible}, SpellCheck: ${spellCheckEnabled}`);
  
  // Add event listeners
  sidebarToolbarToggle.addEventListener('change', (e) => {
    console.log(`[sidebarToggles.js] Sidebar toolbar toggle changed to: ${e.target.checked}`);
    // Only apply to non-expanded notes
    toggleToolbarsForMainPage(e.target.checked);
  });
  
  sidebarSpellCheckToggle.addEventListener('change', (e) => {
    console.log(`[sidebarToggles.js] Sidebar spell check toggle changed to: ${e.target.checked}`);
    // Only apply to non-expanded notes
    toggleSpellCheckForMainPage(e.target.checked);
  });
}

/**
 * Toggle toolbar visibility for main page notes only (not expanded notes)
 * @param {boolean} visible - Whether toolbars should be visible
 */
function toggleToolbarsForMainPage(visible) {
  // Use the existing toggleToolbars function but only affect non-expanded notes
  toggleToolbars(visible);
  
  // Update the sidebar toggle if needed
  const sidebarToolbarToggle = document.getElementById('sidebarToolbarToggle');
  if (sidebarToolbarToggle) {
    sidebarToolbarToggle.checked = visible;
  }
}

/**
 * Toggle spell check for main page notes only (not expanded notes)
 * @param {boolean} enabled - Whether spell check should be enabled
 */
function toggleSpellCheckForMainPage(enabled) {
  // Get all notes that are NOT expanded
  const nonExpandedNotes = document.querySelectorAll('.note:not(.expanded)');
  
  // Toggle spell check using the existing function
  const currentState = isSpellCheckEnabled();
  if (currentState !== enabled) {
    toggleSpellCheck();
  }
  
  // Update the sidebar toggle if needed
  const sidebarSpellCheckToggle = document.getElementById('sidebarSpellCheckToggle');
  if (sidebarSpellCheckToggle) {
    sidebarSpellCheckToggle.checked = enabled;
  }
}

/**
 * Update sidebar toggle states (called when toggles change elsewhere)
 */
export function updateSidebarToggleStates() {
  const sidebarToolbarToggle = document.getElementById('sidebarToolbarToggle');
  const sidebarSpellCheckToggle = document.getElementById('sidebarSpellCheckToggle');
  
  if (sidebarToolbarToggle) {
    sidebarToolbarToggle.checked = getToolbarsVisible();
  }
  
  if (sidebarSpellCheckToggle) {
    sidebarSpellCheckToggle.checked = isSpellCheckEnabled();
  }
}
