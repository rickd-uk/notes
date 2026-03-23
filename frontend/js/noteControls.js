// noteControls.js - Controls for expanded note mode
import { getQuillEditor, getAllQuillEditors, setEditorReadOnly } from "./quillEditor.js";
import {
  toggleToolbars,
  getToolbarsVisible,
} from "./toolbarToggle.js";
import { setNoteReadOnly } from "./api.js";
import {
  hasEncryptionPassword, isUnlocked, encryptNote, decryptAndSaveNote
} from './encryptionManager.js';
import { showToast } from './uiUtils.js';
// NOTE: showUnlockModal is NOT imported statically. eventHandlers.js imports ui.js,
// ui.js dynamically imports noteControls.js — a static import here would create a
// cycle that causes showUnlockModal to be undefined at module init time.
// Use a dynamic import inside the click handler instead (see encrypt button).

// Track spell check state globally - default to enabled
let spellCheckEnabled = false;

// Sidebar settings saved before entering expanded view — restored on collapse
let savedToolbarState = null;
let savedSpellCheckState = null;
/**
 * Create and add controls to an expanded note
 * @param {HTMLElement} noteElement - The expanded note element
 */
export function addExpandedNoteControls(noteElement) {
  // Create controls container
  const controlsContainer = document.querySelector(".expanded-note-controls");

  if (!controlsContainer) {
    console.error(
      "CRITICAL: .expanded-note-controls container not found in DOM!",
    );
    return;
  }

  // Save sidebar settings so we can restore them when the note is collapsed
  savedToolbarState = getToolbarsVisible();
  savedSpellCheckState = spellCheckEnabled;

  // Clear any previous buttons from the container to prevent duplicates
  controlsContainer.innerHTML = "";

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

  // Add lock/unlock toggle button
  const noteId = noteElement.dataset.id;
  const isReadOnly = noteElement.dataset.readOnly === "true";

  const lockBtn = document.createElement("button");
  lockBtn.className = `expanded-control-btn${isReadOnly ? " active" : ""}`;
  lockBtn.innerHTML = `
    <span>${isReadOnly ? "🔒" : "🔓"}</span>
    <span class="tooltip">${isReadOnly ? "Unlock note" : "Lock note"}</span>
  `;
  lockBtn.addEventListener("click", async () => {
    const nowReadOnly = noteElement.dataset.readOnly !== "true";
    const result = await setNoteReadOnly(noteId, nowReadOnly);
    if (result) {
      noteElement.dataset.readOnly = nowReadOnly ? "true" : "false";
      noteElement.classList.toggle("note--locked", nowReadOnly);
      // Update lock badge on card
      const existing = noteElement.querySelector(".note-lock-badge");
      if (nowReadOnly && !existing) {
        const badge = document.createElement("div");
        badge.className = "note-lock-badge";
        badge.title = "Read-only";
        badge.textContent = "🔒";
        noteElement.appendChild(badge);
      } else if (!nowReadOnly && existing) {
        existing.remove();
      }
      setEditorReadOnly(noteId, nowReadOnly);
      lockBtn.classList.toggle("active", nowReadOnly);
      lockBtn.querySelector("span:first-child").textContent = nowReadOnly ? "🔒" : "🔓";
      lockBtn.querySelector(".tooltip").textContent = nowReadOnly ? "Unlock note" : "Lock note";
    }
  });

  // Add buttons to container
  controlsContainer.appendChild(toolbarToggleBtn);
  controlsContainer.appendChild(spellCheckBtn);
  controlsContainer.appendChild(lockBtn);

  // Add encrypt button — only visible if user has set an encryption password
  if (hasEncryptionPassword()) {
    const isEncrypted = noteElement.dataset.encrypted === 'true';

    const encryptBtn = document.createElement('button');
    encryptBtn.className = `expanded-control-btn${isEncrypted ? ' active' : ''}`;
    encryptBtn.innerHTML = `
      <span>🔐</span>
      <span class="tooltip">${isEncrypted ? 'Decrypt note' : 'Encrypt note'}</span>
    `;

    encryptBtn.addEventListener('click', async () => {
      const nowEncrypted = noteElement.dataset.encrypted !== 'true';

      if (!isUnlocked()) {
        showToast('Enter your encryption password to continue');
        // Dynamic import to avoid static cycle: eventHandlers → ui → (dynamic) noteControls → eventHandlers
        const { showUnlockModal } = await import('./eventHandlers.js');
        showUnlockModal(async () => {
          // retry after unlock
          encryptBtn.click();
        });
        return;
      }

      try {
        const quill = (await import('./quillEditor.js')).getQuillEditor(noteId);
        if (nowEncrypted) {
          const content = quill ? quill.root.innerHTML : '';
          const ciphertext = await encryptNote(noteId, content);
          noteElement.dataset.encrypted = 'true';
          noteElement.dataset.readOnly = 'true';
          noteElement.classList.add('note--encrypted', 'note--locked');
          // Store ciphertext so decrypt can use it without a page reload
          noteElement.dataset.encryptedContent = ciphertext;
          // Replace editor content with placeholder so user sees it's encrypted
          if (quill) {
            quill.enable(true);
            quill.clipboard.dangerouslyPasteHTML('<p style="opacity:0.4;font-style:italic">🔐 Encrypted — click 🔐 to decrypt</p>');
            quill.enable(false);
          }
          setEditorReadOnly(noteId, true);
          // Update lock button state too
          lockBtn.classList.add('active');
          lockBtn.querySelector('span:first-child').textContent = '🔒';
        } else {
          // dataset.encryptedContent is set by ui.js renderNotes (Task 10).
          // If it's absent (note was just encrypted this session), fall back to
          // quill content, which IS the ciphertext the server just stored.
          const ciphertext = noteElement.dataset.encryptedContent || quill?.root.innerHTML || '';
          if (!ciphertext.startsWith('ENC:')) {
            showToast('No encrypted content found — reload and try again');
            return;
          }
          const plaintext = await decryptAndSaveNote(noteId, ciphertext);
          noteElement.dataset.encrypted = 'false';
          noteElement.dataset.readOnly = 'false';
          noteElement.classList.remove('note--encrypted', 'note--locked');
          if (quill) {
            quill.enable(true);
            quill.clipboard.dangerouslyPasteHTML(plaintext);
          }
          setEditorReadOnly(noteId, false);
          lockBtn.classList.remove('active');
          lockBtn.querySelector('span:first-child').textContent = '🔓';
        }
        encryptBtn.classList.toggle('active', nowEncrypted);
        encryptBtn.querySelector('span:first-child').textContent = '🔐';
        encryptBtn.querySelector('.tooltip').textContent = nowEncrypted ? 'Decrypt note' : 'Encrypt note';
      } catch (err) {
        showToast('Encryption error: ' + err.message);
        console.error(err);
      }
    });

    controlsContainer.appendChild(encryptBtn);
  }

  // Add container to the document body - needs to be at body level because note is positioned fixed
  document.body.appendChild(controlsContainer);

  // Apply current spell check state to all editors for consistency
  applySpellCheckToAll(spellCheckEnabled);
}

/**
 * Remove expanded note controls when note is collapsed
 */
export function removeExpandedNoteControls() {
  const controlsContainer = document.querySelector(".expanded-note-controls");
  if (controlsContainer) {
    controlsContainer.innerHTML = "";
  }

  // Restore toolbar and spell check to whatever the sidebar had before expanding
  if (savedToolbarState !== null) {
    toggleToolbars(savedToolbarState);
    savedToolbarState = null;
  }
  if (savedSpellCheckState !== null) {
    spellCheckEnabled = savedSpellCheckState;
    localStorage.setItem("spellCheckEnabled", spellCheckEnabled.toString());
    applySpellCheckToAll(spellCheckEnabled);
    savedSpellCheckState = null;
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
