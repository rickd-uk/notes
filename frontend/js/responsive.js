// responsive.js - Mobile responsiveness handling
import { handleCategoryClick } from './eventHandlers.js';

// Setup mobile navigation
export function setupMobileNavigation() {
  // Create sidebar overlay if it doesn't exist
  if (!document.querySelector('.sidebar-overlay')) {
    const sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'sidebar-overlay';
    document.body.appendChild(sidebarOverlay);
  }

  const sidebar = document.querySelector('.sidebar');
  const navToggle = document.getElementById('navToggleBtn');
  const sidebarOverlay = document.querySelector('.sidebar-overlay');

  function toggleSidebar() {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
  }

  if (navToggle) {
    navToggle.addEventListener('click', toggleSidebar);
  }
  sidebarOverlay.addEventListener('click', toggleSidebar);

  setupCategoryClickEvents();

  let previousWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const currentWidth = window.innerWidth;
    if ((previousWidth <= 1199 && currentWidth > 1199) ||
        (previousWidth > 1199 && currentWidth <= 1199)) {
      sidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    previousWidth = currentWidth;
  });
}

// Setup click events for categories on mobile
export function setupCategoryClickEvents() {
  // This function needs to be called after categories are rendered
  // It adds special handling for categories on mobile devices

  if (window.innerWidth <= 1199) {
    document.querySelectorAll('.category').forEach(categoryElem => {
      // We use the normal click handler in eventHandlers.js
      // But add a handler for closing the sidebar after selection

      // Remove previous mobile-specific event listeners if any
      categoryElem.removeEventListener('click', closeSidebarAfterSelection);

      // Add new event listeners
      categoryElem.addEventListener('click', closeSidebarAfterSelection);
    });

    // Fix for buttons being added multiple times when switching categories
    const emptyAddNoteBtn = document.getElementById('emptyAddNoteBtn');
    if (emptyAddNoteBtn) {
      // Ensure we only have one event listener by cloning and replacing
      const newBtn = emptyAddNoteBtn.cloneNode(true);
      emptyAddNoteBtn.parentNode.replaceChild(newBtn, emptyAddNoteBtn);

      // Re-attach the event listener
      newBtn.addEventListener('click', () => {
        // Import function dynamically to avoid circular dependency
        import('./eventHandlers.js').then(module => {
          module.createNewNote();
        });
      });
    }
  }
}

// Function to close sidebar after category selection on mobile
function closeSidebarAfterSelection() {
  if (window.innerWidth <= 1199) {
    setTimeout(() => {
      const sidebar = document.querySelector('.sidebar');
      const sidebarOverlay = document.querySelector('.sidebar-overlay');

      if (sidebar && sidebarOverlay) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    }, 100);
  }
}

// Update the UI when the screen size changes
export function handleScreenResize() {
  const isMobile = window.innerWidth <= 1199;
  document.body.classList.toggle('mobile-view', isMobile);
  setupCategoryClickEvents();
}
