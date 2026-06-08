'use strict';
// Minecraft server process management via detached tmux sessions.
//   - start():    writes a launch script, opens a tmux session running it; stdout/stderr
//                 are redirected to a panel-owned run-log (plain text, full capture).
//   - input:      delivered with `tmux send-keys` (reliable even with stdout redirected).
//   - output:     the run-log is tailed and streamed to subscribers over the event bus.
//   - lifecycle:  sessions are independent of this process, so servers survive a panel
//                 restart; on boot we re-attach tailers to any already-running session.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync, spawnSync } = require('child_process');
const { EventEmitter } = require('events');
const cfg = require('./config');
const { ping } = require('./ping');

const bus = new EventEmitter();
bus.setMaxListeners(0);

const tailers = new Map();      // id -> Tailer
const cpuSamples = new Map();   // id -> { ticks, ts }

// ---------------------------------------------------------------------------
// tmux helpers
// ---------------------------------------------------------------------------
function tmux(args) {
  return execFileSync('tmux', args, { encoding: 'utf8' });
}

function isRunning(id) {
  try {
    execFileSync('tmux', ['has-session', '-t', cfg.tmuxSession(id)], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// pane_pid is the java process itself (the launch script `exec`s java).
function serverPid(id) {
  if (!isRunning(id)) return null;
  try {
    const out = tmux(['list-panes', '-t', cfg.tmuxSession(id), '-F', '#{pane_pid}']).trim();
    const pid = parseInt(out.split('\n')[0], 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Live console tailing (poll the run-log; handle truncation on restart)
// ---------------------------------------------------------------------------
class Tailer {
  constructor(id) {
    this.id = id;
    this.file = cfg.runLog(id);
    this.offset = 0;
    this.partial = '';
    this.timer = null;
    try { this.offset = fs.statSync(this.file).size; } catch { this.offset = 0; }
    this.poll = this.poll.bind(this);
    this.timer = setInterval(this.poll, 250);
  }
  poll() {
    let size;
    try { size = fs.statSync(this.file).size; } catch { return; }
    if (size < this.offset) { this.offset = 0; this.partial = ''; } // truncated/replaced
    if (size === this.offset) return;
    const fd = fs.openSync(this.file, 'r');
    try {
      const len = size - this.offset;
      const buf = Buffer.alloc(len);
      const n = fs.readSync(fd, buf, 0, len, this.offset); // may be < len if it shrank mid-read
      this.offset += n;
      if (n === 0) return;
      const text = this.partial + buf.toString('utf8', 0, n);
      const lines = text.split('\n');
      this.partial = lines.pop();
      for (const line of lines) bus.emit('console:' + this.id, line);
    } finally {
      fs.closeSync(fd);
    }
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function ensureTailer(id) {
  if (!tailers.has(id)) tailers.set(id, new Tailer(id));
}

// Return the tail of the run-log as a string (backlog for newly-connected clients).
function consoleBacklog(id, maxBytes = 65536) {
  try {
    const file = cfg.runLog(id);
    const size = fs.statSync(file).size;
    const start = Math.max(0, size - maxBytes);
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(size - start);
      const n = fs.readSync(fd, buf, 0, buf.length, start);
      let s = buf.toString('utf8', 0, n);
      if (start > 0) s = s.slice(s.indexOf('\n') + 1); // drop partial first line
      return s;
    } finally { fs.closeSync(fd); }
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
// Heap/flag string (no leading `java`, no jar). If `memory` is set, inject
// -Xms/-Xmx; if blank, the owner supplies heap sizing inside jvmArgs themselves.
function heapAndFlags(server) {
  const mem = (server.memory || '').trim();
  const flags = (server.jvmArgs != null ? server.jvmArgs : cfg.DEFAULT_FLAGS).trim();
  const parts = [];
  if (mem) parts.push('-Xms' + mem, '-Xmx' + mem);
  if (flags) parts.push(flags);
  return parts.join(' ');
}

// Human-readable preview of exactly what gets launched (no redirection).
function launchPreview(server) {
  const java = server.java || cfg.JAVA_DEFAULT;
  return [java, heapAndFlags(server), '-jar', server.jar, 'nogui'].join(' ');
}

function launchCommand(server) {
  const dir = cfg.serverDir(server.id);
  const java = server.java || cfg.JAVA_DEFAULT;
  const runlog = cfg.runLog(server.id);
  const mem = (server.memory || '').trim();
  const flags = (server.jvmArgs != null ? server.jvmArgs : cfg.DEFAULT_FLAGS).trim();
  const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
  // EVERY token is single-quoted, so no config value (memory, a flag, jar, java)
  // can break out of the launch script into the shell — even though the config
  // is owner-controlled, the panel has no auth, so this is hardened regardless.
  const tokens = [java];
  if (mem) tokens.push('-Xms' + mem, '-Xmx' + mem);
  for (const f of flags.split(/\s+/).filter(Boolean)) tokens.push(f);
  tokens.push('-jar', server.jar, 'nogui');
  const script = [
    '#!/usr/bin/env bash',
    'cd ' + q(dir) + ' || exit 1',
    'exec ' + tokens.map(q).join(' ') + ' > ' + q(runlog) + ' 2>&1',
    '',
  ].join('\n');
  return script;
}

// Per-server lifecycle lock: serializes start/stop/restart/kill so e.g. a
// restart's stop→start window can't be raced by a concurrent start.
const locks = new Map();
function withLock(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const run = prev.then(() => fn(), () => fn());
  locks.set(id, run.then(() => {}, () => {}));
  return run;
}

// Track stops we initiated so the crash watcher doesn't treat them as crashes.
const intentionalStop = new Set();

function _start(server) {
  if (isRunning(server.id)) throw new Error('already running');
  intentionalStop.delete(server.id);
  crashTimes.delete(server.id); // manual start resets the crash backoff
  const dir = cfg.serverDir(server.id);
  if (!fs.existsSync(path.join(dir, server.jar))) {
    throw new Error('server jar not found: ' + server.jar);
  }
  fs.mkdirSync(cfg.RUN_DIR, { recursive: true });
  // Fresh run-log each start (the launch script also truncates via `>`).
  fs.writeFileSync(cfg.runLog(server.id), '');
  const scriptPath = path.join(cfg.RUN_DIR, server.id + '.start.sh');
  fs.writeFileSync(scriptPath, launchCommand(server), { mode: 0o755 });
  tmux(['new-session', '-d', '-s', cfg.tmuxSession(server.id), '-x', '230', '-y', '50',
        'bash', scriptPath]);
  ensureTailer(server.id);
  bus.emit('console:' + server.id, '[panel] starting ' + server.id + ' ...');
  return true;
}

// Send a console command (adds the Enter key).
function sendCommand(id, command) {
  if (!isRunning(id)) throw new Error('not running');
  execFileSync('tmux', ['send-keys', '-t', cfg.tmuxSession(id), '-l', command]);
  execFileSync('tmux', ['send-keys', '-t', cfg.tmuxSession(id), 'Enter']);
  bus.emit('console:' + id, '[panel] > ' + command);
}

// Graceful stop: issue `stop`, then wait for the session to disappear.
function _stop(id, timeoutMs = 90000) {
  intentionalStop.add(id);
  return new Promise((resolve) => {
    if (!isRunning(id)) return resolve(true);
    try { sendCommand(id, 'stop'); } catch { /* fallthrough to kill */ }
    const deadline = Date.now() + timeoutMs;
    const iv = setInterval(() => {
      if (!isRunning(id)) { clearInterval(iv); resolve(true); }
      else if (Date.now() > deadline) {
        clearInterval(iv);
        try { tmux(['kill-session', '-t', cfg.tmuxSession(id)]); } catch {}
        resolve(true);
      }
    }, 500);
  });
}

// Force kill (SIGHUP via session teardown) — last resort, no world save.
function _kill(id) {
  intentionalStop.add(id);
  if (!isRunning(id)) return false;
  try { tmux(['kill-session', '-t', cfg.tmuxSession(id)]); } catch {}
  bus.emit('console:' + id, '[panel] force-killed ' + id);
  return true;
}

// Locked public lifecycle API.
function start(server) { return withLock(server.id, async () => _start(server)); }
function stop(id, timeoutMs) { return withLock(id, () => _stop(id, timeoutMs)); }
function kill(id) { return withLock(id, async () => _kill(id)); }
function restart(server) {
  return withLock(server.id, async () => {
    await _stop(server.id);
    await new Promise((r) => setTimeout(r, 1500));
    return _start(server);
  });
}

// ---------------------------------------------------------------------------
// Status / stats (lightweight, read from /proc)
// ---------------------------------------------------------------------------
let clkTck = 100;
try { clkTck = parseInt(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim(), 10) || 100; } catch {}

function bootTime() {
  try {
    const stat = fs.readFileSync('/proc/stat', 'utf8');
    const m = stat.match(/btime (\d+)/);
    return m ? parseInt(m[1], 10) : null;
  } catch { return null; }
}

function procStats(pid) {
  try {
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    // field layout: after the (comm) there are space-separated fields; utime=14, stime=15, starttime=22 (1-based)
    const close = stat.lastIndexOf(')');
    const rest = stat.slice(close + 2).split(' ');
    const utime = parseInt(rest[11], 10); // 14th overall -> index 11 after dropping pid+comm
    const stime = parseInt(rest[12], 10);
    const starttime = parseInt(rest[19], 10);
    let rssBytes = 0;
    const status = fs.readFileSync('/proc/' + pid + '/status', 'utf8');
    const rm = status.match(/VmRSS:\s+(\d+) kB/);
    if (rm) rssBytes = parseInt(rm[1], 10) * 1024;
    const bt = bootTime();
    const uptimeSec = bt ? Math.max(0, Math.floor(Date.now() / 1000) - (bt + Math.floor(starttime / clkTck))) : null;
    return { ticks: utime + stime, rssBytes, uptimeSec };
  } catch {
    return null;
  }
}

// Per-server disk usage (du -sb), sampled in the background so status() never blocks.
const diskCache = new Map();
function refreshDisks() {
  for (const s of cfg.load().servers) {
    execFile('du', ['-sb', cfg.serverDir(s.id)], { maxBuffer: 1 << 20 }, (err, stdout) => {
      if (!err) { const n = parseInt(String(stdout).split(/\s+/)[0], 10); if (Number.isFinite(n)) diskCache.set(s.id, n); }
    });
  }
}
refreshDisks();
setInterval(refreshDisks, 60000).unref();

// Player counts via server-list ping (cached; status() reads the cache).
const playersCache = new Map();
const crashTimes = new Map(); // id -> [timestamps] for auto-restart backoff
function refreshPlayers() {
  for (const s of cfg.load().servers) {
    if (!isRunning(s.id)) { playersCache.delete(s.id); continue; }
    ping('127.0.0.1', s.port, 2500).then((r) => { if (r) playersCache.set(s.id, r); }).catch(() => {});
  }
}
setInterval(refreshPlayers, 5000).unref();

function status(id) {
  const running = isRunning(id);
  const diskBytes = diskCache.has(id) ? diskCache.get(id) : null;
  const players = running ? (playersCache.get(id) || null) : null;
  const out = { id, running, pid: null, rssBytes: null, uptimeSec: null, cpuPct: null, diskBytes, players };
  if (!running) { cpuSamples.delete(id); return out; }
  const pid = serverPid(id);
  out.pid = pid;
  const ps = pid ? procStats(pid) : null;
  if (ps) {
    out.rssBytes = ps.rssBytes;
    out.uptimeSec = ps.uptimeSec;
    const now = Date.now();
    const prev = cpuSamples.get(id);
    if (prev && now > prev.ts) {
      const dTicks = ps.ticks - prev.ticks;
      const dSec = (now - prev.ts) / 1000;
      out.cpuPct = Math.max(0, Math.round((dTicks / clkTck / dSec) * 100));
    }
    cpuSamples.set(id, { ticks: ps.ticks, ts: now });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Host-wide metrics (sampled on a fixed interval so per-call deltas are stable)
// ---------------------------------------------------------------------------
let hostCpuPrev = null;
let hostCpuPct = 0;
function sampleHostCpu() {
  try {
    const line = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0]; // "cpu  u n s idle iowait irq ..."
    const f = line.trim().split(/\s+/).slice(1).map(Number);
    const idle = (f[3] || 0) + (f[4] || 0);
    const total = f.reduce((a, b) => a + b, 0);
    if (hostCpuPrev) {
      const dIdle = idle - hostCpuPrev.idle;
      const dTotal = total - hostCpuPrev.total;
      if (dTotal > 0) hostCpuPct = Math.max(0, Math.min(100, Math.round((1 - dIdle / dTotal) * 100)));
    }
    hostCpuPrev = { idle, total };
  } catch { /* ignore */ }
}
sampleHostCpu();
setInterval(sampleHostCpu, 2000).unref();

function getHostMetrics() {
  const memTotal = os.totalmem();
  const memUsed = memTotal - os.freemem();
  let diskTotal = 0, diskUsed = 0;
  try {
    const st = fs.statfsSync(cfg.BASE_DIR);
    diskTotal = st.blocks * st.bsize;
    diskUsed = diskTotal - st.bavail * st.bsize;
  } catch {}
  return {
    cpuPct: hostCpuPct,
    cores: os.cpus().length,
    memTotalBytes: memTotal,
    memUsedBytes: memUsed,
    memPct: Math.round((memUsed / memTotal) * 100),
    diskTotalBytes: diskTotal,
    diskUsedBytes: diskUsed,
    diskPct: diskTotal ? Math.round((diskUsed / diskTotal) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Java detection — find installed JDKs and their versions (cached per process)
// ---------------------------------------------------------------------------
let javaCache = null;
function javaVersionOf(p) {
  try {
    const r = spawnSync(p, ['-version'], { encoding: 'utf8', timeout: 5000 });
    const text = (r.stderr || '') + (r.stdout || '');
    const m = text.match(/version "([^"]+)"/);
    if (!m) return null;
    const full = m[1];
    const major = full.startsWith('1.') ? parseInt(full.split('.')[1], 10) : parseInt(full.split('.')[0], 10);
    return { full, major: Number.isFinite(major) ? major : null };
  } catch { return null; }
}
function detectJavas(force = false) {
  if (javaCache && !force) return javaCache;
  const seen = new Set();
  const list = [];
  // List EVERY distinct java binary path that exists (no symlink collapsing) so the
  // dropdown shows all installs; dedupe only on the exact path string.
  const add = (p, isDefault) => {
    if (!p || seen.has(p) || !fs.existsSync(p)) return;
    seen.add(p);
    const v = javaVersionOf(p);
    if (!v) return;
    list.push({
      path: p, version: v.full, major: v.major, isDefault: !!isDefault,
      label: `Java ${v.major || '?'} · ${v.full}${isDefault ? ' (system default)' : ''} — ${p}`,
    });
  };
  add('/usr/bin/java', true);
  if (process.env.JAVA_HOME) add(path.join(process.env.JAVA_HOME, 'bin', 'java'), false);
  try {
    for (const e of fs.readdirSync('/usr/lib/jvm')) add(path.join('/usr/lib/jvm', e, 'bin', 'java'), false);
  } catch {}
  list.sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : (b.major || 0) - (a.major || 0)));
  javaCache = list;
  return list;
}

// Crash watcher: detect unexpected exits and optionally auto-restart (with backoff).
const lastSeenRunning = new Map();
function crashWatch() {
  for (const s of cfg.load().servers) {
    const running = isRunning(s.id);
    const was = lastSeenRunning.get(s.id);
    lastSeenRunning.set(s.id, running);
    if (was && !running && !intentionalStop.has(s.id)) {
      bus.emit('console:' + s.id, '[panel] ⚠ ' + s.id + ' exited unexpectedly (crash detected).');
      if (s.autoRestart) {
        const times = (crashTimes.get(s.id) || []).filter((t) => Date.now() - t < 300000);
        if (times.length >= 3) {
          bus.emit('console:' + s.id, '[panel] auto-restart suppressed: 3 crashes within 5 min — start it manually once fixed.');
        } else {
          times.push(Date.now()); crashTimes.set(s.id, times);
          bus.emit('console:' + s.id, '[panel] auto-restarting ' + s.id + ' …');
          start(s).catch((e) => bus.emit('console:' + s.id, '[panel] auto-restart failed: ' + e.message));
        }
      }
    }
  }
}
setInterval(crashWatch, 10000).unref();

// On panel boot, attach tailers to any sessions that are already alive.
function reattachAll() {
  for (const s of cfg.load().servers) {
    if (isRunning(s.id)) ensureTailer(s.id);
  }
}

module.exports = {
  bus, isRunning, serverPid, start, stop, kill, restart, sendCommand,
  status, consoleBacklog, ensureTailer, reattachAll,
  launchPreview, getHostMetrics, heapAndFlags, detectJavas,
};
