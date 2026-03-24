// sidebarToggles.js - Handle sidebar toggles for main page (non-expanded view)

import { toggleToolbars, getToolbarsVisible } from './toolbarToggle.js';
import { toggleSpellCheck, isSpellCheckEnabled } from './noteControls.js';
import { hasEncryptionPassword, lockSession, isUnlocked } from './encryptionManager.js';

// ── Privacy mode ──────────────────────────────────────────────────────────────

export function isPrivacyModeEnabled() {
  return localStorage.getItem('privacyMode') === 'true';
}

function setPrivacyMode(enabled) {
  document.body.classList.toggle('privacy-mode', enabled);
  localStorage.setItem('privacyMode', enabled.toString());
}

// Decrypt all encrypted note cards in-place (no re-render needed)
async function applyDecryptionToAllNotes() {
  const { decryptNoteContent } = await import('./encryptionManager.js');
  const { getQuillEditor, setEditorReadOnly } = await import('./quillEditor.js');

  for (const noteEl of document.querySelectorAll('.note[data-encrypted="true"]')) {
    const noteId = noteEl.dataset.id;
    const ciphertext = noteEl.dataset.encryptedContent || '';
    if (!ciphertext.startsWith('ENC:')) {
      noteEl.dataset.decryptionFailed = 'true';
      continue;
    }
    const plaintext = await decryptNoteContent(ciphertext);
    const quill = getQuillEditor(noteId);
    if (!quill) continue;
    quill.enable(true);
    if (plaintext) {
      quill.clipboard.dangerouslyPasteHTML(plaintext);
      noteEl.dataset.decryptionFailed = 'false';
      if (noteEl.dataset.readOnly === 'true') setEditorReadOnly(noteId, true);
    } else {
      quill.clipboard.dangerouslyPasteHTML('<p style="opacity:0.6;font-style:italic">⚠️ Decryption failed — expand and click 🔐 to clear</p>');
      quill.enable(false);
      noteEl.dataset.decryptionFailed = 'true';
    }
  }
}

// Replace decrypted content with encrypted placeholder in-place
function applyEncryptedPlaceholderToAllNotes() {
  import('./quillEditor.js').then(({ getQuillEditor }) => {
    for (const noteEl of document.querySelectorAll('.note[data-encrypted="true"]')) {
      const quill = getQuillEditor(noteEl.dataset.id);
      if (!quill) continue;
      quill.enable(true);
      quill.clipboard.dangerouslyPasteHTML('<p style="opacity:0.4;font-style:italic">🔐 Encrypted — turn on Show Encrypted to view</p>');
      quill.enable(false);
    }
  });
}

/**
 * Initialize the sidebar toggles for toolbar and spell check (main page only)
 */
export function initSidebarToggles() {
  console.log('[sidebarToggles.js] Initializing sidebar toggles...');

  // Get the sidebar toggle checkboxes
  const sidebarToolbarToggle = document.getElementById('sidebarToolbarToggle');
  const sidebarSpellCheckToggle = document.getElementById('sidebarSpellCheckToggle');
  const sidebarPrivacyToggle = document.getElementById('sidebarPrivacyToggle');
  const sidebarStrictDecryptToggle = document.getElementById('sidebarStrictDecryptToggle');
  const strictDecryptToggleRow = document.getElementById('strictDecryptToggleRow');

  if (!sidebarToolbarToggle || !sidebarSpellCheckToggle) {
    console.error('[sidebarToggles.js] Sidebar toggle elements not found in DOM');
    return;
  }

  // Set initial states from localStorage (both should be off by default)
  const toolbarVisible = getToolbarsVisible();
  const spellCheckEnabled = isSpellCheckEnabled();

  sidebarToolbarToggle.checked = toolbarVisible;
  sidebarSpellCheckToggle.checked = spellCheckEnabled;

  // Privacy toggle — restore from localStorage
  if (sidebarPrivacyToggle) {
    const privacyEnabled = isPrivacyModeEnabled();
    sidebarPrivacyToggle.checked = privacyEnabled;
    setPrivacyMode(privacyEnabled);

    sidebarPrivacyToggle.addEventListener('change', (e) => {
      setPrivacyMode(e.target.checked);
    });
  }

  // Unlock Notes toggle — only show when encryption password is set
  if (sidebarStrictDecryptToggle && strictDecryptToggleRow) {
    if (hasEncryptionPassword()) {
      strictDecryptToggleRow.style.display = '';
    }

    // Sync toggle to actual session state (key may have been restored from sessionStorage).
    // Browsers can restore checkbox state on refresh so we always force it to match reality.
    sidebarStrictDecryptToggle.checked = isUnlocked();

    sidebarStrictDecryptToggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const { showUnlockModal } = await import('./eventHandlers.js');
        showUnlockModal(async () => {
          await applyDecryptionToAllNotes();
        });
        // Uncheck if user cancels the modal
        const cancelBtn = document.getElementById('cancelUnlockBtn');
        if (cancelBtn) {
          const onCancel = () => {
            sidebarStrictDecryptToggle.checked = false;
            cancelBtn.removeEventListener('click', onCancel);
          };
          cancelBtn.addEventListener('click', onCancel);
        }
      } else {
        lockSession();
        applyEncryptedPlaceholderToAllNotes();
      }
    });
  }

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
