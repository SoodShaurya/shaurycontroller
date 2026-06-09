'use strict';
// AI agent (DeepSeek, OpenAI-compatible chat API) with human-in-the-loop tool use.
//
// SAFETY MODEL: chat() only ever PROPOSES actions (tool_calls); it never executes
// anything. execute() performs an action and is reachable ONLY via the /api/ai/execute
// route, which the frontend calls AFTER the user clicks Approve. So every config change /
// console command / terminal command is gated on explicit user verification — there is no
// code path where the model self-executes.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cfg = require('./config');
const mc = require('./mc');
const backup = require('./backup');
const fabric = require('./fabric');

const DEEPSEEK = 'https://api.deepseek.com/chat/completions';
const SECRETS = path.join(__dirname, 'secrets.json');

function loadSecrets() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(SECRETS, 'utf8')); } catch {}
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || s.deepseekApiKey || '',
    model: process.env.DEEPSEEK_MODEL || s.deepseekModel || 'deepseek-v4-flash',
  };
}
function isConfigured() { return !!loadSecrets().apiKey; }

// Tools the agent may PROPOSE. Each maps to an approval-gated action in execute().
const FUNCTIONS = [
    {
      name: 'set_server_config',
      description: 'Change a server\'s configuration (applies on its next start/restart). Only include the fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: 'the server id, e.g. tardcentral' },
          port: { type: 'integer' },
          memory: { type: 'string', description: 'heap size like 6G or 8000M; sets -Xms=-Xmx. Blank string to manage heap via flags.' },
          jvmArgs: { type: 'string', description: 'space-separated JVM flags (excluding -Xms/-Xmx and -jar)' },
          java: { type: 'string', description: 'absolute path to a java binary' },
          jar: { type: 'string', description: 'server jar filename in the server directory' },
        },
        required: ['serverId'],
      },
    },
    {
      name: 'console_command',
      description: 'Send a command to a RUNNING Minecraft server\'s console (e.g. "say hi", "whitelist add X", "tp ...").',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'string' },
          command: { type: 'string', description: 'the console command WITHOUT a leading slash' },
        },
        required: ['serverId', 'command'],
      },
    },
    {
      name: 'terminal_command',
      description: 'Run a shell command on the host (as user ubuntu, which has sudo). Use for diagnostics or host changes. Prefer read-only commands; be careful — this is powerful.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    },
    {
      name: 'server_lifecycle',
      description: 'Start, stop (graceful), restart, or kill (force) a server.',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'string' },
          action: { type: 'string', enum: ['start', 'stop', 'restart', 'kill'] },
        },
        required: ['serverId', 'action'],
      },
    },
    {
      name: 'create_backup',
      description: 'Create a compressed backup of a server (safe whether running or stopped).',
      parameters: {
        type: 'object',
        properties: { serverId: { type: 'string' } },
        required: ['serverId'],
      },
    },
    {
      name: 'install_mod',
      description: 'Install a mod/plugin/datapack from Modrinth into a server, matched to its MC version AND platform (Fabric servers take mods, Paper servers take plugins — the panel rejects an incompatible project). Use the Modrinth project slug. projectType defaults to the server\'s platform (plugin for Paper, mod for Fabric).',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'string' },
          slug: { type: 'string', description: 'Modrinth project slug, e.g. "lithium"' },
          projectType: { type: 'string', enum: ['mod', 'datapack', 'plugin', 'resourcepack', 'shader'] },
        },
        required: ['serverId', 'slug'],
      },
    },
];
// OpenAI-style tool schema (DeepSeek is OpenAI-compatible).
const OPENAI_TOOLS = FUNCTIONS.map((f) => ({ type: 'function', function: { name: f.name, description: f.description, parameters: f.parameters } }));

const SYSTEM_BASE = `You are "Copilot", the expert in-panel operations assistant for **shaurycontroller**, a web panel that manages Minecraft servers (both **Fabric** and **Paper**). Act like a senior Minecraft server administrator pair-working with the user: proactive, precise, and safety-conscious. Diagnose root causes, propose concrete minimal fixes, and explain your reasoning briefly.

# Environment
- Host: Ubuntu Linux on aarch64 (ARM, Oracle Ampere), 4 vCPU / 24 GB RAM. You run as user 'ubuntu' (has passwordless sudo).
- Each server is either **Fabric** (modded vanilla, loads .jar **mods**) or **Paper** (Bukkit/Spigot fork, loads .jar **plugins**). Check each server's "type" in the live state before assuming. The panel runs each in a tmux session, streams console via the server's run-log, sends commands with tmux send-keys, and keeps servers alive across panel restarts (best-effort).
- **Java: use Java 21 (LTS)** for these servers. Java 25 breaks older Fabric loaders with "Unsupported class file major version 69" (the loader's ASM can't parse Java 25 bytecode); newer loaders (~0.19+) tolerate 25. If a server won't boot and you see major version 69, switch its java to /usr/lib/jvm/jdk-21.0.6/bin/java.
- **Fabric** servers: mods live in <server>/mods/ (.jar), datapacks in <server>/world/datapacks/. Most mods require **Fabric API**. Mods must match the server's exact MC version + the fabric loader, or they fail to load / crash. **Paper** servers: plugins live in <server>/plugins/ (.jar), no loader jar needed; plugins are generally tolerant of minor MC version differences but still target a MC range. A Fabric mod will NOT run on Paper and vice-versa — install the right project type for the platform (install_mod enforces this).
- Backups: compressed tar.zst in the panel's backups/ dir. Take a backup before risky changes (version upgrades, WorldEdit ops, mass mod changes).

# Your tools (ALL require explicit user Approval before they run — you only PROPOSE)
- set_server_config: change port / memory (heap, -Xms=-Xmx) / jvmArgs / java path / jar. Applies on next start/restart.
- console_command: a command to a RUNNING server (no leading slash). e.g. say, list, whitelist add, op, gamerule, time set, weather, tp, save-all, kick, ban, difficulty, gamemode.
- terminal_command: any host shell command (powerful — has sudo). Prefer read-only/least-privilege; avoid destructive ops unless explicitly asked.
- server_lifecycle: start / stop (graceful) / restart / kill (force, no save — last resort).
- create_backup: compressed backup (safe running or stopped).
- install_mod: install a Modrinth project (by slug) matched to the server's MC + platform (mod for Fabric, plugin for Paper).

# How to work (Copilot-style)
- Use the live state below for facts; never invent server names, versions, or values. If you need data you don't have, gather it first with a READ-ONLY action (e.g. terminal 'tail -n 60 <server>/logs/latest.log', 'ls <server>/mods', 'free -h', 'df -h'; or console '/spark tps', '/spark health', 'list').
- For multi-step goals, propose the FIRST concrete step, wait for its result, then continue — don't dump many actions at once. Each step is approval-gated, so keep them small and clearly justified.
- Always say WHY. Never claim something is done before you receive the tool result. If the user only wants information, just answer — don't call a tool.
- Keep replies concise and skimmable.

# Domain knowledge for diagnosis & tuning
- **Performance / lag (low TPS, high MSPT, "Can't keep up")**: the spark mod is installed — use '/spark tps' and '/spark profiler --timeout 30' to find the cause, '/spark health' for GC/MSPT. Biggest safe lever is lowering **simulation-distance** (ticking radius) in server.properties; view-distance affects bandwidth/render more than TPS. Common culprits: too-high sim/view distance, entity buildup (mob farms, item entities), chunk-gen during exploration (C2ME helps), hopper/redstone lag. Performance mods that preserve vanilla behavior: lithium (logic), ferritecore (memory), krypton (network), c2me (chunk gen/IO), noisium (worldgen), vmp (many players). Avoid behavior-changing mods unless asked.
- **JVM**: heap set via the memory field (-Xms=-Xmx, e.g. 6G). The panel applies Aikar's G1GC flags. Don't over-allocate — leave headroom for off-heap (Netty, BlueMap, mmap'd region files, OS page cache). On 24 GB total with another ~3 GB Paper server present, two big heaps can OOM.
- **Crashes / won't start**: read logs/latest.log and crash-reports/. Typical causes: (1) mod/plugin built for a different MC version (check the Mods tab conflicts; update or remove); (2) missing dependency — on Fabric install Fabric API; (3) Java version (major 69 → use Java 21); (4) OutOfMemory → raise heap or reduce mods/sim-distance; (5) port already in use → change port or stop the conflicting server; (6) eula not accepted (eula.txt must be eula=true — panel sets this); (7) wrong platform — a Fabric mod dropped into a Paper server's plugins/ (or vice-versa) won't load.
- **server.properties** notables: difficulty (peaceful/easy/normal/hard), gamemode, view-distance, simulation-distance, max-players, online-mode (false=offline/"cracked", a security risk — allows name spoofing), white-list + enforce-whitelist, pvp, hardcore, level-seed, level-name, motd, spawn-protection, sync-chunk-writes=false (async I/O, big win, no gameplay change), allow-flight.
- **Security**: this panel has no login (Tailscale-only). Keep online-mode=true for public/whitelisted servers to prevent impersonation; be deliberate about op/whitelist. Don't expose ports you don't intend to.
- **Ports**: MC ports must be free per server and opened in the host firewall + Oracle security list to be reachable publicly; over Tailscale they already work.`;

function fmtGB(b) { return (b / 1073741824).toFixed(1); }

// Read-only situational awareness injected into every request (no approval needed).
function buildContext(serverId) {
  const servers = cfg.load().servers.map((s) => {
    const st = mc.status(s.id);
    return `- ${s.id}: ${s.type === 'paper' ? 'Paper (plugins)' : 'Fabric (mods)'}, MC ${s.mcVersion}, port ${s.port}, heap ${s.memory || '(manual)'}, java ${s.java}, jar ${s.jar}, ${st.running ? 'RUNNING pid ' + st.pid + ' rss ' + fmtGB(st.rssBytes || 0) + 'GB' : 'stopped'}`;
  }).join('\n') || '(none)';
  const h = mc.getHostMetrics();
  let focus = '';
  if (serverId && mc.isRunning(serverId)) {
    const tail = mc.consoleBacklog(serverId, 3000).split('\n').filter(Boolean).slice(-15).join('\n');
    focus = `\n\nRecent console of ${serverId}:\n${tail}`;
  }
  return `Servers:\n${servers}\n\nHost: CPU ${h.cpuPct}%, RAM ${fmtGB(h.memUsedBytes)}/${fmtGB(h.memTotalBytes)}GB, ${h.cores} cores.${focus}`;
}

async function chat({ contents, serverId }) {
  const { apiKey, model } = loadSecrets();
  if (!apiKey) throw Object.assign(new Error('AI not configured (no DeepSeek API key)'), { status: 503 });
  if (!Array.isArray(contents)) throw Object.assign(new Error('contents[] required'), { status: 400 });
  // OpenAI/DeepSeek message format: system prompt + live state is prepended fresh each turn
  // (it isn't stored in the client's history), then the running conversation.
  const messages = [
    { role: 'system', content: SYSTEM_BASE + '\n\n## Live state\n' + buildContext(serverId) },
    ...contents,
  ];
  let res, data;
  try {
    res = await fetch(DEEPSEEK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model, messages, tools: OPENAI_TOOLS, tool_choice: 'auto', temperature: 0.4, max_tokens: 4096 }),
    });
    data = await res.json();
  } catch (e) {
    throw Object.assign(new Error('DeepSeek request failed: ' + e.message), { status: 502 });
  }
  if (!res.ok || data.error) {
    const msg = (data && data.error && (data.error.message || data.error)) || ('HTTP ' + res.status);
    if (res.status === 429) throw Object.assign(new Error('DeepSeek rate limit reached — wait a moment and try again.'), { status: 429 });
    if (res.status === 401) throw Object.assign(new Error('DeepSeek rejected the API key (401) — check panel/secrets.json.'), { status: 502 });
    if (res.status === 402) throw Object.assign(new Error('DeepSeek account has insufficient balance (402).'), { status: 502 });
    throw new Error('DeepSeek: ' + msg);
  }
  const choice = data.choices && data.choices[0];
  const message = (choice && choice.message) || { role: 'assistant', content: '' };
  const toolCalls = (message.tool_calls || []).map((tc) => {
    let args = {};
    try { args = JSON.parse((tc.function && tc.function.arguments) || '{}'); } catch {}
    return { id: tc.id, name: tc.function && tc.function.name, args };
  });
  return {
    message,               // echoed back verbatim into the conversation on the next turn
    text: message.content || '',
    toolCalls,
    finishReason: choice && choice.finish_reason,
  };
}

function runTerminal(command) {
  return new Promise((resolve) => {
    const child = spawn('bash', ['-lc', command], { cwd: cfg.BASE_DIR });
    let out = '', truncated = false;
    const onData = (d) => { if (out.length < 16384) out += d.toString(); else truncated = true; };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 60000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0, exitCode: code, output: (out || '(no output)') + (truncated ? '\n…(truncated)' : '') }); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, exitCode: -1, output: String(e.message) }); });
  });
}

// Execute an APPROVED action. Called only by /api/ai/execute after user verification.
async function execute(action) {
  const { name, args } = action || {};
  if (name === 'set_server_config') {
    const { serverId, ...patch } = args || {};
    if (!cfg.getServer(serverId)) throw Object.assign(new Error('no such server: ' + serverId), { status: 404 });
    const updated = cfg.updateServer(serverId, patch);
    if (patch.port !== undefined) cfg.setServerProperty(serverId, 'server-port', updated.port);
    return { ok: true, applied: patch, launchPreview: mc.launchPreview(updated), note: mc.isRunning(serverId) ? 'applies on next restart' : 'applies on next start' };
  }
  if (name === 'console_command') {
    const { serverId, command } = args || {};
    if (!cfg.getServer(serverId)) throw Object.assign(new Error('no such server: ' + serverId), { status: 404 });
    if (!mc.isRunning(serverId)) throw new Error(serverId + ' is not running');
    mc.sendCommand(serverId, command);
    await new Promise((r) => setTimeout(r, 900));
    const tail = mc.consoleBacklog(serverId, 2000).split('\n').filter(Boolean).slice(-8).join('\n');
    return { ok: true, sent: command, recentConsole: tail };
  }
  if (name === 'terminal_command') {
    if (!args || !args.command) throw Object.assign(new Error('command required'), { status: 400 });
    return await runTerminal(args.command);
  }
  if (name === 'server_lifecycle') {
    const { serverId, action } = args || {};
    const s = cfg.getServer(serverId);
    if (!s) throw Object.assign(new Error('no such server: ' + serverId), { status: 404 });
    if (action === 'start') await mc.start(s);
    else if (action === 'stop') await mc.stop(serverId);
    else if (action === 'restart') await mc.restart(s);
    else if (action === 'kill') await mc.kill(serverId);
    else throw Object.assign(new Error('bad action'), { status: 400 });
    return { ok: true, serverId, action, running: mc.isRunning(serverId) };
  }
  if (name === 'create_backup') {
    const { serverId } = args || {};
    if (!cfg.getServer(serverId)) throw Object.assign(new Error('no such server: ' + serverId), { status: 404 });
    const r = await backup.start(cfg.getServer(serverId), { compress: true });
    return { ok: true, serverId, startedBackup: r.name, note: 'backup running in background' };
  }
  if (name === 'install_mod') {
    const { serverId, slug, projectType } = args || {};
    const s = cfg.getServer(serverId);
    if (!s) throw Object.assign(new Error('no such server: ' + serverId), { status: 404 });
    return await fabric.installFromModrinth(serverId, { slug, projectType: projectType || (s.type === 'paper' ? 'plugin' : 'mod') });
  }
  throw Object.assign(new Error('unknown action: ' + name), { status: 400 });
}

module.exports = { isConfigured, loadSecrets, chat, execute };
