'use strict';
// Per-server backups: compressed by default (zstd, gzip fallback), with live progress
// streamed over the event bus. When the server is running, the world is flushed and
// save-off'd first so the archive is consistent, then save-on'd afterwards.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn, execFile, execFileSync } = require('child_process');
const cfg = require('./config');
const mc = require('./mc');

const jobs = new Map(); // id -> { running, file, pct }

function have(cmd) {
  try { execFileSync('command', ['-v', cmd], { shell: '/bin/bash', stdio: 'ignore' }); return true; }
  catch { return false; }
}
const HAS_ZSTD = have('zstd');
const HAS_PV = have('pv');

// Marker written while a server's autosave is disabled for a backup, so a panel
// crash mid-backup can be recovered (autosave re-enabled) on next boot.
function markerPath(id) { return path.join(cfg.RUN_DIR, id + '.savedisabled'); }
function setSaveDisabled(id, on) {
  try { if (on) fs.writeFileSync(markerPath(id), ''); else fs.rmSync(markerPath(id), { force: true }); } catch {}
}
// On boot (or shutdown), re-enable autosave for any running server left marked.
function reenablePending() {
  let names = [];
  try { names = fs.readdirSync(cfg.RUN_DIR); } catch { return; }
  for (const n of names) {
    if (!n.endsWith('.savedisabled')) continue;
    const id = n.slice(0, -'.savedisabled'.length);
    try { if (mc.isRunning(id)) mc.sendCommand(id, 'save-on'); } catch {}
    try { fs.rmSync(path.join(cfg.RUN_DIR, n), { force: true }); } catch {}
  }
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function emit(id, data) {
  const job = jobs.get(id);
  if (job) Object.assign(job, data);
  cfg && mc.bus.emit('backup:' + id, { id, ...data });
}

function duBytes(dir) {
  return new Promise((resolve) => {
    execFile('du', ['-sb', dir], { maxBuffer: 1 << 20 }, (err, stdout) => {
      if (err) return resolve(0);
      resolve(parseInt(String(stdout).split(/\s+/)[0], 10) || 0);
    });
  });
}

function jobStatus(id) {
  const j = jobs.get(id);
  return j ? { running: !!j.running, pct: j.pct || 0, file: j.file || null, phase: j.phase || null } : { running: false };
}

async function listBackups(id) {
  const dir = path.join(cfg.BACKUPS_DIR, id);
  let names = [];
  try { names = await fsp.readdir(dir); } catch { return []; }
  const out = [];
  for (const name of names) {
    try {
      const st = await fsp.stat(path.join(dir, name));
      if (st.isFile()) out.push({ name, path: path.join(dir, name), size: st.size, mtime: st.mtimeMs });
    } catch {}
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

async function deleteBackup(id, name) {
  if (!name || name.includes('/') || name.includes('..')) throw Object.assign(new Error('bad name'), { status: 400 });
  await fsp.rm(path.join(cfg.BACKUPS_DIR, id, name), { force: true });
}

function backupFilePath(id, name) {
  if (!name || name.includes('/') || name.includes('..')) throw Object.assign(new Error('bad name'), { status: 400 });
  return path.join(cfg.BACKUPS_DIR, id, name);
}

// Start a backup. compress=true (default) -> .tar.zst (or .tar.gz). false -> .tar
async function start(server, { compress = true } = {}) {
  const id = server.id;
  if (jobs.get(id) && jobs.get(id).running) throw Object.assign(new Error('a backup is already running'), { status: 409 });

  const useZstd = compress && HAS_ZSTD;
  const useGzip = compress && !HAS_ZSTD;
  const ext = useZstd ? '.tar.zst' : useGzip ? '.tar.gz' : '.tar';
  const outDir = path.join(cfg.BACKUPS_DIR, id);
  await fsp.mkdir(outDir, { recursive: true });
  const fileName = `${id}-${stamp()}${ext}`;
  const outPath = path.join(outDir, fileName);

  jobs.set(id, { running: true, pct: 0, file: outPath, phase: 'preparing' });
  emit(id, { phase: 'preparing', pct: 0, file: outPath });

  // Run the heavy work without blocking the request.
  (async () => {
    const wasRunning = mc.isRunning(id);
    try {
      if (wasRunning) {
        emit(id, { phase: 'flushing', pct: 0, file: outPath });
        setSaveDisabled(id, true);
        try {
          mc.sendCommand(id, 'save-off');
          mc.sendCommand(id, 'save-all flush');
        } catch {}
        await new Promise((r) => setTimeout(r, 5000)); // let the flush settle to disk
      }

      const total = await duBytes(cfg.serverDir(id));
      emit(id, { phase: 'archiving', pct: 0, file: outPath, totalBytes: total });

      const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
      // --warning=no-file-changed: a running server keeps writing logs/level.dat;
      // tar still exits 1 for "file changed as we read it" but the archive is valid.
      const tar = `tar --warning=no-file-changed -C ${q(cfg.SERVERS_DIR)} -cf - ${q(id)}`;
      let pipeline;
      const comp = useZstd ? 'zstd -T0 -3 -q -o ' + q(outPath)
                 : useGzip ? 'gzip > ' + q(outPath)
                 : 'cat > ' + q(outPath);
      if (HAS_PV && total > 0) {
        // pv prints an integer percentage to stderr; comp consumes stdout.
        pipeline = `${tar} | pv -n -s ${total} | ${comp}`;
      } else {
        pipeline = `${tar} | ${comp}`;
      }

      await new Promise((resolve, reject) => {
        const child = spawn('bash', ['-o', 'pipefail', '-c', pipeline]);
        let stderrBuf = '';
        let poller = null;
        if (!(HAS_PV && total > 0) && total > 0) {
          // Fallback progress: estimate from output file size growth.
          const ratio = useZstd ? 0.45 : useGzip ? 0.5 : 1.0;
          poller = setInterval(() => {
            try {
              const sz = fs.statSync(outPath).size;
              const pct = Math.min(99, Math.round((sz / (total * ratio)) * 100));
              emit(id, { phase: 'archiving', pct, file: outPath });
            } catch {}
          }, 700);
        }
        child.stderr.on('data', (d) => {
          stderrBuf += d.toString();
          const lines = stderrBuf.split('\n');
          stderrBuf = lines.pop();
          for (const line of lines) {
            const t = line.trim();
            if (/^\d+$/.test(t)) emit(id, { phase: 'archiving', pct: Math.min(100, parseInt(t, 10)), file: outPath });
          }
        });
        child.on('error', reject);
        child.on('close', (code) => {
          if (poller) clearInterval(poller);
          // 0 = ok; 1 = tar "file changed as we read it" (benign for a live server).
          if (code === 0 || code === 1) resolve();
          else reject(new Error('archive process exited with code ' + code + (stderrBuf ? ': ' + stderrBuf : '')));
        });
      });

      let size = 0;
      try { size = (await fsp.stat(outPath)).size; } catch {}
      if (!size) throw new Error('archive is empty — backup failed');
      emit(id, { phase: 'done', pct: 100, file: outPath, size });
    } catch (err) {
      try { await fsp.rm(outPath, { force: true }); } catch {}
      emit(id, { phase: 'error', error: String(err.message || err), file: outPath });
    } finally {
      if (wasRunning && mc.isRunning(id)) {
        try { mc.sendCommand(id, 'save-on'); } catch {}
      }
      setSaveDisabled(id, false);
      const j = jobs.get(id);
      if (j) j.running = false;
    }
  })();

  return { file: outPath, name: fileName };
}

module.exports = { start, jobStatus, listBackups, deleteBackup, backupFilePath, reenablePending, HAS_ZSTD, HAS_PV };
