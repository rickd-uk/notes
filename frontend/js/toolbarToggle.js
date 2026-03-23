// toolbarToggle.js - Global toolbar toggle functionality

// Flag to track global toolbar visibility state
export let toolbarsVisible = false; // No default value, will be set by init

/**
 * Toggle visibility of all Quill toolbars
 * @param {boolean} visible - Optional explicit state. If not provided, toggles current state.
 * @returns {boolean} The new visibility state
 */
export function toggleToolbars(visible) {
  console.log(
    `[toolbarToggle.js] toggleToolbars called. Current toolbarsVisible: ${toolbarsVisible}, requested visible: ${visible}`,
  );
  // If no explicit state provided, toggle current state
  if (visible === undefined) {
    toolbarsVisible = !toolbarsVisible;
  } else {
    toolbarsVisible = visible;
  }

  localStorage.setItem("toolbarsVisible", toolbarsVisible.toString());

  const toolbars = document.querySelectorAll(".ql-toolbar");
  toolbars.forEach((toolbar) => {
    toolbar.style.display = toolbarsVisible ? "" : "none";

    const editorContainer = toolbar.closest(".note-editor-container");
    if (editorContainer) {
      const editor = editorContainer.querySelector(".ql-container");
      if (editor) {
        editor.style.marginTop = toolbarsVisible ? "" : "0";
        editor.style.height = toolbarsVisible ? "" : "calc(100% - 10px)";
      }
    }
  });

  updateToggleButtonAppearance();
  document.body.setAttribute("data-toolbars-hidden", !toolbarsVisible);
  console.log(`[toolbarToggle.js] toolbarsVisible is now: ${toolbarsVisible}`);
  return toolbarsVisible;
}

/**
 * Initialize toolbar visibility from saved preference and create toggles
 */
export function initToolbarToggle() {
  console.log("[toolbarToggle.js] initToolbarToggle called.");
  const savedVisibility = localStorage.getItem("toolbarsVisible");
  if (savedVisibility !== null) {
    toolbarsVisible = savedVisibility === "true";
  } else {
    toolbarsVisible = false; // Default to false if nothing is saved
    localStorage.setItem("toolbarsVisible", "false");
  }
  // Apply initial visibility (without toggling the value of toolbarsVisible again)
  toggleToolbars(toolbarsVisible);

  createMainViewToggles();
}

/**
 * Get current toolbar visibility state
 */
export function getToolbarsVisible() {
  return toolbarsVisible;
}

/**
 * Set toolbar visibility to a specific state
 * @param {boolean} visible - Whether toolbars should be visible
 */
export function setToolbarsVisible(visible) {
  if (visible !== toolbarsVisible) {
    toggleToolbars(visible);
  }
}

/**
 * Update the appearance of toolbar toggle button based on current state
 */
function updateToggleButtonAppearance() {
  const toolbarToggle = document.getElementById("mainToolbarToggle");
  if (toolbarToggle) {
    toolbarToggle.classList.toggle("active", toolbarsVisible);
  }

  const expandedControls = document.getElementById("expandedNoteControls");
  if (expandedControls) {
    const expandedToggle = expandedControls.querySelector("button:first-child"); // Assuming it's the first
    if (
      expandedToggle &&
      expandedToggle.title.toLowerCase().includes("toolbar")
    ) {
      // Be more specific if needed
      expandedToggle.classList.toggle("active", toolbarsVisible);
    }
  }
}

/**
 * Create toggle buttons in the main view header
 */
function createMainViewToggles() {
  console.log("[toolbarToggle.js] createMainViewToggles called.");
  const notesHeader = document.querySelector(".notes-header");
  const addNoteBtn = document.getElementById("addNoteBtn");

  if (!notesHeader) {
    console.error(
      "[toolbarToggle.js] .notes-header element NOT FOUND. Cannot add main view toggles.",
    );
    return;
  }
  if (!addNoteBtn) {
    console.warn(
      "[toolbarToggle.js] #addNoteBtn element NOT FOUND. Toggles will be appended to header.",
    );
  }

  const controlsContainer = document.createElement("div");
  controlsContainer.className = "header-controls-group";
  controlsContainer.id = "headerControlsGroup";

  import("./noteControls.js")
    .then((module) => {
      console.log(
        "[toolbarToggle.js] noteControls.js module dynamically imported.",
      );

      const searchButton = document.createElement("button");
      searchButton.id = "searchButton";
      searchButton.className = "header-control-btn";
      searchButton.title = "Search Notes";
      searchButton.innerHTML = "<span>🔍</span>";
      // The actual click handler for search will be attached by searchNotes.js
      controlsContainer.appendChild(searchButton);
      console.log(
        "[toolbarToggle.js] Search button created (handler to be attached by searchNotes.js).",
      );

      const sortButton = document.createElement("button");
      sortButton.id = "sortButton";
      sortButton.className = "header-control-btn";
      sortButton.title = "Sort Notes";
      sortButton.innerHTML = "<span>↕️</span>";
      // The actual click handler for sort will be attached by sortNotes.js
      controlsContainer.appendChild(sortButton);
      console.log(
        "[toolbarToggle.js] Sort button created (handler to be attached by sortNotes.js).",
      );

      if (addNoteBtn) {
        notesHeader.insertBefore(controlsContainer, addNoteBtn);
      } else {
        notesHeader.appendChild(controlsContainer); // Fallback if addNoteBtn is not found
      }
      console.log(
        "[toolbarToggle.js] Controls container with all buttons added to notesHeader.",
      );

      // ***** DISPATCH THE EVENT HERE, AFTER BUTTONS ARE IN THE DOM *****
      console.log("[toolbarToggle.js] Dispatching 'uiControlsReady' event.");
      document.dispatchEvent(new CustomEvent("uiControlsReady"));
    })
    .catch((error) => {
      console.error(
        "[toolbarToggle.js] Error importing or processing noteControls.js module:",
        error,
      );
      // Even if noteControls fails, we might still want to dispatch for search/sort if they were created before the error
      // However, in this structure, search/sort are inside the .then(), so if import fails, they aren't created.
      // If search/sort were outside, you might dispatch here, but it's cleaner to keep them dependent or handle error states.
    });
}
