// admin.js — Admin panel logic

const API = '/api/admin';
let notesPage = 1;

// ── Auth guard ───────────────────────────────────────────────────────────────
async function checkAdminAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) { window.location.href = '/'; return; }
  const data = await res.json();
  if (!data.user?.isAdmin) { window.location.href = '/'; return; }
  document.getElementById('adminUsername').textContent = data.user.username;
}

// ── Navigation ───────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      const section = item.dataset.section;
      document.getElementById(`section-${section}`).classList.add('active');
      // Lazy-load section data
      if (section === 'dashboard') loadDashboard();
      if (section === 'signup') loadSignupToggle();
      if (section === 'server') loadServerInfo();
      if (section === 'logs') loadLogs();
      if (section === 'users') loadUsers();
      if (section === 'notes') loadNotes();
    });
  });
}

// ── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const data = await apiFetch('/stats');
  if (!data) return;
  document.getElementById('statUsers').textContent = data.totalUsers;
  document.getElementById('statNotes').textContent = data.totalNotes;
  document.getElementById('statSignup').textContent = data.signupsEnabled ? 'ON' : 'OFF';
  const card = document.getElementById('statSignupCard');
  card.className = 'stat-card ' + (data.signupsEnabled ? 'green' : 'red');
}

// ── Signup toggle ────────────────────────────────────────────────────────────
async function loadSignupToggle() {
  const data = await apiFetch('/settings');
  if (!data) return;
  const enabled = data.settings.signups_enabled === 'true';
  document.getElementById('signupToggle').checked = enabled;
  document.getElementById('signupToggleLabel').textContent = enabled ? 'Signups are ENABLED' : 'Signups are DISABLED';
}

window.handleSignupToggle = async (checked) => {
  const label = document.getElementById('signupToggleLabel');
  label.textContent = 'Saving...';
  await apiFetch('/settings', {
    method: 'POST',
    body: JSON.stringify({ key: 'signups_enabled', value: checked ? 'true' : 'false' }),
  });
  label.textContent = checked ? 'Signups are ENABLED' : 'Signups are DISABLED';
};

// ── Server info ───────────────────────────────────────────────────────────────
async function loadServerInfo() {
  const data = await apiFetch('/server-info');
  if (!data) return;
  const tbody = document.querySelector('#serverInfoTable tbody');
  const rows = [
    ['Node.js Version', data.nodeVersion],
    ['Platform', data.platform],
    ['Uptime', formatUptime(data.uptimeSeconds)],
    ['Memory (RSS)', data.memoryMB + ' MB'],
    ['Database', data.dbStatus],
    ['DB Server Time', data.dbTime ? new Date(data.dbTime).toLocaleString() : '—'],
  ];
  tbody.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

// ── Logs ─────────────────────────────────────────────────────────────────────
window.loadLogs = async function () {
  const el = document.getElementById('logOutput');
  el.textContent = 'Loading...';
  const data = await apiFetch('/logs');
  if (!data) return;
  el.textContent = data.lines.join('\n') || '(no log entries)';
  el.scrollTop = el.scrollHeight;
};

// ── Backup ───────────────────────────────────────────────────────────────────
window.runBackup = async function () {
  const btn = document.getElementById('backupBtn');
  const status = document.getElementById('backupStatus');
  btn.disabled = true;
  status.textContent = 'Creating backup...';
  const data = await apiFetch('/backup', { method: 'POST' });
  btn.disabled = false;
  if (data?.success) {
    status.style.color = '#a8e6cf';
    status.textContent = `✓ Backup created: ${data.filename}`;
  } else {
    status.style.color = '#f78';
    status.textContent = `✗ Backup failed`;
  }
};

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const data = await apiFetch('/users');
  if (!data) return;
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = data.users.map(u => {
    const isRick = u.username === 'rick';
    const statusBadge = isRick
      ? '<span class="badge admin">admin</span>'
      : u.suspended
        ? '<span class="badge suspended">suspended</span>'
        : '<span class="badge active">active</span>';
    const actions = isRick ? '<span style="color:#555;font-size:12px;">—</span>' : `
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn ${u.suspended ? 'btn-success' : 'btn-warn'}" onclick="toggleSuspend(${u.id},'${esc(u.username)}',${u.suspended})">${u.suspended ? '▶ Restore' : '⏸ Suspend'}</button>
        <button class="btn btn-primary" onclick="openRename(${u.id},'${esc(u.username)}')">✏ Rename</button>
        <button class="btn btn-warn" onclick="openResetPassword(${u.id},'${esc(u.username)}')">🔑 Reset PW</button>
        <button class="btn btn-primary" onclick="forceLogout(${u.id},'${esc(u.username)}')">⏏ Logout</button>
        <button class="btn btn-danger" onclick="deleteUser(${u.id},'${esc(u.username)}')">🗑 Delete</button>
      </div>`;
    return `<tr>
      <td style="color:#7eb8f7">${esc(u.username)}</td>
      <td style="color:#888">${u.email ? esc(u.email) : '—'}</td>
      <td>${u.note_count}</td>
      <td style="color:#888;font-size:12px">${u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

window.toggleSuspend = async (id, username, currentlySuspended) => {
  if (!confirm(`${currentlySuspended ? 'Restore' : 'Suspend'} user "${username}"?`)) return;
  await apiFetch(`/users/${id}/suspend`, { method: 'PATCH' });
  loadUsers();
};

window.deleteUser = (id, username) => {
  openConfirm(
    `Delete "${username}"?`,
    `This will permanently delete ${username} and all their notes and categories. This cannot be undone.`,
    async () => { await apiFetch(`/users/${id}`, { method: 'DELETE' }); loadUsers(); }
  );
};

window.forceLogout = async (id, username) => {
  if (!confirm(`Force-logout "${username}"? Their current session will be invalidated.`)) return;
  await apiFetch(`/users/${id}/logout`, { method: 'POST' });
  alert(`${username} has been logged out.`);
};

let renameTargetId = null;
window.openRename = (id, username) => {
  renameTargetId = id;
  document.getElementById('renameInput').value = username;
  document.getElementById('renameModal').classList.add('open');
};

window.submitRename = async () => {
  const username = document.getElementById('renameInput').value.trim();
  if (!username) return;
  const res = await apiFetch(`/users/${renameTargetId}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  });
  if (res) { closeModal('renameModal'); loadUsers(); }
};

let resetPasswordTargetId = null;
window.openResetPassword = (id, _username) => {
  resetPasswordTargetId = id;
  document.getElementById('resetPasswordInput').value = '';
  document.getElementById('resetPasswordModal').classList.add('open');
};

window.submitResetPassword = async () => {
  const newPassword = document.getElementById('resetPasswordInput').value;
  if (!newPassword || newPassword.length < 8) { alert('Password must be at least 8 characters'); return; }
  const res = await apiFetch(`/users/${resetPasswordTargetId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
  if (res) { closeModal('resetPasswordModal'); alert('Password reset successfully.'); }
};

// ── Notes ─────────────────────────────────────────────────────────────────────
async function loadNotes(page = 1) {
  notesPage = page;
  const data = await apiFetch(`/notes?page=${page}&limit=50`);
  if (!data) return;
  const tbody = document.getElementById('notesTableBody');
  tbody.innerHTML = data.notes.map(n => `<tr>
    <td style="color:#7eb8f7">${esc(n.username)}</td>
    <td style="color:#aaa;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.preview || '(empty)')}</td>
    <td style="color:#888;font-size:12px">${new Date(n.created_at).toLocaleDateString()}</td>
    <td><button class="btn btn-danger" onclick="deleteNote(${n.id})">🗑 Delete</button></td>
  </tr>`).join('');

  const totalPages = Math.ceil(data.total / 50);
  const pagination = document.getElementById('notesPagination');
  pagination.innerHTML = `
    <button onclick="loadNotes(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
    <span>Page ${page} of ${totalPages} (${data.total} total)</span>
    <button onclick="loadNotes(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
  `;
}

window.deleteNote = (id) => {
  openConfirm('Delete this note?', 'This note will be permanently deleted.', async () => {
    await apiFetch(`/notes/${id}`, { method: 'DELETE' });
    loadNotes(notesPage);
  });
};

// ── Modals ────────────────────────────────────────────────────────────────────
let confirmCallback = null;
function openConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmOkBtn').onclick = async () => {
    closeModal('confirmModal');
    await confirmCallback();
  };
}

window.closeModal = (id) => {
  document.getElementById(id).classList.remove('open');
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/';
      return null;
    }
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Request failed');
      return null;
    }
    return data;
  } catch (err) {
    console.error('Admin API error:', err);
    alert('Network error');
    return null;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await checkAdminAuth();
  initNav();
  loadDashboard();
})();
