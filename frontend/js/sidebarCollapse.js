// sidebarCollapse.js — Desktop sidebar collapse/expand logic
// Initial collapsed state is restored by the inline script in index.html.
// This module only wires up the toggle buttons.

const STORAGE_KEY = 'sidebarCollapsed';

function setSidebarCollapsed(collapsed) {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed', collapsed);
  localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false');
}

export function initSidebarCollapse() {
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  const expandBtn = document.getElementById('sidebarExpandBtn');

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => setSidebarCollapsed(true));
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', () => setSidebarCollapsed(false));
  }
}
