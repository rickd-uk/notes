// quillEditor.js - Quill rich text editor integration with content size limits

// Lazily load Quill JS + CSS on first use — avoids blocking initial page load.
// Returns a promise that resolves once window.Quill is available.
let quillLoadPromise = null;
function loadQuill() {
  if (window.Quill) return Promise.resolve();
  if (quillLoadPromise) return quillLoadPromise;
  quillLoadPromise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "vendor/quill.snow.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "vendor/quill.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load Quill editor"));
    document.head.appendChild(script);
  });
  return quillLoadPromise;
}

import { handleNoteInput } from "./eventHandlers.js";
import { getToolbarsVisible } from "./toolbarToggle.js";
import {
  isSpellcheckEnabled,
  applySpellcheckToEditor,
} from "./spellcheckToggle.js";
import {
  validateContentSize,
  validatePasteSize,
  handlePasteValidation,
  showSizeIndicator,
  LIMITS,
} from "./contentLimits.js";
import { showToast } from "./uiUtils.js";

// Store Quill editor instances
let quillEditors = {};

// Configure Quill toolbar options
const quillToolbarOptions = [
  ["bold", "italic", "underline"],
  [{ header: 1 }, { header: 2 }],
  [{ list: "ordered" }],
  [{ color: [] }],
];

// Show a temporary warning message
function showPasteWarning(message, isError = false) {
  // Remove any existing paste warning
  const existingWarning = document.querySelector(".paste-warning");
  if (existingWarning) {
    existingWarning.remove();
  }

  const warning = document.createElement("div");
  warning.className = `paste-warning${isError ? " error" : ""}`;
  warning.innerHTML = `
<button class="paste-warning-close" aria-label="Close">×</button>
<div>${message}</div>
`;

  document.body.appendChild(warning);

  const closeBtn = warning.querySelector(".paste-warning-close");
  closeBtn.addEventListener("click", () => warning.remove());

  // Auto-remove after 8 seconds
  setTimeout(() => {
    if (warning.parentNode) {
      warning.remove();
    }
  }, 8000);
}

// Initialize Quill for all notes
export async function initializeQuillEditors() {
  await loadQuill();
  document.querySelectorAll(".note").forEach((noteElement) => {
    const noteId = noteElement.dataset.id;
    const textareaContent =
      noteElement.querySelector(".note-content")?.value || "";

    // Create Quill editor for this note
    createQuillEditor(noteElement, noteId, textareaContent);
  });
}

// Create a Quill editor for a note
export async function createQuillEditor(noteElement, noteId, initialContent) {
  await loadQuill();
  // Clean up any existing editor for this note
  destroyQuillEditor(noteId);

  // Validate initial content size
  const validation = validateContentSize(initialContent || "");
  if (!validation.isValid) {
    console.warn(
      `Note ${noteId} has oversized content (${validation.formatted.current}), truncating...`,
    );
    showToast(`Note content was too large and has been truncated`, "warning");
  }

  // Create container for editor
  const editorContainer = document.createElement("div");
  editorContainer.className = "note-editor-container";

  // Create editor element
  const editorElement = document.createElement("div");
  editorElement.className = "quill-editor";

  // Check if this editor is in a modal
  const isInModal = !!noteElement.closest(".modal");

  // Set spell checking based on setting (default to on in modals, follow toggle in main view)
  const useSpellcheck = isInModal ? true : isSpellcheckEnabled();
  editorElement.setAttribute("spellcheck", useSpellcheck ? "true" : "false");

  editorContainer.appendChild(editorElement);

  // Replace textarea with editor
  const textarea = noteElement.querySelector(".note-content");
  if (textarea) {
    textarea.parentNode.replaceChild(editorContainer, textarea);
  } else {
    // If no textarea (e.g., creating from scratch), just append
    noteElement.insertBefore(
      editorContainer,
      noteElement.querySelector(".note-footer"),
    );
  }

  // Initialize Quill
  const quill = new Quill(editorElement, {
    modules: {
      toolbar: quillToolbarOptions,
      clipboard: {
        matchVisual: false,
      },
    },
    placeholder: "Start writing...",
    theme: "snow",
  });

  // Set initial content
  if (initialContent) {
    try {
      // Check if content is HTML
      if (initialContent.trim().startsWith("<")) {
        quill.clipboard.dangerouslyPasteHTML(initialContent);
      } else {
        quill.setText(initialContent);
      }
    } catch (error) {
      console.error("Error setting initial content:", error);
      quill.setText("(Error loading note content)");
    }
  }

  // Store reference to editor
  quillEditors[noteId] = quill;

  // ===== PASTE EVENT HANDLER WITH SIZE VALIDATION =====
  quill.root.addEventListener(
    "paste",
    function (e) {
      // Get the clipboard data
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      // Get pasted content
      let pastedContent = "";

      // Try to get HTML content first
      const htmlData = clipboardData.getData("text/html");
      if (htmlData) {
        pastedContent = htmlData;
      } else {
        // Fall back to plain text
        const textData = clipboardData.getData("text/plain");
        if (textData) {
          // Convert plain text to HTML paragraphs
          pastedContent = textData
            .split("\n")
            .map((line) => (line ? `<p>${line}</p>` : "<p><br></p>"))
            .join("");
        }
      }

      if (!pastedContent) return;

      // Get current content
      const currentContent = quill.root.innerHTML;

      // Validate the paste operation
      const validation = handlePasteValidation(pastedContent, currentContent);

      if (!validation.success) {
        // Prevent the paste
        e.preventDefault();
        e.stopPropagation();

        // Show error message
        showPasteWarning(validation.message, true);
        showToast(validation.message, "error");

        return false;
      }

      // If there's a warning but paste is allowed
      if (validation.message) {
        showPasteWarning(validation.message, false);
      }

      // Allow the paste to proceed normally
      // Quill will handle the actual insertion
    },
    true,
  ); // Use capture phase to intercept before Quill processes it

  // Handle content changes
  quill.on("text-change", function (delta, oldDelta, source) {
    // Get HTML content from the editor
    const content = quill.root.innerHTML;

    // Validate content size
    const validation = validateContentSize(content);

    // Update size indicator
    showSizeIndicator(noteElement, validation);

    // If content is too large, show error and prevent saving
    if (!validation.isValid) {
      showToast(
        `Note is too large (${validation.formatted.current}). Maximum size is ${validation.formatted.max}. Please reduce content.`,
        "error",
      );

      // Don't save oversized content
      return;
    }

    // Warn if approaching limit
    if (validation.isNearLimit && source === "user") {
      showToast(
        `Note is ${validation.percentage.toFixed(0)}% of maximum size`,
        "warning",
      );
    }

    // Handle the input normally
    handleNoteInput(noteId, content);
  });

  // Apply current toolbar visibility state to the new editor
  applyToolbarVisibility(noteId);

  // Apply spell check setting to the Quill editor root element
  if (!isInModal) {
    quill.root.setAttribute("spellcheck", useSpellcheck ? "true" : "false");
  }

  // Show initial size indicator if needed
  const initialValidation = validateContentSize(initialContent || "");
  showSizeIndicator(noteElement, initialValidation);

  return quill;
}

// Enable or disable editing for a note's Quill editor
export function setEditorReadOnly(noteId, readOnly) {
  const quill = quillEditors[noteId];
  if (!quill) return;
  quill.enable(!readOnly);
  const noteEl = document.querySelector(`.note[data-id="${noteId}"]`);
  if (noteEl) {
    // Hide toolbar when read-only
    const toolbar = noteEl.querySelector(".ql-toolbar");
    if (toolbar) toolbar.style.display = readOnly ? "none" : "";
    // Update placeholder to reflect read-only state
    const editor = noteEl.querySelector(".ql-editor");
    if (editor) editor.dataset.placeholder = readOnly ? "Empty note." : "Start writing...";
  }
}

// Apply current toolbar visibility to a specific editor
export function applyToolbarVisibility(noteId) {
  const toolbarsVisible = getToolbarsVisible();
  const editorContainer = document.querySelector(
    `.note[data-id="${noteId}"] .note-editor-container`,
  );

  if (editorContainer) {
    const toolbar = editorContainer.querySelector(".ql-toolbar");
    const editor = editorContainer.querySelector(".ql-container");

    if (toolbar) {
      toolbar.style.display = toolbarsVisible ? "" : "none";
    }

    if (editor) {
      editor.style.marginTop = toolbarsVisible ? "" : "0";
      editor.style.height = toolbarsVisible ? "" : "100%";
    }
  }
}

// Toggle toolbar visibility for all editors
export function toggleAllToolbars(visible) {
  Object.keys(quillEditors).forEach((noteId) => {
    applyToolbarVisibility(noteId);
  });
}

// Get a specific Quill editor instance
export function getQuillEditor(noteId) {
  return quillEditors[noteId];
}

// Focus on a specific Quill editor
export function focusQuillEditor(noteId) {
  const quill = quillEditors[noteId];
  if (quill) {
    quill.focus();
    // Move cursor to end
    const length = quill.getLength();
    quill.setSelection(length, 0);
  }
}

// Destroy a specific Quill editor
export function destroyQuillEditor(noteId) {
  const quill = quillEditors[noteId];
  if (quill) {
    // Get the editor container
    const noteElement = document.querySelector(`.note[data-id="${noteId}"]`);
    if (noteElement) {
      const editorContainer = noteElement.querySelector(
        ".note-editor-container",
      );
      if (editorContainer) {
        editorContainer.remove();
      }
    }

    delete quillEditors[noteId];
  }
}

// Clear all Quill editors
export function clearQuillEditors() {
  Object.keys(quillEditors).forEach((noteId) => {
    destroyQuillEditor(noteId);
  });
  quillEditors = {};
}

// Update Quill editor layout (for responsive changes)
export function updateQuillEditorLayout(noteId) {
  const quill = quillEditors[noteId];
  if (quill) {
    // Force Quill to recalculate its dimensions
    quill.root.style.height = "";
    setTimeout(() => {
      quill.root.style.height = quill.root.scrollHeight + "px";
    }, 0);
  }
}

// Apply spellcheck to all editors
export function applySpellcheckToAllEditors(enabled) {
  Object.keys(quillEditors).forEach((noteId) => {
    const quill = quillEditors[noteId];
    if (quill) {
      quill.root.setAttribute("spellcheck", enabled ? "true" : "false");
    }
  });
}

// Get content from a Quill editor with size validation
export function getQuillContent(noteId) {
  const quill = quillEditors[noteId];
  if (!quill) return null;

  const content = quill.root.innerHTML;
  const validation = validateContentSize(content);

  return {
    content,
    validation,
    isValid: validation.isValid,
  };
}

// Added this function:
export function getAllQuillEditors() {
  return quillEditors;
}

export function applyToolbarVisibilityToAll() {
  Object.keys(quillEditors).forEach((noteId) => {
    applyToolbarVisibility(noteId);
  });
}

// Set content in a Quill editor with size validation
export function setQuillContent(noteId, content) {
  const quill = quillEditors[noteId];
  if (!quill) return false;

  const validation = validateContentSize(content);

  if (!validation.isValid) {
    showToast(
      `Content is too large (${validation.formatted.current}). Cannot set content.`,
      "error",
    );
    return false;
  }

  try {
    if (content.trim().startsWith("<")) {
      quill.clipboard.dangerouslyPasteHTML(content);
    } else {
      quill.setText(content);
    }

    return true;
  } catch (error) {
    console.error("Error setting content:", error);
    showToast("Error setting note content", "error");
    return false;
  }
}

// Export the editors object for debugging
export { quillEditors };
