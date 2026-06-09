'use strict';
// shaurycontroller — lightweight web panel for Fabric Minecraft servers.
// Express REST API + a WebSocket per server for live console / status / backup progress.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const { WebSocketServer } = require('ws');

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB, streamed (not buffered)

const cfg = require('./config');
const mc = require('./mc');
const files = require('./files');
const backup = require('./backup');
const fabric = require('./fabric');
const ai = require('./ai');
const playerdata = require('./playerdata');
const access = require('./access');
const paper = require('./paper');

cfg.ensureDirs();
mc.reattachAll();        // resume tailing any servers already running from before a panel restart
backup.reenablePending(); // re-enable autosave if a backup was interrupted by a crash/restart

// On shutdown, make sure no running server is left with autosave disabled.
function shutdown() { try { backup.reenablePending(); } catch {} process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const PORT = parseInt(process.env.PANEL_PORT || '8095', 10);
const HOST = process.env.PANEL_HOST || '0.0.0.0';

const app = express();
app.use(express.json({ limit: '8mb' }));

const asyncH = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  res.status(e.status || 500).json({ error: String(e.message || e) });
});

function requireServer(req, res) {
  const s = cfg.getServer(req.params.id);
  if (!s) { res.status(404).json({ error: 'no such server: ' + req.params.id }); return null; }
  return s;
}

// ---------------------------------------------------------------------------
// Host / meta info
// ---------------------------------------------------------------------------
app.get('/api/info', asyncH(async (req, res) => {
  res.json({
    base: cfg.BASE_DIR,
    serversDir: cfg.SERVERS_DIR,
    backupsDir: cfg.BACKUPS_DIR,
    java: cfg.JAVA_DEFAULT,
    compression: { zstd: backup.HAS_ZSTD, pv: backup.HAS_PV },
    totalMemBytes: os.totalmem(),
    freeMemBytes: os.freemem(),
    cpus: os.cpus().length,
    diskTotalBytes: mc.getHostMetrics().diskTotalBytes,
    diskUsedBytes: mc.getHostMetrics().diskUsedBytes,
  });
}));

app.get('/api/fabric/meta', asyncH(async (req, res) => {
  res.json(await fabric.metaInfo());
}));

app.get('/api/paper/versions', asyncH(async (req, res) => {
  res.json({ versions: await paper.versions() });
}));

// ---------------------------------------------------------------------------
// Server list & lifecycle
// ---------------------------------------------------------------------------
app.get('/api/servers', asyncH(async (req, res) => {
  const list = cfg.load().servers.map((s) => ({
    ...s,
    status: mc.status(s.id),
    backup: backup.jobStatus(s.id),
  }));
  res.json({ servers: list, host: mc.getHostMetrics() });
}));

app.get('/api/servers/:id', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json({ ...s, status: mc.status(s.id), backup: backup.jobStatus(s.id), launchPreview: mc.launchPreview(s) });
}));

// Edit an existing server's config (port / memory / jvm flags / java / jar).
app.put('/api/servers/:id/config', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const patch = req.body || {};
  const updated = cfg.updateServer(s.id, patch);
  // Keep server.properties in sync so the new port actually takes effect on next start.
  if (patch.port !== undefined) cfg.setServerProperty(s.id, 'server-port', updated.port);
  res.json({ ok: true, server: updated, launchPreview: mc.launchPreview(updated), running: mc.isRunning(s.id) });
}));

app.get('/api/host', asyncH(async (req, res) => {
  res.json(mc.getHostMetrics());
}));

app.get('/api/java', asyncH(async (req, res) => {
  res.json({ javas: mc.detectJavas(req.query.refresh === '1') });
}));

app.get('/api/network', asyncH(async (req, res) => {
  res.json(await mc.getNetwork());
}));

// ---- player data editor ----------------------------------------------------
app.get('/api/servers/:id/players', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json(await playerdata.listPlayers(s.id));
}));
app.get('/api/servers/:id/player-ips', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json(await playerdata.playerIps(s.id));
}));
app.get('/api/servers/:id/players/:uuid', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json(await playerdata.readPlayer(s.id, req.params.uuid));
}));
app.put('/api/servers/:id/players/:uuid', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json(await playerdata.writePlayer(s.id, req.params.uuid, req.body || {}));
}));

app.get('/api/servers/:id/access', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json(access.readLists(s.id));
}));
app.post('/api/servers/:id/access', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json(await access.mutate(s.id, req.body || {}));
}));

// ---- Modrinth browser ------------------------------------------------------
app.get('/api/modrinth/search', asyncH(async (req, res) => {
  res.json(await fabric.modrinthSearch({
    query: req.query.q || '', projectType: req.query.type || 'mod',
    gameVersion: req.query.gameVersion || '', offset: parseInt(req.query.offset || '0', 10),
  }));
}));
app.get('/api/modrinth/project/:slug', asyncH(async (req, res) => {
  res.json(await fabric.modrinthProject(req.params.slug));
}));
app.get('/api/modrinth/project/:slug/versions', asyncH(async (req, res) => {
  res.json({ versions: await fabric.modrinthVersions(req.params.slug, { loaders: fabric.loadersForType(req.query.type || 'mod'), gameVersion: req.query.gameVersion }) });
}));
app.post('/api/servers/:id/modrinth/install', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json({ ok: true, ...(await fabric.installFromModrinth(s.id, req.body || {})) });
}));
app.get('/api/servers/:id/mods/installed', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json(await fabric.installedMods(s.id));
}));
app.post('/api/servers/:id/mods/update', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json({ ok: true, ...(await fabric.updateMod(s.id, req.body || {})) });
}));

// ---- AI agent (Gemini, human-in-the-loop) ----------------------------------
app.get('/api/ai/config', asyncH(async (req, res) => {
  res.json({ configured: ai.isConfigured(), model: ai.loadSecrets().model });
}));

// Returns the model's reply + any PROPOSED actions. Never executes anything.
app.post('/api/ai/chat', asyncH(async (req, res) => {
  const { contents, serverId } = req.body || {};
  res.json(await ai.chat({ contents, serverId }));
}));

// Executes a single action the user has APPROVED in the UI.
app.post('/api/ai/execute', asyncH(async (req, res) => {
  const action = req.body && req.body.action;
  if (!action || !action.name) throw Object.assign(new Error('action required'), { status: 400 });
  res.json(await ai.execute(action));
}));

// ---- jar management --------------------------------------------------------
app.get('/api/servers/:id/jars', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json({ jars: await fabric.listJars(s.id), active: s.jar });
}));

app.post('/api/servers/:id/jars/download', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const r = await fabric.downloadServerJar(s.id, req.body || {});
  res.json({ ok: true, ...r, jars: await fabric.listJars(s.id) });
}));

app.post('/api/servers/:id/jars/fabric-api', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const r = await fabric.installFabricApi(s.id, (req.body && req.body.mcVersion) || undefined);
  res.json({ ok: true, ...r });
}));

app.post('/api/servers/:id/jars/prune', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json({ ok: true, ...(await fabric.pruneJars(s.id)), jars: await fabric.listJars(s.id) });
}));

app.post('/api/servers', asyncH(async (req, res) => {
  const server = await fabric.createServer(req.body || {});
  res.json({ ok: true, server });
}));

app.delete('/api/servers/:id', asyncH(async (req, res) => {
  const deleteFiles = req.query.keepFiles !== '1';
  await fabric.deleteServer(req.params.id, { deleteFiles });
  res.json({ ok: true });
}));

// Stream-upload a world .zip and import it as the server's world.
app.post('/api/servers/:id/import-world', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const zipPath = path.join(cfg.serverDir(s.id), '.import-world.zip');
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(zipPath);
    let written = 0, aborted = false;
    const fail = (err) => { if (aborted) return; aborted = true; out.destroy(); fs.rm(zipPath, { force: true }, () => {}); reject(err); };
    req.on('data', (c) => { written += c.length; if (written > MAX_UPLOAD_BYTES) { req.destroy(); fail(Object.assign(new Error('zip too large'), { status: 413 })); } });
    req.on('error', fail); out.on('error', fail);
    out.on('finish', () => { if (!aborted) resolve(); });
    req.pipe(out);
  });
  res.json({ ok: true, ...(await fabric.importWorld(s.id, zipPath)) });
}));

app.post('/api/servers/:id/start', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await mc.start(s); res.json({ ok: true });
}));

app.post('/api/servers/:id/stop', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await mc.stop(s.id); res.json({ ok: true });
}));

app.post('/api/servers/:id/restart', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await mc.restart(s); res.json({ ok: true });
}));

app.post('/api/servers/:id/kill', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await mc.kill(s.id); res.json({ ok: true });
}));

app.post('/api/servers/:id/command', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const command = (req.body && req.body.command) || '';
  if (!command) throw Object.assign(new Error('command required'), { status: 400 });
  mc.sendCommand(s.id, command);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// File manager
// ---------------------------------------------------------------------------
app.get('/api/servers/:id/files', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json(await files.list(s.id, req.query.path || ''));
}));

app.get('/api/servers/:id/configs', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json({ configs: await files.listConfigs(s.id) });
}));

app.get('/api/servers/:id/file', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json({ path: req.query.path, content: await files.readText(s.id, req.query.path) });
}));

app.put('/api/servers/:id/file', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await files.writeText(s.id, req.body.path, req.body.content != null ? req.body.content : '');
  res.json({ ok: true });
}));

app.post('/api/servers/:id/mkdir', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await files.mkdir(s.id, req.body.path);
  res.json({ ok: true });
}));

app.post('/api/servers/:id/rename', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await files.rename(s.id, req.body.from, req.body.to);
  res.json({ ok: true });
}));

app.delete('/api/servers/:id/file', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await files.remove(s.id, req.query.path);
  res.json({ ok: true });
}));

// Streamed upload: POST /upload?path=<dir>&name=<filename>, body = file bytes.
// The body is piped straight to disk (never buffered in memory) with a size cap.
app.post('/api/servers/:id/upload', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const clen = parseInt(req.headers['content-length'] || '0', 10);
  if (clen && clen > MAX_UPLOAD_BYTES) throw Object.assign(new Error('file too large'), { status: 413 });
  const dest = await files.uploadDest(s.id, req.query.path || '', req.query.name);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    let written = 0, aborted = false;
    const fail = (err) => { if (aborted) return; aborted = true; out.destroy(); fs.rm(dest, { force: true }, () => {}); reject(err); };
    req.on('data', (chunk) => {
      written += chunk.length;
      if (written > MAX_UPLOAD_BYTES) { req.destroy(); fail(Object.assign(new Error('file too large'), { status: 413 })); }
    });
    req.on('error', fail);
    out.on('error', fail);
    out.on('finish', () => { if (!aborted) resolve(); });
    req.pipe(out);
  });
  res.json({ ok: true });
}));

app.get('/api/servers/:id/download', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const { abs, name } = files.forDownload(s.id, req.query.path);
  let st;
  try { st = fs.statSync(abs); } catch { throw Object.assign(new Error('not found'), { status: 404 }); }
  if (st.isDirectory()) throw Object.assign(new Error('cannot download a directory'), { status: 400 });
  res.download(abs, name, (err) => { if (err && !res.headersSent) res.status(500).end(); });
}));

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------
app.get('/api/servers/:id/backups', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  res.json({ backups: await backup.listBackups(s.id), job: backup.jobStatus(s.id) });
}));

app.post('/api/servers/:id/backup', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const compress = !(req.body && req.body.compress === false);
  const r = await backup.start(s, { compress });
  res.json({ ok: true, ...r });
}));

app.get('/api/servers/:id/backups/download', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  const p = backup.backupFilePath(s.id, req.query.name);
  res.download(p, path.basename(p));
}));

app.delete('/api/servers/:id/backups', asyncH(async (req, res) => {
  const s = requireServer(req, res); if (!s) return;
  await backup.deleteBackup(s.id, req.query.name);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// WebSocket: /ws?server=<id> — live console + status + backup progress
// ---------------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const id = url.searchParams.get('server');
  if (!id || !cfg.getServer(id)) { ws.close(1008, 'unknown server'); return; }

  const send = (obj) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };

  if (mc.isRunning(id)) mc.ensureTailer(id);
  send({ type: 'backlog', text: mc.consoleBacklog(id) });
  send({ type: 'status', status: mc.status(id), host: mc.getHostMetrics() });
  send({ type: 'backup', ...backup.jobStatus(id) });

  const onConsole = (line) => send({ type: 'console', line });
  const onBackup = (data) => send({ type: 'backup', ...data });
  mc.bus.on('console:' + id, onConsole);
  mc.bus.on('backup:' + id, onBackup);
  const statusTimer = setInterval(() => send({ type: 'status', status: mc.status(id), host: mc.getHostMetrics() }), 2000);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'command' && msg.command) mc.sendCommand(id, msg.command);
    } catch {}
  });
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return; cleaned = true;
    mc.bus.off('console:' + id, onConsole);
    mc.bus.off('backup:' + id, onBackup);
    clearInterval(statusTimer);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

server.listen(PORT, HOST, () => {
  console.log(`[shaurycontroller] panel listening on http://${HOST}:${PORT}`);
});
