'use strict';
// shaurycontroller frontend — single-page, no framework.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---- inline SVG icon set (Feather-style; stroke inherits text color) -------
const ICON_PATHS = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10.5 13.9 12.4 12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  package: '<path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  ram: '<rect x="2" y="7" width="20" height="10" rx="1"/><line x1="6" y1="11" x2="6" y2="13"/><line x1="10" y1="11" x2="10" y2="13"/><line x1="14" y1="11" x2="14" y2="13"/><line x1="18" y1="11" x2="18" y2="13"/>',
  disk: '<path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>',
};
function icon(name, cls) {
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}
function iconBtn(name, onclick, { cls = '', title = '', label = '' } = {}) {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.innerHTML = icon(name) + (label ? ' ' + esc(label) : '');
  if (title) b.title = title;
  b.onclick = onclick;
  return b;
}
const worldDropHTML = () => `${icon('upload')} Drag &amp; drop a <b>world .zip</b> here, or click to browse`;
function iconifyStatic() {
  const set = (sel, name, label) => { const el = $(sel); if (el) el.innerHTML = icon(name) + (label ? ' ' + label : ''); };
  set('#newServerBtn', 'plus', 'New server');
  set('#btnUpload', 'upload', 'Upload');
  set('#btnNewFolder', 'folder', 'New folder');
  set('#btnRefreshFiles', 'refresh', 'Refresh');
  set('#cfgRefresh', 'refresh', 'Refresh');
  set('#btnBackup', 'archive', 'Create backup');
  set('#btnDetectJars', 'refresh', 'Detect');
  set('#btnDownloadJar', 'download', 'Download server jar');
  set('#btnFabricApi', 'package', 'Install / update Fabric API');
  set('#btnPruneJars', 'scissors', 'Prune unused jars');
  set('#btnDoDownloadJar', 'download', 'Download & select');
  set('#btnAddFlag', 'plus', '');
  set('#aiClose', 'x', '');
  set('#updateAllBtn', 'refresh', 'Update all outdated');
  const launcher = $('#aiLauncher'); if (launcher) launcher.innerHTML = icon('sparkle', 'ic-lg');
  const title = $('.ai-title'); if (title) title.innerHTML = icon('sparkle') + ' Copilot <span id="aiModel" class="ai-model"></span>';
  const searchBtn = $('#modSearchForm button[type=submit]'); if (searchBtn) searchBtn.innerHTML = icon('search') + ' Search';
  const drop = $('#nsWorldDrop'); if (drop) drop.innerHTML = worldDropHTML();
  set('#mCpuLabel', 'cpu', 'CPU'); set('#mRamLabel', 'ram', 'Memory'); set('#mDiskLabel', 'disk', 'Storage');
}
const state = { servers: [], selected: null, ws: null, cwd: '', info: null, net: null,
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
  const { servers, host } = await api('GET', '/api/servers');
  state.servers = servers;
  renderServerList();
  renderHostMetrics(host);
  if (state.selected) {
    const s = servers.find((x) => x.id === state.selected);
    if (s) updateStatus(s.status);
  }
}
function renderNetwork(net) {
  if (net) state.net = net;
  const n = state.net; if (!n) return;
  const row = (label, ip) => `<div class="net-row"><span class="net-l">${label}</span>${ip ? `<span class="net-ip" data-ip="${esc(ip)}" title="click to copy">${esc(ip)}</span>` : '<span class="muted">—</span>'}</div>`;
  $('#hostNet').innerHTML = row('Tailscale', n.tailscaleIp) + row('Public', n.publicIp);
}
// Clipboard works only in secure contexts; this panel is plain HTTP over Tailscale,
// so fall back to a hidden-textarea execCommand copy.
function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
  }
  return fallbackCopy(text);
}
$('#hostNet').addEventListener('click', async (e) => {
  const el = e.target.closest('.net-ip'); if (!el) return;
  const ok = await copyText(el.dataset.ip);
  toast(ok ? 'copied ' + el.dataset.ip : 'select & copy: ' + el.dataset.ip, !ok);
});
function renderHostMetrics(host) {
  if (!host) return;
  const gb = (b) => (b / 1073741824).toFixed(1);
  $('#hostMetrics').innerHTML =
    miniRow('CPU', host.cpuPct, host.cpuPct + '%', 'c-cpu') +
    miniRow('RAM', host.memPct, `${gb(host.memUsedBytes)}/${gb(host.memTotalBytes)} GB`, 'c-ram') +
    miniRow('DISK', host.diskPct, `${gb(host.diskUsedBytes)}/${gb(host.diskTotalBytes)} GB`, 'c-disk');
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
    const players = on && st.players ? ` · ${icon('users', 'ic-sm')} ${st.players.online}/${st.players.max}` : '';
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
  delete $('#modResults').dataset.loaded; $('#modResults').innerHTML = ''; modState.offset = 0; modState.typeFor = null; // reset Modrinth browser for the new server
  pState = null; playersAll = []; $('#playerEdit').innerHTML = '<div class="muted">Select a player to edit.</div>'; $('#playersList').innerHTML = '';
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
  if (typeof updateAiFocus === 'function') updateAiFocus(); // keep copilot focus pill in sync
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
  if (name === 'players') loadPlayers();
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
let filesSig = '', filesUploading = false;
async function loadFiles(rel, opts = {}) {
  if (!state.selected) return;
  try {
    const data = await api('GET', `/api/servers/${state.selected}/files?path=${encodeURIComponent(rel || '')}`);
    const sig = (data.path || '') + '|' + data.entries.map((e) => `${e.name}:${e.size}:${Math.round(e.mtime)}`).join(',');
    if (opts.auto && sig === filesSig) return; // nothing changed — don't disrupt the view
    filesSig = sig;
    const scroll = $('#tab-files').scrollTop;
    state.cwd = data.path || '';
    renderBreadcrumb(state.cwd);
    const tb = $('#fileRows'); tb.innerHTML = '';
    if (state.cwd) {
      const up = document.createElement('tr');
      up.innerHTML = `<td><span class="fname dir">${icon('folder')} ..</span></td><td></td><td></td><td></td>`;
      up.querySelector('.fname').onclick = () => loadFiles(parentPath(state.cwd));
      tb.appendChild(up);
    }
    for (const e of data.entries) {
      const tr = document.createElement('tr');
      const rel2 = pjoin(state.cwd, e.name);
      tr.innerHTML = `<td><span class="fname ${e.dir ? 'dir' : ''}">${e.dir ? icon('folder') : icon('file')} ${esc(e.name)}</span></td>
        <td>${e.dir ? '' : fmtBytes(e.size)}</td><td class="muted">${fmtDate(e.mtime)}</td>
        <td class="row-actions"></td>`;
      const nameEl = tr.querySelector('.fname');
      nameEl.onclick = () => (e.dir ? loadFiles(rel2) : editFile(rel2));
      const act = tr.querySelector('.row-actions');
      if (!e.dir) act.appendChild(iconBtn('download', () => window.open(`/api/servers/${state.selected}/download?path=${encodeURIComponent(rel2)}`), { title: 'Download' }));
      act.appendChild(mkBtn('rename', () => renameEntry(rel2, e.name)));
      act.appendChild(iconBtn('trash', async () => {
        if (await confirmDialog({ title: 'Delete', body: `Delete "${e.name}"?`, danger: true })) {
          await api('DELETE', `/api/servers/${state.selected}/file?path=${encodeURIComponent(rel2)}`).catch((er) => toast(er.message, true));
          loadFiles(state.cwd);
        }
      }, { cls: 'btn-bad', title: 'Delete' }));
      tb.appendChild(tr);
    }
    $('#tab-files').scrollTop = scroll;
  } catch (e) { if (!opts.auto) toast(e.message, true); }
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
    edState = { path: rel, mode: 'text', lines: [], entries: [], json: null };
    $('#edTitle').textContent = rel;
    $('#edMsg').textContent = ''; $('#edMsg').className = 'muted';
    $('#edModeBar').innerHTML = ''; $('#edForm').classList.add('hidden'); $('#edForm').classList.remove('ed-json'); $('#edForm').innerHTML = '';
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
  $('#edModeBar').innerHTML = '<span class="ed-chip">properties</span>';
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
// JSON gets a collapsible tree editor (edit values inline, expand/collapse, add/remove keys),
// with a Raw-text toggle as a fallback for hand-editing or invalid files.
function buildJsonEditor(content) {
  let parsed, ok = true;
  try { parsed = JSON.parse(content); } catch { ok = false; }
  if (!ok) return buildJsonRaw(content, 'Invalid JSON — editing as raw text.');
  edState.mode = 'jsontree';
  edState.json = parsed;
  $('#edContent').classList.add('hidden');
  const form = $('#edForm'); form.classList.remove('hidden'); form.classList.add('ed-json');
  $('#edModeBar').innerHTML = '<span class="ed-chip">json</span>';
  const expand = mkBtn('Expand all', () => $$('.jt-children', form).forEach((c) => { c.classList.remove('hidden'); }));
  const collapse = mkBtn('Collapse all', () => $$('.jt-children', form).forEach((c) => { c.classList.add('hidden'); }));
  const raw = mkBtn('Raw text', () => buildJsonRaw(JSON.stringify(edState.json, null, 2)));
  $('#edModeBar').append(expand, collapse, raw);
  rebuildJsonTree();
}
function buildJsonRaw(content, note) {
  edState.mode = 'json';
  const form = $('#edForm'); form.classList.add('hidden'); form.classList.remove('ed-json'); form.innerHTML = '';
  const ta = $('#edContent'); ta.classList.remove('hidden'); ta.value = content;
  $('#edModeBar').innerHTML = '<span class="ed-chip">json · raw</span>';
  const fmt = mkBtn('Format', () => { try { ta.value = JSON.stringify(JSON.parse(ta.value), null, 2); setEdMsg('formatted', false); } catch (e) { setEdMsg('Invalid JSON: ' + e.message, true); } });
  const tree = mkBtn('Tree', () => { try { JSON.parse(ta.value); buildJsonEditor(ta.value); setEdMsg('', false); } catch (e) { setEdMsg('Invalid JSON: ' + e.message, true); } });
  $('#edModeBar').append(fmt, tree);
  if (note) setEdMsg(note, true);
}
function rebuildJsonTree() {
  const form = $('#edForm'); form.innerHTML = '';
  const root = document.createElement('div'); root.className = 'json-tree';
  if (edState.json !== null && typeof edState.json === 'object') jtRenderContainer(root, edState.json, 0);
  else { const line = document.createElement('div'); line.className = 'jt-line'; line.append(jtInput(edState, 'json')); root.appendChild(line); }
  form.appendChild(root);
}
function jtInput(container, key) {
  const val = container[key];
  let input;
  if (typeof val === 'boolean') { input = document.createElement('input'); input.type = 'checkbox'; input.className = 'jt-bool'; input.checked = val; input.onchange = () => { container[key] = input.checked; }; }
  else if (typeof val === 'number') { input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.className = 'jt-val'; input.value = val; input.oninput = () => { const n = parseFloat(input.value); container[key] = Number.isFinite(n) ? n : 0; }; }
  else { input = document.createElement('input'); input.type = 'text'; input.className = 'jt-val'; input.value = val === null ? '' : String(val); if (val === null) input.placeholder = 'null'; input.oninput = () => { container[key] = input.value; }; }
  return input;
}
function jtDelBtn(container, key, isArr) {
  const del = document.createElement('button'); del.type = 'button'; del.className = 'jt-del'; del.title = 'remove'; del.textContent = '✕';
  del.onclick = () => { if (isArr) container.splice(key, 1); else delete container[key]; rebuildJsonTree(); };
  return del;
}
function jtRenderContainer(wrap, container, depth) {
  const isArr = Array.isArray(container);
  const keys = isArr ? container.map((_, i) => i) : Object.keys(container);
  for (const k of keys) {
    const val = container[k];
    const keyEl = document.createElement('span'); keyEl.className = 'jt-key'; keyEl.textContent = (isArr ? '[' + k + ']' : k) + ':';
    if (val !== null && typeof val === 'object') {
      const isArr2 = Array.isArray(val);
      const head = document.createElement('div'); head.className = 'jt-line jt-branch'; head.style.paddingLeft = (depth * 14) + 'px';
      const caret = document.createElement('button'); caret.type = 'button'; caret.className = 'jt-caret'; caret.textContent = '▾';
      const meta = document.createElement('span'); meta.className = 'jt-meta'; meta.textContent = isArr2 ? `[${val.length}]` : `{${Object.keys(val).length}}`;
      const children = document.createElement('div'); children.className = 'jt-children';
      caret.onclick = () => { const c = children.classList.toggle('hidden'); caret.textContent = c ? '▸' : '▾'; };
      head.append(caret, keyEl, meta, jtDelBtn(container, k, isArr));
      jtRenderContainer(children, val, depth + 1);
      wrap.append(head, children);
    } else {
      const line = document.createElement('div'); line.className = 'jt-line'; line.style.paddingLeft = (depth * 14) + 'px';
      line.append(keyEl, jtInput(container, k), jtDelBtn(container, k, isArr));
      wrap.appendChild(line);
    }
  }
  const add = document.createElement('div'); add.className = 'jt-add'; add.style.paddingLeft = (depth * 14) + 'px';
  if (isArr) {
    add.append(mkBtn('+ item', () => { container.push(''); rebuildJsonTree(); }));
  } else {
    const ki = document.createElement('input'); ki.className = 'jt-add-k'; ki.placeholder = 'new key';
    add.append(ki, mkBtn('+ key', () => { const nk = ki.value.trim(); if (!nk || nk in container) return; container[nk] = ''; rebuildJsonTree(); }));
  }
  wrap.appendChild(add);
}
function setEdMsg(t, bad) { $('#edMsg').textContent = t; $('#edMsg').className = 'muted' + (bad ? ' bad-text' : ''); }
$('#edCancel').onclick = () => $('#editorModal').classList.add('hidden');
$('#edSave').onclick = async () => {
  let content;
  if (edState.mode === 'properties') {
    const lines = edState.lines.slice();
    for (const e of edState.entries) lines[e.lineIndex] = e.key + '=' + (e.el.type === 'checkbox' ? (e.el.checked ? 'true' : 'false') : e.el.value);
    content = lines.join('\n');
  } else if (edState.mode === 'jsontree') {
    content = JSON.stringify(edState.json, null, 2);
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
function xhrUpload(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => { let d = {}; try { d = JSON.parse(xhr.responseText); } catch {} (xhr.status >= 200 && xhr.status < 300) ? resolve(d) : reject(new Error(d.error || ('HTTP ' + xhr.status))); };
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(file);
  });
}
$('#btnUpload').onclick = () => $('#uploadInput').click();
$('#uploadInput').onchange = async (e) => {
  const files = [...e.target.files]; e.target.value = '';
  if (!files.length) return;
  filesUploading = true;
  const prog = $('#fileUploadProgress'); prog.classList.add('active');
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    $('#fileUploadLabel').textContent = `Uploading ${f.name} (${i + 1}/${files.length})`;
    $('#fileUploadFill').style.width = '0%'; $('#fileUploadPct').textContent = '0%';
    try {
      await xhrUpload(`/api/servers/${state.selected}/upload?path=${encodeURIComponent(state.cwd)}&name=${encodeURIComponent(f.name)}`, f,
        (pct) => { $('#fileUploadFill').style.width = pct + '%'; $('#fileUploadPct').textContent = pct + '%'; });
    } catch (er) { toast('upload failed: ' + f.name + ' — ' + er.message, true); }
  }
  prog.classList.remove('active'); filesUploading = false;
  toast(files.length > 1 ? `uploaded ${files.length} files` : 'uploaded ' + files[0].name);
  loadFiles(state.cwd);
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
      tr.innerHTML = `<td class="mono">${esc(b.name)}<div class="muted mono" style="font-size:11px">${esc(b.path)}</div></td>
        <td>${fmtBytes(b.size)}</td><td class="muted">${fmtDate(b.mtime)}</td><td class="row-actions"></td>`;
      const act = tr.querySelector('.row-actions');
      act.appendChild(iconBtn('download', () => window.open(`/api/servers/${state.selected}/backups/download?name=${encodeURIComponent(b.name)}`), { title: 'Download' }));
      act.appendChild(iconBtn('trash', async () => {
        if (await confirmDialog({ title: 'Delete backup', body: b.name, danger: true })) {
          await api('DELETE', `/api/servers/${state.selected}/backups?name=${encodeURIComponent(b.name)}`).catch((e) => toast(e.message, true));
          loadBackups();
        }
      }, { cls: 'btn-bad', title: 'Delete' }));
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

// ---- minimal safe Markdown renderer ---------------------------------------
function mdEsc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// Mod READMEs mix in raw HTML (<center>, <img>, <a>, badges). Normalize that to markdown/text
// BEFORE escaping so it renders instead of showing as literal source.
function mdClean(md) {
  let s = String(md || '').replace(/\r/g, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*?>/gi, (m, src) => `\n![](${src})\n`);
  s = s.replace(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*?>([\s\S]*?)<\/a>/gi, (m, href, txt) => `[${txt.trim() || href}](${href})`);
  // drop layout/formatting tags but keep their inner text (markdown bold/italic still works)
  s = s.replace(/<\/?(?:center|div|span|p|picture|source|summary|details|font|small|sub|sup|kbd|figure|figcaption|table|thead|tbody|tfoot|tr|td|th|h[1-6]|b|i|u|s|strong|em|blockquote|hr|article|section|header|footer|nav|main|aside|button|abbr|mark)\b[^>]*>/gi, '');
  return s;
}
function mdInline(s) {
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  // images first so the leading "!" is consumed (and linked-image badges work: [![alt](img)](link))
  s = s.replace(/!\[([^\]]*)\]\(\s*(https?:\/\/[^)\s]+)(?:\s+[^)]*)?\)/gi, (m, alt, u) => `<img class="md-img" src="${u}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+[^)]*)?\)/g, (m, t, u) => `<a href="${/^https?:\/\//i.test(u) ? u : '#'}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  return s;
}
function mdToHtml(md) {
  const lines = mdEsc(mdClean(md)).split('\n');
  let html = '', inList = false, inCode = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  const hTag = (n) => (n <= 1 ? 'h3' : n === 2 ? 'h4' : 'h5');
  for (const raw of lines) {
    if (/^```/.test(raw)) { if (inCode) { html += '</code></pre>'; inCode = false; } else { closeList(); html += '<pre class="md-code"><code>'; inCode = true; } continue; }
    if (inCode) { html += raw + '\n'; continue; }
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); const t = hTag(h[1].length); html += `<${t}>${mdInline(h[2])}</${t}>`; continue; }
    const li = raw.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${mdInline(li[1])}</li>`; continue; }
    if (!raw.trim()) { closeList(); continue; }
    closeList(); html += `<p>${mdInline(raw)}</p>`;
  }
  closeList(); if (inCode) html += '</code></pre>';
  return html;
}

// ---- Mods (Modrinth browser) ----------------------------------------------
let modState = { offset: 0, loading: false };
function currentServer() { return state.servers.find((s) => s.id === state.selected) || {}; }
function modInit() {
  const srv = currentServer();
  const isPaper = srv.type === 'paper';
  $('#modMcLabel').textContent = srv.mcVersion || '';
  // The loadable category depends on platform: Fabric loads mods, Paper loads plugins.
  // Show only the relevant one (content types — datapacks/resourcepacks/shaders — apply to both).
  const optMod = $('#modType option[value=mod]'), optPlugin = $('#modType option[value=plugin]');
  if (optMod) optMod.hidden = isPaper;
  if (optPlugin) optPlugin.hidden = !isPaper;
  if (modState.typeFor !== state.selected) {
    $('#modType').value = isPaper ? 'plugin' : 'mod';
    modState.typeFor = state.selected;
  }
  loadInstalled();
  if (!$('#modResults').dataset.loaded) modSearch(true);
}
// The Modrinth project_type of a search hit can't distinguish a Paper plugin from a Fabric mod
// (both report "mod"), so installs/version-lookups use the user-selected dropdown type instead,
// which is defaulted to the server's platform.
function selectedModType() { return $('#modType').value || 'mod'; }
async function loadInstalled() {
  if (!state.selected) return;
  try {
    const { mods, mcVersion, folder } = await api('GET', `/api/servers/${state.selected}/mods/installed`);
    const sec = $('#installedSection'), box = $('#installedMods');
    const noun = folder === 'plugins' ? 'plugins' : 'mods';
    if (!mods.length) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    $('#installedCount').textContent = `· ${mods.length} ${noun} · MC ${mcVersion}`;
    const outdated = mods.filter((m) => m.conflict && m.identified && m.slug);
    const btn = $('#updateAllBtn');
    btn.classList.toggle('hidden', !outdated.length);
    btn.textContent = `Update all outdated (${outdated.length})`;
    btn.onclick = async () => { btn.disabled = true; for (const m of outdated) await doUpdate(m, null); btn.disabled = false; loadInstalled(); };
    box.innerHTML = '';
    mods.forEach((m) => box.appendChild(renderInstalledRow(m, folder || 'mods')));
  } catch (e) { /* ignore */ }
}
function renderInstalledRow(m, folder = 'mods') {
  const row = document.createElement('div'); row.className = 'mod-card installed' + (m.conflict ? ' conflict' : '');
  const iconHtml = m.iconUrl ? `<img class="mod-icon" src="${esc(m.iconUrl)}" alt="" loading="lazy" />` : '<div class="mod-icon"></div>';
  const badge = m.conflict ? `<span class="conflict-badge">${icon('alert', 'ic-sm')} ${esc(m.conflictReason || ('not built for MC ' + currentServer().mcVersion))}</span>` : '';
  const ver = m.identified ? esc(m.versionNumber) : 'unidentified';
  row.innerHTML = `${iconHtml}
    <div class="mod-main">
      <div class="mod-title">${esc(m.title || m.filename)} ${badge}</div>
      <div class="mod-desc mono">${esc(m.filename)} · ${ver}</div>
      <div class="mod-card-actions"></div>
      <div class="mod-expand"></div>
    </div>`;
  const act = row.querySelector('.mod-card-actions');
  if (m.identified && m.slug) act.appendChild(mkBtn('Details', () => toggleModDetails(row, m)));
  if (m.conflict && m.slug) { const b = iconBtn('download', () => doUpdate(m, row), { cls: 'btn-accent', label: 'Update' }); act.appendChild(b); }
  const del = mkBtn('Remove', async () => {
    if (await confirmDialog({ title: 'Remove ' + (folder === 'plugins' ? 'plugin' : 'mod'), body: m.filename, danger: true })) {
      await api('DELETE', `/api/servers/${state.selected}/file?path=${encodeURIComponent(folder + '/' + m.filename)}`).catch((e) => toast(e.message, true));
      loadInstalled();
    }
  }); del.className = 'btn btn-bad'; act.appendChild(del);
  const msg = document.createElement('span'); msg.className = 'mod-msg'; act.appendChild(msg);
  return row;
}
async function doUpdate(m, row) {
  const msg = row ? row.querySelector('.mod-msg') : null;
  if (msg) msg.textContent = 'updating…';
  try {
    const r = await api('POST', `/api/servers/${state.selected}/mods/update`, { slug: m.slug, filename: m.filename, projectType: m.projectType || 'mod' });
    if (msg) msg.textContent = 'updated → ' + r.file;
    toast('updated ' + (m.title || m.slug) + ' → ' + r.file);
    if (row) loadInstalled();
  } catch (e) { if (msg) msg.textContent = 'failed: ' + e.message; else toast(e.message, true); }
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
  const iconHtml = h.iconUrl ? `<img class="mod-icon" src="${esc(h.iconUrl)}" alt="" loading="lazy" />` : '<div class="mod-icon"></div>';
  card.innerHTML = `${iconHtml}
    <div class="mod-main">
      <div class="mod-title">${esc(h.title)} <span class="by">by ${esc(h.author || '?')}</span> <span class="mod-dl">${icon('download', 'ic-sm')} ${(h.downloads || 0).toLocaleString()}</span></div>
      <div class="mod-desc">${esc(h.description || '')}</div>
      <div class="mod-card-actions"><button class="btn mod-details">Details ${icon('chevronDown', 'ic-sm')}</button><button class="btn btn-accent mod-quick">${icon('download')} Install latest</button><span class="mod-msg"></span></div>
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
    const [proj, vers] = await Promise.all([
      api('GET', `/api/modrinth/project/${encodeURIComponent(h.slug)}`),
      api('GET', `/api/modrinth/project/${encodeURIComponent(h.slug)}/versions?` + new URLSearchParams({ type: selectedModType(), gameVersion: gv }).toString()),
    ]);
    exp.dataset.loaded = '1';
    const body = (proj.body || proj.description || '').slice(0, 8000);
    const opts = (vers.versions || []).map((v) => `<option value="${esc(v.id)}">${esc(v.versionNumber)} · MC ${esc((v.gameVersions || []).slice(-3).join(','))} · ${esc((v.loaders || []).join(','))}</option>`).join('');
    exp.innerHTML = `<div class="mod-body md">${mdToHtml(body)}</div>
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
    const r = await api('POST', `/api/servers/${state.selected}/modrinth/install`, { slug: h.slug, versionId, projectType: selectedModType() });
    msgEl.textContent = `installed ${r.file} → ${r.dir}/`;
    toast('installed ' + r.file);
    loadInstalled();
  } catch (e) { msgEl.textContent = 'failed: ' + e.message; }
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
  $('#btnFabricApi').style.display = (s.type === 'paper') ? 'none' : ''; // Fabric API is Fabric-only
  $('#jarDownloadPanel').classList.add('hidden');
  $('#setStatus').textContent = '';
  updatePreview();
  loadJars(s.id, s.jar); // auto-detect jars in the working dir and fill the selector
  const dir = `${state.info ? state.info.serversDir : ''}/${s.id}`;
  const net = state.net || {};
  const rows = [['id', s.id], ['Minecraft', s.mcVersion], ['Fabric loader', s.loader || '–'],
    ['installer', s.installer || '–'], ['directory', dir], ['created', s.createdAt || '–'],
    ['connect (Tailscale)', net.tailscaleIp ? `${net.tailscaleIp}:${s.port}` : '–'],
    ['connect (Public)', net.publicIp ? `${net.publicIp}:${s.port}` : '–']];
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
      o.value = activeJar; o.textContent = activeJar + ' (not found on disk)';
      sel.appendChild(o);
    }
    for (const j of jars) {
      const o = document.createElement('option');
      o.value = j.name;
      o.textContent = `${j.name}${j.active ? ' (active)' : ''} · ${fmtBytes(j.size)}`;
      sel.appendChild(o);
    }
    sel.value = activeJar || (jars[0] && jars[0].name) || '';
    updatePreview();
  } catch (e) { /* keep the fallback option */ }
}
async function populateJarVersions() {
  try {
    const type = $('#jarType').value;
    let games;
    if (type === 'paper') {
      if (!paperVersionsCache) paperVersionsCache = (await api('GET', '/api/paper/versions')).versions;
      games = paperVersionsCache;
    } else {
      if (!fabricMeta) fabricMeta = await api('GET', '/api/fabric/meta');
      games = fabricMeta.games;
    }
    const stableOnly = $('#jarStableOnly').checked;
    const sel = $('#jarMcVersion'); sel.innerHTML = '';
    for (const v of games) {
      if (stableOnly && !v.stable) continue;
      const o = document.createElement('option'); o.value = v.version; o.textContent = v.version + (v.stable ? '' : ' (unstable)');
      sel.appendChild(o);
    }
  } catch (e) { $('#jarDlStatus').textContent = 'failed to load versions: ' + e.message; }
}
$('#jarType').onchange = populateJarVersions;
$('#btnDetectJars').onclick = () => {
  const srv = state.servers.find((s) => s.id === state.selected);
  if (srv) { loadJars(srv.id, srv.jar); $('#jarStatus').textContent = 're-detected'; }
};
$('#btnDownloadJar').onclick = async () => {
  const p = $('#jarDownloadPanel'); p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) { $('#jarType').value = currentServer().type || 'fabric'; await populateJarVersions(); }
};
$('#jarStableOnly').onchange = populateJarVersions;
$('#btnDoDownloadJar').onclick = async () => {
  const mcVersion = $('#jarMcVersion').value; const type = $('#jarType').value; if (!mcVersion) return;
  $('#jarDlStatus').textContent = `downloading ${type === 'paper' ? 'Paper' : 'Fabric'} server jar…`;
  try {
    const r = await api('POST', `/api/servers/${state.selected}/jars/download`, { type, mcVersion });
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
    $('#jarStatus').textContent = 'Fabric API: ' + r.file;
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
  const srv = currentServer();
  if ($('#mSrvName')) $('#mSrvName').textContent = srv.id || '';
  if ($('#mSrvState')) $('#mSrvState').textContent = running ? '· running' : '· stopped';
  setGauge('mSrvCpu', srvCpu + '%', 'mSrvCpuFill', srvCpu);
  setGauge('mSrvRam', running ? `${(srvRamBytes / 1073741824).toFixed(1)} GB · ${srvRamPct}%` : '–', 'mSrvRamFill', srvRamPct);
  pushMetric(state.metrics.srvCpu, srvCpu); pushMetric(state.metrics.srvRam, srvRamPct);
  const diskTotal = (host && host.diskTotalBytes) || (state.info && state.info.diskTotalBytes) || 1;
  if (st && st.diskBytes != null) {
    const pct = Math.round((st.diskBytes / diskTotal) * 100);
    setGauge('mSrvDisk', `${(st.diskBytes / 1073741824).toFixed(1)} GB`, 'mSrvDiskFill', pct);
    if ($('#mSrvDiskSub')) $('#mSrvDiskSub').textContent = `${pct}% of disk`;
  }
  if (host) renderHostMetrics(host); // host metrics live in the sidebar now
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
let nsWorldFile = null;
async function openNewServer() {
  $('#newServerModal').classList.remove('hidden');
  $('#nsStatus').textContent = ''; $('#nsName').value = ''; $('#nsMemory').value = '4G';
  $('#nsType').value = 'fabric'; $('#nsFabricApiRow').style.display = '';
  $('#nsVersion').innerHTML = '<option>loading…</option>';
  nsWorldFile = null; $('#nsWorldName').textContent = '';
  $('#nsWorldDrop').innerHTML = worldDropHTML();
  $('#nsWorldBar').classList.add('hidden'); $('#nsWorldFill').style.width = '0%';
  try {
    fabricMeta = await api('GET', '/api/fabric/meta');
    $('#nsMeta').textContent = `loader ${fabricMeta.latestLoader} · installer ${fabricMeta.latestInstaller}`;
    fillVersions();
  } catch (e) { $('#nsStatus').textContent = 'failed to load versions: ' + e.message; }
}
// world.zip drag-and-drop
function setWorldFile(f) {
  if (!f) return;
  if (!/\.zip$/i.test(f.name)) return toast('please choose a .zip file', true);
  nsWorldFile = f;
  $('#nsWorldName').textContent = `${f.name} · ${fmtBytes(f.size)}`;
  $('#nsWorldDrop').innerHTML = icon('check') + ' world selected — drop another to replace';
}
$('#nsWorldDrop').onclick = () => $('#nsWorldInput').click();
$('#nsWorldInput').onchange = (e) => setWorldFile(e.target.files[0]);
['dragenter', 'dragover'].forEach((ev) => $('#nsWorldDrop').addEventListener(ev, (e) => { e.preventDefault(); $('#nsWorldDrop').classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => $('#nsWorldDrop').addEventListener(ev, (e) => { e.preventDefault(); $('#nsWorldDrop').classList.remove('drag'); }));
$('#nsWorldDrop').addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) setWorldFile(e.dataTransfer.files[0]); });
function uploadWorld(id, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/servers/${id}/import-world`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let d = {}; try { d = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && d.ok) resolve(d);
      else reject(new Error(d.error || ('HTTP ' + xhr.status)));
    };
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(file);
  });
}
let paperVersionsCache = null;
async function fillVersions() {
  const type = $('#nsType').value;
  $('#nsFabricApiRow').style.display = type === 'paper' ? 'none' : '';
  const sel = $('#nsVersion');
  let games;
  if (type === 'paper') {
    if (!paperVersionsCache) { sel.innerHTML = '<option>loading…</option>'; try { paperVersionsCache = (await api('GET', '/api/paper/versions')).versions; } catch (e) { sel.innerHTML = ''; $('#nsStatus').textContent = 'failed to load Paper versions: ' + e.message; return; } }
    games = paperVersionsCache;
  } else {
    if (!fabricMeta) return;
    games = fabricMeta.games;
  }
  const stableOnly = $('#nsStableOnly').checked;
  sel.innerHTML = '';
  for (const v of games) {
    if (stableOnly && !v.stable) continue;
    const o = document.createElement('option'); o.value = v.version; o.textContent = v.version + (v.stable ? '' : ' (unstable)');
    sel.appendChild(o);
  }
}
$('#nsStableOnly').onchange = fillVersions;
$('#nsType').onchange = fillVersions;
$('#nsCancel').onclick = () => $('#newServerModal').classList.add('hidden');
$('#nsCreate').onclick = async () => {
  const name = $('#nsName').value.trim(); const mcVersion = $('#nsVersion').value; const memory = $('#nsMemory').value.trim() || '4G';
  const type = $('#nsType').value;
  if (!name) return toast('name required', true);
  $('#nsCreate').disabled = true; $('#nsStatus').textContent = `creating (downloading ${type === 'paper' ? 'Paper' : 'Fabric'} server jar)…`;
  try {
    const { server } = await api('POST', '/api/servers', { name, mcVersion, memory, type });
    if (type === 'fabric' && $('#nsFabricApi').checked) {
      $('#nsStatus').textContent = 'installing Fabric API…';
      try { await api('POST', `/api/servers/${server.id}/jars/fabric-api`, { mcVersion }); } catch (e) { toast('created, but Fabric API failed: ' + e.message, true); }
    }
    if (nsWorldFile) {
      $('#nsWorldBar').classList.remove('hidden');
      $('#nsStatus').textContent = 'uploading world…';
      try {
        await uploadWorld(server.id, nsWorldFile, (pct) => {
          $('#nsWorldFill').style.width = pct + '%';
          $('#nsStatus').textContent = pct < 100 ? `uploading world… ${pct}%` : 'extracting & configuring world…';
        });
        toast('world imported into ' + server.id);
      } catch (e) { toast('created, but world import failed: ' + e.message, true); }
    }
    $('#newServerModal').classList.add('hidden');
    await refreshServers(); location.hash = '#/' + server.id; route(); toast('created ' + server.id);
  } catch (e) { $('#nsStatus').textContent = 'error: ' + e.message; }
  finally { $('#nsCreate').disabled = false; }
};

// ---- Players (GUI playerdata + inventory editor) ---------------------------
const COMMON_ITEMS = ['minecraft:diamond', 'minecraft:diamond_block', 'minecraft:netherite_ingot', 'minecraft:netherite_block', 'minecraft:emerald', 'minecraft:gold_ingot', 'minecraft:iron_ingot', 'minecraft:copper_ingot', 'minecraft:coal', 'minecraft:redstone', 'minecraft:lapis_lazuli', 'minecraft:diamond_sword', 'minecraft:netherite_sword', 'minecraft:diamond_pickaxe', 'minecraft:netherite_pickaxe', 'minecraft:diamond_axe', 'minecraft:diamond_shovel', 'minecraft:diamond_hoe', 'minecraft:elytra', 'minecraft:diamond_helmet', 'minecraft:diamond_chestplate', 'minecraft:diamond_leggings', 'minecraft:diamond_boots', 'minecraft:netherite_helmet', 'minecraft:netherite_chestplate', 'minecraft:netherite_leggings', 'minecraft:netherite_boots', 'minecraft:shield', 'minecraft:bow', 'minecraft:crossbow', 'minecraft:trident', 'minecraft:arrow', 'minecraft:totem_of_undying', 'minecraft:golden_apple', 'minecraft:enchanted_golden_apple', 'minecraft:ender_pearl', 'minecraft:experience_bottle', 'minecraft:tnt', 'minecraft:obsidian', 'minecraft:cobblestone', 'minecraft:stone', 'minecraft:dirt', 'minecraft:oak_log', 'minecraft:oak_planks', 'minecraft:torch', 'minecraft:crafting_table', 'minecraft:furnace', 'minecraft:chest', 'minecraft:shulker_box', 'minecraft:ender_chest', 'minecraft:bread', 'minecraft:cooked_beef', 'minecraft:water_bucket', 'minecraft:lava_bucket', 'minecraft:bucket', 'minecraft:flint_and_steel', 'minecraft:bookshelf', 'minecraft:enchanting_table', 'minecraft:anvil', 'minecraft:nether_star', 'minecraft:beacon', 'minecraft:dragon_egg', 'minecraft:netherite_upgrade_smithing_template'];
let playersAll = [], pState = null, slotCtx = null;
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function intv(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

function loadPlayers() {
  if (!state.selected) return;
  const dl = $('#itemList'); if (dl && !dl.childElementCount) dl.innerHTML = COMMON_ITEMS.map((i) => `<option value="${i}">`).join('');
  const running = currentServer().status && currentServer().status.running;
  $('#playersBanner').classList.toggle('hidden', !running);
  if (running) $('#playersBanner').textContent = 'The server is running — whitelist/bans below apply live, but the inventory & stats editor is disabled (stop the server to edit player data).';
  loadAccess();
  api('GET', `/api/servers/${state.selected}/players`).then(({ players }) => { playersAll = players; renderPlayerList(); if (accessState) renderAccess(accessState); }).catch((e) => toast(e.message, true));
  api('GET', `/api/servers/${state.selected}/player-ips`).then(({ byName }) => { playerIpMap = byName || {}; renderPlayerList(); }).catch(() => {});
}
// --- access control (whitelist / bans) ---
function loadAccess() {
  if (!state.selected) return;
  api('GET', `/api/servers/${state.selected}/access`).then(renderAccess).catch(() => {});
}
let accessState = null;
function renderAccess(l) {
  accessState = l;
  const entry = (label, attrs, reason) => `<div class="access-entry"><span class="ae-name">${esc(label)}</span>${reason ? `<span class="ae-reason">${esc(reason)}</span>` : ''}<button class="btn btn-bad" ${attrs} title="remove">${icon('x', 'ic-sm')}</button></div>`;
  const wl = l.whitelist.length ? l.whitelist.map((e) => entry(e.name || e.uuid, `data-act="whitelist_remove" data-name="${esc(e.name || '')}"`)).join('') : '<div class="access-empty">empty</div>';
  const bans = l.banned.length ? l.banned.map((e) => entry(e.name || e.uuid, `data-act="pardon" data-name="${esc(e.name || '')}"`, e.reason)).join('') : '<div class="access-empty">none</div>';
  const ips = l.bannedIps.length ? l.bannedIps.map((e) => entry(e.ip, `data-act="pardon_ip" data-ip="${esc(e.ip)}"`, e.reason)).join('') : '<div class="access-empty">none</div>';
  // Quick-add: past players (resolved names) who aren't already whitelisted.
  const wlNames = new Set(l.whitelist.map((e) => (e.name || '').toLowerCase()).filter(Boolean));
  const candidates = (playersAll || []).filter((p) => p.name && !wlNames.has(p.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const quickAdd = candidates.length
    ? `<div class="access-add"><select class="acc-sel" title="past players">${candidates.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('')}</select><button class="btn btn-accent" data-act="whitelist_add_sel" title="add selected player to whitelist">${icon('plus')} Add</button></div>`
    : '';
  $('#accessPanel').innerHTML = `
    <div class="access-card"><h4>Whitelist <span class="toggle-pill ${l.whitelistEnabled ? 'on' : 'off'}" data-act="${l.whitelistEnabled ? 'whitelist_off' : 'whitelist_on'}">${l.whitelistEnabled ? 'enabled' : 'disabled'}</span></h4>
      ${quickAdd}
      <div class="access-add"><input class="acc-in" placeholder="or type a player name" /><button class="btn btn-accent" data-act="whitelist_add">${icon('plus')}</button></div>
      <div class="access-entries">${wl}</div></div>
    <div class="access-card"><h4>Banned players</h4>
      <div class="access-add"><input class="acc-in" placeholder="player name" /><button class="btn btn-bad" data-act="ban">Ban</button></div>
      <div class="access-entries">${bans}</div></div>
    <div class="access-card"><h4>Banned IPs</h4>
      <div class="access-add"><input class="acc-in" placeholder="1.2.3.4" /><button class="btn btn-bad" data-act="ban_ip">Ban IP</button></div>
      <div class="access-entries">${ips}</div></div>`;
}
async function accessAction(action, params) {
  try { renderAccess(await api('POST', `/api/servers/${state.selected}/access`, { action, ...params })); }
  catch (e) { toast(e.message, true); }
}
function accessAdd(btn) {
  const inp = btn.closest('.access-card').querySelector('.acc-in');
  const val = inp.value.trim(); if (!val) return; inp.value = '';
  accessAction(btn.dataset.act, btn.dataset.act === 'ban_ip' ? { ip: val } : { name: val });
}
$('#accessPanel').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'whitelist_add_sel') {
    const sel = btn.closest('.access-add').querySelector('.acc-sel');
    if (sel && sel.value) accessAction('whitelist_add', { name: sel.value });
  } else if (btn.dataset.name !== undefined) accessAction(act, { name: btn.dataset.name });
  else if (btn.dataset.ip !== undefined) accessAction(act, { ip: btn.dataset.ip });
  else if (act === 'whitelist_on' || act === 'whitelist_off') accessAction(act, {});
  else accessAdd(btn);
});
$('#accessPanel').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.classList.contains('acc-in')) return;
  const btn = e.target.closest('.access-add').querySelector('[data-act]'); if (btn) accessAdd(btn);
});
let playerIpMap = {}; // lowerName -> { name, ips: [{ip, count}] }
let playerSort = 'name';
function ipsFor(p) { const r = playerIpMap[(p.name || '').toLowerCase()]; return r ? r.ips : []; }
function playerItem(p) {
  const b = document.createElement('button');
  b.className = 'player-item' + (pState && pState.uuid === p.uuid ? ' active' : '');
  const ips = ipsFor(p);
  const ipLine = ips.length ? `<div class="pi-ips" title="IPs this player has logged in from">${ips.map((x) => esc(x.ip)).join(' · ')}</div>` : '';
  b.innerHTML = `<div class="pi-name">${esc(p.name || '(unknown)')}</div><div class="uuid">${esc(p.uuid)}</div>${ipLine}`;
  b.onclick = () => selectPlayer(p.uuid);
  return b;
}
function renderPlayerList() {
  const q = ($('#playerSearch').value || '').toLowerCase();
  const list = $('#playersList'); list.innerHTML = '';
  const match = (p) => !q || (p.name || '').toLowerCase().includes(q) || p.uuid.includes(q);
  if (playerSort === 'ip') return renderPlayerListByIp(q, match, list);
  for (const p of playersAll) { if (match(p)) list.appendChild(playerItem(p)); }
  if (!list.childElementCount) list.innerHTML = '<div class="muted" style="padding:8px">No players found.</div>';
}
function renderPlayerListByIp(q, match, list) {
  const groups = {}; const noIp = [];
  for (const p of playersAll) {
    if (!match(p)) continue;
    const ips = ipsFor(p);
    if (!ips.length) { noIp.push(p); continue; }
    for (const { ip } of ips) (groups[ip] = groups[ip] || []).push(p);
  }
  // Most-shared IPs first — shared addresses (likely alts) surface at the top.
  const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [ip, ps] of entries) {
    const head = document.createElement('div');
    head.className = 'ip-group-head' + (ps.length > 1 ? ' shared' : '');
    head.innerHTML = `<span class="ip-addr">${esc(ip)}</span><span class="ip-count">${ps.length} account${ps.length > 1 ? 's' : ''}</span>`;
    list.appendChild(head);
    ps.forEach((p) => list.appendChild(playerItem(p)));
  }
  if (noIp.length) {
    const head = document.createElement('div'); head.className = 'ip-group-head';
    head.innerHTML = `<span class="ip-addr muted">no logged IP</span><span class="ip-count">${noIp.length}</span>`;
    list.appendChild(head);
    noIp.forEach((p) => list.appendChild(playerItem(p)));
  }
  if (!list.childElementCount) list.innerHTML = '<div class="muted" style="padding:8px">No players found.</div>';
}
$('#playerSearch').addEventListener('input', renderPlayerList);
$('#playerSort').addEventListener('change', (e) => { playerSort = e.target.value; renderPlayerList(); });
async function selectPlayer(uuid) {
  try {
    const d = await api('GET', `/api/servers/${state.selected}/players/${uuid}`);
    pState = { uuid: d.uuid, name: d.name, health: d.health, foodLevel: d.foodLevel, xpLevel: d.xpLevel, gamemode: d.gamemode, dimension: d.dimension, pos: d.pos.slice(), inv: {}, ender: {} };
    d.inventory.forEach((it) => { pState.inv[it.slot] = { id: it.id, count: it.count, contents: it.contents }; });
    d.enderItems.forEach((it) => { pState.ender[it.slot] = { id: it.id, count: it.count, contents: it.contents }; });
    renderEditor(); renderPlayerList();
  } catch (e) { toast(e.message, true); }
}
// Item icons: primary source is minecraftitems.xyz, which renders proper icons for items AND
// 3D blocks AND block-entities (chests, skulls, etc.). Fall back through the raw Minecraft asset
// textures (item → block → block face) for anything it doesn't cover, then to the item-id text.
const ICON_API = 'https://api.minecraftitems.xyz/api/item';
const TEX_BASE = 'https://assets.mcasset.cloud/1.21.4/assets/minecraft/textures';
function texName(id) { return id.replace(/^minecraft:/, '').replace(/[^a-z0-9_]/gi, ''); }
function iconUrls(id) {
  const n = texName(id);
  if (!n) return [];
  return [
    `${ICON_API}/${n}/size=4`,
    `${TEX_BASE}/item/${n}.png`,
    `${TEX_BASE}/block/${n}.png`,
    `${TEX_BASE}/block/${n}_front.png`,
    `${TEX_BASE}/block/${n}_top.png`,
  ];
}
function slotCell(kind, slot, map) {
  const it = map[slot];
  const filled = it && it.id;
  const special = slot < 0 || slot >= 100;
  if (!filled) return `<div class="slot${special ? ' special' : ''}" data-kind="${kind}" data-slot="${slot}" title="slot ${slot} — empty"></div>`;
  const short = it.id.replace(/^minecraft:/, '');
  const urls = iconUrls(it.id);
  const img = urls.length ? `<img class="slot-img" src="${urls[0]}" data-fallbacks="${esc(urls.slice(1).join('|'))}" alt="">` : '';
  const hasContents = Array.isArray(it.contents);
  const badge = hasContents ? `<span class="slot-box" title="contains items — click to view">${icon('package', 'ic-sm')}</span>` : '';
  return `<div class="slot filled${special ? ' special' : ''}${hasContents ? ' has-contents' : ''}" data-kind="${kind}" data-slot="${slot}" title="${esc(it.id + ' ×' + it.count + (hasContents ? ' — click to view contents' : ''))}">${img}<span class="slot-id"${img ? ' style="display:none"' : ''}>${esc(short)}</span><span class="slot-count">${it.count > 1 ? it.count : ''}</span>${badge}</div>`;
}
// Walk the fallback chain on load error; raw textures get pixelated upscaling, the rendered API
// images stay smooth. When the chain is exhausted, drop the img and show the item-id text.
function wireSlotImages(root) {
  root.querySelectorAll('img.slot-img').forEach((img) => {
    img.addEventListener('error', () => {
      const fbs = (img.dataset.fallbacks || '').split('|').filter(Boolean);
      if (fbs.length) {
        img.dataset.fallbacks = fbs.slice(1).join('|');
        img.style.imageRendering = fbs[0].includes('assets.mcasset') ? 'pixelated' : 'auto';
        img.src = fbs[0];
        return;
      }
      const lbl = img.parentElement && img.parentElement.querySelector('.slot-id');
      if (lbl) lbl.style.display = '';
      img.remove();
    });
  });
}
function renderEditor() {
  if (!pState) return;
  const p = pState;
  const gm = ['Survival', 'Creative', 'Adventure', 'Spectator'];
  const dims = ['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end'];
  const dimOpts = dims.map((dd) => `<option ${dd === p.dimension ? 'selected' : ''}>${dd}</option>`).join('') + (dims.includes(p.dimension) ? '' : `<option selected>${esc(p.dimension)}</option>`);
  $('#playerEdit').innerHTML = `
    <div class="pe-head"><b>${esc(p.name || '(unknown)')}</b> <span class="muted mono">${esc(p.uuid)}</span></div>
    <div class="pe-stats">
      <label>Game mode <select id="peGm">${gm.map((g, i) => `<option value="${i}" ${i === p.gamemode ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>Health <input id="peHealth" value="${p.health}"></label>
      <label>Food <input id="peFood" value="${p.foodLevel}"></label>
      <label>XP level <input id="peXp" value="${p.xpLevel}"></label>
      <label>Dimension <select id="peDim">${dimOpts}</select></label>
      <label>X <input id="peX" value="${p.pos[0]}"></label>
      <label>Y <input id="peY" value="${p.pos[1]}"></label>
      <label>Z <input id="peZ" value="${p.pos[2]}"></label>
    </div>
    <div class="inv-section"><h4>Armor &amp; offhand <span class="muted">(helmet · chest · legs · boots · offhand)</span></h4>
      <div class="inv-grid armor">${[103, 102, 101, 100, -106].map((s) => slotCell('inv', s, p.inv)).join('')}</div></div>
    <div class="inv-section"><h4>Inventory</h4>
      <div class="inv-grid">${range(9, 35).map((s) => slotCell('inv', s, p.inv)).join('')}</div>
      <div class="inv-grid inv-hotbar">${range(0, 8).map((s) => slotCell('inv', s, p.inv)).join('')}</div></div>
    <div class="inv-section"><h4>Ender chest</h4>
      <div class="inv-grid">${range(0, 26).map((s) => slotCell('ender', s, p.ender)).join('')}</div></div>
    <button id="peSave" class="btn btn-accent">${icon('check')} Save player</button>
    <span id="peSaveMsg" class="muted" style="margin-left:8px"></span>`;
  wireSlotImages($('#playerEdit'));
}
$('#playerEdit').addEventListener('click', (e) => {
  const slotEl = e.target.closest('.slot');
  if (slotEl) return openSlotEditor(slotEl.dataset.kind, parseInt(slotEl.dataset.slot, 10));
  if (e.target.closest('#peSave')) savePlayer();
});
// Read-only 27-slot grid of a container's contents (shulker boxes, etc.), using the item view.
function shulkerGrid(contents) {
  const map = {}; (contents || []).forEach((c) => { map[c.slot] = { id: c.id, count: c.count }; });
  return `<div class="inv-grid">${range(0, 26).map((s) => slotCell('view', s, map)).join('')}</div>`;
}
function openSlotEditor(kind, slot) {
  slotCtx = { kind, slot };
  const it = pState[kind][slot] || {};
  $('#slotTitle').textContent = `${kind === 'ender' ? 'Ender' : 'Inventory'} slot ${slot}`;
  $('#slotId').value = it.id || ''; $('#slotCount').value = it.count || 1;
  const sc = $('#slotContents');
  if (Array.isArray(it.contents)) {
    const n = it.contents.length;
    sc.classList.remove('hidden');
    sc.innerHTML = `<div class="slot-contents-head">${icon('package', 'ic-sm')} Contents · ${n} item${n === 1 ? '' : 's'} <span class="muted">(read-only)</span></div>${shulkerGrid(it.contents)}`;
    wireSlotImages(sc);
  } else { sc.classList.add('hidden'); sc.innerHTML = ''; }
  $('#slotModal').classList.remove('hidden'); setTimeout(() => $('#slotId').focus(), 50);
}
$('#slotCancel').onclick = () => $('#slotModal').classList.add('hidden');
$('#slotSet').onclick = () => {
  const id = $('#slotId').value.trim(), c = Math.max(1, parseInt($('#slotCount').value, 10) || 1);
  const prev = pState[slotCtx.kind][slotCtx.slot];
  if (id) {
    const keep = prev && prev.id === id ? prev.contents : undefined; // keep container contents if item unchanged
    pState[slotCtx.kind][slotCtx.slot] = { id, count: c, ...(keep ? { contents: keep } : {}) };
  } else delete pState[slotCtx.kind][slotCtx.slot];
  $('#slotModal').classList.add('hidden'); renderEditor();
};
$('#slotClear').onclick = () => { delete pState[slotCtx.kind][slotCtx.slot]; $('#slotModal').classList.add('hidden'); renderEditor(); };
function mapToArr(map) { return Object.entries(map).map(([slot, it]) => ({ slot: parseInt(slot, 10), id: it.id, count: it.count })); }
async function savePlayer() {
  if (!pState) return;
  const msg = $('#peSaveMsg'); msg.textContent = 'saving…';
  const edits = {
    health: num($('#peHealth').value), foodLevel: intv($('#peFood').value), xpLevel: intv($('#peXp').value),
    gamemode: intv($('#peGm').value), dimension: $('#peDim').value,
    pos: [num($('#peX').value), num($('#peY').value), num($('#peZ').value)],
    inventory: mapToArr(pState.inv), enderItems: mapToArr(pState.ender),
  };
  try {
    await api('PUT', `/api/servers/${state.selected}/players/${pState.uuid}`, edits);
    msg.textContent = 'saved (backup kept as .dat.bak)';
    toast('saved player ' + (pState.name || pState.uuid));
  } catch (e) { msg.textContent = ''; toast(e.message, true); }
}

// ---- AI copilot ------------------------------------------------------------
const aiState = { contents: [], model: '', pending: 0, responses: [], busy: false };
$('#aiLauncher').onclick = () => toggleAi(true);
$('#aiClose').onclick = () => toggleAi(false);
const AI_GREETING = "Hi! I can read your servers/host, change a server's config, send console commands, and run host terminal commands — but I'll always ask you to approve each action first. What do you need?";
// Reflect the currently-selected server as a header pill (the conversation is one continuous
// thread; the focus just shows which server's live state the copilot is looking at).
function updateAiFocus() {
  const el = $('#aiFocus'); if (!el) return;
  el.textContent = state.selected || '';
  el.classList.toggle('hidden', !state.selected);
}
// Greet exactly once per session: the greeting isn't part of the chat history, so gate on the
// thread being empty (not on aiState.contents) — re-opening the drawer or switching servers
// must never re-add it.
function greetCopilot() { if (!$('#aiThread').childElementCount) renderAiMsg('assistant', AI_GREETING); }
function toggleAi(open) {
  $('#aiDrawer').classList.toggle('hidden', !open);
  if (open) { updateAiFocus(); greetCopilot(); setTimeout(() => $('#aiInput').focus(), 50); }
}
$('#aiForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#aiInput').value.trim();
  if (!t || aiState.busy) return;
  if (aiState.pending > 0) { toast('Approve or reject the pending action first.', true); return; }
  $('#aiInput').value = ''; $('#aiInput').style.height = 'auto';
  renderAiMsg('user', t); aiTurn(t);
});
$('#aiInput').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'; });
$('#aiInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#aiForm').requestSubmit(); } });

function aiScroll() { const t = $('#aiThread'); t.scrollTop = t.scrollHeight; }
function renderAiMsg(role, text) {
  const d = document.createElement('div'); d.className = 'ai-msg ' + role;
  // User text stays literal; assistant/error replies render as markdown.
  if (role === 'user') d.textContent = text;
  else { d.classList.add('md'); d.innerHTML = mdToHtml(text); }
  $('#aiThread').appendChild(d); aiScroll(); return d;
}
function setTyping(on) {
  let t = $('#aiTyping');
  if (on && !t) { t = document.createElement('div'); t.id = 'aiTyping'; t.className = 'ai-typing'; t.textContent = 'thinking…'; $('#aiThread').appendChild(t); aiScroll(); }
  else if (!on && t) t.remove();
}
async function aiTurn(userText) {
  if (userText) aiState.contents.push({ role: 'user', content: userText });
  aiState.busy = true; setTyping(true);
  try {
    const r = await api('POST', '/api/ai/chat', { contents: aiState.contents, serverId: state.selected });
    aiState.contents.push(r.message); // assistant message (with any tool_calls), echoed back next turn
    if (r.text) renderAiMsg('assistant', r.text);
    const calls = r.toolCalls || [];
    if (calls.length) { aiState.pending = calls.length; calls.forEach(renderActionCard); }
    else if (!r.text) renderAiMsg('assistant', '(no response — try rephrasing)');
  } catch (e) { renderAiMsg('error', e.message); }
  finally { aiState.busy = false; setTyping(false); }
}
function renderActionCard(fc) {
  const a = fc.args || {};
  const kind = fc.name === 'terminal_command' ? 'terminal' : (fc.name === 'console_command' || fc.name === 'read_console') ? 'console' : 'config';
  const labels = {
    set_server_config: icon('gear') + ' modify config', console_command: icon('terminal') + ' console command', terminal_command: icon('alert') + ' host terminal command',
    server_lifecycle: icon('gear') + ' server: ' + esc(a.action || 'lifecycle'), create_backup: icon('archive') + ' create backup', install_mod: icon('package') + ' install mod',
    read_console: icon('terminal') + ' read console',
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
  } else if (fc.name === 'read_console') {
    body = `<pre>read console of ${esc(a.serverId)}${a.lines ? ' (' + esc(String(a.lines)) + ' lines)' : ''}</pre>`;
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
      const summary = r.output || r.console || r.recentConsole || (r.file ? `installed ${r.file} → ${r.dir}/` : '')
        || (r.action ? `${r.action} done (running=${r.running})` : '') || (r.startedBackup ? `backup started: ${r.startedBackup}` : '') || r.note || 'done';
      result.textContent = summary;
      resolveAction(fc, r);
    } catch (e) {
      result.className = 'ai-result bad'; result.textContent = e.message;
      resolveAction(fc, { ok: false, error: e.message });
    }
    refreshServers();
  };
  reject.onclick = () => {
    approve.disabled = reject.disabled = true; result.className = 'ai-result bad'; result.textContent = 'rejected';
    resolveAction(fc, { rejected: true, note: 'user rejected this action' });
  };
  $('#aiThread').appendChild(card); aiScroll();
}
function resolveAction(fc, response) {
  // Each tool_call needs a matching tool message (by id) before the next assistant turn.
  aiState.contents.push({ role: 'tool', tool_call_id: fc.id, content: JSON.stringify(response) });
  aiState.pending -= 1;
  if (aiState.pending <= 0) aiTurn(); // agent reacts to results / proposes next steps (still approval-gated)
}

// ---- boot ------------------------------------------------------------------
(async function boot() {
  iconifyStatic(); // replace static button labels with SVG icons
  try { state.info = await api('GET', '/api/info'); renderHostInfo(); } catch {}
  try { renderNetwork(await api('GET', '/api/network')); } catch {}
  try {
    const c = await api('GET', '/api/ai/config');
    if (c.configured) { aiState.model = c.model; $('#aiModel').textContent = c.model; }
    else $('#aiLauncher').style.display = 'none';
  } catch { $('#aiLauncher').style.display = 'none'; }
  await refreshServers();
  route(); // restore selected server/tab from the URL hash (deep-link / refresh)
  setInterval(refreshServers, 5000);
  // auto-refresh the file list while the Files tab is open (skips re-render if unchanged)
  setInterval(() => {
    if (state.selected && !filesUploading && $('#tab-files').classList.contains('active')) loadFiles(state.cwd, { auto: true });
  }, 5000);
})();
function renderHostInfo() {
  const i = state.info; if (!i) return;
  $('#hostInfo').innerHTML = `${i.cpus} cores · zstd ${i.compression.zstd ? 'on' : 'off'} · pv ${i.compression.pv ? 'on' : 'off'}`;
}
