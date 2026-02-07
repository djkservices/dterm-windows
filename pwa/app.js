// ── State ──
const state = {
  token: null,
  user: null,
  currentPanel: 'dashboard',
  monitors: [],
  messages: [],
  notes: '',
  snippets: [],
  pushSubscription: null,
  editingSnippetIndex: -1
};

const VAPID_PUBLIC_KEY = 'BM_nWMcyb4kCht1zzBbSYvWtwT4Cm5kixm45Svb6795HfXyJphdzr-tSp74zg9FMl3sVWor_wJT4r6gOhgU_bBU';

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  const token = localStorage.getItem('dterm_token');
  const user = localStorage.getItem('dterm_user');
  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    const res = await api.auth.validate(token);
    if (res && !res.error) {
      showApp();
    } else {
      localStorage.removeItem('dterm_token');
      localStorage.removeItem('dterm_user');
    }
  }
});

// ── Service Worker ──
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.error('SW registration failed:', e); }
  }
}

// ── Auth ──
async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  if (!username || !password) { errorEl.textContent = 'Please enter username and password'; errorEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Signing in...'; errorEl.style.display = 'none';
  const res = await api.auth.login(username, password);
  btn.disabled = false; btn.textContent = 'Sign In';
  if (res.error) { errorEl.textContent = res.error; errorEl.style.display = 'block'; return; }
  state.token = res.token; state.user = res.user;
  localStorage.setItem('dterm_token', res.token);
  localStorage.setItem('dterm_user', JSON.stringify(res.user));
  showApp();
}

async function handleRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('register-btn');
  if (!username || !email || !password) { errorEl.textContent = 'Please fill in all fields'; errorEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Creating account...'; errorEl.style.display = 'none';
  const res = await api.auth.register(username, email, password);
  btn.disabled = false; btn.textContent = 'Create Account';
  if (res.error) { errorEl.textContent = res.error; errorEl.style.display = 'block'; return; }
  state.token = res.token; state.user = res.user;
  localStorage.setItem('dterm_token', res.token);
  localStorage.setItem('dterm_user', JSON.stringify(res.user));
  showApp();
}

function handleLogout() {
  state.token = null; state.user = null; state.monitors = []; state.messages = []; state.notes = ''; state.snippets = [];
  localStorage.removeItem('dterm_token'); localStorage.removeItem('dterm_user');
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('view-login').classList.add('active');
}

function showLoginForm() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-error').style.display = 'none';
}

function showRegisterForm() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('register-error').style.display = 'none';
}

// ── App Entry ──
async function showApp() {
  document.getElementById('view-login').classList.remove('active');
  document.getElementById('main-app').style.display = 'flex';
  showPanel('dashboard');
  loadAllData();
  requestPushOnLogin();
}

async function loadAllData() {
  await Promise.all([loadMonitors(), loadMessages(), loadSyncData()]);
  renderDashboard();
}

// ── Panel Navigation ──
function showPanel(panel) {
  // Clear tool monitor if leaving tools
  if (state.currentPanel === 'tools' && panel !== 'tools' && typeof toolMonitorInterval !== 'undefined' && toolMonitorInterval) {
    clearInterval(toolMonitorInterval);
    toolMonitorInterval = null;
  }

  state.currentPanel = panel;

  // Update panels
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panelEl = document.getElementById('panel-' + panel);
  if (panelEl) panelEl.classList.add('active');

  // Update sidebar buttons
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  const sideBtn = document.querySelector(`.sidebar-btn[data-panel="${panel}"]`);
  if (sideBtn) sideBtn.classList.add('active');

  // Update bottom nav
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-panel="${panel}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Title
  const titles = {
    dashboard: 'Dashboard', tools: 'Tools', notes: 'Notes', snippets: 'Snippets',
    monitors: 'Monitors', messages: 'Messages', collab: 'Collaboration',
    ai: 'AI Chat', search: 'Search', profile: 'Profile'
  };
  document.getElementById('top-bar-title').textContent = titles[panel] || 'dTerm';

  // Top bar action
  const actionBtn = document.getElementById('top-bar-action');
  if (panel === 'monitors') {
    actionBtn.textContent = '+'; actionBtn.style.display = 'block'; actionBtn.onclick = openAddMonitor;
  } else if (panel === 'messages') {
    actionBtn.textContent = '+'; actionBtn.style.display = 'block'; actionBtn.onclick = openCompose;
  } else if (panel === 'snippets') {
    actionBtn.textContent = '+'; actionBtn.style.display = 'block'; actionBtn.onclick = () => openSnippetEdit(-1);
  } else {
    actionBtn.style.display = 'none';
  }

  // Render panel-specific content
  if (panel === 'dashboard') renderDashboard();
  else if (panel === 'monitors') renderMonitors();
  else if (panel === 'messages') renderMessages();
  else if (panel === 'profile') renderProfile();
  else if (panel === 'notes') renderNotes();
  else if (panel === 'snippets') renderSnippets();
  else if (panel === 'tools') initToolsPanel();
  else if (panel === 'collab') renderCollab();
  else if (panel === 'ai') renderAI();
  else if (panel === 'search') renderSearch();

  // Close mobile sidebar
  closeSidebar();
}

// ── Mobile Sidebar Toggle ──
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  // Create/show overlay
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = closeSidebar;
    document.getElementById('main-app').appendChild(overlay);
  }
  overlay.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.remove('open');
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) overlay.classList.remove('open');
}

// ── Monitors ──
async function loadMonitors() {
  const res = await api.monitors.list(state.token);
  if (res && res.success) state.monitors = res.monitors || [];
}

function renderMonitors() {
  const container = document.getElementById('monitors-list');
  if (!state.monitors.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#9678;</div><div class="empty-title">No monitors yet</div><div class="empty-text">Add a domain, SSL, or uptime monitor to get started</div><button class="btn btn-primary btn-small" onclick="openAddMonitor()">Add Monitor</button></div>`;
    return;
  }
  container.innerHTML = state.monitors.map(m => {
    const status = m.status || 'unknown';
    const detail = m.details ? JSON.parse(typeof m.details === 'string' ? m.details : JSON.stringify(m.details)) : {};
    let info = '';
    if (m.type === 'domain' || m.type === 'ssl') {
      info = detail.days_remaining != null ? `${detail.days_remaining} days remaining` : 'Pending check';
    } else if (m.type === 'uptime') {
      info = detail.response_time_ms != null ? `${detail.response_time_ms}ms - HTTP ${detail.http_status || '?'}` : 'Pending check';
    }
    return `<div class="card monitor-card"><span class="status-dot ${status}"></span><div class="monitor-info"><div class="monitor-target">${escapeHtml(m.label || m.target)}</div><div class="monitor-detail"><span class="monitor-type-badge ${m.type}">${m.type}</span> ${escapeHtml(m.target)}</div><div class="monitor-detail">${info}</div></div><button class="btn-icon" onclick="confirmDeleteMonitor(${m.id})" title="Delete">&times;</button></div>`;
  }).join('');
}

function openAddMonitor() {
  document.getElementById('modal-add-monitor').classList.add('active');
  document.getElementById('monitor-target').value = '';
  document.getElementById('monitor-label').value = '';
  document.getElementById('monitor-alert-days').value = '30';
  document.getElementById('monitor-add-error').style.display = 'none';
  updateTargetLabel();
}

function closeAddMonitor() { document.getElementById('modal-add-monitor').classList.remove('active'); }

document.getElementById('monitor-type').addEventListener('change', updateTargetLabel);

function updateTargetLabel() {
  const type = document.getElementById('monitor-type').value;
  const label = document.getElementById('monitor-target-label');
  const input = document.getElementById('monitor-target');
  if (type === 'uptime') { label.textContent = 'URL'; input.placeholder = 'https://example.com'; }
  else { label.textContent = 'Domain'; input.placeholder = 'example.com'; }
}

async function handleAddMonitor() {
  const type = document.getElementById('monitor-type').value;
  const target = document.getElementById('monitor-target').value.trim();
  const label = document.getElementById('monitor-label').value.trim();
  const alertDays = parseInt(document.getElementById('monitor-alert-days').value) || 30;
  const errorEl = document.getElementById('monitor-add-error');
  const btn = document.getElementById('monitor-add-btn');
  if (!target) { errorEl.textContent = 'Please enter a target'; errorEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Adding...'; errorEl.style.display = 'none';
  const res = await api.monitors.add(state.token, type, target, label, alertDays);
  btn.disabled = false; btn.textContent = 'Add';
  if (res.error) { errorEl.textContent = res.error; errorEl.style.display = 'block'; return; }
  closeAddMonitor(); showToast('Monitor added', 'success');
  await loadMonitors(); renderMonitors(); renderDashboard();
}

function confirmDeleteMonitor(id) { if (confirm('Delete this monitor?')) deleteMonitor(id); }

async function deleteMonitor(id) {
  const res = await api.monitors.delete(state.token, id);
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('Monitor deleted', 'success');
  await loadMonitors(); renderMonitors(); renderDashboard();
}

// ── Messages ──
async function loadMessages() {
  const res = await api.messages.getMyMessages(state.token);
  if (res && res.success) state.messages = res.messages || [];
}

function renderMessages() {
  const container = document.getElementById('messages-list');
  if (!state.messages.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#9993;</div><div class="empty-title">No messages</div><div class="empty-text">Send a bug report or feature request</div><button class="btn btn-primary btn-small" onclick="openCompose()">New Message</button></div>`;
    return;
  }
  container.innerHTML = state.messages.map(m => {
    const replies = m.admin_replies ? m.admin_replies.split('|||') : [];
    return `<div class="card message-card"><div class="message-subject">${escapeHtml(m.subject)}</div><div class="message-body">${escapeHtml(m.body)}</div>${replies.map(r => `<div class="message-reply"><div class="message-reply-label">Admin Reply</div>${escapeHtml(r)}</div>`).join('')}<div class="message-date">${formatDate(m.created_at)}</div></div>`;
  }).join('');
}

function openCompose() {
  document.getElementById('modal-compose').classList.add('active');
  document.getElementById('compose-body').value = '';
  document.getElementById('compose-error').style.display = 'none';
}

function closeCompose() { document.getElementById('modal-compose').classList.remove('active'); }

async function handleSendMessage() {
  const subject = document.getElementById('compose-subject').value;
  const body = document.getElementById('compose-body').value.trim();
  const errorEl = document.getElementById('compose-error');
  const btn = document.getElementById('compose-send-btn');
  if (!body) { errorEl.textContent = 'Please enter a message'; errorEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Sending...'; errorEl.style.display = 'none';
  const res = await api.messages.send(state.token, subject, body);
  btn.disabled = false; btn.textContent = 'Send';
  if (res.error) { errorEl.textContent = res.error; errorEl.style.display = 'block'; return; }
  closeCompose(); showToast('Message sent', 'success');
  await loadMessages(); renderMessages();
}

// ── Sync Data (Notes & Snippets) ──
async function loadSyncData() {
  const res = await api.sync.pullAll(state.token);
  if (res && res.success && res.data) {
    const notesRaw = res.data.notes?.data_json || '';
    try {
      const parsed = JSON.parse(notesRaw);
      if (typeof parsed === 'string') state.notes = parsed;
      else if (parsed !== null && typeof parsed === 'object') {
        if ('content' in parsed) state.notes = parsed.content || '';
        else if ('text' in parsed) state.notes = parsed.text || '';
        else state.notes = JSON.stringify(parsed, null, 2);
      } else state.notes = '';
    } catch (e) { state.notes = notesRaw; }

    state.snippets = [];
    const snippetSources = ['snippets', 'settings'];
    for (const key of snippetSources) {
      if (res.data[key]?.data_json) {
        try {
          const parsed = JSON.parse(res.data[key].data_json);
          if (Array.isArray(parsed)) { state.snippets = parsed; break; }
          if (parsed.snippets && Array.isArray(parsed.snippets)) { state.snippets = parsed.snippets; break; }
        } catch (e) {}
      }
    }
  }
}

// ── Notes (Full Editor) ──
function renderNotes() {
  const container = document.getElementById('notes-panel-content');
  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <textarea id="notes-editor" style="width:100%;min-height:calc(100vh - 200px);padding:14px;background:var(--bg-secondary);color:var(--text-primary);border:none;resize:none;font-size:14px;font-family:inherit;line-height:1.6;outline:none;"
        placeholder="Write your notes here...">${escapeHtml(state.notes)}</textarea>
    </div>
    <button class="btn btn-primary" id="notes-save-btn" onclick="handleSaveNotes()" style="margin-top:12px;">Save Notes</button>`;
}

async function handleSaveNotes() {
  const editor = document.getElementById('notes-editor');
  const btn = document.getElementById('notes-save-btn');
  if (!editor || !btn) return;
  const content = editor.value;
  btn.disabled = true; btn.textContent = 'Saving...';
  const dataJson = JSON.stringify({ content });
  const res = await api.sync.push(state.token, 'notes', dataJson);
  if (res && res.success) {
    state.notes = content; btn.textContent = 'Saved!'; showToast('Notes saved', 'success');
    setTimeout(() => { btn.textContent = 'Save Notes'; btn.disabled = false; }, 1500);
  } else { btn.textContent = 'Save Notes'; btn.disabled = false; showToast(res?.error || 'Failed to save', 'error'); }
}

// ── Snippets (Full CRUD) ──
function renderSnippets() {
  const container = document.getElementById('snippets-panel-content');
  if (!state.snippets.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#10100;</div><div class="empty-title">No snippets</div><div class="empty-text">Create code snippets to save and sync</div><button class="btn btn-primary btn-small" onclick="openSnippetEdit(-1)">New Snippet</button></div>`;
    return;
  }
  container.innerHTML = state.snippets.map((s, i) => `
    <div class="card snippet-card">
      <div class="card-header">
        <span class="card-title">${escapeHtml(s.name || 'Untitled')}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon" onclick="copySnippet(${i})" title="Copy">&#128203;</button>
          <button class="btn-icon" onclick="openSnippetEdit(${i})" title="Edit">&#9998;</button>
          <button class="btn-icon" onclick="deleteSnippet(${i})" title="Delete">&times;</button>
        </div>
      </div>
      <span class="snippet-lang">${escapeHtml(s.language || 'text')}</span>
      <div class="snippet-code">${escapeHtml(s.code || '')}</div>
    </div>
  `).join('');
}

function copySnippet(index) {
  const snippet = state.snippets[index];
  if (snippet && snippet.code) navigator.clipboard.writeText(snippet.code).then(() => showToast('Copied to clipboard', 'success'));
}

function openSnippetEdit(index) {
  state.editingSnippetIndex = index;
  const modal = document.getElementById('modal-edit-snippet');
  const title = document.getElementById('snippet-modal-title');
  const nameInput = document.getElementById('snippet-edit-name');
  const langInput = document.getElementById('snippet-edit-lang');
  const codeInput = document.getElementById('snippet-edit-code');
  document.getElementById('snippet-edit-error').style.display = 'none';

  if (index >= 0 && state.snippets[index]) {
    const s = state.snippets[index];
    title.textContent = 'Edit Snippet';
    nameInput.value = s.name || '';
    langInput.value = s.language || 'text';
    codeInput.value = s.code || '';
  } else {
    title.textContent = 'New Snippet';
    nameInput.value = ''; langInput.value = 'text'; codeInput.value = '';
  }
  modal.classList.add('active');
}

function closeSnippetEdit() { document.getElementById('modal-edit-snippet').classList.remove('active'); }

async function handleSaveSnippet() {
  const name = document.getElementById('snippet-edit-name').value.trim();
  const language = document.getElementById('snippet-edit-lang').value;
  const code = document.getElementById('snippet-edit-code').value;
  const errorEl = document.getElementById('snippet-edit-error');
  const btn = document.getElementById('snippet-save-btn');

  if (!name) { errorEl.textContent = 'Please enter a name'; errorEl.style.display = 'block'; return; }
  if (!code) { errorEl.textContent = 'Please enter code'; errorEl.style.display = 'block'; return; }

  btn.disabled = true; btn.textContent = 'Saving...';

  if (state.editingSnippetIndex >= 0) {
    state.snippets[state.editingSnippetIndex] = { name, language, code };
  } else {
    state.snippets.push({ name, language, code });
  }

  const dataJson = JSON.stringify(state.snippets);
  const res = await api.sync.push(state.token, 'snippets', dataJson);
  btn.disabled = false; btn.textContent = 'Save';

  if (res && res.success) {
    closeSnippetEdit(); showToast('Snippet saved', 'success'); renderSnippets();
  } else {
    errorEl.textContent = res?.error || 'Failed to save'; errorEl.style.display = 'block';
  }
}

async function deleteSnippet(index) {
  if (!confirm('Delete this snippet?')) return;
  state.snippets.splice(index, 1);
  const dataJson = JSON.stringify(state.snippets);
  const res = await api.sync.push(state.token, 'snippets', dataJson);
  if (res && res.success) { showToast('Snippet deleted', 'success'); renderSnippets(); }
  else showToast('Failed to delete', 'error');
}

// ── Tools Panel ──
function initToolsPanel() {
  const panel = document.getElementById('tools-panel');
  const content = document.getElementById('tools-content');
  panel.style.display = 'flex';
  content.style.display = 'none';
  content.innerHTML = '';

  if (typeof renderToolsPanel === 'function') {
    renderToolsPanel(document.getElementById('tools-list'));
  } else {
    document.getElementById('tools-list').innerHTML = '<div class="text-muted text-center mt-16">Tools failed to load. Try refreshing.</div>';
  }
}

// ── Dashboard ──
function renderDashboard() {
  document.getElementById('summary-monitors').textContent = state.monitors.length;
  const alerts = state.monitors.filter(m => m.status === 'warning' || m.status === 'critical');
  document.getElementById('summary-alerts').textContent = alerts.length;
  document.getElementById('summary-messages').textContent = state.messages.length;

  const alertsContainer = document.getElementById('dashboard-alerts');
  if (!alerts.length) {
    alertsContainer.innerHTML = '<div class="card card-body text-muted" style="text-align:center;">No active alerts</div>';
  } else {
    alertsContainer.innerHTML = alerts.slice(0, 3).map(m => {
      const detail = m.details ? JSON.parse(typeof m.details === 'string' ? m.details : JSON.stringify(m.details)) : {};
      let info = '';
      if (m.type === 'domain' || m.type === 'ssl') info = detail.days_remaining != null ? `${detail.days_remaining} days remaining` : '';
      else if (m.type === 'uptime') info = detail.error || `HTTP ${detail.http_status || '?'}`;
      return `<div class="card monitor-card"><span class="status-dot ${m.status}"></span><div class="monitor-info"><div class="monitor-target">${escapeHtml(m.label || m.target)}</div><div class="monitor-detail"><span class="monitor-type-badge ${m.type}">${m.type}</span> ${info}</div></div></div>`;
    }).join('');
  }

  const msgsContainer = document.getElementById('dashboard-messages');
  if (!state.messages.length) {
    msgsContainer.innerHTML = '<div class="card card-body text-muted" style="text-align:center;">No messages</div>';
  } else {
    msgsContainer.innerHTML = state.messages.slice(0, 3).map(m => `<div class="card message-card"><div class="message-subject">${escapeHtml(m.subject)}</div><div class="message-body" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(m.body)}</div><div class="message-date">${formatDate(m.created_at)}</div></div>`).join('');
  }

  const notesContainer = document.getElementById('dashboard-notes');
  if (!state.notes) {
    notesContainer.innerHTML = '<div class="card card-body text-muted" style="text-align:center;">No synced notes</div>';
  } else {
    const preview = state.notes.substring(0, 200);
    notesContainer.innerHTML = `<div class="card note-card" onclick="showPanel('notes')"><div class="note-preview">${escapeHtml(preview)}${state.notes.length > 200 ? '...' : ''}</div></div>`;
  }
}

// ── Profile ──
function renderProfile() {
  if (!state.user) return;
  const avatar = document.getElementById('profile-avatar');
  if (state.user.profile_photo_url) {
    avatar.innerHTML = `<img src="${state.user.profile_photo_url}" alt="">`;
  } else {
    avatar.textContent = (state.user.username || '?')[0].toUpperCase();
  }
  document.getElementById('profile-name').textContent = state.user.username || '';
  document.getElementById('profile-email').textContent = state.user.email || '';
  document.getElementById('profile-notes-count').textContent = state.notes ? '1' : '0';
  document.getElementById('profile-snippets-count').textContent = state.snippets.length;
  const toggle = document.getElementById('push-toggle');
  toggle.checked = !!state.pushSubscription;
  setupPushNotifications();
}

// ── Collaboration Panel ──
function renderCollab() {
  const container = document.getElementById('collab-content');
  container.innerHTML = `
    <div class="collab-status">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span class="status-dot unknown"></span>
        <span>Not connected to a collaboration session</span>
      </div>
      <div class="text-muted" style="font-size:12px;">Collaboration lets you share your workspace with other dTerm users in real-time.</div>
    </div>
    <div class="form-group">
      <label class="form-label">Username to invite</label>
      <input class="form-input" id="collab-invite-user" placeholder="Enter username">
    </div>
    <button class="btn btn-primary" onclick="sendCollabRequest()">Send Collaboration Request</button>
    <div class="section-header"><span class="section-title">Pending Requests</span></div>
    <div id="collab-requests"><div class="card card-body text-muted" style="text-align:center;">No pending requests</div></div>
  `;
  checkCollabRequests();
}

async function sendCollabRequest() {
  const username = document.getElementById('collab-invite-user').value.trim();
  if (!username) { showToast('Enter a username', 'error'); return; }
  const res = await api.collab.request(state.token, username);
  if (res && res.success) { showToast('Request sent', 'success'); document.getElementById('collab-invite-user').value = ''; }
  else showToast(res?.error || 'Failed to send', 'error');
}

async function checkCollabRequests() {
  const res = await api.broadcast.check(state.token);
  // Display any pending collab notifications
}

// ── AI Chat Panel ──
function renderAI() {
  const container = document.getElementById('ai-content');
  const aiServices = [
    { name: 'ChatGPT', url: 'https://chatgpt.com', icon: '&#9672;', desc: 'OpenAI' },
    { name: 'Claude', url: 'https://claude.ai', icon: '&#9673;', desc: 'Anthropic' },
    { name: 'Gemini', url: 'https://gemini.google.com', icon: '&#9670;', desc: 'Google' },
    { name: 'Copilot', url: 'https://copilot.microsoft.com', icon: '&#9671;', desc: 'Microsoft' },
    { name: 'Perplexity', url: 'https://perplexity.ai', icon: '&#8981;', desc: 'Search + AI' },
    { name: 'Poe', url: 'https://poe.com', icon: '&#9674;', desc: 'Multi-model' },
  ];
  let html = '<div style="margin-bottom:12px;color:var(--text-muted);font-size:13px;">AI services open in a new tab (they block embedding).</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
  for (const s of aiServices) {
    html += `<a href="${s.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:var(--text-primary);transition:background 0.15s;">
      <span style="font-size:24px;">${s.icon}</span>
      <div>
        <div style="font-size:14px;font-weight:600;">${s.name}</div>
        <div style="font-size:12px;color:var(--text-muted);">${s.desc}</div>
      </div>
    </a>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

// ── Search Panel ──
function renderSearch() {
  const container = document.getElementById('search-content');
  container.innerHTML = `
    <div class="search-input-wrap">
      <input class="form-input" id="search-query" placeholder="Search notes and snippets..." oninput="performSearch()">
    </div>
    <div id="search-results"></div>
  `;
}

function performSearch() {
  const query = (document.getElementById('search-query')?.value || '').toLowerCase().trim();
  const results = document.getElementById('search-results');
  if (!query) { results.innerHTML = '<div class="text-muted text-center mt-16">Type to search your notes and snippets</div>'; return; }

  let html = '';

  // Search notes
  if (state.notes && state.notes.toLowerCase().includes(query)) {
    const idx = state.notes.toLowerCase().indexOf(query);
    const start = Math.max(0, idx - 40);
    const end = Math.min(state.notes.length, idx + query.length + 40);
    const preview = (start > 0 ? '...' : '') + state.notes.substring(start, end) + (end < state.notes.length ? '...' : '');
    html += `<div class="search-result" onclick="showPanel('notes')"><div class="search-result-title">Notes</div><div class="search-result-meta">Synced notes</div><div class="search-result-preview">${escapeHtml(preview)}</div></div>`;
  }

  // Search snippets
  state.snippets.forEach((s, i) => {
    const nameMatch = (s.name || '').toLowerCase().includes(query);
    const codeMatch = (s.code || '').toLowerCase().includes(query);
    if (nameMatch || codeMatch) {
      let preview = '';
      if (codeMatch) {
        const idx = s.code.toLowerCase().indexOf(query);
        const start = Math.max(0, idx - 30);
        const end = Math.min(s.code.length, idx + query.length + 30);
        preview = (start > 0 ? '...' : '') + s.code.substring(start, end) + (end < s.code.length ? '...' : '');
      }
      html += `<div class="search-result" onclick="showPanel('snippets')"><div class="search-result-title">${escapeHtml(s.name || 'Untitled')}</div><div class="search-result-meta">${escapeHtml(s.language || 'text')} snippet</div>${preview ? `<div class="search-result-preview">${escapeHtml(preview)}</div>` : ''}</div>`;
    }
  });

  results.innerHTML = html || '<div class="text-muted text-center mt-16">No results found</div>';
}

// ── Push Notifications ──
async function requestPushOnLogin() {
  const support = getPushSupport();
  if (!support.hasSW || !support.hasPush || !support.hasNotif) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      state.pushSubscription = existing;
      await api.push.subscribe(state.token, existing.toJSON());
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      state.pushSubscription = sub;
      await api.push.subscribe(state.token, sub.toJSON());
      showToast('Notifications enabled', 'success');
    }
  } catch (e) { console.error('Auto push setup error:', e); }
}

function getPushSupport() {
  return {
    hasSW: 'serviceWorker' in navigator,
    hasPush: 'PushManager' in window,
    hasNotif: 'Notification' in window,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent)
  };
}

async function setupPushNotifications() {
  const support = getPushSupport();
  const statusEl = document.getElementById('push-status');
  const toggleEl = document.getElementById('push-toggle');
  const enableSection = document.getElementById('push-enable-section');

  if (support.isIOS && !support.isStandalone) {
    statusEl.textContent = 'Push notifications require the app to be added to your Home Screen.';
    statusEl.style.display = 'block'; toggleEl.disabled = true; return;
  }
  if (!support.hasSW) { statusEl.textContent = 'Push notifications are not supported on this browser.'; statusEl.style.display = 'block'; toggleEl.disabled = true; return; }
  if (!support.hasPush) { statusEl.textContent = 'Push notifications are not available.'; statusEl.style.display = 'block'; toggleEl.disabled = true; return; }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      state.pushSubscription = sub; toggleEl.checked = true;
      statusEl.textContent = 'Notifications are enabled.'; statusEl.style.display = 'block'; statusEl.style.color = 'var(--success)';
      await api.push.subscribe(state.token, sub.toJSON());
    } else {
      if (support.hasNotif && Notification.permission === 'default') enableSection.style.display = 'block';
      statusEl.textContent = 'Notifications are disabled.'; statusEl.style.display = 'block';
    }
  } catch (e) { statusEl.textContent = 'Error: ' + e.message; statusEl.style.display = 'block'; }
}

async function handleEnablePush() {
  const btn = document.getElementById('push-enable-btn');
  btn.disabled = true; btn.textContent = 'Requesting permission...';
  await handlePushToggle(true);
  document.getElementById('push-enable-section').style.display = 'none';
  btn.disabled = false; btn.textContent = 'Enable Push Notifications';
}

async function handlePushToggle(enabled) {
  const support = getPushSupport();
  const statusEl = document.getElementById('push-status');
  if (!support.hasSW || !support.hasPush) { showToast('Push not supported', 'error'); document.getElementById('push-toggle').checked = false; return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    if (enabled) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { showToast('Permission denied', 'error'); document.getElementById('push-toggle').checked = false; return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      state.pushSubscription = sub;
      await api.push.subscribe(state.token, sub.toJSON());
      showToast('Notifications enabled', 'success');
      statusEl.textContent = 'Notifications are enabled.'; statusEl.style.display = 'block'; statusEl.style.color = 'var(--success)';
    } else {
      if (state.pushSubscription) {
        const endpoint = state.pushSubscription.endpoint;
        await state.pushSubscription.unsubscribe();
        await api.push.unsubscribe(state.token, endpoint);
        state.pushSubscription = null;
        showToast('Notifications disabled', 'success');
        statusEl.textContent = 'Notifications are disabled.'; statusEl.style.display = 'block'; statusEl.style.color = 'var(--text-muted)';
      }
    }
  } catch (e) { showToast('Failed: ' + e.message, 'error'); document.getElementById('push-toggle').checked = !!state.pushSubscription; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ── Utilities ──
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return d.toLocaleDateString();
}

let toastTimer = null;
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  requestAnimationFrame(() => { toast.classList.add('show'); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000); });
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
});

// Handle enter key on login/register forms
document.getElementById('login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
document.getElementById('reg-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });
