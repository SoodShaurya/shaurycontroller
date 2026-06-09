'use strict';
// GUI player-data editor: read/write <world>/playerdata/<uuid>.dat (gzipped NBT).
// Edits are only allowed when the server is STOPPED (a running server holds player
// state in memory and would overwrite/ignore changes). Each write backs up the .dat.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const nbt = require('prismarine-nbt');
const cfg = require('./config');
const mc = require('./mc');

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const UA = { 'User-Agent': 'shaurycontroller-panel/1.0' };

function isOnlineMode(id) {
  try { return !/^online-mode=false/m.test(fs.readFileSync(path.join(cfg.serverDir(id), 'server.properties'), 'utf8')); } catch { return true; }
}
async function mapLimit(arr, limit, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, async () => {
    while (i < arr.length) { const idx = i++; await fn(arr[idx]); }
  }));
}
// Mojang session API: premium UUID -> current username. Only works for online-mode
// (premium) UUIDs; offline UUIDs are a hash of the name and can't be reversed. Cached.
const mojangCache = new Map();
async function mojangName(uuid) {
  const key = uuid.toLowerCase();
  if (mojangCache.has(key)) return mojangCache.get(key);
  let name = null;
  try {
    const r = await fetch('https://sessionserver.mojang.com/session/minecraft/profile/' + uuid.replace(/-/g, ''), { headers: UA, signal: AbortSignal.timeout(5000) });
    if (r.status === 429) return null; // rate-limited — don't cache, retry on a later load
    if (r.ok) { const d = await r.json(); if (d && d.name) name = d.name; }
  } catch { return null; }
  mojangCache.set(key, name);
  return name;
}

function levelName(id) {
  try {
    const props = fs.readFileSync(path.join(cfg.serverDir(id), 'server.properties'), 'utf8');
    const m = props.match(/^level-name=(.*)$/m);
    if (m && m[1].trim()) return m[1].trim();
  } catch {}
  return 'world';
}
function playerdataDir(id) { return path.join(cfg.serverDir(id), levelName(id), 'playerdata'); }
function datPath(id, uuid) {
  if (!UUID_RE.test(uuid)) throw Object.assign(new Error('invalid uuid'), { status: 400 });
  return path.join(playerdataDir(id), uuid + '.dat');
}

function readArr(id, file) {
  try { const v = JSON.parse(fs.readFileSync(path.join(cfg.serverDir(id), file), 'utf8')); return Array.isArray(v) ? v : []; } catch { return []; }
}
function nameMap(id) {
  const map = {};
  for (const file of ['usercache.json', 'ops.json', 'whitelist.json', 'banned-players.json']) {
    for (const e of readArr(id, file)) if (e && e.uuid && e.name && !map[e.uuid.toLowerCase()]) map[e.uuid.toLowerCase()] = e.name;
  }
  return map;
}

// Some worlds (Paper/Spigot) store the name in the .dat as bukkit.lastKnownName — read it as a
// fallback for players missing from the json caches. Cached per uuid+mtime so list loads stay fast.
const datNameCache = new Map();
async function datName(file, uuid, mtime) {
  const c = datNameCache.get(uuid);
  if (c && c.mtime === mtime) return c.name;
  let name = null;
  try {
    const { parsed } = await nbt.parse(await fsp.readFile(file));
    const v = parsed.value;
    name = (v.bukkit && v.bukkit.value && v.bukkit.value.lastKnownName && v.bukkit.value.lastKnownName.value)
      || (v.Paper && v.Paper.value && v.Paper.value.lastKnownName && v.Paper.value.lastKnownName.value) || null;
  } catch {}
  datNameCache.set(uuid, { name, mtime });
  return name;
}

async function listPlayers(id) {
  const dir = playerdataDir(id);
  let files = [];
  try { files = (await fsp.readdir(dir)).filter((f) => /\.dat$/.test(f) && UUID_RE.test(f.replace(/\.dat$/, ''))); } catch { return { players: [] }; }
  const names = nameMap(id);
  const players = await Promise.all(files.map(async (f) => {
    const uuid = f.replace(/\.dat$/, '');
    const full = path.join(dir, f);
    let mtime = 0; try { mtime = (await fsp.stat(full)).mtimeMs; } catch {}
    let name = names[uuid.toLowerCase()] || null;
    if (!name) name = await datName(full, uuid, mtime); // bukkit/paper lastKnownName
    return { uuid, name, mtime };
  }));
  // For premium (online-mode) servers, resolve any still-unknown UUIDs via the Mojang API.
  if (isOnlineMode(id)) {
    await mapLimit(players.filter((p) => !p.name), 6, async (p) => { p.name = await mojangName(p.uuid); });
  }
  players.sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : a.name ? -1 : b.name ? 1 : b.mtime - a.mtime));
  return { players };
}

// Parse server logs for login lines ("Name[/IP:PORT] logged in ...") to learn which IPs each
// player has connected from. Used for the per-player IP list and the sort-by-IP / alt view.
// Result is cached briefly (logs only change when a server is running). Names are matched
// case-insensitively to the player list.
const LOGIN_RE = /\b([A-Za-z0-9_]{1,16})\[\/(.+):\d+\] logged in\b/g;
const ipCache = new Map(); // id -> { at, data }
async function playerIps(id) {
  const cached = ipCache.get(id);
  if (cached && Date.now() - cached.at < 30000) return cached.data;
  const dir = path.join(cfg.serverDir(id), 'logs');
  let files = [];
  try { files = await fsp.readdir(dir); } catch { const d = { byName: {} }; ipCache.set(id, { at: Date.now(), data: d }); return d; }
  const logs = files.filter((f) => f === 'latest.log' || f.endsWith('.log.gz'));
  const byName = {}; // lowerName -> { name, ips: { ip: count } }
  for (const f of logs) {
    let text;
    try {
      const buf = await fsp.readFile(path.join(dir, f));
      text = f.endsWith('.gz') ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    } catch { continue; }
    LOGIN_RE.lastIndex = 0;
    let m;
    while ((m = LOGIN_RE.exec(text))) {
      const name = m[1];
      const ip = m[2].trim().replace(/^\[|\]$/g, ''); // strip IPv6 brackets if present
      if (!ip) continue;
      const key = name.toLowerCase();
      const rec = byName[key] || (byName[key] = { name, ips: {} });
      rec.ips[ip] = (rec.ips[ip] || 0) + 1;
    }
  }
  const out = { byName: {} };
  for (const [k, rec] of Object.entries(byName)) {
    out.byName[k] = {
      name: rec.name,
      ips: Object.entries(rec.ips).map(([ip, count]) => ({ ip, count })).sort((a, b) => b.count - a.count),
    };
  }
  ipCache.set(id, { at: Date.now(), data: out });
  return out;
}

// --- tagged-NBT helpers ---
const T = {
  byte: (v) => ({ type: 'byte', value: v | 0 }),
  int: (v) => ({ type: 'int', value: v | 0 }),
  float: (v) => ({ type: 'float', value: Number(v) }),
  double: (v) => ({ type: 'double', value: Number(v) }),
  string: (v) => ({ type: 'string', value: String(v) }),
};
// Contents of a container item (shulker box, etc.). Supports the 1.20.5+ component format
// (components["minecraft:container"] = [{slot, item:{id,count}}]) and the legacy
// tag.BlockEntityTag.Items format. Returns null if the item isn't a container.
function containerContents(it) {
  const comp = it.components && it.components.value && it.components.value['minecraft:container'];
  if (comp && comp.value && Array.isArray(comp.value.value)) {
    return comp.value.value.map((e) => {
      const item = (e.item && e.item.value) || {};
      return {
        slot: e.slot ? e.slot.value : 0,
        id: item.id ? item.id.value : 'minecraft:air',
        count: item.count ? item.count.value : 1,
      };
    });
  }
  const bet = it.tag && it.tag.value && it.tag.value.BlockEntityTag && it.tag.value.BlockEntityTag.value;
  if (bet && bet.Items && bet.Items.value && Array.isArray(bet.Items.value.value)) {
    return bet.Items.value.value.map((e) => ({
      slot: e.Slot ? e.Slot.value : 0,
      id: e.id ? e.id.value : 'minecraft:air',
      count: e.Count ? e.Count.value : 1,
    }));
  }
  return null;
}
function itemsFromList(listTag) {
  const out = [];
  const arr = listTag && listTag.value && Array.isArray(listTag.value.value) ? listTag.value.value : [];
  for (const it of arr) {
    const contents = containerContents(it);
    out.push({
      slot: it.Slot ? it.Slot.value : (it.slot ? it.slot.value : 0),
      id: it.id ? it.id.value : 'minecraft:air',
      count: it.count ? it.count.value : (it.Count ? it.Count.value : 1),
      hasComponents: !!(it.components || it.tag),
      ...(contents ? { contents } : {}),
    });
  }
  return out;
}

async function readPlayer(id, uuid) {
  const buf = await fsp.readFile(datPath(id, uuid));
  const { parsed } = await nbt.parse(buf);
  const v = parsed.value;
  const g = (k, d) => (v[k] ? v[k].value : d);
  const pos = v.Pos && v.Pos.value && v.Pos.value.value ? v.Pos.value.value : [0, 0, 0];
  return {
    uuid,
    name: nameMap(id)[uuid.toLowerCase()] || null,
    health: g('Health', 20),
    foodLevel: g('foodLevel', 20),
    xpLevel: g('XpLevel', 0),
    xpTotal: g('XpTotal', 0),
    gamemode: g('playerGameType', 0),
    dimension: g('Dimension', 'minecraft:overworld'),
    pos: [pos[0] || 0, pos[1] || 0, pos[2] || 0],
    selectedSlot: g('SelectedItemSlot', 0),
    inventory: itemsFromList(v.Inventory),
    enderItems: itemsFromList(v.EnderItems),
  };
}

// Build a tagged inventory list, preserving original components when the slot's id is unchanged.
function buildList(origListTag, edits) {
  const origBySlot = {};
  const arr = origListTag && origListTag.value && Array.isArray(origListTag.value.value) ? origListTag.value.value : [];
  for (const it of arr) origBySlot[it.Slot ? it.Slot.value : 0] = it;
  const items = [];
  for (const e of edits || []) {
    if (!e || e.id == null || e.id === '' || e.id === 'minecraft:air') continue;
    const count = Math.max(1, parseInt(e.count, 10) || 1);
    const id = String(e.id).includes(':') ? String(e.id) : 'minecraft:' + String(e.id);
    const item = { Slot: T.byte(e.slot), id: T.string(id), count: T.int(count) };
    const orig = origBySlot[e.slot];
    if (orig && orig.id && orig.id.value === id) { // same item → keep its components/tag (enchants etc.)
      if (orig.components) item.components = orig.components;
      if (orig.tag) item.tag = orig.tag;
    }
    items.push(item);
  }
  return { type: 'list', value: { type: items.length ? 'compound' : 'end', value: items } };
}

async function writePlayer(id, uuid, edits) {
  if (mc.isRunning(id)) throw Object.assign(new Error('stop the server before editing player data (a running server would overwrite your changes)'), { status: 409 });
  const file = datPath(id, uuid);
  const buf = await fsp.readFile(file);
  const { parsed } = await nbt.parse(buf);
  const v = parsed.value;
  const set = (k, tag) => { if (v[k]) v[k] = tag; else v[k] = tag; };

  if (edits.health != null) set('Health', T.float(edits.health));
  if (edits.foodLevel != null) set('foodLevel', T.int(edits.foodLevel));
  if (edits.xpLevel != null) set('XpLevel', T.int(edits.xpLevel));
  if (edits.gamemode != null) set('playerGameType', T.int(edits.gamemode));
  if (edits.dimension != null) set('Dimension', T.string(edits.dimension));
  if (Array.isArray(edits.pos)) set('Pos', { type: 'list', value: { type: 'double', value: edits.pos.map(Number) } });
  if (Array.isArray(edits.inventory)) v.Inventory = buildList(v.Inventory, edits.inventory);
  if (Array.isArray(edits.enderItems)) v.EnderItems = buildList(v.EnderItems, edits.enderItems);

  // backup, then write gzipped NBT
  try { await fsp.copyFile(file, file + '.bak'); } catch {}
  const out = zlib.gzipSync(nbt.writeUncompressed(parsed, 'big'));
  await fsp.writeFile(file, out);
  return { ok: true, backup: path.basename(file) + '.bak' };
}

module.exports = { listPlayers, readPlayer, writePlayer, playerIps };
