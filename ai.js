'use strict';
// AI agent (Google Gemini, free tier) with human-in-the-loop tool use.
//
// SAFETY MODEL: chat() only ever PROPOSES actions (Gemini functionCalls); it never
// executes anything. execute() performs an action and is reachable ONLY via the
// /api/ai/execute route, which the frontend calls AFTER the user clicks Approve.
// So every config change / console command / terminal command is gated on explicit
// user verification — there is no code path where the model self-executes.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cfg = require('./config');
const mc = require('./mc');
const backup = require('./backup');
const fabric = require('./fabric');

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const SECRETS = path.join(__dirname, 'secrets.json');

function loadSecrets() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(SECRETS, 'utf8')); } catch {}
  return {
    apiKey: process.env.GEMINI_API_KEY || s.geminiApiKey || '',
    model: process.env.GEMINI_MODEL || s.geminiModel || 'gemini-2.5-flash',
  };
}
function isConfigured() { return !!loadSecrets().apiKey; }

// Tools the agent may PROPOSE. Each maps to an approval-gated action in execute().
const TOOLS = [{
  functionDeclarations: [
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
      description: 'Install a mod/plugin/datapack from Modrinth into a server (matched to its MC version + Fabric). Use the Modrinth project slug.',
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
  ],
}];

const SYSTEM_BASE = `You are the in-panel operations copilot for "shaurycontroller", a web panel that manages Fabric Minecraft servers on a Linux (aarch64) host.

You can act ONLY through these tools: set_server_config, console_command, terminal_command, server_lifecycle (start/stop/restart/kill), create_backup, install_mod (from Modrinth). IMPORTANT: every tool call you make is shown to the human and executed ONLY after they explicitly Approve it — so propose precise, minimal actions and briefly explain WHY before/with each call. Never claim an action is done until you receive its tool result. If the user just wants information, answer from the live state below without calling a tool. Keep replies concise. For terminal commands, prefer the least-privileged command that works and avoid destructive operations unless clearly asked.`;

function fmtGB(b) { return (b / 1073741824).toFixed(1); }

// Read-only situational awareness injected into every request (no approval needed).
function buildContext(serverId) {
  const servers = cfg.load().servers.map((s) => {
    const st = mc.status(s.id);
    return `- ${s.id}: MC ${s.mcVersion}, port ${s.port}, heap ${s.memory || '(manual)'}, java ${s.java}, jar ${s.jar}, ${st.running ? 'RUNNING pid ' + st.pid + ' rss ' + fmtGB(st.rssBytes || 0) + 'GB' : 'stopped'}`;
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
  if (!apiKey) throw Object.assign(new Error('AI not configured (no Gemini API key)'), { status: 503 });
  if (!Array.isArray(contents)) throw Object.assign(new Error('contents[] required'), { status: 400 });
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_BASE + '\n\n## Live state\n' + buildContext(serverId) }] },
    tools: TOOLS,
    contents,
    generationConfig: { temperature: 0.4 },
  };
  const res = await fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error('Gemini: ' + (data.error.message || res.status));
  const cand = data.candidates && data.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  return {
    modelParts: parts, // echoed back verbatim (preserves thoughtSignature) on the next turn
    text: parts.filter((p) => p.text).map((p) => p.text).join(''),
    functionCalls: parts.filter((p) => p.functionCall).map((p) => p.functionCall),
    finishReason: cand && cand.finishReason,
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
    return await fabric.installFromModrinth(serverId, { slug, projectType: projectType || 'mod', loader: 'fabric', gameVersion: s.mcVersion });
  }
  throw Object.assign(new Error('unknown action: ' + name), { status: 400 });
}

module.exports = { isConfigured, loadSecrets, chat, execute };
