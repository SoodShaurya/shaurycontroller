'use strict';
// File-manager operations, sandboxed to a single server's directory.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const cfg = require('./config');

// Resolve a client-supplied relative path against a server root, refusing escapes.
// Combines a lexical check with a realpath check so a symlink that physically
// lives inside the server dir but points outside it cannot escape the sandbox.
function resolveSafe(id, rel) {
  const normRoot = path.resolve(cfg.serverDir(id));
  const target = path.resolve(normRoot, '.' + path.sep + (rel || ''));
  if (target !== normRoot && !target.startsWith(normRoot + path.sep)) {
    throw Object.assign(new Error('path escapes server directory'), { status: 400 });
  }
  let realRoot;
  try { realRoot = fs.realpathSync(normRoot); } catch { return target; }
  // Resolve symlinks on the nearest existing ancestor (the target itself if it exists).
  let probe = target;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return target;
    probe = parent;
  }
  const real = fs.realpathSync(probe);
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
    throw Object.assign(new Error('path escapes server directory (symlink)'), { status: 400 });
  }
  return target;
}

async function list(id, rel) {
  const dir = resolveSafe(id, rel);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    let size = 0, mtimeMs = 0, isDir = e.isDirectory();
    try {
      const st = await fsp.stat(path.join(dir, e.name));
      size = st.size; mtimeMs = st.mtimeMs; isDir = st.isDirectory();
    } catch { /* dangling symlink etc. */ }
    out.push({ name: e.name, dir: isDir, size, mtime: mtimeMs });
  }
  out.sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name.localeCompare(b.name)));
  return { path: rel || '', entries: out };
}

async function readText(id, rel, maxBytes = 2 * 1024 * 1024) {
  const file = resolveSafe(id, rel);
  const st = await fsp.stat(file);
  if (st.isDirectory()) throw Object.assign(new Error('is a directory'), { status: 400 });
  if (st.size > maxBytes) throw Object.assign(new Error('file too large to edit (' + st.size + ' bytes)'), { status: 413 });
  return await fsp.readFile(file, 'utf8');
}

async function writeText(id, rel, content) {
  const file = resolveSafe(id, rel);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, content);
}

function validName(name) {
  if (!name || name.includes('/') || name.includes('\\') || name === '..' || name === '.') {
    throw Object.assign(new Error('invalid file name'), { status: 400 });
  }
  return name;
}

// Write raw bytes (used by uploads). `buf` is a Buffer.
async function writeBytes(id, relDir, name, buf) {
  validName(name);
  const dir = resolveSafe(id, relDir);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, name), buf);
}

// Resolve + prepare a destination path for a streamed upload.
async function uploadDest(id, relDir, name) {
  validName(name);
  const dir = resolveSafe(id, relDir);
  await fsp.mkdir(dir, { recursive: true });
  return path.join(dir, name);
}

async function mkdir(id, rel) {
  const dir = resolveSafe(id, rel);
  await fsp.mkdir(dir, { recursive: true });
}

async function remove(id, rel) {
  const target = resolveSafe(id, rel);
  if (target === path.resolve(cfg.serverDir(id))) {
    throw Object.assign(new Error('refusing to delete server root'), { status: 400 });
  }
  await fsp.rm(target, { recursive: true, force: true });
}

async function rename(id, fromRel, toRel) {
  const from = resolveSafe(id, fromRel);
  const to = resolveSafe(id, toRel);
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.rename(from, to);
}

// Resolve a path for download streaming; returns { abs, name }.
function forDownload(id, rel) {
  const abs = resolveSafe(id, rel);
  return { abs, name: path.basename(abs) };
}

// List editable config files: server.properties + key root JSONs + everything under config/.
const EDITABLE_EXT = new Set(['.properties', '.json', '.json5', '.jsonc', '.toml', '.yaml', '.yml', '.conf', '.cfg', '.ini', '.txt', '.mcmeta', '.snbt']);
async function listConfigs(id, max = 400) {
  const root = cfg.serverDir(id);
  const out = [];
  const push = async (rel) => {
    try { const st = await fsp.stat(path.join(root, rel)); if (st.isFile()) out.push({ path: rel, size: st.size, type: path.extname(rel).slice(1) || 'txt' }); } catch {}
  };
  for (const f of ['server.properties', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json']) await push(f);
  async function walk(rel, depth) {
    if (depth > 4 || out.length >= max) return;
    let entries; try { entries = await fsp.readdir(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (out.length >= max) break;
      const r = rel + '/' + e.name;
      if (e.isDirectory()) await walk(r, depth + 1);
      else if (EDITABLE_EXT.has(path.extname(e.name).toLowerCase())) await push(r);
    }
  }
  await walk('config', 0);
  return out;
}

module.exports = { resolveSafe, list, readText, writeText, writeBytes, uploadDest, mkdir, remove, rename, forDownload, listConfigs };
