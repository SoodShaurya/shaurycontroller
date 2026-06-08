'use strict';
// Central configuration: paths, defaults, and the servers.json registry.
const fs = require('fs');
const path = require('path');

const PANEL_DIR = __dirname;
const BASE_DIR = path.resolve(PANEL_DIR, '..');
const SERVERS_DIR = path.join(BASE_DIR, 'servers');
const BACKUPS_DIR = path.join(BASE_DIR, 'backups');
const RUN_DIR = path.join(PANEL_DIR, 'run');
const CONFIG_FILE = path.join(PANEL_DIR, 'servers.json');

// Java 21 LTS — the runtime Mojang targets for MC 1.21.x and current versions.
// (Java 25 fails: the older Fabric loaders bundle an ASM that can't parse class
// file major version 69. Java 25 lives at /usr/lib/jvm/java-25-openjdk-arm64.)
const JAVA_DEFAULT = '/usr/lib/jvm/jdk-21.0.6/bin/java';

// Aikar's flags for a <=12GB G1GC heap. -Xms/-Xmx are injected separately from each
// server's `memory` field, so they are intentionally absent here. Refined by research.
const DEFAULT_FLAGS = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:+AlwaysPreTouch',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
  '-XX:G1HeapWastePercent=5',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:InitiatingHeapOccupancyPercent=15',
  '-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem',
  '-XX:MaxTenuringThreshold=1',
  '-Dusing.aikars.flags=https://mcflags.emc.gs',
  '-Daikars.new.flags=true',
].join(' ');

function ensureDirs() {
  for (const d of [SERVERS_DIR, BACKUPS_DIR, RUN_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function load() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const cfg = JSON.parse(raw);
    if (!Array.isArray(cfg.servers)) cfg.servers = [];
    return cfg;
  } catch (e) {
    if (e.code === 'ENOENT') return { servers: [] };
    throw e;
  }
}

function save(cfg) {
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, CONFIG_FILE);
}

function getServer(id) {
  return load().servers.find((s) => s.id === id) || null;
}

// Update editable fields of a server in the registry. Validates inputs.
function updateServer(id, patch) {
  const cfg = load();
  const s = cfg.servers.find((x) => x.id === id);
  if (!s) throw Object.assign(new Error('no such server'), { status: 404 });

  if (patch.port !== undefined) {
    const port = parseInt(patch.port, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw Object.assign(new Error('port must be 1-65535'), { status: 400 });
    }
    s.port = port;
  }
  if (patch.memory !== undefined) {
    const m = String(patch.memory).trim();
    if (m && !/^\d+[kKmMgG]?$/.test(m)) {
      throw Object.assign(new Error('memory must look like 6G / 8000M / 1024K (or blank to set heap via flags)'), { status: 400 });
    }
    s.memory = m;
  }
  if (patch.jvmArgs !== undefined) {
    if (typeof patch.jvmArgs !== 'string') throw Object.assign(new Error('jvmArgs must be a string'), { status: 400 });
    s.jvmArgs = patch.jvmArgs.trim();
  }
  if (patch.java !== undefined) {
    s.java = String(patch.java).trim() || JAVA_DEFAULT;
  }
  if (patch.jar !== undefined) {
    const jar = String(patch.jar).trim();
    if (!jar || /[\/\\]/.test(jar) || jar.includes('..')) throw Object.assign(new Error('jar must be a bare filename in the server dir'), { status: 400 });
    s.jar = jar;
  }
  if (patch.name !== undefined && String(patch.name).trim()) s.name = String(patch.name).trim();
  if (patch.autoRestart !== undefined) s.autoRestart = !!patch.autoRestart;

  save(cfg);
  return s;
}

// Set a single key in a server's server.properties (creates the file if absent).
function setServerProperty(id, key, value) {
  const file = path.join(serverDir(id), 'server.properties');
  let lines = [];
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch { /* will create */ }
  const prefix = key + '=';
  let found = false;
  lines = lines.map((l) => {
    if (l.startsWith(prefix)) { found = true; return prefix + value; }
    return l;
  });
  if (!found) {
    if (lines.length && lines[lines.length - 1] === '') lines[lines.length - 1] = prefix + value;
    else lines.push(prefix + value);
    lines.push('');
  }
  fs.writeFileSync(file, lines.join('\n'));
}

// Absolute directory of a server's files.
function serverDir(id) {
  return path.join(SERVERS_DIR, id);
}

// Panel-owned run-log file (full stdout/stderr capture for the live console).
function runLog(id) {
  return path.join(RUN_DIR, id + '.log');
}

function tmuxSession(id) {
  return 'mc-' + id;
}

module.exports = {
  PANEL_DIR, BASE_DIR, SERVERS_DIR, BACKUPS_DIR, RUN_DIR, CONFIG_FILE,
  JAVA_DEFAULT, DEFAULT_FLAGS,
  ensureDirs, load, save, getServer, updateServer, setServerProperty,
  serverDir, runLog, tmuxSession,
};
