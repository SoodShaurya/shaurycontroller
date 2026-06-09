'use strict';
// PaperMC downloads (api.papermc.io v2). Paper is a Bukkit/Spigot fork — plugins (in
// plugins/), not Fabric mods. Same launch shape (java -jar paper-*.jar nogui).
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const PAPER = 'https://api.papermc.io/v2/projects/paper';
const UA = { 'User-Agent': 'shaurycontroller-panel/1.0 (apsood@gmail.com)' };

async function getJSON(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error('PaperMC ' + url + ' -> ' + r.status);
  return r.json();
}
function isStable(v) { return !/-(pre|rc)|snapshot/i.test(v); }

async function versions() {
  const d = await getJSON(PAPER);
  return (d.versions || []).slice().reverse().map((v) => ({ version: v, stable: isStable(v) }));
}

async function latestBuild(version) {
  const d = await getJSON(`${PAPER}/versions/${encodeURIComponent(version)}/builds`);
  const builds = d.builds || [];
  const stable = builds.filter((b) => b.channel === 'STABLE');
  const b = (stable.length ? stable : builds).slice(-1)[0];
  if (!b) throw new Error('no Paper build found for ' + version);
  const app = b.downloads.application;
  return { build: b.build, name: app.name, sha256: app.sha256 };
}

async function downloadInto(dir, version) {
  if (!/^[0-9A-Za-z.\-]+$/.test(version)) throw Object.assign(new Error('invalid Paper version'), { status: 400 });
  const b = await latestBuild(version);
  const url = `${PAPER}/versions/${encodeURIComponent(version)}/builds/${b.build}/downloads/${encodeURIComponent(b.name)}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error('failed to download Paper jar (' + res.status + ') for ' + version);
  const buf = Buffer.from(await res.arrayBuffer());
  if (b.sha256) { const got = crypto.createHash('sha256').update(buf).digest('hex'); if (got !== b.sha256) throw new Error('Paper jar checksum mismatch'); }
  await fsp.writeFile(path.join(dir, b.name), buf);
  return { jar: b.name, build: b.build };
}

module.exports = { versions, latestBuild, downloadInto };
