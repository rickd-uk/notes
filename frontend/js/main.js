// main.js - Entry point for the application
import { initState, setCurrentUser, elements } from "./state.js";
import {
  loadCategories,
  loadNotes,
  preloadAdjacentCategories,
  getCurrentUser,
} from "./api.js";
import { setupEventListeners } from "./eventHandlers.js";
import { setupMobileNavigation } from "./responsive.js";
import { initDarkMode } from "./darkMode.js";
import { initToolbarToggle } from "./toolbarToggle.js";
import { applyToolbarVisibilityToAll } from "./quillEditor.js";
import { initSpellCheck, applySpellCheckToAll } from "./noteControls.js";
import { initSidebarToggles } from "./sidebarToggles.js";
import { loadEncryptionSetup, restoreSessionKey } from "./encryptionManager.js";

// Function to update the username display
async function updateUsernameDisplay() {
  try {
    const user = await getCurrentUser();
    if (user) {
      console.log("User data retrieved:", user);
      // Set user in state
      setCurrentUser(user);

      // Update username display
      if (elements.usernameDisplay) {
        elements.usernameDisplay.textContent = `${user.username}`;
      }

      // Show admin link for rick
      if (user.isAdmin) {
        const existing = document.getElementById('adminNavLink');
        if (!existing) {
          const link = document.createElement('a');
          link.id = 'adminNavLink';
          link.href = '/admin.html';
          link.textContent = '⚙️ Admin';
          link.style.cssText = 'font-size:12px;color:#7eb8f7;text-decoration:none;margin-left:8px;opacity:0.8;';
          link.onmouseover = () => link.style.opacity = '1';
          link.onmouseout = () => link.style.opacity = '0.8';
          elements.usernameDisplay.parentElement.appendChild(link);
        }
      }
    } else {
      // If no user is found, redirect to login
      window.location.href = "/login.html";
    }
  } catch (error) {
    console.error("Error fetching user info:", error);
    elements.usernameDisplay.textContent = "Unknown User";
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", async () => {
  // Check if Quill is loaded
  if (typeof Quill === "undefined") {
    console.error(
      "Quill.js is not loaded. Rich text editing will not be available.",
    );
  }

  // Initialize dark mode
  initDarkMode();

  // Initialize application state
  initState();

  // Set up all event listeners
  setupEventListeners();

  // Set up mobile navigation
  setupMobileNavigation();

  await updateUsernameDisplay();

  // Load encryption setup — needed before loadNotes so renderNotes knows if user has encryption
  await loadEncryptionSetup();

  // Restore session key from sessionStorage (survives page refresh, cleared on explicit lock)
  await restoreSessionKey();

  // Load initial data
  await loadCategories();
  await loadNotes();

  // Initialize the global toolbar toggle
  setTimeout(() => {
    initToolbarToggle();

    // Make sure toolbar visibility is applied to all editors
    setTimeout(() => {
      applyToolbarVisibilityToAll();
    }, 100);
  }, 500);

  // Initialize spell check
  setTimeout(() => {
    initSpellCheck();

    // Apply spell check setting to all editors
    setTimeout(() => {
      const isSpellCheckEnabled =
        localStorage.getItem("spellCheckEnabled") === "true";
      applySpellCheckToAll(isSpellCheckEnabled);
    }, 200);
  }, 700);

  // Initialize sidebar toggles (for main page only)
  setTimeout(() => {
    initSidebarToggles();
  }, 900);

  // Preload adjacent categories after initial load
  setTimeout(() => {
    preloadAdjacentCategories();
  }, 2000);

  // Add MutationObserver to detect new notes and maintain toolbar visibility and spell check
  const notesContainer = document.getElementById("notesContainer");
  if (notesContainer) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          // New notes were added, ensure toolbar visibility and spell check are maintained
          setTimeout(() => {
            applyToolbarVisibilityToAll();
            const isSpellCheckEnabled =
              localStorage.getItem("spellCheckEnabled") === "true";
            applySpellCheckToAll(isSpellCheckEnabled);
          }, 50);
        }
      });
    });

    // Start observing the notes container for changes
    observer.observe(notesContainer, {
      childList: true,
      subtree: true,
    });
  }
});
