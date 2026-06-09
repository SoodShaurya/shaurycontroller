'use strict';
// Minecraft Server List Ping (modern 1.7+ protocol) — fetch online/max players + version.
const net = require('net');

function encodeVarInt(n) {
  const bytes = [];
  let v = n >>> 0;
  do { let b = v & 0x7f; v >>>= 7; if (v) b |= 0x80; bytes.push(b); } while (v);
  return Buffer.from(bytes);
}
function encodeString(s) {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([encodeVarInt(b.length), b]);
}
function readVarInt(buf, offset) {
  let result = 0, shift = 0, pos = offset, byte;
  do {
    if (pos >= buf.length) return null; // need more bytes
    byte = buf[pos++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    if (shift > 35) return null;
  } while (byte & 0x80);
  return { value: result >>> 0, offset: pos };
}

function ping(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let done = false, buf = Buffer.alloc(0);
    const socket = net.createConnection({ host, port });
    const finish = (v) => { if (done) return; done = true; try { socket.destroy(); } catch {} resolve(v); };
    socket.setTimeout(timeoutMs, () => finish(null));
    socket.on('error', () => finish(null));
    socket.on('connect', () => {
      const hs = Buffer.concat([
        encodeVarInt(0x00),       // handshake packet id
        encodeVarInt(765),        // protocol version (any recent; status is version-agnostic)
        encodeString(host),
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        encodeVarInt(1),          // next state: status
      ]);
      const handshake = Buffer.concat([encodeVarInt(hs.length), hs]);
      const statusReq = Buffer.concat([encodeVarInt(1), encodeVarInt(0x00)]);
      socket.write(Buffer.concat([handshake, statusReq]));
    });
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const lenR = readVarInt(buf, 0);
      if (!lenR) return;
      if (buf.length - lenR.offset < lenR.value) return; // wait for the whole packet
      let off = lenR.offset;
      const idR = readVarInt(buf, off); if (!idR) return; off = idR.offset;
      const sR = readVarInt(buf, off); if (!sR) return; off = sR.offset;
      try {
        const data = JSON.parse(buf.slice(off, off + sR.value).toString('utf8'));
        finish({
          online: data.players ? data.players.online : null,
          max: data.players ? data.players.max : null,
          version: data.version ? data.version.name : null,
          sample: (data.players && Array.isArray(data.players.sample)) ? data.players.sample : [],
        });
      } catch { finish(null); }
    });
  });
}

module.exports = { ping };
