'use strict';
// Whitelist / ban / pardon management. Works in both states:
//  - server RUNNING  -> issue the console command (live + the server persists the JSON)
//  - server STOPPED  -> edit whitelist.json / banned-players.json / banned-ips.json directly
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config');
const mc = require('./mc');

const NAME_RE = /^[A-Za-z0-9_]{1,16}$/;            // valid Java username charset
const IP_RE = /^[0-9a-fA-F:.]{1,45}$/;
const UA = { 'User-Agent': 'shaurycontroller-panel/1.0' };

function readJson(id, file) {
  try { const v = JSON.parse(fs.readFileSync(path.join(cfg.serverDir(id), file), 'utf8')); return Array.isArray(v) ? v : []; } catch { return []; }
}
async function writeJson(id, file, data) {
  const p = path.join(cfg.serverDir(id), file);
  await fsp.writeFile(p + '.tmp', JSON.stringify(data, null, 2));
  await fsp.rename(p + '.tmp', p);
}
function prop(id, key) {
  try { const m = fs.readFileSync(path.join(cfg.serverDir(id), 'server.properties'), 'utf8').match(new RegExp('^' + key + '=(.*)$', 'm')); return m ? m[1].trim() : null; } catch { return null; }
}

function readLists(id) {
  return {
    running: mc.isRunning(id),
    whitelistEnabled: prop(id, 'white-list') === 'true',
    onlineMode: prop(id, 'online-mode') !== 'false',
    whitelist: readJson(id, 'whitelist.json').map((e) => ({ name: e.name, uuid: e.uuid })),
    banned: readJson(id, 'banned-players.json').map((e) => ({ name: e.name, uuid: e.uuid, reason: e.reason, source: e.source })),
    bannedIps: readJson(id, 'banned-ips.json').map((e) => ({ ip: e.ip, reason: e.reason })),
  };
}

function offlineUuid(name) {
  const h = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
  h[6] = (h[6] & 0x0f) | 0x30; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
function dashUuid(hex) { return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`; }
async function resolveUuid(id, name) {
  for (const e of readJson(id, 'usercache.json')) if (e.name && e.name.toLowerCase() === name.toLowerCase() && e.uuid) return { uuid: e.uuid, name: e.name };
  try {
    const r = await fetch('https://api.mojang.com/users/profiles/minecraft/' + encodeURIComponent(name), { headers: UA, signal: AbortSignal.timeout(5000) });
    if (r.ok) { const d = await r.json(); if (d && d.id) return { uuid: dashUuid(d.id), name: d.name || name }; }
  } catch {}
  if (prop(id, 'online-mode') === 'false') return { uuid: offlineUuid(name), name };
  throw new Error(`couldn't resolve a UUID for "${name}" (never joined and Mojang lookup failed). Start the server and try again, or check the spelling.`);
}

function cleanReason(r) { return String(r || '').replace(/[\r\n\t]/g, ' ').slice(0, 120).trim(); }

async function mutate(id, body) {
  const action = body.action;
  const name = body.name != null ? String(body.name).trim() : '';
  const ip = body.ip != null ? String(body.ip).trim() : '';
  const reason = cleanReason(body.reason);
  const running = mc.isRunning(id);
  const needsName = ['whitelist_add', 'whitelist_remove', 'ban', 'pardon', 'op', 'deop'];
  if (needsName.includes(action) && !NAME_RE.test(name)) throw Object.assign(new Error('invalid player name'), { status: 400 });
  if ((action === 'ban_ip' || action === 'pardon_ip') && !IP_RE.test(ip)) throw Object.assign(new Error('invalid IP'), { status: 400 });

  const cmd = (c) => mc.sendCommand(id, c);
  const removeByName = async (file) => writeJson(id, file, readJson(id, file).filter((e) => (e.name || '').toLowerCase() !== name.toLowerCase()));

  switch (action) {
    case 'whitelist_add':
      if (running) cmd('whitelist add ' + name);
      else { const r = await resolveUuid(id, name); const wl = readJson(id, 'whitelist.json'); if (!wl.some((e) => (e.name || '').toLowerCase() === name.toLowerCase())) { wl.push({ uuid: r.uuid, name: r.name }); await writeJson(id, 'whitelist.json', wl); } }
      break;
    case 'whitelist_remove':
      if (running) cmd('whitelist remove ' + name); else await removeByName('whitelist.json');
      break;
    case 'whitelist_on':
      if (running) cmd('whitelist on'); else cfg.setServerProperty(id, 'white-list', 'true');
      break;
    case 'whitelist_off':
      if (running) cmd('whitelist off'); else cfg.setServerProperty(id, 'white-list', 'false');
      break;
    case 'ban':
      if (running) cmd('ban ' + name + (reason ? ' ' + reason : ''));
      else { const r = await resolveUuid(id, name); const b = readJson(id, 'banned-players.json'); if (!b.some((e) => (e.name || '').toLowerCase() === name.toLowerCase())) { b.push({ uuid: r.uuid, name: r.name, created: new Date().toISOString(), source: '(panel)', expires: 'forever', reason: reason || 'Banned by an operator.' }); await writeJson(id, 'banned-players.json', b); } }
      break;
    case 'pardon':
      if (running) cmd('pardon ' + name); else await removeByName('banned-players.json');
      break;
    case 'ban_ip':
      if (running) cmd('ban-ip ' + ip + (reason ? ' ' + reason : ''));
      else { const b = readJson(id, 'banned-ips.json'); if (!b.some((e) => e.ip === ip)) { b.push({ ip, created: new Date().toISOString(), source: '(panel)', expires: 'forever', reason: reason || 'Banned by an operator.' }); await writeJson(id, 'banned-ips.json', b); } }
      break;
    case 'pardon_ip':
      if (running) cmd('pardon-ip ' + ip); else await writeJson(id, 'banned-ips.json', readJson(id, 'banned-ips.json').filter((e) => e.ip !== ip));
      break;
    default:
      throw Object.assign(new Error('unknown action'), { status: 400 });
  }
  if (running) await new Promise((r) => setTimeout(r, 700)); // let the server rewrite the JSON
  return readLists(id);
}

module.exports = { readLists, mutate };
