// searchNotes.js - Live search with floating results panel
import { getNotes } from "./state.js";
import { renderNotes } from "./ui.js";

let currentSearchTerm = "";
let originalNotes = null;
let selectedIndex = -1;
let showMoreContext = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPlainText(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlight(plainText, term) {
  const safe = escapeHtml(plainText);
  if (!term) return safe;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
}

function getPreview(note, expanded) {
  const text = getPlainText(note.content);
  if (!text) return "(empty note)";
  return text.slice(0, expanded ? 220 : 90);
}

function matchNotes(term) {
  if (!term || !term.trim()) return [];
  const lower = term.toLowerCase().trim();
  return getNotes().filter(note =>
    getPlainText(note.content).toLowerCase().includes(lower)
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function createPanel() {
  if (document.getElementById("liveSearchPanel")) return;

  const panel = document.createElement("div");
  panel.id = "liveSearchPanel";
  panel.innerHTML = `
    <div class="lsp-header">
      <span class="lsp-icon">🔍</span>
      <input id="lspInput" class="lsp-input" type="text"
             placeholder="Search notes…" autocomplete="off" spellcheck="false" />
      <button id="lspClose" class="lsp-close" title="Close">✕</button>
    </div>
    <label class="lsp-option">
      <input type="checkbox" id="lspExpand" />
      <span>Show more context</span>
    </label>
    <div id="lspResults" class="lsp-results"></div>
  `;
  document.body.appendChild(panel);

  const input = panel.querySelector("#lspInput");
  const closeBtn = panel.querySelector("#lspClose");
  const expandCheck = panel.querySelector("#lspExpand");

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => renderResults(input.value), 180);
  });

  input.addEventListener("keydown", e => {
    const items = document.querySelectorAll(".lsp-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIndex]) items[selectedIndex].click();
    } else if (e.key === "Escape") {
      closePanel();
    }
  });

  closeBtn.addEventListener("click", () => closePanel());

  expandCheck.addEventListener("change", e => {
    showMoreContext = e.target.checked;
    renderResults(input.value);
  });

  document.addEventListener("mousedown", e => {
    const p = document.getElementById("liveSearchPanel");
    if (!p || !p.classList.contains("active")) return;
    if (p.contains(e.target)) return;
    const btn = document.getElementById("searchButton");
    if (btn && btn.contains(e.target)) return;
    closePanel();
  });
}

function updateSelection(items) {
  items.forEach((item, i) => item.classList.toggle("selected", i === selectedIndex));
  if (selectedIndex >= 0 && items[selectedIndex]) {
    items[selectedIndex].scrollIntoView({ block: "nearest" });
  }
}

function renderResults(term) {
  const results = document.getElementById("lspResults");
  if (!results) return;
  selectedIndex = -1;

  if (!term || !term.trim()) {
    results.innerHTML = '<p class="lsp-empty">Start typing to search…</p>';
    return;
  }

  const matches = matchNotes(term);

  if (matches.length === 0) {
    results.innerHTML = `<p class="lsp-empty">No matches for "<strong>${escapeHtml(term)}</strong>"</p>`;
    return;
  }

  const frag = document.createDocumentFragment();

  const countEl = document.createElement("div");
  countEl.className = "lsp-count";
  countEl.textContent = `${matches.length} match${matches.length !== 1 ? "es" : ""}`;
  frag.appendChild(countEl);

  matches.forEach(note => {
    const preview = getPreview(note, showMoreContext);
    const item = document.createElement("div");
    item.className = "lsp-item";
    item.dataset.noteId = note.id;
    item.innerHTML = `
      <div class="lsp-preview">${highlight(preview, term.trim())}</div>
      <div class="lsp-meta">${formatDate(note.updated_at || note.created_at)}</div>
    `;
    item.addEventListener("click", () => goToNote(note.id));
    frag.appendChild(item);
  });

  results.innerHTML = "";
  results.appendChild(frag);
}

// ── Navigation ────────────────────────────────────────────────────────────────

function goToNote(noteId) {
  closePanel();
  setTimeout(() => {
    const el = document.querySelector(`.note[data-id="${noteId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("search-highlight");
      setTimeout(() => el.classList.remove("search-highlight"), 1500);
    }
  }, 80);
}

// ── Open / close ──────────────────────────────────────────────────────────────

function openPanel() {
  createPanel();
  const panel = document.getElementById("liveSearchPanel");
  if (!panel) return;
  panel.classList.add("active");
  setTimeout(() => {
    const input = document.getElementById("lspInput");
    if (input) {
      input.focus();
      input.select();
      renderResults(input.value);
    }
  }, 50);
}

function closePanel() {
  const panel = document.getElementById("liveSearchPanel");
  if (panel) panel.classList.remove("active");
  currentSearchTerm = "";
  originalNotes = null;
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initSearchFunctionality() {
  const btn = document.getElementById("searchButton");
  if (!btn) return;
  btn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    const panel = document.getElementById("liveSearchPanel");
    if (panel && panel.classList.contains("active")) {
      closePanel();
    } else {
      openPanel();
    }
  }, true);
}

document.addEventListener("uiControlsReady", initSearchFunctionality);

// ── Styles ────────────────────────────────────────────────────────────────────

const style = document.createElement("style");
style.textContent = `
  #liveSearchPanel {
    position: fixed;
    top: 10%;
    left: 50%;
    transform: translateX(-50%) translateY(-10px);
    width: min(580px, 92vw);
    max-height: 72vh;
    background: var(--surface-color);
    border-radius: 14px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.28);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
  #liveSearchPanel.active {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0);
  }
  body.dark-mode #liveSearchPanel {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255,255,255,0.07);
  }
  .lsp-header {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    gap: 10px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }
  .lsp-icon { font-size: 20px; flex-shrink: 0; }
  .lsp-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 17px;
    background: transparent;
    color: var(--text-color);
    font-family: inherit;
  }
  .lsp-input::placeholder { opacity: 0.4; }
  .lsp-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: var(--text-color);
    opacity: 0.45;
    padding: 4px 6px;
    border-radius: 6px;
    line-height: 1;
    flex-shrink: 0;
    transition: opacity 0.1s, background 0.1s;
  }
  .lsp-close:hover { opacity: 1; background: rgba(128,128,128,0.12); }
  .lsp-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 16px;
    font-size: 13px;
    color: var(--text-color);
    opacity: 0.6;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
    transition: opacity 0.1s;
  }
  .lsp-option:hover { opacity: 1; }
  .lsp-results {
    overflow-y: auto;
    flex: 1;
  }
  .lsp-count {
    padding: 8px 16px 2px;
    font-size: 11px;
    color: var(--text-color);
    opacity: 0.4;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .lsp-empty {
    padding: 28px 16px;
    text-align: center;
    font-size: 14px;
    color: var(--text-color);
    opacity: 0.45;
    margin: 0;
  }
  .lsp-item {
    padding: 11px 16px;
    cursor: pointer;
    border-bottom: 1px solid var(--border-color);
    transition: background 0.1s;
  }
  .lsp-item:last-child { border-bottom: none; }
  .lsp-item:hover,
  .lsp-item.selected { background: rgba(98, 0, 238, 0.06); }
  body.dark-mode .lsp-item:hover,
  body.dark-mode .lsp-item.selected { background: rgba(187, 134, 252, 0.09); }
  .lsp-preview {
    font-size: 14px;
    color: var(--text-color);
    line-height: 1.55;
    word-break: break-word;
  }
  .lsp-preview mark {
    background: rgba(98, 0, 238, 0.15);
    color: var(--primary-color);
    border-radius: 2px;
    padding: 0 2px;
    font-weight: 600;
  }
  body.dark-mode .lsp-preview mark {
    background: rgba(187, 134, 252, 0.22);
    color: #bb86fc;
  }
  .lsp-meta {
    font-size: 11px;
    color: var(--text-color);
    opacity: 0.4;
    margin-top: 4px;
  }
  /* Pulse animation when navigating to a note */
  @keyframes note-search-ping {
    0%   { outline: 2px solid rgba(98, 0, 238, 0); }
    30%  { outline: 2px solid rgba(98, 0, 238, 0.7); }
    100% { outline: 2px solid rgba(98, 0, 238, 0); }
  }
  .note.search-highlight {
    animation: note-search-ping 1.4s ease-out;
  }
`;
document.head.appendChild(style);
