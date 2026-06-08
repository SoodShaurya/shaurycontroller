'use strict';
// shaurycontroller frontend — single-page, no framework.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const state = { servers: [], selected: null, ws: null, cwd: '', info: null,
  metrics: { srvCpu: [], srvRam: [], hostCpu: [], hostRam: [] } };

// ---- helpers ---------------------------------------------------------------
async function api(method, path, body, raw) {
  const opt = { method, headers: {} };
  if (raw) { opt.body = raw; }
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(path, opt);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || res.statusText);
  return data;
}
function fmtBytes(n) {
  if (n == null) return '–';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i ? 1 : 0) + ' ' + u[i];
}
function fmtDur(s) {
  if (s == null) return '–';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`; if (h) return `${h}h ${m}m`; if (m) return `${m}m ${s % 60}s`; return `${s}s`;
}
function fmtDate(ms) { return new Date(ms).toLocaleString(); }
function pjoin(a, b) { return a ? a.replace(/\/+$/, '') + '/' + b : b; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let toastT;
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 4000);
}
function confirmDialog({ title, body, danger, prompt, value }) {
  return new Promise((resolve) => {
    $('#cfTitle').textContent = title; $('#cfBody').textContent = body || '';
    const inp = $('#cfInput');
    if (prompt) { inp.classList.remove('hidden'); inp.value = value || ''; setTimeout(() => inp.focus(), 50); }
    else inp.classList.add('hidden');
    $('#cfOk').className = 'btn ' + (danger ? 'btn-bad' : 'btn-accent');
    $('#confirmModal').classList.remove('hidden');
    const done = (val) => { $('#confirmModal').classList.add('hidden'); $('#cfOk').onclick = $('#cfCancel').onclick = null; resolve(val); };
    $('#cfOk').onclick = () => done(prompt ? inp.value : true);
    $('#cfCancel').onclick = () => done(false);
  });
}

// ---- server list -----------------------------------------------------------
async function refreshServers() {
  const { servers } = await api('GET', '/api/servers');
  state.servers = servers;
  renderServerList();
  if (state.selected) {
    const s = servers.find((x) => x.id === state.selected);
    if (s) updateStatus(s.status);
  }
}
function miniRow(label, pct, val, cls) {
  return `<div class="mini-row"><span class="mini-l">${label}</span><span class="mini-bar"><span class="mini-fill ${cls}" style="width:${Math.max(0, Math.min(100, pct))}%"></span></span><span class="mini-v">${esc(val)}</span></div>`;
}
function renderServerList() {
  const el = $('#serverList'); el.innerHTML = '';
  const cores = (state.info && state.info.cpus) || 1;
  const totalMem = (state.info && state.info.totalMemBytes) || 1;
  const diskTotal = (state.info && state.info.diskTotalBytes) || 1;
  for (const s of state.servers) {
    const st = s.status || {};
    const on = st.running;
    const cpu = on && st.cpuPct != null ? Math.round(st.cpuPct / cores) : 0;
    const ramB = on ? (st.rssBytes || 0) : 0;
    const ramPct = Math.round((ramB / totalMem) * 100);
    const diskB = st.diskBytes;
    const diskPct = diskB != null ? Math.round((diskB / diskTotal) * 100) : 0;
    const div = document.createElement('div');
    div.className = 'server-item' + (s.id === state.selected ? ' active' : '');
    const players = on && st.players ? ` · 👥 ${st.players.online}/${st.players.max}` : '';
    div.innerHTML = `<div class="name"><span class="dot ${on ? 'on' : 'off'}"></span>${esc(s.name)}${s.autoRestart ? ' <span class="ar-badge" title="auto-restart on crash">⟳</span>' : ''}</div>
      <div class="sub">MC ${esc(s.mcVersion)} · :${esc(s.port)} · ${on ? 'running' : 'stopped'}${players}</div>
      <div class="mini">
        ${miniRow('CPU', cpu, on ? cpu + '%' : '—', 'c-cpu')}
        ${miniRow('RAM', ramPct, on ? fmtBytes(ramB) : '—', 'c-ram')}
        ${miniRow('DISK', diskPct, diskB != null ? fmtBytes(diskB) : '…', 'c-disk')}
      </div>`;
    div.onclick = () => { location.hash = '#/' + s.id; };
    el.appendChild(div);
  }
}

// ---- routing: each server (and tab) has a URL hash like #/tardcentral/files --
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [id, tab] = h.split('/');
  if (!id) return;
  if (!state.servers.find((s) => s.id === id)) return;
  if (state.selected !== id) selectServer(id, tab || 'console');
  else if (tab) switchTab(tab);
}
window.addEventListener('hashchange', route);

// ---- select + websocket ----------------------------------------------------
function selectServer(id, tab = 'console') {
  state.selected = id; state.cwd = '';
  state.metrics = { srvCpu: [], srvRam: [], hostCpu: [], hostRam: [] };
  delete $('#modResults').dataset.loaded; $('#modResults').innerHTML = ''; modState.offset = 0; // reset Modrinth browser for the new server
  $('#empty').classList.add('hidden'); $('#serverView').classList.remove('hidden');
  renderServerList();
  const s = state.servers.find((x) => x.id === id);
  $('#serverTitle').textContent = s.name;
  $('#serverMeta').textContent = `MC ${s.mcVersion} · port ${s.port} · ${s.memory} heap`;
  $('#console').textContent = '';
  switchTab(tab);
  renderSettings(s);
  connectWS(id);
  loadFiles('');
  loadBackups();
}
function connectWS(id) {
  if (state.ws) { state.ws.onclose = null; state.ws.close(); }
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?server=${encodeURIComponent(id)}`);
  state.ws = ws;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'backlog') { $('#console').textContent = m.text || ''; scrollConsole(); }
    else if (m.type === 'console') appendConsole(m.line);
    else if (m.type === 'status') { updateStatus(m.status); updateMetrics(m.status, m.host); }
    else if (m.type === 'backup') updateBackup(m);
  };
  ws.onclose = () => { if (state.selected === id) setTimeout(() => connectWS(id), 1500); };
}
function appendConsole(line) {
  const c = $('#console'); const atBottom = c.scrollTop + c.clientHeight >= c.scrollHeight - 30;
  c.textContent += line + '\n';
  if (c.textContent.length > 400000) c.textContent = c.textContent.slice(-300000);
  if (atBottom) scrollConsole();
}
function scrollConsole() { const c = $('#console'); c.scrollTop = c.scrollHeight; }
function updateStatus(st) {
  if (!st) return;
  const on = st.running;
  $('#statusDot').className = 'dot ' + (on ? 'on' : 'off');
  const players = st.players ? `<span>players <b>${st.players.online}/${st.players.max}</b></span>` : '';
  $('#stats').innerHTML = on
    ? `<span>pid <b>${st.pid ?? '–'}</b></span><span>cpu <b>${st.cpuPct ?? '–'}%</b></span>
       <span>mem <b>${fmtBytes(st.rssBytes)}</b></span><span>uptime <b>${fmtDur(st.uptimeSec)}</b></span>${players}`
    : `<span class="muted">stopped</span>`;
  $('#btnStart').disabled = on; $('#btnStop').disabled = !on; $('#btnRestart').disabled = !on; $('#btnKill').disabled = !on;
  const item = state.servers.find((x) => x.id === state.selected); if (item) item.status = st;
}

// ---- tabs ------------------------------------------------------------------
function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tabpane').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'files') loadFiles(state.cwd);
  if (name === 'config') loadConfigs();
  if (name === 'backups') loadBackups();
  if (name === 'metrics') drawAllSparks();
  if (name === 'mods') modInit();
}
$$('.tab').forEach((t) => (t.onclick = () => { if (state.selected) location.hash = '#/' + state.selected + '/' + t.dataset.tab; }));

// ---- lifecycle controls ----------------------------------------------------
$('#btnStart').onclick = () => act('start');
$('#btnStop').onclick = () => act('stop');
$('#btnRestart').onclick = () => act('restart');
$('#btnKill').onclick = async () => { if (await confirmDialog({ title: 'Force kill?', body: 'Kills the JVM without saving the world.', danger: true })) act('kill'); };
async function act(what) {
  try { await api('POST', `/api/servers/${state.selected}/${what}`); toast(what + ' requested'); refreshServers(); }
  catch (e) { toast(e.message, true); }
}
let cmdHistory = [], cmdHistIdx = -1;
$('#cmdForm').onsubmit = (e) => {
  e.preventDefault();
  const inp = $('#cmdInput'); const cmd = inp.value.trim(); if (!cmd) return;
  if (cmdHistory[cmdHistory.length - 1] !== cmd) cmdHistory.push(cmd);
  if (cmdHistory.length > 100) cmdHistory.shift();
  cmdHistIdx = cmdHistory.length;
  if (state.ws && state.ws.readyState === 1) state.ws.send(JSON.stringify({ type: 'command', command: cmd }));
  else api('POST', `/api/servers/${state.selected}/command`, { command: cmd }).catch((e) => toast(e.message, true));
  inp.value = '';
};
$('#cmdInput').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') {
    if (!cmdHistory.length) return;
    e.preventDefault(); cmdHistIdx = Math.max(0, cmdHistIdx - 1); e.target.value = cmdHistory[cmdHistIdx] || '';
    setTimeout(() => e.target.setSelectionRange(e.target.value.length, e.target.value.length), 0);
  } else if (e.key === 'ArrowDown') {
    if (!cmdHistory.length) return;
    e.preventDefault(); cmdHistIdx = Math.min(cmdHistory.length, cmdHistIdx + 1); e.target.value = cmdHistory[cmdHistIdx] || '';
  }
});

// ---- files -----------------------------------------------------------------
async function loadFiles(rel) {
  if (!state.selected) return;
  try {
    const data = await api('GET', `/api/servers/${state.selected}/files?path=${encodeURIComponent(rel || '')}`);
    state.cwd = data.path || '';
    renderBreadcrumb(state.cwd);
    const tb = $('#fileRows'); tb.innerHTML = '';
    if (state.cwd) {
      const up = document.createElement('tr');
      up.innerHTML = `<td><span class="fname dir">📁 ..</span></td><td></td><td></td><td></td>`;
      up.querySelector('.fname').onclick = () => loadFiles(parentPath(state.cwd));
      tb.appendChild(up);
    }
    for (const e of data.entries) {
      const tr = document.createElement('tr');
      const rel2 = pjoin(state.cwd, e.name);
      tr.innerHTML = `<td><span class="fname ${e.dir ? 'dir' : ''}">${e.dir ? '📁' : '📄'} ${e.name}</span></td>
        <td>${e.dir ? '' : fmtBytes(e.size)}</td><td class="muted">${fmtDate(e.mtime)}</td>
        <td class="row-actions"></td>`;
      const nameEl = tr.querySelector('.fname');
      nameEl.onclick = () => (e.dir ? loadFiles(rel2) : editFile(rel2));
      const act = tr.querySelector('.row-actions');
      if (!e.dir) act.appendChild(mkBtn('↓', () => window.open(`/api/servers/${state.selected}/download?path=${encodeURIComponent(rel2)}`)));
      act.appendChild(mkBtn('rename', () => renameEntry(rel2, e.name)));
      act.appendChild(mkBtn('🗑', async () => {
        if (await confirmDialog({ title: 'Delete', body: `Delete "${e.name}"?`, danger: true })) {
          await api('DELETE', `/api/servers/${state.selected}/file?path=${encodeURIComponent(rel2)}`).catch((er) => toast(er.message, true));
          loadFiles(state.cwd);
        }
      }, 'btn-bad'));
      tb.appendChild(tr);
    }
  } catch (e) { toast(e.message, true); }
}
function mkBtn(label, onclick, cls) { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.textContent = label; b.onclick = onclick; return b; }
function parentPath(p) { const i = p.replace(/\/+$/, '').lastIndexOf('/'); return i === -1 ? '' : p.slice(0, i); }
function renderBreadcrumb(p) {
  const bc = $('#breadcrumb'); bc.innerHTML = '';
  const root = document.createElement('a'); root.textContent = state.selected + '/'; root.onclick = () => loadFiles(''); bc.appendChild(root);
  let acc = '';
  for (const part of p.split('/').filter(Boolean)) {
    acc = pjoin(acc, part);
    const a = document.createElement('a'); a.textContent = part + '/'; const t = acc; a.onclick = () => loadFiles(t); bc.appendChild(a);
  }
}
async function renameEntry(rel, name) {
  const nn = await confirmDialog({ title: 'Rename', prompt: true, value: name });
  if (nn && nn !== name) {
    await api('POST', `/api/servers/${state.selected}/rename`, { from: rel, to: pjoin(parentPath(rel), nn) }).catch((e) => toast(e.message, true));
    loadFiles(state.cwd);
  }
}
const editFile = (rel) => openSmartEditor(rel); // file manager uses the format-aware editor too

// ---- format-aware editor (properties form / JSON / text) -------------------
let edState = { path: '', mode: 'text', lines: [], entries: [] };
async function openSmartEditor(rel) {
  try {
    const data = await api('GET', `/api/servers/${state.selected}/file?path=${encodeURIComponent(rel)}`);
    edState = { path: rel, mode: 'text', lines: [], entries: [] };
    $('#edTitle').textContent = rel;
    $('#edMsg').textContent = ''; $('#edMsg').className = 'muted';
    $('#edModeBar').innerHTML = ''; $('#edForm').classList.add('hidden'); $('#edForm').innerHTML = '';
    $('#edContent').classList.remove('hidden');
    const ext = (rel.split('.').pop() || '').toLowerCase();
    if (ext === 'properties') buildPropsEditor(data.content);
    else if (['json', 'json5', 'jsonc', 'mcmeta'].includes(ext)) buildJsonEditor(data.content);
    else { edState.mode = 'text'; $('#edContent').value = data.content; $('#edModeBar').textContent = 'plain text'; }
    $('#editorModal').classList.remove('hidden');
  } catch (e) { toast(e.message, true); }
}
function buildPropsEditor(content) {
  edState.mode = 'properties';
  edState.lines = content.split('\n');
  edState.entries = [];
  $('#edContent').classList.add('hidden');
  $('#edModeBar').textContent = 'visual editor — toggles for booleans, dropdowns for known options';
  const form = $('#edForm'); form.classList.remove('hidden'); form.innerHTML = '';
  edState.lines.forEach((line, i) => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (!m) return;
    const key = m[1], val = m[2];
    const lbl = document.createElement('label'); lbl.className = 'ed-key'; lbl.textContent = key;
    let input;
    if (val === 'true' || val === 'false') { input = document.createElement('input'); input.type = 'checkbox'; input.checked = val === 'true'; }
    else if (key === 'difficulty' || key === 'gamemode') {
      input = document.createElement('select');
      const opts = key === 'difficulty' ? ['peaceful', 'easy', 'normal', 'hard'] : ['survival', 'creative', 'adventure', 'spectator'];
      if (!opts.includes(val)) opts.push(val);
      opts.forEach((o) => { const op = document.createElement('option'); op.value = o; op.textContent = o; input.appendChild(op); });
      input.value = val;
    } else if (/^-?\d+$/.test(val)) { input = document.createElement('input'); input.type = 'number'; input.value = val; }
    else { input = document.createElement('input'); input.type = 'text'; input.value = val; }
    input.className = 'ed-val';
    form.appendChild(lbl); form.appendChild(input);
    edState.entries.push({ key, lineIndex: i, el: input });
  });
  const add = document.createElement('div'); add.className = 'ed-add';
  add.innerHTML = `<input class="ed-add-k" placeholder="new key" /><input class="ed-add-v" placeholder="value" /><button type="button" class="btn ed-add-btn">＋ add</button>`;
  add.querySelector('.ed-add-btn').onclick = () => {
    const k = add.querySelector('.ed-add-k').value.trim(); if (!k) return;
    edState.lines.push(k + '=' + add.querySelector('.ed-add-v').value);
    buildPropsEditor(edState.lines.join('\n'));
  };
  form.appendChild(add);
}
function buildJsonEditor(content) {
  edState.mode = 'json';
  $('#edForm').classList.add('hidden');
  const ta = $('#edContent'); ta.classList.remove('hidden');
  let pretty = content; try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch {}
  ta.value = pretty;
  $('#edModeBar').innerHTML = '<span>JSON</span>';
  const fmt = mkBtn('Format', () => { try { ta.value = JSON.stringify(JSON.parse(ta.value), null, 2); setEdMsg('formatted', false); } catch (e) { setEdMsg('Invalid JSON: ' + e.message, true); } });
  const val = mkBtn('Validate', () => { try { JSON.parse(ta.value); setEdMsg('✓ valid JSON', false); } catch (e) { setEdMsg('✗ ' + e.message, true); } });
  $('#edModeBar').append(fmt, val);
}
function setEdMsg(t, bad) { $('#edMsg').textContent = t; $('#edMsg').className = 'muted' + (bad ? ' bad-text' : ''); }
$('#edCancel').onclick = () => $('#editorModal').classList.add('hidden');
$('#edSave').onclick = async () => {
  let content;
  if (edState.mode === 'properties') {
    const lines = edState.lines.slice();
    for (const e of edState.entries) lines[e.lineIndex] = e.key + '=' + (e.el.type === 'checkbox' ? (e.el.checked ? 'true' : 'false') : e.el.value);
    content = lines.join('\n');
  } else if (edState.mode === 'json') {
    try { JSON.parse($('#edContent').value); } catch (e) { return setEdMsg('Refusing to save invalid JSON: ' + e.message, true); }
    content = $('#edContent').value;
  } else { content = $('#edContent').value; }
  try {
    await api('PUT', `/api/servers/${state.selected}/file`, { path: edState.path, content });
    $('#editorModal').classList.add('hidden'); toast('saved ' + edState.path);
    if ($('#tab-config').classList.contains('active')) loadConfigs();
  } catch (e) { setEdMsg(e.message, true); }
};

// ---- Config tab ------------------------------------------------------------
async function loadConfigs() {
  if (!state.selected) return;
  try {
    const { configs } = await api('GET', `/api/servers/${state.selected}/configs`);
    const el = $('#configList'); el.innerHTML = '';
    if (!configs.length) { el.innerHTML = '<div class="muted">No config files found.</div>'; return; }
    for (const c of configs) {
      const row = document.createElement('div'); row.className = 'cfg-row';
      row.innerHTML = `<span class="cfg-name">${esc(c.path)}</span><span class="cfg-badge">${esc(c.type || 'txt')}</span><span class="cfg-size">${fmtBytes(c.size)}</span>`;
      row.onclick = () => openSmartEditor(c.path);
      el.appendChild(row);
    }
  } catch (e) { toast(e.message, true); }
}
$('#cfgRefresh').onclick = loadConfigs;
$('#btnRefreshFiles').onclick = () => loadFiles(state.cwd);
$('#btnNewFolder').onclick = async () => {
  const name = await confirmDialog({ title: 'New folder', prompt: true });
  if (name) { await api('POST', `/api/servers/${state.selected}/mkdir`, { path: pjoin(state.cwd, name) }).catch((e) => toast(e.message, true)); loadFiles(state.cwd); }
};
$('#btnUpload').onclick = () => $('#uploadInput').click();
$('#uploadInput').onchange = async (e) => {
  for (const f of e.target.files) {
    try {
      await api('POST', `/api/servers/${state.selected}/upload?path=${encodeURIComponent(state.cwd)}&name=${encodeURIComponent(f.name)}`, undefined, f);
      toast('uploaded ' + f.name);
    } catch (er) { toast(er.message, true); }
  }
  e.target.value = ''; loadFiles(state.cwd);
};

// ---- backups ---------------------------------------------------------------
async function loadBackups() {
  if (!state.selected) return;
  try {
    const data = await api('GET', `/api/servers/${state.selected}/backups`);
    if (data.job && data.job.running) showBackupProgress(data.job);
    const tb = $('#backupRows'); tb.innerHTML = '';
    for (const b of data.backups) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="mono">${b.name}<div class="muted mono" style="font-size:11px">${b.path}</div></td>
        <td>${fmtBytes(b.size)}</td><td class="muted">${fmtDate(b.mtime)}</td><td class="row-actions"></td>`;
      const act = tr.querySelector('.row-actions');
      act.appendChild(mkBtn('↓', () => window.open(`/api/servers/${state.selected}/backups/download?name=${encodeURIComponent(b.name)}`)));
      act.appendChild(mkBtn('🗑', async () => {
        if (await confirmDialog({ title: 'Delete backup', body: b.name, danger: true })) {
          await api('DELETE', `/api/servers/${state.selected}/backups?name=${encodeURIComponent(b.name)}`).catch((e) => toast(e.message, true));
          loadBackups();
        }
      }, 'btn-bad'));
      tb.appendChild(tr);
    }
  } catch (e) { toast(e.message, true); }
}
$('#btnBackup').onclick = async () => {
  const compress = $('#compressChk').checked;
  $('#btnBackup').disabled = true;
  try { await api('POST', `/api/servers/${state.selected}/backup`, { compress }); toast('backup started'); }
  catch (e) { toast(e.message, true); $('#btnBackup').disabled = false; }
};
function showBackupProgress(j) {
  $('#backupProgress').classList.remove('hidden');
  $('#bpPhase').textContent = j.phase || 'working';
  $('#bpPct').textContent = (j.pct || 0) + '%';
  $('#bpFill').style.width = (j.pct || 0) + '%';
  if (j.file) $('#bpFile').textContent = j.file;
}
function updateBackup(m) {
  if (m.phase === 'done') {
    showBackupProgress({ ...m, pct: 100 });
    toast('backup complete: ' + (m.file || ''));
    setTimeout(() => { $('#backupProgress').classList.add('hidden'); }, 2500);
    $('#btnBackup').disabled = false; loadBackups();
  } else if (m.phase === 'error') {
    $('#backupProgress').classList.add('hidden'); $('#btnBackup').disabled = false;
    toast('backup failed: ' + (m.error || ''), true);
  } else if (m.phase) {
    showBackupProgress(m); $('#btnBackup').disabled = true;
  }
}

// ---- Mods (Modrinth browser) ----------------------------------------------
let modState = { offset: 0, loading: false };
function currentServer() { return state.servers.find((s) => s.id === state.selected) || {}; }
function modInit() {
  $('#modMcLabel').textContent = currentServer().mcVersion || '';
  if (!$('#modResults').dataset.loaded) modSearch(true);
}
$('#modSearchForm').addEventListener('submit', (e) => { e.preventDefault(); modSearch(true); });
$('#modType').addEventListener('change', () => modSearch(true));
$('#modMcOnly').addEventListener('change', () => modSearch(true));
$('#modMore').onclick = () => modSearch(false);
async function modSearch(reset) {
  if (modState.loading) return; modState.loading = true;
  if (reset) { modState.offset = 0; $('#modResults').innerHTML = ''; }
  try {
    const gv = $('#modMcOnly').checked ? (currentServer().mcVersion || '') : '';
    const params = new URLSearchParams({ q: $('#modQuery').value.trim(), type: $('#modType').value, gameVersion: gv, offset: String(modState.offset) });
    const r = await api('GET', '/api/modrinth/search?' + params.toString());
    $('#modResults').dataset.loaded = '1';
    if (reset && !r.hits.length) $('#modResults').innerHTML = '<div class="muted">No results.</div>';
    r.hits.forEach(renderModCard);
    modState.offset += r.hits.length;
    $('#modMore').classList.toggle('hidden', modState.offset >= r.total || !r.hits.length);
  } catch (e) { toast(e.message, true); }
  finally { modState.loading = false; }
}
function renderModCard(h) {
  const card = document.createElement('div'); card.className = 'mod-card';
  const icon = h.iconUrl ? `<img class="mod-icon" src="${esc(h.iconUrl)}" alt="" loading="lazy" />` : '<div class="mod-icon"></div>';
  card.innerHTML = `${icon}
    <div class="mod-main">
      <div class="mod-title">${esc(h.title)} <span class="by">by ${esc(h.author || '?')}</span> <span class="mod-dl">▼ ${(h.downloads || 0).toLocaleString()}</span></div>
      <div class="mod-desc">${esc(h.description || '')}</div>
      <div class="mod-card-actions"><button class="btn mod-details">Details ▾</button><button class="btn btn-accent mod-quick">Install latest</button><span class="mod-msg"></span></div>
      <div class="mod-expand"></div>
    </div>`;
  card.querySelector('.mod-quick').onclick = () => installMod(h, null, card.querySelector('.mod-msg'));
  card.querySelector('.mod-details').onclick = () => toggleModDetails(card, h);
  $('#modResults').appendChild(card);
}
async function toggleModDetails(card, h) {
  card.classList.toggle('open');
  const exp = card.querySelector('.mod-expand');
  if (!card.classList.contains('open') || exp.dataset.loaded) return;
  exp.innerHTML = '<div class="muted">loading…</div>';
  try {
    const gv = $('#modMcOnly').checked ? (currentServer().mcVersion || '') : '';
    const loader = h.projectType === 'mod' ? 'fabric' : '';
    const [proj, vers] = await Promise.all([
      api('GET', `/api/modrinth/project/${encodeURIComponent(h.slug)}`),
      api('GET', `/api/modrinth/project/${encodeURIComponent(h.slug)}/versions?` + new URLSearchParams({ loader, gameVersion: gv }).toString()),
    ]);
    exp.dataset.loaded = '1';
    const body = (proj.body || proj.description || '').slice(0, 4000);
    const opts = (vers.versions || []).map((v) => `<option value="${esc(v.id)}">${esc(v.versionNumber)} · MC ${esc((v.gameVersions || []).slice(-3).join(','))} · ${esc((v.loaders || []).join(','))}</option>`).join('');
    exp.innerHTML = `<div class="mod-body">${esc(body)}</div>
      <div class="mod-install-row">
        <select class="mod-ver">${opts || '<option value="">no matching version for this server</option>'}</select>
        <button class="btn btn-accent mod-install-ver">Install selected</button>
        <span class="mod-msg msg2"></span>
      </div>`;
    const sel = exp.querySelector('.mod-ver');
    exp.querySelector('.mod-install-ver').onclick = () => installMod(h, sel.value || null, exp.querySelector('.msg2'));
  } catch (e) { exp.innerHTML = '<div class="mod-msg">error: ' + esc(e.message) + '</div>'; }
}
async function installMod(h, versionId, msgEl) {
  if (!state.selected) return;
  msgEl.textContent = 'installing…';
  try {
    const gv = $('#modMcOnly').checked ? (currentServer().mcVersion || '') : '';
    const r = await api('POST', `/api/servers/${state.selected}/modrinth/install`, { slug: h.slug, versionId, projectType: h.projectType, loader: 'fabric', gameVersion: gv });
    msgEl.textContent = `✓ installed ${r.file} → ${r.dir}/`;
    toast('installed ' + r.file);
  } catch (e) { msgEl.textContent = '✗ ' + e.message; }
}

// ---- settings (editable) + delete -----------------------------------------
function renderSettings(s) {
  $('#mSrvName').textContent = s.id;
  $('#setAutoRestart').checked = !!s.autoRestart;
  $('#setPort').value = s.port ?? '';
  $('#setMemory').value = s.memory ?? '';
  flagList = (s.jvmArgs || '').split(/\s+/).filter(Boolean); // JVM flags as chips
  renderFlags();
  // immediate fallback option so the preview works before /java and /jars resolve
  $('#setJava').innerHTML = `<option value="${esc(s.java || '')}">${esc(s.java || '(default)')}</option>`;
  $('#setJava').value = s.java || '';
  loadJavas(s.java); // auto-detect installed JDKs and fill the selector
  $('#setJar').innerHTML = `<option value="${esc(s.jar || '')}">${esc(s.jar || '(none)')}</option>`;
  $('#setJar').value = s.jar || '';
  $('#jarStatus').textContent = ''; $('#jarDlStatus').textContent = '';
  $('#jarDownloadPanel').classList.add('hidden');
  $('#setStatus').textContent = '';
  updatePreview();
  loadJars(s.id, s.jar); // auto-detect jars in the working dir and fill the selector
  const dir = `${state.info ? state.info.serversDir : ''}/${s.id}`;
  const rows = [['id', s.id], ['Minecraft', s.mcVersion], ['Fabric loader', s.loader || '–'],
    ['installer', s.installer || '–'], ['directory', dir], ['created', s.createdAt || '–']];
  $('#settingsGrid').innerHTML = rows.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`).join('');
}
function buildPreview() {
  const java = $('#setJava').value.trim();
  const mem = $('#setMemory').value.trim();
  const flags = flagList.join(' ');
  const jar = $('#setJar').value.trim();
  const heap = mem ? `-Xms${mem} -Xmx${mem} ` : '';
  return `${java} ${heap}${flags ? flags + ' ' : ''}-jar ${jar} nogui`;
}
function updatePreview() { $('#launchPreview').textContent = buildPreview(); }
['setPort', 'setMemory', 'setJava', 'setJar'].forEach((id) => {
  const el = $('#' + id); if (!el) return;
  el.addEventListener('input', updatePreview);
  el.addEventListener('change', updatePreview);
});

// --- JVM flags as chips ---
let flagList = [];
function renderFlags() {
  const box = $('#flagTags');
  const input = $('#flagInput');
  [...box.querySelectorAll('.tag')].forEach((n) => n.remove());
  flagList.forEach((f, i) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `<span class="tag-text">${esc(f)}</span><button type="button" class="tag-x">×</button>`;
    tag.querySelector('.tag-x').onclick = () => { flagList.splice(i, 1); renderFlags(); updatePreview(); };
    box.insertBefore(tag, input);
  });
}
function addFlagsFromInput() {
  const v = $('#flagInput').value.trim();
  if (!v) return;
  v.split(/\s+/).filter(Boolean).forEach((f) => flagList.push(f));
  $('#flagInput').value = '';
  renderFlags(); updatePreview();
}
$('#flagInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addFlagsFromInput(); }
  else if (e.key === 'Backspace' && !e.target.value && flagList.length) { flagList.pop(); renderFlags(); updatePreview(); }
});
$('#btnAddFlag').onclick = addFlagsFromInput;

// --- Java selector ---
async function loadJavas(currentPath) {
  try {
    const { javas } = await api('GET', '/api/java');
    const sel = $('#setJava'); sel.innerHTML = '';
    if (currentPath && !javas.find((j) => j.path === currentPath)) {
      const o = document.createElement('option'); o.value = currentPath; o.textContent = currentPath + ' (current)'; sel.appendChild(o);
    }
    for (const j of javas) {
      const o = document.createElement('option'); o.value = j.path; o.textContent = j.label; sel.appendChild(o);
    }
    sel.value = currentPath || (javas[0] && javas[0].path) || '';
    updatePreview();
  } catch (e) { /* keep fallback */ }
}
$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const patch = { memory: $('#setMemory').value.trim(), jvmArgs: flagList.join(' '), autoRestart: $('#setAutoRestart').checked };
  const port = $('#setPort').value.trim(); if (port) patch.port = port;
  const java = $('#setJava').value.trim(); if (java) patch.java = java;
  const jar = $('#setJar').value.trim(); if (jar) patch.jar = jar;
  $('#setStatus').textContent = 'saving…';
  try {
    const r = await api('PUT', `/api/servers/${state.selected}/config`, patch);
    $('#launchPreview').textContent = r.launchPreview;
    $('#setStatus').textContent = 'saved' + (r.running ? ' — restart the server to apply' : '');
    await refreshServers();
    const cur = state.servers.find((x) => x.id === state.selected);
    if (cur) $('#serverMeta').textContent = `MC ${cur.mcVersion} · port ${cur.port} · ${cur.memory || 'manual'} heap`;
  } catch (err) { $('#setStatus').textContent = 'error: ' + err.message; }
});

// ---- jar management --------------------------------------------------------
async function loadJars(id, activeJar) {
  try {
    const { jars } = await api('GET', `/api/servers/${id}/jars`);
    if (state.selected !== id) return;
    const sel = $('#setJar'); sel.innerHTML = '';
    if (activeJar && !jars.find((j) => j.name === activeJar)) {
      const o = document.createElement('option');
      o.value = activeJar; o.textContent = activeJar + ' — ⚠ not found on disk';
      sel.appendChild(o);
    }
    for (const j of jars) {
      const o = document.createElement('option');
      o.value = j.name;
      o.textContent = `${j.name}${j.active ? '  ✓active' : ''} · ${fmtBytes(j.size)}`;
      sel.appendChild(o);
    }
    sel.value = activeJar || (jars[0] && jars[0].name) || '';
    updatePreview();
  } catch (e) { /* keep the fallback option */ }
}
async function populateJarVersions() {
  try {
    if (!fabricMeta) fabricMeta = await api('GET', '/api/fabric/meta');
    const stableOnly = $('#jarStableOnly').checked;
    const sel = $('#jarMcVersion'); sel.innerHTML = '';
    for (const v of fabricMeta.games) {
      if (stableOnly && !v.stable) continue;
      const o = document.createElement('option'); o.value = v.version; o.textContent = v.version + (v.stable ? '' : ' (snapshot)');
      sel.appendChild(o);
    }
  } catch (e) { $('#jarDlStatus').textContent = 'failed to load versions: ' + e.message; }
}
$('#btnDetectJars').onclick = () => {
  const srv = state.servers.find((s) => s.id === state.selected);
  if (srv) { loadJars(srv.id, srv.jar); $('#jarStatus').textContent = 're-detected'; }
};
$('#btnDownloadJar').onclick = async () => {
  const p = $('#jarDownloadPanel'); p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) await populateJarVersions();
};
$('#jarStableOnly').onchange = populateJarVersions;
$('#btnDoDownloadJar').onclick = async () => {
  const mcVersion = $('#jarMcVersion').value; if (!mcVersion) return;
  $('#jarDlStatus').textContent = 'downloading Fabric server jar…';
  try {
    const r = await api('POST', `/api/servers/${state.selected}/jars/download`, { mcVersion });
    await refreshServers();
    const srv = state.servers.find((s) => s.id === state.selected);
    renderSettings(srv);
    $('#serverMeta').textContent = `MC ${srv.mcVersion} · port ${srv.port} · ${srv.memory || 'manual'} heap`;
    $('#jarDlStatus').textContent = '';
    toast('downloaded & selected ' + r.jar + ' — Save config / restart to apply');
  } catch (e) { $('#jarDlStatus').textContent = 'error: ' + e.message; }
};
$('#btnFabricApi').onclick = async () => {
  $('#jarStatus').textContent = 'installing Fabric API…';
  try {
    const r = await api('POST', `/api/servers/${state.selected}/jars/fabric-api`, {});
    $('#jarStatus').textContent = 'Fabric API → ' + r.file;
    toast('Fabric API installed: ' + r.file);
  } catch (e) { $('#jarStatus').textContent = ''; toast('Fabric API: ' + e.message, true); }
};
$('#btnPruneJars').onclick = async () => {
  try {
    const { jars } = await api('GET', `/api/servers/${state.selected}/jars`);
    const removable = jars.filter((j) => !j.active).map((j) => j.name);
    if (!removable.length) return toast('no unused jars to prune');
    if (await confirmDialog({ title: 'Prune unused jars', body: `Delete ${removable.length} non-active jar(s)?\n\n${removable.join('\n')}`, danger: true })) {
      const r = await api('POST', `/api/servers/${state.selected}/jars/prune`, {});
      toast('pruned ' + r.deleted.length + ' jar(s)');
      const srv = state.servers.find((s) => s.id === state.selected); loadJars(srv.id, srv.jar);
    }
  } catch (e) { toast(e.message, true); }
};

// ---- metrics ---------------------------------------------------------------
function setGauge(valId, text, fillId, pct) {
  const v = $('#' + valId); if (v) v.textContent = text;
  const f = $('#' + fillId); if (f) f.style.width = Math.max(0, Math.min(100, pct)) + '%';
}
function pushMetric(arr, v) { arr.push(v); if (arr.length > 90) arr.shift(); }
function updateMetrics(st, host) {
  const cores = (state.info && state.info.cpus) || 1;
  const totalMem = (host && host.memTotalBytes) || (state.info && state.info.totalMemBytes) || 1;
  const running = st && st.running;
  const srvCpu = running && st.cpuPct != null ? Math.min(100, Math.round(st.cpuPct / cores)) : 0;
  const srvRamBytes = running ? (st.rssBytes || 0) : 0;
  const srvRamPct = Math.min(100, Math.round((srvRamBytes / totalMem) * 100));
  setGauge('mSrvCpu', srvCpu + '% of machine', 'mSrvCpuFill', srvCpu);
  setGauge('mSrvRam', `${(srvRamBytes / 1073741824).toFixed(2)} GB · ${srvRamPct}%`, 'mSrvRamFill', srvRamPct);
  pushMetric(state.metrics.srvCpu, srvCpu); pushMetric(state.metrics.srvRam, srvRamPct);
  const diskTotal = (host && host.diskTotalBytes) || (state.info && state.info.diskTotalBytes) || 1;
  if (st && st.diskBytes != null) {
    const pct = Math.round((st.diskBytes / diskTotal) * 100);
    setGauge('mSrvDisk', `${(st.diskBytes / 1073741824).toFixed(2)} GB · ${pct}% of disk`, 'mSrvDiskFill', pct);
  }
  if (host) {
    setGauge('mHostCpu', host.cpuPct + '%', 'mHostCpuFill', host.cpuPct);
    setGauge('mHostRam', `${(host.memUsedBytes / 1073741824).toFixed(1)} / ${(host.memTotalBytes / 1073741824).toFixed(1)} GB · ${host.memPct}%`, 'mHostRamFill', host.memPct);
    pushMetric(state.metrics.hostCpu, host.cpuPct); pushMetric(state.metrics.hostRam, host.memPct);
    if (host.diskTotalBytes) {
      setGauge('mHostDisk', `${(host.diskUsedBytes / 1073741824).toFixed(0)} / ${(host.diskTotalBytes / 1073741824).toFixed(0)} GB · ${host.diskPct}%`, 'mHostDiskFill', host.diskPct);
    }
  }
  if ($('#tab-metrics').classList.contains('active')) drawAllSparks();
}
function drawSpark(id, data, color) {
  const c = document.getElementById(id); if (!c) return;
  const w = c.clientWidth || 320, h = c.height || 40;
  if (c.width !== w) c.width = w;
  const ctx = c.getContext('2d'); ctx.clearRect(0, 0, w, h);
  if (data.length < 2) return;
  const n = data.length;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - (Math.max(0, Math.min(100, v)) / 100) * (h - 3) - 2;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.globalAlpha = 0.13; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
}
function drawAllSparks() {
  drawSpark('mSrvCpuSpark', state.metrics.srvCpu, '#5b8cff');
  drawSpark('mSrvRamSpark', state.metrics.srvRam, '#3fb950');
  drawSpark('mHostCpuSpark', state.metrics.hostCpu, '#5b8cff');
  drawSpark('mHostRamSpark', state.metrics.hostRam, '#3fb950');
}
$('#btnDelete').onclick = async () => {
  const id = state.selected;
  const typed = await confirmDialog({ title: 'Delete server', body: `This permanently deletes the server "${id}" and its files (backups are kept). Type the name to confirm.`, danger: true, prompt: true });
  if (typed === id) {
    try { await api('DELETE', `/api/servers/${id}`); toast('deleted ' + id); state.selected = null; location.hash = ''; $('#serverView').classList.add('hidden'); $('#empty').classList.remove('hidden'); refreshServers(); }
    catch (e) { toast(e.message, true); }
  } else if (typed !== false) toast('name did not match — not deleted', true);
};

// ---- new server ------------------------------------------------------------
$('#newServerBtn').onclick = openNewServer;
let fabricMeta = null;
async function openNewServer() {
  $('#newServerModal').classList.remove('hidden');
  $('#nsStatus').textContent = ''; $('#nsName').value = ''; $('#nsMemory').value = '4G';
  $('#nsVersion').innerHTML = '<option>loading…</option>';
  try {
    fabricMeta = await api('GET', '/api/fabric/meta');
    $('#nsMeta').textContent = `loader ${fabricMeta.latestLoader} · installer ${fabricMeta.latestInstaller}`;
    fillVersions();
  } catch (e) { $('#nsStatus').textContent = 'failed to load versions: ' + e.message; }
}
function fillVersions() {
  const stableOnly = $('#nsStableOnly').checked;
  const sel = $('#nsVersion'); sel.innerHTML = '';
  for (const v of fabricMeta.games) {
    if (stableOnly && !v.stable) continue;
    const o = document.createElement('option'); o.value = v.version; o.textContent = v.version + (v.stable ? '' : ' (snapshot)');
    sel.appendChild(o);
  }
}
$('#nsStableOnly').onchange = fillVersions;
$('#nsCancel').onclick = () => $('#newServerModal').classList.add('hidden');
$('#nsCreate').onclick = async () => {
  const name = $('#nsName').value.trim(); const mcVersion = $('#nsVersion').value; const memory = $('#nsMemory').value.trim() || '4G';
  if (!name) return toast('name required', true);
  $('#nsCreate').disabled = true; $('#nsStatus').textContent = 'creating (downloading Fabric server jar)…';
  try {
    const { server } = await api('POST', '/api/servers', { name, mcVersion, memory });
    if ($('#nsFabricApi').checked) {
      $('#nsStatus').textContent = 'installing Fabric API…';
      try { await api('POST', `/api/servers/${server.id}/jars/fabric-api`, { mcVersion }); } catch (e) { toast('created, but Fabric API failed: ' + e.message, true); }
    }
    $('#newServerModal').classList.add('hidden');
    await refreshServers(); location.hash = '#/' + server.id; route(); toast('created ' + server.id);
  } catch (e) { $('#nsStatus').textContent = 'error: ' + e.message; }
  finally { $('#nsCreate').disabled = false; }
};

// ---- AI copilot ------------------------------------------------------------
const aiState = { contents: [], model: '', pending: 0, responses: [], busy: false };
$('#aiLauncher').onclick = () => toggleAi(true);
$('#aiClose').onclick = () => toggleAi(false);
function toggleAi(open) {
  $('#aiDrawer').classList.toggle('hidden', !open);
  if (open) {
    $('#aiFocus').textContent = state.selected || '(none)';
    setTimeout(() => $('#aiInput').focus(), 50);
    if (!aiState.contents.length) renderAiMsg('assistant', "Hi! I can read your servers/host, change a server's config, send console commands, and run host terminal commands — but I'll always ask you to approve each action first. What do you need?");
  }
}
$('#aiForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#aiInput').value.trim(); if (!t || aiState.busy) return;
  $('#aiInput').value = ''; $('#aiInput').style.height = 'auto';
  renderAiMsg('user', t); aiTurn(t);
});
$('#aiInput').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'; });
$('#aiInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#aiForm').requestSubmit(); } });

function aiScroll() { const t = $('#aiThread'); t.scrollTop = t.scrollHeight; }
function renderAiMsg(role, text) {
  const d = document.createElement('div'); d.className = 'ai-msg ' + role; d.textContent = text;
  $('#aiThread').appendChild(d); aiScroll(); return d;
}
function setTyping(on) {
  let t = $('#aiTyping');
  if (on && !t) { t = document.createElement('div'); t.id = 'aiTyping'; t.className = 'ai-typing'; t.textContent = '✦ thinking…'; $('#aiThread').appendChild(t); aiScroll(); }
  else if (!on && t) t.remove();
}
async function aiTurn(userText) {
  if (userText) aiState.contents.push({ role: 'user', parts: [{ text: userText }] });
  aiState.busy = true; setTyping(true);
  try {
    const r = await api('POST', '/api/ai/chat', { contents: aiState.contents, serverId: state.selected });
    aiState.contents.push({ role: 'model', parts: r.modelParts });
    if (r.text) renderAiMsg('assistant', r.text);
    const calls = r.functionCalls || [];
    if (calls.length) { aiState.pending = calls.length; aiState.responses = []; calls.forEach(renderActionCard); }
  } catch (e) { renderAiMsg('error', e.message); }
  finally { aiState.busy = false; setTyping(false); }
}
function renderActionCard(fc) {
  const a = fc.args || {};
  const kind = fc.name === 'terminal_command' ? 'terminal' : fc.name === 'console_command' ? 'console' : 'config';
  const labels = {
    set_server_config: '⚙ modify config', console_command: '⌨ console command', terminal_command: '⚠ host terminal command',
    server_lifecycle: '⚙ server: ' + esc(a.action || 'lifecycle'), create_backup: '⚙ create backup', install_mod: '⚙ install mod',
  };
  const label = labels[fc.name] || esc(fc.name);
  let body = '';
  if (fc.name === 'set_server_config') {
    const { serverId, ...patch } = a;
    const srv = state.servers.find((s) => s.id === serverId) || {};
    body = `<div class="ai-diff"><b>${esc(serverId)}</b><br>` + Object.entries(patch).map(([k, v]) =>
      `${esc(k)}: <span class="old">${esc(String(srv[k] ?? '∅'))}</span> → <span class="new">${esc(String(v))}</span>`).join('<br>') + '</div>';
  } else if (fc.name === 'console_command') {
    body = `<pre>[${esc(a.serverId)}] &gt; ${esc(a.command)}</pre>`;
  } else if (fc.name === 'terminal_command') {
    body = `<pre>$ ${esc(a.command)}</pre>`;
  } else if (fc.name === 'server_lifecycle') {
    body = `<pre>${esc(a.action)} → ${esc(a.serverId)}</pre>`;
  } else if (fc.name === 'create_backup') {
    body = `<pre>backup ${esc(a.serverId)}</pre>`;
  } else if (fc.name === 'install_mod') {
    body = `<pre>install ${esc(a.slug)} (${esc(a.projectType || 'mod')}) → ${esc(a.serverId)}</pre>`;
  }
  const card = document.createElement('div'); card.className = 'ai-card ' + kind;
  card.innerHTML = `<div class="ai-card-h">${label}</div>${body}
    <div class="ai-card-actions"><button class="btn btn-good ai-approve">Approve</button><button class="btn ai-reject">Reject</button></div>
    <div class="ai-result"></div>`;
  const approve = card.querySelector('.ai-approve'), reject = card.querySelector('.ai-reject'), result = card.querySelector('.ai-result');
  approve.onclick = async () => {
    approve.disabled = reject.disabled = true; result.className = 'ai-result'; result.textContent = 'running…';
    try {
      const r = await api('POST', '/api/ai/execute', { action: { name: fc.name, args: fc.args } });
      result.className = 'ai-result ok';
      const summary = r.output || r.recentConsole || (r.file ? `installed ${r.file} → ${r.dir}/` : '')
        || (r.action ? `${r.action} done (running=${r.running})` : '') || (r.startedBackup ? `backup started: ${r.startedBackup}` : '') || r.note || 'done';
      result.textContent = '✓ ' + summary;
      resolveAction(fc.name, r);
    } catch (e) {
      result.className = 'ai-result bad'; result.textContent = '✗ ' + e.message;
      resolveAction(fc.name, { ok: false, error: e.message });
    }
    refreshServers();
  };
  reject.onclick = () => {
    approve.disabled = reject.disabled = true; result.className = 'ai-result bad'; result.textContent = 'rejected';
    resolveAction(fc.name, { rejected: true, note: 'user rejected this action' });
  };
  $('#aiThread').appendChild(card); aiScroll();
}
function resolveAction(name, response) {
  aiState.responses.push({ functionResponse: { name, response } });
  aiState.pending -= 1;
  if (aiState.pending <= 0) {
    aiState.contents.push({ role: 'user', parts: aiState.responses });
    aiState.responses = [];
    aiTurn(); // agent reacts to results / proposes next steps (still approval-gated)
  }
}

// ---- boot ------------------------------------------------------------------
(async function boot() {
  try { state.info = await api('GET', '/api/info'); renderHostInfo(); } catch {}
  try {
    const c = await api('GET', '/api/ai/config');
    if (c.configured) { aiState.model = c.model; $('#aiModel').textContent = c.model; }
    else $('#aiLauncher').style.display = 'none';
  } catch { $('#aiLauncher').style.display = 'none'; }
  await refreshServers();
  route(); // restore selected server/tab from the URL hash (deep-link / refresh)
  setInterval(refreshServers, 5000);
})();
function renderHostInfo() {
  const i = state.info; if (!i) return;
  $('#hostInfo').innerHTML = `host: ${i.cpus} cores · ${fmtBytes(i.totalMemBytes)} RAM<br>disk: ${fmtBytes(i.diskUsedBytes)} / ${fmtBytes(i.diskTotalBytes)} used<br>zstd: ${i.compression.zstd ? '✓' : '✗'} · pv: ${i.compression.pv ? '✓' : '✗'}`;
}
