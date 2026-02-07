/* ============================================================
   dTerm PWA - tools.js
   All 40 tool implementations (renderers, runners, helpers)
   ============================================================ */

// ── API Proxy ──────────────────────────────────────────────────
const TOOLS_API = 'https://mynetworktools.com/dterm/api/tools-proxy.php';

async function toolsProxy(tool, params) {
  const token = localStorage.getItem('dterm_token');
  try {
    const res = await fetch(TOOLS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, ...params, token })
    });
    return await res.json();
  } catch (e) {
    return { error: 'Network error: ' + e.message };
  }
}

// ── Monitor interval tracker ──────────────────────────────────
let toolMonitorInterval = null;

// ── Helpers ───────────────────────────────────────────────────
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // brief visual feedback could be added here
  }).catch(() => {});
}

// ── Tool Categories ───────────────────────────────────────────
const toolCategories = {
  'Network': [
    'Ping', 'Traceroute', 'DNS Lookup', 'Reverse DNS', 'Port Scanner',
    'IP Info', 'Whois', 'MAC Lookup', 'Subnet Calculator',
    'Ping Monitor', 'Uptime Monitor', 'Blacklist Check'
  ],
  'SSL / Security': [
    'SSL Checker', 'SSL Expiry', 'Security Headers',
    'Password Generator', 'Password Checker', 'Hash Generator'
  ],
  'Web / SEO': [
    'SEO Analyzer', 'Page Speed', 'Broken Links', 'HTTP Headers',
    'Open Graph', 'Meta Tags', 'Robots.txt', 'Sitemap Generator', 'Domain Expiry'
  ],
  'Developer': [
    'API Tester', 'JSON Formatter', 'Code Beautifier', 'Regex Tester',
    'Base64', 'JWT Decoder', 'Cron Parser', 'UUID Generator', 'Timestamp Converter'
  ],
  'Utilities': [
    'Markdown Preview', 'Lorem Ipsum', 'QR Generator', 'Color Picker'
  ]
};

// ── Category Icons ────────────────────────────────────────────
const categoryIcons = {
  'Network': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/></svg>',
  'SSL / Security': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  'Web / SEO': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  'Developer': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  'Utilities': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
};

// ── Render tools panel (category list) ────────────────────────
function renderToolsPanel(container) {
  let html = '';
  for (const [cat, tools] of Object.entries(toolCategories)) {
    const icon = categoryIcons[cat] || '';
    html += `<div class="tools-category">
      <div class="tools-category-header">${icon}<span>${escHtml(cat)}</span></div>
      <div class="tools-category-grid">`;
    for (const t of tools) {
      html += `<button class="tool-btn" onclick="openTool('${escHtml(t)}')">${escHtml(t)}</button>`;
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
}

function showToolsList() {
  if (toolMonitorInterval) { clearInterval(toolMonitorInterval); toolMonitorInterval = null; }
  const panel = document.getElementById('tools-panel');
  const content = document.getElementById('tools-content');
  if (panel) panel.style.display = 'flex';
  if (content) { content.style.display = 'none'; content.innerHTML = ''; }
}

// ── Open a specific tool ──────────────────────────────────────
function openTool(name) {
  if (toolMonitorInterval) { clearInterval(toolMonitorInterval); toolMonitorInterval = null; }
  const panel = document.getElementById('tools-panel');
  const content = document.getElementById('tools-content');
  const renderer = toolRenderers[name];
  if (renderer) {
    if (panel) panel.style.display = 'none';
    if (content) { content.style.display = 'flex'; content.innerHTML = renderer(name); }
  } else {
    if (panel) panel.style.display = 'none';
    if (content) {
      content.style.display = 'flex';
      content.innerHTML = `<div class="tool-view">
      <div class="tool-header"><button class="tool-back-btn" onclick="showToolsList()">&larr;</button><h3>${escHtml(name)}</h3></div>
      <div class="tool-output">Tool not implemented yet.</div></div>`;
    }
  }
}

// ── Back button + header helper ───────────────────────────────
function toolHeader(title) {
  return `<div class="tool-header"><button class="tool-back-btn" onclick="showToolsList()">&larr;</button><h3>${escHtml(title)}</h3></div>`;
}

// ── TOOL RENDERERS ────────────────────────────────────────────
const toolRenderers = {};

/* ====================== NETWORK ====================== */

// ── Ping ──
toolRenderers['Ping'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-ping-host" class="tool-input" placeholder="Host / IP" />
  <input id="t-ping-count" class="tool-input" style="width:60px" placeholder="4" value="4" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunPing()">Ping</button></div>
  <pre id="t-ping-out" class="tool-output" style="display:none"></pre></div>`;

// ── Traceroute ──
toolRenderers['Traceroute'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-trace-host" class="tool-input" placeholder="Host / IP" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunTraceroute()">Trace</button></div>
  <pre id="t-trace-out" class="tool-output" style="display:none"></pre></div>`;

// ── DNS Lookup ──
toolRenderers['DNS Lookup'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-dns-host" class="tool-input" placeholder="Domain" />
  <select id="t-dns-type" class="tool-input" style="width:80px"><option>A</option><option>AAAA</option><option>MX</option><option>NS</option><option>TXT</option><option>CNAME</option><option>SOA</option><option>ANY</option></select></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunDns()">Lookup</button></div>
  <pre id="t-dns-out" class="tool-output" style="display:none"></pre></div>`;

// ── Reverse DNS ──
toolRenderers['Reverse DNS'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-rdns-ip" class="tool-input" placeholder="IP Address" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunReverseDns()">Lookup</button></div>
  <pre id="t-rdns-out" class="tool-output" style="display:none"></pre></div>`;

// ── Port Scanner ──
toolRenderers['Port Scanner'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-port-host" class="tool-input" placeholder="Host / IP" />
  <input id="t-port-ports" class="tool-input" style="width:140px" placeholder="80,443,22 or 1-1024" value="21,22,25,53,80,110,143,443,993,995,3306,3389,5432,8080" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunPortScan()">Scan</button></div>
  <pre id="t-port-out" class="tool-output" style="display:none"></pre></div>`;

// ── IP Info ──
toolRenderers['IP Info'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-ipinfo-ip" class="tool-input" placeholder="IP Address (blank = your IP)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunIpInfo()">Lookup</button></div>
  <div id="t-ipinfo-out" class="tool-output" style="display:none"></div></div>`;

// ── Whois ──
toolRenderers['Whois'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-whois-domain" class="tool-input" placeholder="Domain" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunWhois()">Lookup</button></div>
  <pre id="t-whois-out" class="tool-output" style="display:none"></pre></div>`;

// ── MAC Lookup ──
toolRenderers['MAC Lookup'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-mac-addr" class="tool-input" placeholder="MAC Address (e.g. AA:BB:CC:DD:EE:FF)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunMacLookup()">Lookup</button></div>
  <pre id="t-mac-out" class="tool-output" style="display:none"></pre></div>`;

// ── Subnet Calculator ──
toolRenderers['Subnet Calculator'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-subnet-ip" class="tool-input" placeholder="IP Address (e.g. 192.168.1.0)" />
  <input id="t-subnet-cidr" class="tool-input" style="width:80px" placeholder="CIDR / Mask" value="24" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunSubnet()">Calculate</button></div>
  <div id="t-subnet-out" class="tool-output" style="display:none"></div></div>`;

// ── Ping Monitor ──
toolRenderers['Ping Monitor'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-pingmon-host" class="tool-input" placeholder="Host / IP" />
  <input id="t-pingmon-interval" class="tool-input" style="width:80px" placeholder="Sec" value="5" /></div>
  <div class="tool-row"><button id="t-pingmon-btn" class="tool-run-btn" onclick="toolRunPingMonitor()">Start</button></div>
  <pre id="t-pingmon-out" class="tool-output" style="display:none"></pre></div>`;

// ── Uptime Monitor ──
toolRenderers['Uptime Monitor'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-upmon-url" class="tool-input" placeholder="URL (https://...)" />
  <input id="t-upmon-interval" class="tool-input" style="width:80px" placeholder="Sec" value="30" /></div>
  <div class="tool-row"><button id="t-upmon-btn" class="tool-run-btn" onclick="toolRunUptimeMonitor()">Start</button></div>
  <pre id="t-upmon-out" class="tool-output" style="display:none"></pre></div>`;

// ── Blacklist Check ──
toolRenderers['Blacklist Check'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-bl-ip" class="tool-input" placeholder="IP Address" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunBlacklist()">Check</button></div>
  <pre id="t-bl-out" class="tool-output" style="display:none"></pre></div>`;

/* ====================== SSL / SECURITY ====================== */

// ── SSL Checker ──
toolRenderers['SSL Checker'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-sslchk-host" class="tool-input" placeholder="Domain" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunSslChecker()">Check</button></div>
  <div id="t-sslchk-out" class="tool-output" style="display:none"></div></div>`;

// ── SSL Expiry ──
toolRenderers['SSL Expiry'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-sslexp-host" class="tool-input" placeholder="Domain" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunSslExpiry()">Check</button></div>
  <div id="t-sslexp-out" class="tool-output" style="display:none"></div></div>`;

// ── Security Headers ──
toolRenderers['Security Headers'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-sechead-url" class="tool-input" placeholder="URL (https://...)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunSecHeaders()">Analyze</button></div>
  <div id="t-sechead-out" class="tool-output" style="display:none"></div></div>`;

// ── Password Generator ──
toolRenderers['Password Generator'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-pwgen-len" class="tool-input" style="width:60px" placeholder="Length" value="16" /></div>
  <div class="tool-row tool-checkboxes">
    <label><input type="checkbox" id="t-pwgen-upper" checked /> A-Z</label>
    <label><input type="checkbox" id="t-pwgen-lower" checked /> a-z</label>
    <label><input type="checkbox" id="t-pwgen-digits" checked /> 0-9</label>
    <label><input type="checkbox" id="t-pwgen-symbols" checked /> Symbols</label>
  </div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunPwGen()">Generate</button>
  <button class="tool-run-btn secondary" onclick="copyToClipboard(document.getElementById('t-pwgen-out').textContent)">Copy</button></div>
  <pre id="t-pwgen-out" class="tool-output" style="display:none"></pre></div>`;

// ── Password Checker ──
toolRenderers['Password Checker'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-pwchk-pw" class="tool-input" placeholder="Enter password to check" type="text" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunPwCheck()">Check</button></div>
  <div id="t-pwchk-out" class="tool-output" style="display:none"></div></div>`;

// ── Hash Generator ──
toolRenderers['Hash Generator'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><textarea id="t-hash-input" class="tool-textarea" placeholder="Text to hash" rows="3"></textarea></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunHash()">Hash</button></div>
  <div id="t-hash-out" class="tool-output" style="display:none"></div></div>`;

/* ====================== WEB / SEO ====================== */

// ── SEO Analyzer ──
toolRenderers['SEO Analyzer'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-seo-url" class="tool-input" placeholder="URL (https://...)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunSeo()">Analyze</button></div>
  <div id="t-seo-out" class="tool-output" style="display:none"></div></div>`;

// ── Page Speed ──
toolRenderers['Page Speed'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-speed-url" class="tool-input" placeholder="URL (https://...)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunPageSpeed()">Test</button></div>
  <div id="t-speed-out" class="tool-output" style="display:none"></div></div>`;

// ── Broken Links ──
toolRenderers['Broken Links'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-broken-url" class="tool-input" placeholder="URL (https://...)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunBrokenLinks()">Scan</button></div>
  <div id="t-broken-out" class="tool-output" style="display:none"></div></div>`;

// ── HTTP Headers ──
toolRenderers['HTTP Headers'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-httph-url" class="tool-input" placeholder="URL (https://...)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunHttpHeaders()">Fetch</button></div>
  <pre id="t-httph-out" class="tool-output" style="display:none"></pre></div>`;

// ── Open Graph ──
toolRenderers['Open Graph'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-og-url" class="tool-input" placeholder="URL (https://...)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunOpenGraph()">Fetch</button></div>
  <div id="t-og-out" class="tool-output" style="display:none"></div></div>`;

// ── Meta Tags ──
toolRenderers['Meta Tags'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-meta-url" class="tool-input" placeholder="URL (https://...)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunMetaTags()">Fetch</button></div>
  <div id="t-meta-out" class="tool-output" style="display:none"></div></div>`;

// ── Robots.txt ──
toolRenderers['Robots.txt'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-robots-domain" class="tool-input" placeholder="Domain" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunRobots()">Fetch</button></div>
  <pre id="t-robots-out" class="tool-output" style="display:none"></pre></div>`;

// ── Sitemap Generator ──
toolRenderers['Sitemap Generator'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-sitemap-url" class="tool-input" placeholder="URL (https://...)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunSitemap()">Generate</button></div>
  <pre id="t-sitemap-out" class="tool-output" style="display:none"></pre></div>`;

// ── Domain Expiry ──
toolRenderers['Domain Expiry'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-domexp-domain" class="tool-input" placeholder="Domain" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunDomainExpiry()">Check</button></div>
  <div id="t-domexp-out" class="tool-output" style="display:none"></div></div>`;

/* ====================== DEVELOPER ====================== */

// ── API Tester ──
toolRenderers['API Tester'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row">
    <select id="t-api-method" class="tool-input" style="width:90px"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option><option>OPTIONS</option></select>
    <input id="t-api-url" class="tool-input" placeholder="URL" />
  </div>
  <div class="tool-row"><textarea id="t-api-headers" class="tool-textarea" placeholder="Headers (JSON)" rows="2">{"Content-Type":"application/json"}</textarea></div>
  <div class="tool-row"><textarea id="t-api-body" class="tool-textarea" placeholder="Body (JSON)" rows="3"></textarea></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunApi()">Send</button></div>
  <div id="t-api-status" class="tool-row" style="display:none"></div>
  <pre id="t-api-out" class="tool-output" style="display:none"></pre></div>`;

// ── JSON Formatter ──
toolRenderers['JSON Formatter'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><textarea id="t-json-input" class="tool-textarea" placeholder="Paste JSON here" rows="6"></textarea></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunJsonFormat()">Format</button>
  <button class="tool-run-btn secondary" onclick="toolJsonMinify()">Minify</button>
  <button class="tool-run-btn secondary" onclick="copyToClipboard(document.getElementById('t-json-out').textContent)">Copy</button></div>
  <pre id="t-json-out" class="tool-output" style="display:none"></pre></div>`;

// ── Code Beautifier ──
toolRenderers['Code Beautifier'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><textarea id="t-beautify-input" class="tool-textarea" placeholder="Paste code (JSON, HTML, XML)" rows="6"></textarea></div>
  <div class="tool-row"><select id="t-beautify-indent" class="tool-input" style="width:100px">
    <option value="2">2 Spaces</option><option value="4">4 Spaces</option><option value="tab">Tab</option></select>
  <button class="tool-run-btn" onclick="toolRunBeautify()">Beautify</button>
  <button class="tool-run-btn secondary" onclick="copyToClipboard(document.getElementById('t-beautify-out').textContent)">Copy</button></div>
  <pre id="t-beautify-out" class="tool-output" style="display:none"></pre></div>`;

// ── Regex Tester ──
toolRenderers['Regex Tester'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-regex-pattern" class="tool-input" placeholder="Regex pattern" />
  <input id="t-regex-flags" class="tool-input" style="width:60px" placeholder="Flags" value="g" /></div>
  <div class="tool-row"><textarea id="t-regex-input" class="tool-textarea" placeholder="Test string" rows="4"></textarea></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunRegex()">Test</button></div>
  <div id="t-regex-out" class="tool-output" style="display:none"></div></div>`;

// ── Base64 ──
toolRenderers['Base64'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><textarea id="t-b64-input" class="tool-textarea" placeholder="Text to encode / decode" rows="4"></textarea></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunBase64('encode')">Encode</button>
  <button class="tool-run-btn secondary" onclick="toolRunBase64('decode')">Decode</button>
  <button class="tool-run-btn secondary" onclick="copyToClipboard(document.getElementById('t-b64-out').textContent)">Copy</button></div>
  <pre id="t-b64-out" class="tool-output" style="display:none"></pre></div>`;

// ── JWT Decoder ──
toolRenderers['JWT Decoder'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><textarea id="t-jwt-input" class="tool-textarea" placeholder="Paste JWT token" rows="3"></textarea></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunJwt()">Decode</button></div>
  <div id="t-jwt-out" class="tool-output" style="display:none"></div></div>`;

// ── Cron Parser ──
toolRenderers['Cron Parser'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-cron-expr" class="tool-input" placeholder="Cron expression (e.g. */5 * * * *)" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunCron()">Parse</button></div>
  <div id="t-cron-out" class="tool-output" style="display:none"></div></div>`;

// ── UUID Generator ──
toolRenderers['UUID Generator'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-uuid-count" class="tool-input" style="width:60px" placeholder="Count" value="1" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunUuid()">Generate</button>
  <button class="tool-run-btn secondary" onclick="copyToClipboard(document.getElementById('t-uuid-out').textContent)">Copy</button></div>
  <pre id="t-uuid-out" class="tool-output" style="display:none"></pre></div>`;

// ── Timestamp Converter ──
toolRenderers['Timestamp Converter'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-ts-input" class="tool-input" placeholder="Unix timestamp or date string" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunTimestamp()">Convert</button>
  <button class="tool-run-btn secondary" onclick="toolRunTimestampNow()">Now</button></div>
  <div id="t-ts-out" class="tool-output" style="display:none"></div></div>`;

/* ====================== UTILITIES ====================== */

// ── Markdown Preview ──
toolRenderers['Markdown Preview'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><textarea id="t-md-input" class="tool-textarea" placeholder="Enter Markdown" rows="8"></textarea></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunMarkdown()">Preview</button></div>
  <div id="t-md-out" class="tool-output md-preview" style="display:none"></div></div>`;

// ── Lorem Ipsum ──
toolRenderers['Lorem Ipsum'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-lorem-count" class="tool-input" style="width:60px" placeholder="Count" value="3" />
  <select id="t-lorem-type" class="tool-input" style="width:120px"><option value="paragraphs">Paragraphs</option><option value="sentences">Sentences</option><option value="words">Words</option></select></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunLorem()">Generate</button>
  <button class="tool-run-btn secondary" onclick="copyToClipboard(document.getElementById('t-lorem-out').textContent)">Copy</button></div>
  <pre id="t-lorem-out" class="tool-output" style="display:none;white-space:pre-wrap"></pre></div>`;

// ── QR Generator ──
toolRenderers['QR Generator'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-qr-text" class="tool-input" placeholder="Text or URL" /></div>
  <div class="tool-row"><select id="t-qr-size" class="tool-input" style="width:100px"><option value="200">200x200</option><option value="300" selected>300x300</option><option value="400">400x400</option><option value="500">500x500</option></select>
  <button class="tool-run-btn" onclick="toolRunQr()">Generate</button></div>
  <div id="t-qr-out" class="tool-output" style="display:none;text-align:center"></div></div>`;

// ── Color Picker ──
toolRenderers['Color Picker'] = (name) => `<div class="tool-view">${toolHeader(name)}
  <div class="tool-row"><input id="t-color-input" class="tool-input" placeholder="#ff6600 or rgb(255,102,0) or hsl(24,100%,50%)" value="#ff6600" />
  <input type="color" id="t-color-picker" value="#ff6600" onchange="document.getElementById('t-color-input').value=this.value;toolRunColor()" style="width:40px;height:32px;padding:0;border:none;cursor:pointer" /></div>
  <div class="tool-row"><button class="tool-run-btn" onclick="toolRunColor()">Convert</button></div>
  <div id="t-color-out" class="tool-output" style="display:none"></div></div>`;


/* ============================================================
   TOOL RUN FUNCTIONS
   ============================================================ */

/* ====================== NETWORK RUNNERS ====================== */

// ── Ping ──
async function toolRunPing() {
  const host = document.getElementById('t-ping-host').value.trim();
  const count = document.getElementById('t-ping-count').value || '4';
  if (!host) return;
  const out = document.getElementById('t-ping-out');
  out.style.display = 'block'; out.textContent = 'Pinging...';
  const r = await toolsProxy('ping', { host, count: parseInt(count) });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── Traceroute ──
async function toolRunTraceroute() {
  const host = document.getElementById('t-trace-host').value.trim();
  if (!host) return;
  const out = document.getElementById('t-trace-out');
  out.style.display = 'block'; out.textContent = 'Tracing route...';
  const r = await toolsProxy('traceroute', { host });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── DNS Lookup ──
async function toolRunDns() {
  const host = document.getElementById('t-dns-host').value.trim();
  const type = document.getElementById('t-dns-type').value;
  if (!host) return;
  const out = document.getElementById('t-dns-out');
  out.style.display = 'block'; out.textContent = 'Looking up...';
  const r = await toolsProxy('dns', { host, type });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── Reverse DNS ──
async function toolRunReverseDns() {
  const ip = document.getElementById('t-rdns-ip').value.trim();
  if (!ip) return;
  const out = document.getElementById('t-rdns-out');
  out.style.display = 'block'; out.textContent = 'Looking up...';
  const r = await toolsProxy('reversedns', { ip });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── Port Scanner ──
async function toolRunPortScan() {
  const host = document.getElementById('t-port-host').value.trim();
  const ports = document.getElementById('t-port-ports').value.trim();
  if (!host) return;
  const out = document.getElementById('t-port-out');
  out.style.display = 'block'; out.textContent = 'Scanning ports...';
  const r = await toolsProxy('portscan', { host, ports });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── IP Info ──
async function toolRunIpInfo() {
  const ip = document.getElementById('t-ipinfo-ip').value.trim();
  const out = document.getElementById('t-ipinfo-out');
  out.style.display = 'block'; out.innerHTML = 'Loading...';
  const r = await toolsProxy('ipinfo', { ip: ip || '' });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  const data = r.data || r;
  if (typeof data === 'object' && !Array.isArray(data)) {
    let html = '<table class="tool-result-table">';
    for (const [k, v] of Object.entries(data)) {
      if (k === 'error' || k === 'output') continue;
      html += `<tr><td>${escHtml(String(k))}</td><td>${escHtml(String(v))}</td></tr>`;
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.textContent = r.output || JSON.stringify(data, null, 2);
  }
}

// ── Whois ──
async function toolRunWhois() {
  const domain = document.getElementById('t-whois-domain').value.trim();
  if (!domain) return;
  const out = document.getElementById('t-whois-out');
  out.style.display = 'block'; out.textContent = 'Looking up...';
  const r = await toolsProxy('whois', { domain });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── MAC Lookup ──
async function toolRunMacLookup() {
  const mac = document.getElementById('t-mac-addr').value.trim();
  if (!mac) return;
  const out = document.getElementById('t-mac-out');
  out.style.display = 'block'; out.textContent = 'Looking up...';
  const r = await toolsProxy('maclookup', { mac });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── Subnet Calculator (client-side) ──
function toolRunSubnet() {
  const ipStr = document.getElementById('t-subnet-ip').value.trim();
  const cidrStr = document.getElementById('t-subnet-cidr').value.trim();
  if (!ipStr) return;
  const out = document.getElementById('t-subnet-out');
  out.style.display = 'block';
  let cidr = parseInt(cidrStr);
  if (cidrStr.includes('.')) {
    const parts = cidrStr.split('.').map(Number);
    cidr = parts.reduce((a, b) => a + (b >>> 0).toString(2).split('1').length - 1, 0);
  }
  if (isNaN(cidr) || cidr < 0 || cidr > 32) {
    out.innerHTML = '<div class="tool-status fail">Invalid CIDR</div>';
    return;
  }
  const ip = ipStr.split('.').map(Number);
  const ipNum = (ip[0] << 24 | ip[1] << 16 | ip[2] << 8 | ip[3]) >>> 0;
  const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
  const network = (ipNum & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  const firstHost = (network + 1) >>> 0;
  const lastHost = (broadcast - 1) >>> 0;
  const hosts = cidr <= 30 ? Math.pow(2, 32 - cidr) - 2 : (cidr === 31 ? 2 : 1);
  const toIp = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const toMask = c => { const m = c === 0 ? 0 : (0xFFFFFFFF << (32 - c)) >>> 0; return toIp(m); };
  out.innerHTML = `<table class="tool-result-table">
    <tr><td>Network</td><td>${toIp(network)}/${cidr}</td></tr>
    <tr><td>Netmask</td><td>${toMask(cidr)}</td></tr>
    <tr><td>Wildcard</td><td>${toIp(~mask >>> 0)}</td></tr>
    <tr><td>Broadcast</td><td>${toIp(broadcast)}</td></tr>
    <tr><td>First Host</td><td>${toIp(firstHost)}</td></tr>
    <tr><td>Last Host</td><td>${toIp(lastHost)}</td></tr>
    <tr><td>Usable Hosts</td><td>${hosts.toLocaleString()}</td></tr>
    <tr><td>IP Class</td><td>${ip[0] < 128 ? 'A' : ip[0] < 192 ? 'B' : ip[0] < 224 ? 'C' : ip[0] < 240 ? 'D' : 'E'}</td></tr></table>`;
}

// ── Ping Monitor ──
async function toolRunPingMonitor() {
  const btn = document.getElementById('t-pingmon-btn');
  const out = document.getElementById('t-pingmon-out');
  out.style.display = 'block';

  if (toolMonitorInterval) {
    clearInterval(toolMonitorInterval);
    toolMonitorInterval = null;
    btn.textContent = 'Start';
    return;
  }

  const host = document.getElementById('t-pingmon-host').value.trim();
  const interval = (parseInt(document.getElementById('t-pingmon-interval').value) || 5) * 1000;
  if (!host) return;

  btn.textContent = 'Stop';
  out.textContent = '';
  let count = 0;

  const doPing = async () => {
    count++;
    const ts = new Date().toLocaleTimeString();
    const r = await toolsProxy('ping', { host, count: 1 });
    const line = r.output ? r.output.trim().split('\n').pop() : (r.error || 'No response');
    out.textContent += `[${ts}] #${count}: ${line}\n`;
    out.scrollTop = out.scrollHeight;
  };

  await doPing();
  toolMonitorInterval = setInterval(doPing, interval);
}

// ── Uptime Monitor ──
async function toolRunUptimeMonitor() {
  const btn = document.getElementById('t-upmon-btn');
  const out = document.getElementById('t-upmon-out');
  out.style.display = 'block';

  if (toolMonitorInterval) {
    clearInterval(toolMonitorInterval);
    toolMonitorInterval = null;
    btn.textContent = 'Start';
    return;
  }

  const url = document.getElementById('t-upmon-url').value.trim();
  const interval = (parseInt(document.getElementById('t-upmon-interval').value) || 30) * 1000;
  if (!url) return;

  btn.textContent = 'Stop';
  out.textContent = '';
  let count = 0;

  const doCheck = async () => {
    count++;
    const ts = new Date().toLocaleTimeString();
    const r = await toolsProxy('uptime', { url });
    const status = r.status || r.error || 'Unknown';
    const time = r.time ? ` (${r.time}ms)` : '';
    out.textContent += `[${ts}] #${count}: ${status}${time}\n`;
    out.scrollTop = out.scrollHeight;
  };

  await doCheck();
  toolMonitorInterval = setInterval(doCheck, interval);
}

// ── Blacklist Check ──
async function toolRunBlacklist() {
  const ip = document.getElementById('t-bl-ip').value.trim();
  if (!ip) return;
  const out = document.getElementById('t-bl-out');
  out.style.display = 'block'; out.textContent = 'Checking blacklists...';
  const r = await toolsProxy('blacklist', { ip });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}


/* ====================== SSL / SECURITY RUNNERS ====================== */

// ── SSL Checker ──
async function toolRunSslChecker() {
  const host = document.getElementById('t-sslchk-host').value.trim();
  if (!host) return;
  const out = document.getElementById('t-sslchk-out');
  out.style.display = 'block'; out.innerHTML = 'Checking SSL...';
  const r = await toolsProxy('sslchecker', { host });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  if (r.data && typeof r.data === 'object') {
    let html = '<table class="tool-result-table">';
    for (const [k, v] of Object.entries(r.data)) {
      html += `<tr><td>${escHtml(String(k))}</td><td>${escHtml(String(v))}</td></tr>`;
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.innerHTML = `<pre>${escHtml(r.output || JSON.stringify(r, null, 2))}</pre>`;
  }
}

// ── SSL Expiry ──
async function toolRunSslExpiry() {
  const host = document.getElementById('t-sslexp-host').value.trim();
  if (!host) return;
  const out = document.getElementById('t-sslexp-out');
  out.style.display = 'block'; out.innerHTML = 'Checking...';
  const r = await toolsProxy('sslexpiry', { host });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  if (r.data && typeof r.data === 'object') {
    let html = '<table class="tool-result-table">';
    for (const [k, v] of Object.entries(r.data)) {
      const cls = k.toLowerCase().includes('days') ? (parseInt(v) < 30 ? 'warn' : 'ok') : '';
      html += `<tr><td>${escHtml(String(k))}</td><td class="${cls ? 'tool-status ' + cls : ''}">${escHtml(String(v))}</td></tr>`;
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.innerHTML = `<pre>${escHtml(r.output || JSON.stringify(r, null, 2))}</pre>`;
  }
}

// ── Security Headers ──
async function toolRunSecHeaders() {
  const url = document.getElementById('t-sechead-url').value.trim();
  if (!url) return;
  const out = document.getElementById('t-sechead-out');
  out.style.display = 'block'; out.innerHTML = 'Analyzing...';
  const r = await toolsProxy('securityheaders', { url });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  if (r.data && typeof r.data === 'object') {
    const desired = [
      'Strict-Transport-Security', 'Content-Security-Policy', 'X-Content-Type-Options',
      'X-Frame-Options', 'X-XSS-Protection', 'Referrer-Policy', 'Permissions-Policy'
    ];
    let html = '<table class="tool-result-table">';
    for (const h of desired) {
      const val = r.data[h] || r.data[h.toLowerCase()];
      const cls = val ? 'ok' : 'fail';
      html += `<tr><td>${escHtml(h)}</td><td class="tool-status ${cls}">${val ? escHtml(String(val)) : 'Missing'}</td></tr>`;
    }
    // Show any extra headers from response
    for (const [k, v] of Object.entries(r.data)) {
      if (!desired.includes(k) && !desired.map(d => d.toLowerCase()).includes(k.toLowerCase())) {
        html += `<tr><td>${escHtml(String(k))}</td><td>${escHtml(String(v))}</td></tr>`;
      }
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.innerHTML = `<pre>${escHtml(r.output || JSON.stringify(r, null, 2))}</pre>`;
  }
}

// ── Password Generator (client-side) ──
function toolRunPwGen() {
  const len = parseInt(document.getElementById('t-pwgen-len').value) || 16;
  let chars = '';
  if (document.getElementById('t-pwgen-upper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (document.getElementById('t-pwgen-lower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (document.getElementById('t-pwgen-digits').checked) chars += '0123456789';
  if (document.getElementById('t-pwgen-symbols').checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let pw = '';
  for (let i = 0; i < len; i++) pw += chars[arr[i] % chars.length];
  const out = document.getElementById('t-pwgen-out');
  out.style.display = 'block';
  out.textContent = pw;
}

// ── Password Checker (client-side) ──
function toolRunPwCheck() {
  const pw = document.getElementById('t-pwchk-pw').value;
  const out = document.getElementById('t-pwchk-out');
  out.style.display = 'block';
  if (!pw) { out.innerHTML = ''; return; }
  const len = pw.length;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  let pool = 0;
  if (hasUpper) pool += 26;
  if (hasLower) pool += 26;
  if (hasDigit) pool += 10;
  if (hasSymbol) pool += 32;
  const entropy = Math.floor(len * Math.log2(pool || 1));
  let strength = 'Weak', cls = 'fail';
  if (entropy >= 60) { strength = 'Moderate'; cls = 'warn'; }
  if (entropy >= 80) { strength = 'Strong'; cls = 'ok'; }
  if (entropy >= 100) { strength = 'Very Strong'; cls = 'ok'; }
  out.innerHTML = `<table class="tool-result-table">
    <tr><td>Length</td><td>${len}</td></tr>
    <tr><td>Uppercase</td><td>${hasUpper ? '\u2713' : '\u2717'}</td></tr>
    <tr><td>Lowercase</td><td>${hasLower ? '\u2713' : '\u2717'}</td></tr>
    <tr><td>Digits</td><td>${hasDigit ? '\u2713' : '\u2717'}</td></tr>
    <tr><td>Symbols</td><td>${hasSymbol ? '\u2713' : '\u2717'}</td></tr>
    <tr><td>Entropy</td><td>${entropy} bits</td></tr>
    <tr><td>Strength</td><td class="tool-status ${cls}">${strength}</td></tr></table>`;
}

// ── Hash Generator (client-side with JS MD5) ──
async function toolRunHash() {
  const input = document.getElementById('t-hash-input').value;
  const out = document.getElementById('t-hash-out');
  out.style.display = 'block';
  if (!input) { out.innerHTML = ''; return; }
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const algos = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
  let html = '<table class="tool-result-table">';
  // MD5 in pure JS
  const md5hex = md5(input);
  html += `<tr><td>MD5</td><td style="word-break:break-all;">${md5hex}</td></tr>`;
  for (const algo of algos) {
    const hash = await crypto.subtle.digest(algo, data);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    html += `<tr><td>${algo}</td><td style="word-break:break-all;">${hex}</td></tr>`;
  }
  html += '</table>';
  out.innerHTML = html;
}

// ── Minimal MD5 implementation (pure JS) ──
function md5(string) {
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);  d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);   b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);   d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);  b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);   d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);      b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);  d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);   d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);  b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);   d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);  b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);  b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);      d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);  d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);  b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);   d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);  b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);   d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);  b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);   d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);  d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);   d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);  b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);   d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);   b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }
  function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  function rhex(n) {
    const hc = '0123456789abcdef';
    let s = '';
    for (let j = 0; j < 4; j++) s += hc.charAt((n >> (j * 8 + 4)) & 0x0F) + hc.charAt((n >> (j * 8)) & 0x0F);
    return s;
  }
  function hex(x) { for (let i = 0; i < x.length; i++) x[i] = rhex(x[i]); return x.join(''); }
  function md5str(s) {
    const n = s.length;
    let state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  return hex(md5str(string));
}


/* ====================== WEB / SEO RUNNERS ====================== */

// ── SEO Analyzer ──
async function toolRunSeo() {
  const url = document.getElementById('t-seo-url').value.trim();
  if (!url) return;
  const out = document.getElementById('t-seo-out');
  out.style.display = 'block'; out.innerHTML = 'Analyzing...';
  const r = await toolsProxy('seo', { url });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  // If proxy returns parsed data
  if (r.data && typeof r.data === 'object') {
    let html = '<table class="tool-result-table">';
    for (const [k, v] of Object.entries(r.data)) {
      html += `<tr><td>${escHtml(String(k))}</td><td>${escHtml(String(v))}</td></tr>`;
    }
    html += '</table>';
    out.innerHTML = html;
    return;
  }
  // If proxy returns raw HTML, parse it client-side
  const htmlContent = r.html || r.output || '';
  if (!htmlContent) { out.innerHTML = '<div class="tool-status fail">No data returned</div>'; return; }
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const title = doc.querySelector('title')?.textContent || 'N/A';
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || 'N/A';
  const metaKw = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || 'N/A';
  const h1s = doc.querySelectorAll('h1');
  const h2s = doc.querySelectorAll('h2');
  const imgs = doc.querySelectorAll('img');
  const imgsNoAlt = Array.from(imgs).filter(i => !i.getAttribute('alt')).length;
  const links = doc.querySelectorAll('a[href]');
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || 'N/A';
  const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || 'N/A';
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 'N/A';

  let seoHtml = '<table class="tool-result-table">';
  seoHtml += `<tr><td>Title</td><td>${escHtml(title)} (${title.length} chars)</td></tr>`;
  seoHtml += `<tr><td>Description</td><td>${escHtml(metaDesc.substring(0, 160))} (${metaDesc.length} chars)</td></tr>`;
  seoHtml += `<tr><td>Keywords</td><td>${escHtml(metaKw.substring(0, 160))}</td></tr>`;
  seoHtml += `<tr><td>H1 Tags</td><td>${h1s.length}</td></tr>`;
  seoHtml += `<tr><td>H2 Tags</td><td>${h2s.length}</td></tr>`;
  seoHtml += `<tr><td>Images</td><td>${imgs.length} (${imgsNoAlt} without alt)</td></tr>`;
  seoHtml += `<tr><td>Links</td><td>${links.length}</td></tr>`;
  seoHtml += `<tr><td>Canonical</td><td>${escHtml(canonical)}</td></tr>`;
  seoHtml += `<tr><td>Viewport</td><td class="tool-status ${viewport !== 'N/A' ? 'ok' : 'fail'}">${viewport !== 'N/A' ? 'Set' : 'Missing'}</td></tr>`;
  seoHtml += `<tr><td>OG Title</td><td>${escHtml(ogTitle)}</td></tr>`;
  seoHtml += '</table>';
  out.innerHTML = seoHtml;
}

// ── Page Speed ──
async function toolRunPageSpeed() {
  const url = document.getElementById('t-speed-url').value.trim();
  if (!url) return;
  const out = document.getElementById('t-speed-out');
  out.style.display = 'block'; out.innerHTML = 'Testing (this may take a moment)...';
  const r = await toolsProxy('pagespeed', { url });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  if (r.data && typeof r.data === 'object') {
    let html = '<table class="tool-result-table">';
    for (const [k, v] of Object.entries(r.data)) {
      html += `<tr><td>${escHtml(String(k))}</td><td>${escHtml(String(v))}</td></tr>`;
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.innerHTML = `<pre>${escHtml(r.output || JSON.stringify(r, null, 2))}</pre>`;
  }
}

// ── Broken Links ──
async function toolRunBrokenLinks() {
  const url = document.getElementById('t-broken-url').value.trim();
  if (!url) return;
  const out = document.getElementById('t-broken-out');
  out.style.display = 'block'; out.innerHTML = 'Scanning links (this may take a moment)...';
  const r = await toolsProxy('brokenlinks', { url });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  if (r.data && Array.isArray(r.data)) {
    if (r.data.length === 0) {
      out.innerHTML = '<div class="tool-status ok">No broken links found!</div>';
      return;
    }
    let html = '<table class="tool-result-table"><tr><th>URL</th><th>Status</th></tr>';
    for (const link of r.data) {
      const cls = link.status >= 400 ? 'fail' : (link.status >= 300 ? 'warn' : 'ok');
      html += `<tr><td style="word-break:break-all;">${escHtml(String(link.url))}</td><td class="tool-status ${cls}">${escHtml(String(link.status))}</td></tr>`;
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.innerHTML = `<pre>${escHtml(r.output || JSON.stringify(r, null, 2))}</pre>`;
  }
}

// ── HTTP Headers ──
async function toolRunHttpHeaders() {
  const url = document.getElementById('t-httph-url').value.trim();
  if (!url) return;
  const out = document.getElementById('t-httph-out');
  out.style.display = 'block'; out.textContent = 'Fetching...';
  const r = await toolsProxy('httpheaders', { url });
  if (r.error) {
    out.textContent = r.error;
    out.classList.add('error');
    return;
  }
  out.classList.remove('error');
  if (r.data && typeof r.data === 'object') {
    let text = '';
    for (const [k, v] of Object.entries(r.data)) {
      text += `${k}: ${v}\n`;
    }
    out.textContent = text;
  } else {
    out.textContent = r.output || JSON.stringify(r, null, 2);
  }
}

// ── Open Graph ──
async function toolRunOpenGraph() {
  const url = document.getElementById('t-og-url').value.trim();
  if (!url) return;
  const out = document.getElementById('t-og-out');
  out.style.display = 'block'; out.innerHTML = 'Fetching...';
  const r = await toolsProxy('opengraph', { url });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  if (r.data && typeof r.data === 'object') {
    let html = '<table class="tool-result-table">';
    for (const [k, v] of Object.entries(r.data)) {
      if (k === 'og:image' || k === 'image') {
        html += `<tr><td>${escHtml(k)}</td><td><img src="${escHtml(String(v))}" style="max-width:200px;max-height:120px" /><br/>${escHtml(String(v))}</td></tr>`;
      } else {
        html += `<tr><td>${escHtml(String(k))}</td><td>${escHtml(String(v))}</td></tr>`;
      }
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.innerHTML = `<pre>${escHtml(r.output || JSON.stringify(r, null, 2))}</pre>`;
  }
}

// ── Meta Tags ──
async function toolRunMetaTags() {
  const url = document.getElementById('t-meta-url').value.trim();
  if (!url) return;
  const out = document.getElementById('t-meta-out');
  out.style.display = 'block'; out.innerHTML = 'Fetching...';
  const r = await toolsProxy('metatags', { url });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  if (r.data && typeof r.data === 'object') {
    let html = '<table class="tool-result-table">';
    for (const [k, v] of Object.entries(r.data)) {
      html += `<tr><td>${escHtml(String(k))}</td><td>${escHtml(String(v))}</td></tr>`;
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.innerHTML = `<pre>${escHtml(r.output || JSON.stringify(r, null, 2))}</pre>`;
  }
}

// ── Robots.txt ──
async function toolRunRobots() {
  const domain = document.getElementById('t-robots-domain').value.trim();
  if (!domain) return;
  const out = document.getElementById('t-robots-out');
  out.style.display = 'block'; out.textContent = 'Fetching...';
  const r = await toolsProxy('robots', { domain });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── Sitemap Generator ──
async function toolRunSitemap() {
  const url = document.getElementById('t-sitemap-url').value.trim();
  if (!url) return;
  const out = document.getElementById('t-sitemap-out');
  out.style.display = 'block'; out.textContent = 'Generating (this may take a moment)...';
  const r = await toolsProxy('sitemap', { url });
  out.textContent = r.output || r.error || 'No response';
  if (r.error) out.classList.add('error'); else out.classList.remove('error');
}

// ── Domain Expiry ──
async function toolRunDomainExpiry() {
  const domain = document.getElementById('t-domexp-domain').value.trim();
  if (!domain) return;
  const out = document.getElementById('t-domexp-out');
  out.style.display = 'block'; out.innerHTML = 'Checking...';
  const r = await toolsProxy('domainexpiry', { domain });
  if (r.error) {
    out.innerHTML = `<div class="tool-status fail">${escHtml(r.error)}</div>`;
    return;
  }
  if (r.data && typeof r.data === 'object') {
    let html = '<table class="tool-result-table">';
    for (const [k, v] of Object.entries(r.data)) {
      const cls = k.toLowerCase().includes('days') ? (parseInt(v) < 30 ? 'fail' : parseInt(v) < 90 ? 'warn' : 'ok') : '';
      html += `<tr><td>${escHtml(String(k))}</td><td class="${cls ? 'tool-status ' + cls : ''}">${escHtml(String(v))}</td></tr>`;
    }
    html += '</table>';
    out.innerHTML = html;
  } else {
    out.innerHTML = `<pre>${escHtml(r.output || JSON.stringify(r, null, 2))}</pre>`;
  }
}


/* ====================== DEVELOPER RUNNERS ====================== */

// ── API Tester (proxy) ──
async function toolRunApi() {
  const method = document.getElementById('t-api-method').value;
  const url = document.getElementById('t-api-url').value.trim();
  const headersRaw = document.getElementById('t-api-headers').value.trim();
  const bodyRaw = document.getElementById('t-api-body').value.trim();
  if (!url) return;

  const statusEl = document.getElementById('t-api-status');
  const out = document.getElementById('t-api-out');
  statusEl.style.display = 'block'; statusEl.innerHTML = 'Sending...';
  out.style.display = 'block'; out.textContent = '';

  let headers = {};
  try { if (headersRaw) headers = JSON.parse(headersRaw); } catch (e) {
    out.textContent = 'Invalid headers JSON: ' + e.message;
    out.classList.add('error');
    statusEl.style.display = 'none';
    return;
  }

  const r = await toolsProxy('api', { method, url, headers, body: bodyRaw });
  if (r.error) {
    statusEl.innerHTML = `<span class="tool-status fail">Error</span>`;
    out.textContent = r.error;
    out.classList.add('error');
    return;
  }

  const status = r.status || '';
  const cls = status >= 200 && status < 300 ? 'ok' : status >= 400 ? 'fail' : 'warn';
  const time = r.time ? ` (${r.time}ms)` : '';
  statusEl.innerHTML = `<span class="tool-status ${cls}">Status: ${status}${time}</span>`;

  let responseBody = r.body || r.output || '';
  try {
    responseBody = JSON.stringify(JSON.parse(responseBody), null, 2);
  } catch {}

  out.textContent = responseBody;
  out.classList.remove('error');

  // Show response headers if available
  if (r.responseHeaders && typeof r.responseHeaders === 'object') {
    let hdrText = '\n\n--- Response Headers ---\n';
    for (const [k, v] of Object.entries(r.responseHeaders)) {
      hdrText += `${k}: ${v}\n`;
    }
    out.textContent += hdrText;
  }
}

// ── JSON Formatter (client-side) ──
function toolRunJsonFormat() {
  const input = document.getElementById('t-json-input').value;
  const out = document.getElementById('t-json-out');
  out.style.display = 'block';
  try {
    out.textContent = JSON.stringify(JSON.parse(input), null, 2);
    out.classList.remove('error');
  } catch (e) {
    out.textContent = 'Error: ' + e.message;
    out.classList.add('error');
  }
}

function toolJsonMinify() {
  const input = document.getElementById('t-json-input').value;
  const out = document.getElementById('t-json-out');
  out.style.display = 'block';
  try {
    out.textContent = JSON.stringify(JSON.parse(input));
    out.classList.remove('error');
  } catch (e) {
    out.textContent = 'Error: ' + e.message;
    out.classList.add('error');
  }
}

// ── Code Beautifier (client-side) ──
function toolRunBeautify() {
  const input = document.getElementById('t-beautify-input').value;
  const indentVal = document.getElementById('t-beautify-indent').value;
  const out = document.getElementById('t-beautify-out');
  out.style.display = 'block';
  // Try JSON first
  try {
    const indent = indentVal === 'tab' ? '\t' : parseInt(indentVal);
    out.textContent = JSON.stringify(JSON.parse(input), null, indent);
    out.classList.remove('error');
    return;
  } catch {}
  // Fall back to XML/HTML beautifier
  let indent = 0;
  const indentStr = indentVal === 'tab' ? '\t' : ' '.repeat(parseInt(indentVal));
  const lines = input.replace(/>\s*</g, '>\n<').split('\n');
  const result = lines.map(line => {
    line = line.trim();
    if (line.startsWith('</')) indent = Math.max(0, indent - 1);
    const formatted = indentStr.repeat(indent) + line;
    if (line.startsWith('<') && !line.startsWith('</') && !line.startsWith('<!') && !line.endsWith('/>') && !line.includes('</')) indent++;
    return formatted;
  }).join('\n');
  out.textContent = result;
  out.classList.remove('error');
}

// ── Regex Tester (client-side) ──
function toolRunRegex() {
  const pattern = document.getElementById('t-regex-pattern').value;
  const flags = document.getElementById('t-regex-flags').value;
  const input = document.getElementById('t-regex-input').value;
  const out = document.getElementById('t-regex-out');
  out.style.display = 'block';
  if (!pattern) { out.innerHTML = ''; return; }
  try {
    const regex = new RegExp(pattern, flags);
    const matches = [];
    let match;
    if (flags.includes('g')) {
      while ((match = regex.exec(input)) !== null) {
        matches.push({ match: match[0], index: match.index, groups: match.slice(1) });
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
    } else {
      match = regex.exec(input);
      if (match) matches.push({ match: match[0], index: match.index, groups: match.slice(1) });
    }
    if (matches.length === 0) {
      out.innerHTML = '<div class="tool-status warn">No matches found</div>';
      return;
    }
    let html = `<div class="tool-status ok">${matches.length} match${matches.length !== 1 ? 'es' : ''} found</div>`;
    html += '<table class="tool-result-table"><tr><th>#</th><th>Match</th><th>Index</th><th>Groups</th></tr>';
    matches.forEach((m, i) => {
      html += `<tr><td>${i + 1}</td><td>${escHtml(m.match)}</td><td>${m.index}</td><td>${m.groups.length ? escHtml(m.groups.join(', ')) : '-'}</td></tr>`;
    });
    html += '</table>';
    // Highlighted text
    html += '<div style="margin-top:8px;font-weight:600;font-size:12px">Highlighted:</div>';
    html += '<pre style="background:var(--surface-2,#1a1a2e);padding:8px;border-radius:4px;margin-top:4px">';
    let highlighted = input;
    const sortedMatches = [...matches].sort((a, b) => b.index - a.index);
    for (const m of sortedMatches) {
      const before = highlighted.substring(0, m.index);
      const matched = highlighted.substring(m.index, m.index + m.match.length);
      const after = highlighted.substring(m.index + m.match.length);
      highlighted = escHtml(before) + '<span style="background:#ff6600;color:#000;padding:1px 2px;border-radius:2px">' + escHtml(matched) + '</span>' + after;
    }
    // Re-escape any remaining unescaped parts (simplified - last match already escaped correctly)
    html += highlighted + '</pre>';
    out.innerHTML = html;
  } catch (e) {
    out.innerHTML = `<div class="tool-status fail">Invalid regex: ${escHtml(e.message)}</div>`;
  }
}

// ── Base64 (client-side) ──
function toolRunBase64(mode) {
  const input = document.getElementById('t-b64-input').value;
  const out = document.getElementById('t-b64-out');
  out.style.display = 'block';
  try {
    if (mode === 'encode') {
      out.textContent = btoa(unescape(encodeURIComponent(input)));
      out.classList.remove('error');
    } else {
      out.textContent = decodeURIComponent(escape(atob(input.trim())));
      out.classList.remove('error');
    }
  } catch (e) {
    out.textContent = 'Error: ' + e.message;
    out.classList.add('error');
  }
}

// ── JWT Decoder (client-side) ──
function toolRunJwt() {
  const token = document.getElementById('t-jwt-input').value.trim();
  const out = document.getElementById('t-jwt-out');
  out.style.display = 'block';
  if (!token) { out.innerHTML = ''; return; }
  try {
    const parts = token.split('.');
    if (parts.length < 2) throw new Error('Invalid JWT format - expected at least 2 parts');

    const decodeBase64Url = (s) => {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return decodeURIComponent(escape(atob(s)));
    };

    const header = JSON.parse(decodeBase64Url(parts[0]));
    const payload = JSON.parse(decodeBase64Url(parts[1]));

    let html = '<div style="font-weight:600;margin-bottom:4px">Header:</div>';
    html += `<pre style="background:var(--surface-2,#1a1a2e);padding:8px;border-radius:4px;margin-bottom:8px">${escHtml(JSON.stringify(header, null, 2))}</pre>`;
    html += '<div style="font-weight:600;margin-bottom:4px">Payload:</div>';
    html += `<pre style="background:var(--surface-2,#1a1a2e);padding:8px;border-radius:4px;margin-bottom:8px">${escHtml(JSON.stringify(payload, null, 2))}</pre>`;

    // Decode common timestamp fields
    const tsFields = ['iat', 'exp', 'nbf', 'auth_time'];
    const foundTs = tsFields.filter(f => payload[f]);
    if (foundTs.length) {
      html += '<table class="tool-result-table">';
      for (const f of foundTs) {
        const date = new Date(payload[f] * 1000);
        const isExpired = f === 'exp' && date < new Date();
        html += `<tr><td>${f}</td><td class="${isExpired ? 'tool-status fail' : ''}">${date.toISOString()} ${isExpired ? '(EXPIRED)' : ''}</td></tr>`;
      }
      html += '</table>';
    }

    html += `<div style="margin-top:8px;font-size:12px;opacity:0.7">Signature: ${parts[2] ? parts[2].substring(0, 20) + '...' : 'N/A'} (not verified)</div>`;
    out.innerHTML = html;
  } catch (e) {
    out.innerHTML = `<div class="tool-status fail">Error: ${escHtml(e.message)}</div>`;
  }
}

// ── Cron Parser (client-side) ──
function toolRunCron() {
  const expr = document.getElementById('t-cron-expr').value.trim();
  const out = document.getElementById('t-cron-out');
  out.style.display = 'block';
  if (!expr) { out.innerHTML = ''; return; }

  const parts = expr.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    out.innerHTML = '<div class="tool-status fail">Invalid cron expression. Expected 5 or 6 fields.</div>';
    return;
  }

  const fieldNames = ['Minute', 'Hour', 'Day of Month', 'Month', 'Day of Week'];
  if (parts.length === 6) fieldNames.unshift('Second');

  const describeField = (val, name) => {
    if (val === '*') return `Every ${name.toLowerCase()}`;
    if (val.includes('/')) {
      const [base, step] = val.split('/');
      return `Every ${step} ${name.toLowerCase()}(s)${base !== '*' ? ' starting at ' + base : ''}`;
    }
    if (val.includes(',')) return `At ${name.toLowerCase()} ${val}`;
    if (val.includes('-')) {
      const [start, end] = val.split('-');
      return `${name} ${start} through ${end}`;
    }
    return `At ${name.toLowerCase()} ${val}`;
  };

  let html = '<table class="tool-result-table">';
  parts.forEach((p, i) => {
    html += `<tr><td>${fieldNames[i]}</td><td><strong>${escHtml(p)}</strong></td><td>${escHtml(describeField(p, fieldNames[i]))}</td></tr>`;
  });
  html += '</table>';

  // Generate human-readable summary
  const offset = parts.length === 6 ? 1 : 0;
  const min = parts[0 + offset], hr = parts[1 + offset], dom = parts[2 + offset], mon = parts[3 + offset], dow = parts[4 + offset];
  let summary = 'Runs ';
  if (min === '*' && hr === '*') summary += 'every minute';
  else if (min.includes('/')) summary += `every ${min.split('/')[1]} minutes`;
  else if (hr === '*') summary += `at minute ${min} of every hour`;
  else if (min !== '*' && hr !== '*') summary += `at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  else summary += `at minute ${min}, hour ${hr}`;

  if (dom !== '*') summary += `, on day ${dom}`;
  if (mon !== '*') {
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    summary += `, in ${months[parseInt(mon)] || mon}`;
  }
  if (dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    summary += `, on ${days[parseInt(dow)] || dow}`;
  }

  html += `<div style="margin-top:8px;padding:8px;background:var(--surface-2,#1a1a2e);border-radius:4px"><strong>Summary:</strong> ${escHtml(summary)}</div>`;

  // Next 5 executions (simplified)
  html += '<div style="margin-top:8px;font-weight:600;font-size:12px">Next 5 runs:</div>';
  html += '<div style="font-size:12px;opacity:0.8">';
  const now = new Date();
  const nextRuns = [];
  const testDate = new Date(now);
  testDate.setSeconds(0, 0);
  for (let attempts = 0; attempts < 525960 && nextRuns.length < 5; attempts++) {
    testDate.setMinutes(testDate.getMinutes() + 1);
    const m = testDate.getMinutes(), h = testDate.getHours(), d = testDate.getDate(), mo = testDate.getMonth() + 1, dw = testDate.getDay();
    const matchField = (field, value, max) => {
      if (field === '*') return true;
      if (field.includes('/')) { const [base, step] = field.split('/'); const b = base === '*' ? 0 : parseInt(base); return (value - b) % parseInt(step) === 0 && value >= b; }
      if (field.includes(',')) return field.split(',').map(Number).includes(value);
      if (field.includes('-')) { const [s, e] = field.split('-').map(Number); return value >= s && value <= e; }
      return parseInt(field) === value;
    };
    if (matchField(min, m) && matchField(hr, h) && matchField(dom, d) && matchField(mon, mo) && matchField(dow, dw)) {
      nextRuns.push(new Date(testDate));
    }
  }
  nextRuns.forEach(d => { html += `${d.toLocaleString()}<br/>`; });
  html += '</div>';
  out.innerHTML = html;
}

// ── UUID Generator (client-side) ──
function toolRunUuid() {
  const count = Math.min(parseInt(document.getElementById('t-uuid-count').value) || 1, 100);
  const out = document.getElementById('t-uuid-out');
  out.style.display = 'block';
  const uuids = [];
  for (let i = 0; i < count; i++) {
    uuids.push(crypto.randomUUID());
  }
  out.textContent = uuids.join('\n');
}

// ── Timestamp Converter (client-side) ──
function toolRunTimestamp() {
  const input = document.getElementById('t-ts-input').value.trim();
  const out = document.getElementById('t-ts-out');
  out.style.display = 'block';
  if (!input) { out.innerHTML = ''; return; }

  let date;
  // Try as unix timestamp (seconds)
  if (/^\d{10}$/.test(input)) {
    date = new Date(parseInt(input) * 1000);
  }
  // Try as unix timestamp (milliseconds)
  else if (/^\d{13}$/.test(input)) {
    date = new Date(parseInt(input));
  }
  // Try as date string
  else {
    date = new Date(input);
  }

  if (isNaN(date.getTime())) {
    out.innerHTML = '<div class="tool-status fail">Invalid date or timestamp</div>';
    return;
  }

  const unix = Math.floor(date.getTime() / 1000);
  const unixMs = date.getTime();
  out.innerHTML = `<table class="tool-result-table">
    <tr><td>Unix (seconds)</td><td>${unix}</td></tr>
    <tr><td>Unix (milliseconds)</td><td>${unixMs}</td></tr>
    <tr><td>ISO 8601</td><td>${date.toISOString()}</td></tr>
    <tr><td>UTC</td><td>${date.toUTCString()}</td></tr>
    <tr><td>Local</td><td>${date.toLocaleString()}</td></tr>
    <tr><td>Date</td><td>${date.toLocaleDateString()}</td></tr>
    <tr><td>Time</td><td>${date.toLocaleTimeString()}</td></tr>
    <tr><td>Day of Week</td><td>${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()]}</td></tr>
    <tr><td>Day of Year</td><td>${Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000)}</td></tr>
    <tr><td>Week Number</td><td>${Math.ceil(((date - new Date(date.getFullYear(), 0, 1)) / 86400000 + new Date(date.getFullYear(), 0, 1).getDay() + 1) / 7)}</td></tr>
    <tr><td>Relative</td><td>${getRelativeTime(date)}</td></tr></table>`;
}

function toolRunTimestampNow() {
  const now = new Date();
  document.getElementById('t-ts-input').value = Math.floor(now.getTime() / 1000).toString();
  toolRunTimestamp();
}

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const absDiff = Math.abs(diffMs);
  const suffix = diffMs > 0 ? 'ago' : 'from now';
  if (absDiff < 60000) return `${Math.floor(absDiff / 1000)} seconds ${suffix}`;
  if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)} minutes ${suffix}`;
  if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)} hours ${suffix}`;
  if (absDiff < 2592000000) return `${Math.floor(absDiff / 86400000)} days ${suffix}`;
  if (absDiff < 31536000000) return `${Math.floor(absDiff / 2592000000)} months ${suffix}`;
  return `${Math.floor(absDiff / 31536000000)} years ${suffix}`;
}


/* ====================== UTILITIES RUNNERS ====================== */

// ── Markdown Preview (client-side) ──
function toolRunMarkdown() {
  const input = document.getElementById('t-md-input').value;
  const out = document.getElementById('t-md-out');
  out.style.display = 'block';
  if (!input) { out.innerHTML = ''; return; }
  out.innerHTML = parseMarkdown(input);
}

function parseMarkdown(md) {
  let html = md;
  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang}">${escHtml(code.trim())}</code></pre>`;
  });
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  // Horizontal rule
  html = html.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '<hr/>');
  // Unordered lists
  html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%" />');
  // Line breaks (double newline = paragraph)
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');
  // Wrap in paragraph
  html = '<p>' + html + '</p>';
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  // Clean up paragraphs around block elements
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr\/>)/g, '$1');
  html = html.replace(/(<hr\/>)<\/p>/g, '$1');
  return html;
}

// ── Lorem Ipsum (client-side) ──
function toolRunLorem() {
  const count = parseInt(document.getElementById('t-lorem-count').value) || 3;
  const type = document.getElementById('t-lorem-type').value;
  const out = document.getElementById('t-lorem-out');
  out.style.display = 'block';

  const words = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
    'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
    'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
    'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
    'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'perspiciatis', 'unde',
    'omnis', 'iste', 'natus', 'error', 'voluptatem', 'accusantium', 'doloremque',
    'laudantium', 'totam', 'rem', 'aperiam', 'eaque', 'ipsa', 'quae', 'ab', 'illo',
    'inventore', 'veritatis', 'quasi', 'architecto', 'beatae', 'vitae', 'dicta',
    'explicabo', 'nemo', 'ipsam', 'voluptas', 'aspernatur', 'aut', 'odit',
    'fugit', 'consequuntur', 'magni', 'dolores', 'eos', 'ratione', 'sequi',
    'nesciunt', 'neque', 'porro', 'quisquam', 'nihil', 'impedit', 'quo', 'minus'
  ];

  const randomWord = () => words[Math.floor(Math.random() * words.length)];
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const genSentence = () => {
    const len = 8 + Math.floor(Math.random() * 12);
    let s = [];
    for (let i = 0; i < len; i++) s.push(randomWord());
    return capitalize(s.join(' ')) + '.';
  };

  const genParagraph = () => {
    const sCount = 3 + Math.floor(Math.random() * 5);
    let sentences = [];
    for (let i = 0; i < sCount; i++) sentences.push(genSentence());
    return sentences.join(' ');
  };

  let result;
  if (type === 'words') {
    const w = [];
    for (let i = 0; i < count; i++) w.push(randomWord());
    w[0] = capitalize(w[0]);
    result = w.join(' ');
  } else if (type === 'sentences') {
    const s = [];
    for (let i = 0; i < count; i++) s.push(genSentence());
    result = s.join(' ');
  } else {
    const p = [];
    for (let i = 0; i < count; i++) p.push(genParagraph());
    result = p.join('\n\n');
  }

  // Ensure starts with "Lorem ipsum dolor sit amet"
  if (result.length > 30) {
    result = 'Lorem ipsum dolor sit amet, ' + result.substring(result.indexOf(' ', 5) + 1);
  }

  out.textContent = result;
}

// ── QR Generator (client-side, uses api.qrserver.com) ──
function toolRunQr() {
  const text = document.getElementById('t-qr-text').value.trim();
  const size = document.getElementById('t-qr-size').value;
  const out = document.getElementById('t-qr-out');
  out.style.display = 'block';
  if (!text) { out.innerHTML = ''; return; }
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
  out.innerHTML = `<img src="${escHtml(url)}" alt="QR Code" style="max-width:100%;border-radius:4px;background:#fff;padding:8px" />
    <div style="margin-top:8px"><a href="${escHtml(url)}" target="_blank" rel="noopener" style="color:var(--accent,#ff6600);font-size:12px">Open full size</a></div>`;
}

// ── Color Picker (client-side) ──
function toolRunColor() {
  const input = document.getElementById('t-color-input').value.trim();
  const out = document.getElementById('t-color-out');
  out.style.display = 'block';
  if (!input) { out.innerHTML = ''; return; }

  let r, g, b;

  // Parse hex
  const hexMatch = input.match(/^#?([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length === 4) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  // Parse rgb
  const rgbMatch = input.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    r = parseInt(rgbMatch[1]);
    g = parseInt(rgbMatch[2]);
    b = parseInt(rgbMatch[3]);
  }

  // Parse hsl
  const hslMatch = input.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]) / 360;
    const s = parseInt(hslMatch[2]) / 100;
    const l = parseInt(hslMatch[3]) / 100;
    if (s === 0) {
      r = g = b = Math.round(l * 255);
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
      g = Math.round(hue2rgb(p, q, h) * 255);
      b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
    }
  }

  if (r === undefined || isNaN(r)) {
    out.innerHTML = '<div class="tool-status fail">Invalid color format. Use hex (#ff6600), rgb(255,102,0), or hsl(24,100%,50%)</div>';
    return;
  }

  // Clamp values
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  // Convert to hex
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

  // Convert to HSL
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      case bn: h = ((rn - gn) / d + 4) / 6; break;
    }
  }
  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  // Convert to CMYK
  const c = 1 - rn, m = 1 - gn, y = 1 - bn;
  const k = Math.min(c, m, y);
  const cmyk = k === 1 ? { c: 0, m: 0, y: 0, k: 100 } : {
    c: Math.round(((c - k) / (1 - k)) * 100),
    m: Math.round(((m - k) / (1 - k)) * 100),
    y: Math.round(((y - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  };

  // Update color picker input
  const picker = document.getElementById('t-color-picker');
  if (picker) picker.value = hex;

  // Luminance for contrast check
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const textColor = luminance > 128 ? '#000000' : '#ffffff';

  out.innerHTML = `
    <div style="background:${hex};color:${textColor};padding:20px;border-radius:4px;text-align:center;font-weight:600;font-size:18px;margin-bottom:8px">${hex}</div>
    <table class="tool-result-table">
      <tr><td>HEX</td><td>${hex}</td></tr>
      <tr><td>RGB</td><td>rgb(${r}, ${g}, ${b})</td></tr>
      <tr><td>HSL</td><td>hsl(${hDeg}, ${sPct}%, ${lPct}%)</td></tr>
      <tr><td>CMYK</td><td>cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)</td></tr>
      <tr><td>Decimal</td><td>${(r << 16 | g << 8 | b)}</td></tr>
    </table>
    <div style="margin-top:8px;display:flex;gap:4px">
      <div style="flex:1;height:30px;border-radius:3px;background:${hex};opacity:0.2"></div>
      <div style="flex:1;height:30px;border-radius:3px;background:${hex};opacity:0.4"></div>
      <div style="flex:1;height:30px;border-radius:3px;background:${hex};opacity:0.6"></div>
      <div style="flex:1;height:30px;border-radius:3px;background:${hex};opacity:0.8"></div>
      <div style="flex:1;height:30px;border-radius:3px;background:${hex}"></div>
    </div>`;
}
