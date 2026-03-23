// frontend/js/sortNotes.js
import { getNotes, setNotes, elements } from "./state.js"; // Assuming 'elements' might be used, if not, it can be removed.
import { renderNotes } from "./ui.js";
import { showToast } from "./uiUtils.js";

// Store sort preference in localStorage
// Default to 'false' (newest first) if not found in localStorage
let sortOldestFirst = localStorage.getItem("sortOldestFirst") === "true";

/**
 * Update the sort button appearance based on current sort state
 */
function updateButtonAppearance() {
  const sortButton = document.getElementById("sortButton");
  if (!sortButton) {
    console.warn(
      "[sortNotes.js] updateButtonAppearance: Sort button not found.",
    );
    return;
  }

  const sortIcon = sortButton.querySelector("span"); // Assuming the icon is within a <span>
  if (sortIcon) {
    sortIcon.textContent = sortOldestFirst ? "↑" : "↓"; // ↑ for oldest first (ascending), ↓ for newest first (descending)
  }

  sortButton.title = sortOldestFirst
    ? "Sort by newest first"
    : "Sort by oldest first";
  console.log(
    `[sortNotes.js] Sort button appearance updated. Oldest first: ${sortOldestFirst}`,
  );
}

/**
 * Sort the notes based on date and update UI
 * @param {boolean} oldestFirstParam - true to sort oldest first, false for newest first
 */
async function sortAndRenderNotes(oldestFirstParam) {
  console.log(
    `[sortNotes.js] sortAndRenderNotes called. Oldest first: ${oldestFirstParam}`,
  );
  const notesToSort = [...getNotes()]; // Get a copy of current notes

  notesToSort.sort((a, b) => {
    const dateA = new Date(a.updated_at).getTime();
    const dateB = new Date(b.updated_at).getTime();
    return oldestFirstParam ? dateA - dateB : dateB - dateA;
  });

  setNotes(notesToSort); // Update the state with sorted notes
  await renderNotes(); // Re-render the UI

  // Update the global state variable after sorting
  sortOldestFirst = oldestFirstParam;
  localStorage.setItem("sortOldestFirst", sortOldestFirst.toString()); // Save preference

  updateButtonAppearance(); // Update button icon and title
  showToast(
    sortOldestFirst ? "Sorted by oldest first" : "Sorted by newest first",
  );
  console.log(
    `[sortNotes.js] Notes sorted and rendered. Oldest first: ${sortOldestFirst}`,
  );
}

/**
 * Initializes the sort functionality.
 * This function will be called when the 'uiControlsReady' event is dispatched.
 */
function initSortFunctionality() {
  console.log("[sortNotes.js] Attempting to initialize sort functionality...");
  const sortButton = document.getElementById("sortButton");

  if (!sortButton) {
    console.error(
      '[sortNotes.js] Sort button (id="sortButton") NOT FOUND in the DOM even after uiControlsReady. Cannot attach listener.',
    );
    return;
  }

  console.log(
    '[sortNotes.js] Sort button (id="sortButton") FOUND. Adding click listener.',
  );

  // Set initial button appearance based on loaded preference
  updateButtonAppearance();

  // Apply initial sort if notes exist and sort preference is not default (newest first)
  // Or if you always want to apply the saved sort order on load.
  // For now, we'll let the initial render from main.js handle the first display.
  // The button appearance is set, and the first click will sort according to the opposite of the displayed state.
  // If an explicit initial sort is desired here:
  // if (getNotes().length > 0) {
  //     console.log('[sortNotes.js] Applying initial sort based on preference.');
  //     sortAndRenderNotes(sortOldestFirst);
  // }

  sortButton.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Toggle sort order
      const newSortOldestFirst = !sortOldestFirst; // Calculate new state before calling sort
      console.log(
        `[sortNotes.js] Sort button clicked. Toggling sort. New oldestFirst: ${newSortOldestFirst}`,
      );

      sortAndRenderNotes(newSortOldestFirst);
      // The sortAndRenderNotes function now handles localStorage, toast, and button appearance.
    },
    true,
  ); // Using capture phase as in the user's example, can be false if not needed.

  console.log("[sortNotes.js] Sort functionality initialized.");
}

// Listen for the 'uiControlsReady' event to initialize
document.addEventListener("uiControlsReady", () => {
  console.log(
    '[sortNotes.js] "uiControlsReady" event received. Initializing sort functionality.',
  );
  // Retrieve the latest preference from localStorage before initializing
  sortOldestFirst = localStorage.getItem("sortOldestFirst") === "true";
  initSortFunctionality();
});

// Optional: CSS for sort button can be added here if not handled elsewhere
// const style = document.createElement('style');
// style.textContent = `
// /* Styles for sort button or sort UI elements */
// #sortButton span { font-weight: bold; } /* Example */
// `;
// document.head.appendChild(style);
