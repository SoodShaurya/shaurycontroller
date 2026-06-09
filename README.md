# shaurycontroller

I got tired of Crafty Controller for my two Minecraft servers, so I wrote my own panel. It's
deliberately small: Node + Express + a WebSocket, three vanilla JS/CSS/HTML files on the front end,
and `tmux` doing the actual process babysitting. No database, no build step, no login page. You point
it at a directory of servers and it gives you consoles, a file manager, backups, mod installs, and a
chat assistant that can poke at the host — all from one page.

It currently runs two Fabric servers and a Paper one. Fabric and Paper are both first-class; the panel
figures out which is which and behaves accordingly (mods vs plugins, the right folders, etc.).

## Running it

It's a normal Node app:

```bash
cd panel
npm install
node server.js        # listens on 0.0.0.0:8095
```

In practice I run it as a systemd unit (`shaurycontroller-panel`) so it comes back on boot and
restarts if it dies. Each game server lives in its own `tmux` session (`mc-<id>`), which means the
panel can restart without necessarily taking the servers down with it.

**One important thing:** there is no authentication. That's on purpose — the whole thing sits behind
Tailscale and the public internet is firewalled off port 8095. Do not expose it directly. If you want
it reachable from outside, put it behind a reverse proxy with real auth, or just SSH-tunnel in:

```bash
ssh -L 8095:localhost:8095 your-box   # then open http://localhost:8095
```

The sidebar shows the box's Tailscale and public IPs (click to copy), and each server lists its
connect address.

## What's in it

The obvious stuff first — every server gets a live **console** (streamed over the WebSocket, with
command history on ↑/↓), start/stop/restart/kill buttons, and live CPU/RAM/uptime/player-count. There's
an optional per-server crash watchdog that restarts a server if it dies unexpectedly, with a backoff so
it gives up instead of crash-looping forever.

The **file manager** is sandboxed to each server's directory — browse, edit, upload (with a progress
bar), download, rename, mkdir, delete. The editor is format-aware: `.properties` files open as a typed
form, JSON files open as a collapsible tree you can edit inline (or flip to raw text), and everything
else is plain text.

**Backups** are one click. They compress with `zstd` (gzip fallback), show you the destination path and
a live progress bar, and if the server's running they flush and pause autosave first so you don't get a
torn world. There's a marker file so autosave always gets turned back on, even if the panel restarts
mid-backup.

Creating a server lets you pick Fabric or Paper and a Minecraft version, and it pulls the right jar
(Fabric's launcher, or the latest stable Paper build, checksum-verified), assigns a free port, writes
`eula.txt` + `server.properties`, and drops in Aikar's GC flags. You can also drag a `world.zip` onto the
create dialog and it'll unpack it, find the `level.dat`, and wire it up as the world.

The **Mods** tab is a Modrinth browser that's platform-aware — it shows mods on Fabric servers and
plugins on Paper, installs them into the right folder, and refuses to install something that has no
build for your MC version or loader (rather than silently dropping a dead jar in there). Installed items
are listed up top with version-conflict flags and one-click updates.

The **Players** tab is a GUI player-data editor — no hand-editing `.dat` files. Pick a player, tweak
game mode / health / food / XP / position, and edit the inventory, armor, ender chest, and so on as a
slot grid. Item slots show real textures (3D-rendered blocks and all), and shulker boxes are clickable
to peek inside. It also resolves the IPs each player has connected from (parsed out of the logs) and can
sort the list by IP so you can spot alt accounts sharing an address. There's a whitelist/ban/pardon
panel too, with a quick-add dropdown of past players.

## The copilot

There's a floating assistant backed by DeepSeek. It can read your live server and host state and
*propose* actions — change a config, run a console command, run a shell command on the box, restart
something, take a backup, install a mod. The catch, and the whole point, is that **nothing runs until
you click Approve.** The chat endpoint only ever suggests; a separate approve→execute step is the only
thing that actually does anything. So it's useful for "why is tardcentral eating CPU" without handing an
LLM the keys to your server.

The API key lives in `secrets.json` (gitignored, chmod 600) and never touches the browser — all calls
go through the backend. Swap the model or key there (`deepseekApiKey` / `deepseekModel`, or the
`DEEPSEEK_API_KEY` env var) and restart.

## Performance notes

Runs on Java 21 (the Fabric loaders here choke on Java 25 with "Unsupported class file major version
69"). JVM flags are Aikar's G1GC set. The only behaviour-neutral mods I install for perf are the usual
suspects — Lithium, FerriteCore, Krypton, VMP, C2ME, Noisium, spark — nothing that changes gameplay or
redstone. `sync-chunk-writes=false` is set, which moves chunk writes off the main thread for a nice I/O
win and zero gameplay difference.

## Layout

```
panel/
├── server.js       # Express + WebSocket entrypoint
├── config.js       # paths, defaults, the servers.json registry
├── mc.js           # tmux process mgmt, console tail, /proc stats
├── files.js        # sandboxed file manager
├── backup.js       # tar | zstd backups with progress
├── fabric.js       # Fabric/Paper create + Modrinth client
├── paper.js        # PaperMC API
├── playerdata.js   # NBT player/inventory read+write, IP parsing
├── access.js       # whitelist / ban / pardon
├── ai.js           # the DeepSeek copilot (approval-gated)
└── public/         # index.html / app.js / style.css
```

`servers.json` is the registry — edit memory/flags/jar/java there and restart, or just use the UI.
`secrets.json`, `node_modules/`, `run/`, and logs are gitignored.

## Caveats

This was built for my setup and my taste. It assumes Linux, `tmux`, and a `java` (or several) on the
box, and it trusts whoever can reach it completely. It's not hardened for multi-tenant or public use.
If that's fine for you — behind Tailscale, on your own box — it's a pretty pleasant way to run a couple
of servers.
