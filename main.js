const { app, BrowserWindow, ipcMain, dialog, Notification, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const pty = require('node-pty');
const https = require('https');
const { execSync, exec } = require('child_process');

let mainWindow = null;
const terminals = new Map();

// Window state persistence
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const data = fs.readFileSync(windowStatePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { width: 1400, height: 900 };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const state = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: mainWindow.isMaximized()
  };
  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function createWindow() {
  const windowState = loadWindowState();

  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    backgroundColor: '#000000',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 12, y: 10 } } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile('index.html');

  // Save window state on resize/move
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('close', saveWindowState);

  mainWindow.on('closed', () => {
    // Kill all terminals when window closes
    terminals.forEach(ptyProcess => {
      try { ptyProcess.kill(); } catch (e) {}
    });
    terminals.clear();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Auto-updater setup
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', 'downloading');
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', 'ready');
  });

  autoUpdater.on('error', (err) => {
    console.log('Auto-update error:', err.message);
    if (mainWindow) mainWindow.webContents.send('update-status', 'error', err.message);
  });

  // Check for updates after a short delay, then every 60 minutes
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 60 * 60 * 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// File System handlers
ipcMain.handle('fs:readDir', async (_, dirPath) => {
  const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const results = [];
  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);
    let size = 0;
    try {
      if (item.isFile()) {
        const stat = await fs.promises.stat(itemPath);
        size = stat.size;
      }
    } catch (e) {}
    results.push({
      name: item.name,
      path: itemPath,
      isDirectory: item.isDirectory(),
      isFile: item.isFile(),
      size: size
    });
  }
  return results;
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  return await fs.promises.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  await fs.promises.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('fs:delete', async (_, filePath) => {
  const stat = await fs.promises.stat(filePath);
  if (stat.isDirectory()) {
    await fs.promises.rm(filePath, { recursive: true });
  } else {
    await fs.promises.unlink(filePath);
  }
  return true;
});

ipcMain.handle('fs:mkdir', async (_, dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
  return true;
});

ipcMain.handle('fs:rename', async (_, oldPath, newPath) => {
  await fs.promises.rename(oldPath, newPath);
  return true;
});

ipcMain.handle('fs:copy', async (_, src, dest) => {
  const stat = await fs.promises.stat(src);
  if (stat.isDirectory()) {
    await fs.promises.cp(src, dest, { recursive: true });
  } else {
    await fs.promises.copyFile(src, dest);
  }
  return true;
});

ipcMain.handle('fs:getHome', () => app.getPath('home'));

// FTP connections storage
const ftpConnectionsPath = path.join(app.getPath('userData'), 'ftp-connections.json');

ipcMain.handle('ftpConnections:load', async () => {
  try {
    const data = await fs.promises.readFile(ftpConnectionsPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
});

ipcMain.handle('ftpConnections:save', async (_, connections) => {
  await fs.promises.writeFile(ftpConnectionsPath, JSON.stringify(connections, null, 2));
  return true;
});

// Session storage
const sessionPath = path.join(app.getPath('userData'), 'session.json');

ipcMain.handle('session:save', async (_, sessionData) => {
  await fs.promises.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
  return true;
});

ipcMain.handle('session:load', async () => {
  try {
    const data = await fs.promises.readFile(sessionPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
});

ipcMain.handle('terminal:getCwd', async (_, id) => {
  const ptyProcess = terminals.get(id);
  if (!ptyProcess) return null;
  try {
    const pid = ptyProcess.pid;
    const result = execSync(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 2000
    });
    const lines = result.split('\n');
    for (const line of lines) {
      if (line.startsWith('n') && line.length > 1) {
        return line.substring(1);
      }
    }
    return null;
  } catch {
    return null;
  }
});

// Notes storage
const notesPath = path.join(app.getPath('userData'), 'notes.json');

ipcMain.handle('notes:load', async () => {
  try {
    const data = await fs.promises.readFile(notesPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { content: '' };
  }
});

ipcMain.handle('notes:save', async (_, notes) => {
  await fs.promises.writeFile(notesPath, JSON.stringify(notes, null, 2));
  return true;
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  });
  return result.canceled ? null : result.filePaths[0];
});

// Terminal handlers
ipcMain.handle('terminal:create', (_, id, shell, cwd) => {
  const defaultShell = process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh';

  const isWin = process.platform === 'win32';
  const ptyProcess = pty.spawn(shell || defaultShell, [], {
    name: isWin ? undefined : 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: cwd || app.getPath('home'),
    env: {
      ...process.env,
      ...(isWin ? {} : { TERM: 'xterm-256color' })
    },
    ...(isWin ? { useConpty: true } : {})
  });

  terminals.set(id, ptyProcess);

  ptyProcess.onData(data => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', id, data);
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    terminals.delete(id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:exit', id, exitCode);
    }
  });

  return { id, pid: ptyProcess.pid };
});

ipcMain.handle('terminal:write', (_, id, data) => {
  const ptyProcess = terminals.get(id);
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.handle('terminal:resize', (_, id, cols, rows) => {
  const ptyProcess = terminals.get(id);
  if (ptyProcess) ptyProcess.resize(cols, rows);
});

ipcMain.handle('terminal:kill', (_, id) => {
  const ptyProcess = terminals.get(id);
  if (ptyProcess) {
    try { ptyProcess.kill(); } catch (e) {}
    terminals.delete(id);
  }
});

app.on('before-quit', () => {
  terminals.forEach(ptyProcess => {
    try { ptyProcess.kill(); } catch (e) {}
  });
  terminals.clear();
});

// FTP handlers
const ftp = require('basic-ftp');
let ftpClient = null;

// Mutex to serialize FTP operations (basic-ftp only supports one at a time)
let ftpQueue = Promise.resolve();
function ftpOp(fn) {
  ftpQueue = ftpQueue.then(fn, fn);
  return ftpQueue;
}

ipcMain.handle('ftp:connect', async (_, host, port, user, password, secure) => {
  if (ftpClient) {
    try { ftpClient.close(); } catch (e) {}
  }
  ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;
  // Track progress and send to renderer
  ftpClient.trackProgress(info => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ftp:progress', { bytes: info.bytes, bytesOverall: info.bytesOverall, type: info.type });
    }
  });
  await ftpClient.access({
    host: host,
    port: port,
    user: user || 'anonymous',
    password: password || 'anonymous@',
    secure: secure || false,
    secureOptions: secure ? { rejectUnauthorized: false } : undefined
  });
  ftpQueue = Promise.resolve();
  return true;
});

ipcMain.handle('ftp:list', async (_, remotePath) => {
  if (!ftpClient) throw new Error('Not connected');
  return ftpOp(async () => {
    const list = await ftpClient.list(remotePath);
    return list.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory,
      size: item.size
    }));
  });
});

ipcMain.handle('ftp:readFile', async (_, remotePath) => {
  if (!ftpClient) throw new Error('Not connected');
  return ftpOp(async () => {
    const { Writable } = require('stream');
    let content = '';
    const writable = new Writable({
      write(chunk, encoding, callback) {
        content += chunk.toString();
        callback();
      }
    });
    await ftpClient.downloadTo(writable, remotePath);
    return content;
  });
});

ipcMain.handle('ftp:writeFile', async (_, remotePath, content) => {
  if (!ftpClient) throw new Error('Not connected');
  return ftpOp(async () => {
    const { Readable } = require('stream');
    const readable = Readable.from([content]);
    await ftpClient.uploadFrom(readable, remotePath);
    return true;
  });
});

ipcMain.handle('ftp:delete', async (_, remotePath, isDirectory) => {
  if (!ftpClient) throw new Error('Not connected');
  return ftpOp(async () => {
    if (isDirectory) {
      await ftpClient.removeDir(remotePath);
    } else {
      await ftpClient.remove(remotePath);
    }
    return true;
  });
});

ipcMain.handle('ftp:mkdir', async (_, remotePath) => {
  if (!ftpClient) throw new Error('Not connected');
  return ftpOp(async () => {
    await ftpClient.ensureDir(remotePath);
    return true;
  });
});

ipcMain.handle('ftp:downloadToLocal', async (_, remotePath, localPath) => {
  if (!ftpClient) throw new Error('Not connected');
  return ftpOp(async () => {
    await ftpClient.downloadTo(localPath, remotePath);
    return true;
  });
});

ipcMain.handle('ftp:uploadFromLocal', async (_, localPath, remotePath) => {
  if (!ftpClient) throw new Error('Not connected');
  return ftpOp(async () => {
    await ftpClient.uploadFrom(localPath, remotePath);
    return true;
  });
});

ipcMain.handle('ftp:disconnect', async () => {
  if (ftpClient) {
    ftpClient.close();
    ftpClient = null;
  }
  ftpQueue = Promise.resolve();
  return true;
});

// Git handlers

ipcMain.handle('git:getBranch', async (_, dirPath) => {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dirPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return branch;
  } catch {
    return null;
  }
});

// Tools - shell command execution

ipcMain.handle('tools:exec', async (_, command) => {
  // Whitelist allowed commands for security
  const allowed = ['ping', 'traceroute', 'dig', 'nslookup', 'whois', 'curl', 'openssl', 'nc', 'echo', 'md5', 'wget', 'jq', 'base64', 'hostname', 'ifconfig', 'netstat', 'docker', 'npm', 'node', 'python3', 'git', 'head', 'tail', 'wc', 'sort', 'grep', 'awk', 'sed'];
  // Check all commands in pipes
  const parts = command.split(/\|/).map(s => s.trim().replace(/^[^a-zA-Z]*/, '').split(/\s+/)[0]);
  const allAllowed = parts.every(cmd => allowed.includes(cmd));
  if (!allAllowed) {
    return { error: `Command not allowed: ${parts.find(cmd => !allowed.includes(cmd))}` };
  }
  return new Promise((resolve) => {
    exec(command, { timeout: 30000, maxBuffer: 1024 * 1024, encoding: 'utf-8', shell: '/bin/bash' }, (error, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', error: error ? error.message : null });
    });
  });
});

// Cloud sync
const CLOUD_API = 'https://mynetworktools.com/dterm/api';
const cloudAccountPath = path.join(app.getPath('userData'), 'cloud-account.json');

function cloudRequest(endpoint, body, timeout) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(`${CLOUD_API}/${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: timeout || 30000
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({ error: 'Invalid response' }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', e => reject(e));
    req.write(data);
    req.end();
  });
}

function loadCloudAccount() {
  try {
    return JSON.parse(fs.readFileSync(cloudAccountPath, 'utf-8'));
  } catch { return null; }
}

function saveCloudAccount(account) {
  fs.writeFileSync(cloudAccountPath, JSON.stringify(account, null, 2));
}

function clearCloudAccount() {
  try { fs.unlinkSync(cloudAccountPath); } catch {}
}

ipcMain.handle('cloud:login', async (_, username, password) => {
  const result = await cloudRequest('auth.php', { action: 'login', username, password });
  if (result.success) {
    saveCloudAccount({ token: result.token, user: result.user });
  }
  return result;
});

ipcMain.handle('cloud:register', async (_, username, email, password) => {
  const result = await cloudRequest('auth.php', { action: 'register', username, email, password });
  if (result.success) {
    saveCloudAccount({ token: result.token, user: result.user });
  }
  return result;
});

ipcMain.handle('cloud:validate', async () => {
  const account = loadCloudAccount();
  if (!account) return { error: 'Not logged in' };
  const result = await cloudRequest('auth.php', { action: 'validate', token: account.token });
  if (result.success && result.user) {
    account.user = result.user;
    saveCloudAccount(account);
  }
  return result;
});

ipcMain.handle('cloud:push', async (_, dataType, dataJson) => {
  const account = loadCloudAccount();
  if (!account) return { error: 'Not logged in' };
  return cloudRequest('sync.php', { action: 'push', data_type: dataType, data_json: dataJson, token: account.token });
});

ipcMain.handle('cloud:pullAll', async () => {
  const account = loadCloudAccount();
  if (!account) return { error: 'Not logged in' };
  return cloudRequest('sync.php', { action: 'pull_all', token: account.token });
});

ipcMain.handle('cloud:logout', async () => {
  clearCloudAccount();
  return { success: true };
});

ipcMain.handle('cloud:getAccount', async () => {
  return loadCloudAccount();
});

ipcMain.handle('cloud:getWelcome', async () => {
  const account = loadCloudAccount();
  const token = account ? account.token : null;
  try {
    return await cloudRequest('welcome.php', { token });
  } catch { return { error: 'Failed to fetch welcome message' }; }
});

ipcMain.handle('cloud:getGuide', async () => {
  try {
    return await cloudRequest('guide.php', {});
  } catch { return { error: 'Failed to fetch guide' }; }
});

// --- Profile Photo Upload ---
ipcMain.handle('cloud:uploadPhoto', async (_, base64data) => {
  const account = loadCloudAccount();
  if (!account) return { error: 'Not logged in' };
  try {
    const result = await cloudRequest('auth.php', { action: 'upload_photo', token: account.token, image: base64data });
    if (result.success && result.profile_photo_url) {
      // Update stored account with new photo URL
      const current = loadCloudAccount();
      if (current && current.user) {
        current.user.profile_photo_url = result.profile_photo_url;
        saveCloudAccount(current);
      }
    }
    return result;
  } catch (e) { return { error: e.message }; }
});

// --- Messages (Contact/Feedback) ---
ipcMain.handle('messages:request', async (_, action, data) => {
  try {
    return await cloudRequest('messages.php', { action, ...data });
  } catch (e) {
    return { error: e.message };
  }
});

// --- App Version & Auto-Update ---
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:installUpdate', () => {
  autoUpdater.quitAndInstall();
});

// --- Native OS Notification ---
ipcMain.handle('notify', (_, title, body) => {
  if (Notification.isSupported()) {
    const notif = new Notification({ title, body });
    notif.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notif.show();
  }
});

// --- Collab (Real-time Collaborative Editing) ---
ipcMain.handle('collab:request', async (_, action, data) => {
  try {
    // Long-poll requests need a longer timeout (25s server wait + buffer)
    const timeout = (action === 'pull_changes' && data && data.longPoll) ? 30000 : 10000;
    return await cloudRequest('collab.php', { action, ...data }, timeout);
  } catch (e) {
    return { error: e.message };
  }
});

// Git log
ipcMain.handle('git:log', async (_, dirPath, count) => {
  try {
    const n = count || 50;
    const stdout = execSync(`git log --oneline -${n} --format="%H|%h|%s|%an|%ar"`, { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 });
    const commits = stdout.trim().split('\n').filter(l => l).map(line => {
      const [hash, short, message, author, date] = line.split('|');
      return { hash, short, message, author, date };
    });
    return { commits };
  } catch (e) {
    return { error: e.stderr || e.message, commits: [] };
  }
});

// Git diff
ipcMain.handle('git:diff', async (_, dirPath, args) => {
  try {
    const cmd = args ? `git diff ${args}` : 'git diff';
    const stdout = execSync(cmd, { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 5 * 1024 * 1024 });
    return { stdout };
  } catch (e) {
    return { error: e.stderr || e.message };
  }
});

// Git diff for single file
ipcMain.handle('git:diffFile', async (_, dirPath, filePath) => {
  try {
    const stdout = execSync(`git diff -- "${filePath}"`, { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 5 * 1024 * 1024 });
    return { stdout };
  } catch (e) {
    // Try staged diff if unstaged is empty
    try {
      const stdout2 = execSync(`git diff --cached -- "${filePath}"`, { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 5 * 1024 * 1024 });
      return { stdout: stdout2 };
    } catch (e2) {
      return { error: e2.stderr || e2.message };
    }
  }
});

// Git branch management
ipcMain.handle('git:listBranches', async (_, dirPath) => {
  try {
    const stdout = execSync('git branch -a --format="%(HEAD)|%(refname:short)|%(objectname:short)"', { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const branches = stdout.trim().split('\n').filter(l => l).map(line => {
      const [head, name, hash] = line.split('|');
      return { name, hash, current: head.trim() === '*' };
    });
    return { branches };
  } catch (e) {
    return { error: e.stderr || e.message, branches: [] };
  }
});

ipcMain.handle('git:checkout', async (_, dirPath, branch) => {
  try {
    const stdout = execSync(`git checkout "${branch.replace(/"/g, '\\"')}"`, { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 });
    return { stdout };
  } catch (e) {
    return { error: e.stderr || e.message };
  }
});

ipcMain.handle('git:createBranch', async (_, dirPath, branchName) => {
  try {
    const stdout = execSync(`git checkout -b "${branchName.replace(/"/g, '\\"')}"`, { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout };
  } catch (e) {
    return { error: e.stderr || e.message };
  }
});

ipcMain.handle('git:getStatus', async (_, dirPath) => {
  try {
    const status = execSync('git status --porcelain', {
      cwd: dirPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const files = {};
    status.split('\n').forEach(line => {
      if (line.trim()) {
        const code = line.substring(0, 2);
        const file = line.substring(3);
        files[file] = code;
      }
    });
    return files;
  } catch {
    return null;
  }
});

ipcMain.handle('git:statusPorcelain', async (_, dirPath) => {
  try {
    const stdout = execSync('git status --porcelain', { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('git:commitAll', async (_, dirPath, message) => {
  try {
    execSync('git add -A', { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout };
  } catch (e) {
    return { error: e.stderr || e.message };
  }
});

ipcMain.handle('git:push', async (_, dirPath) => {
  try {
    const stdout = execSync('git push', { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
    return { stdout };
  } catch (e) {
    return { error: e.stderr || e.message };
  }
});

ipcMain.handle('git:pull', async (_, dirPath) => {
  try {
    const stdout = execSync('git pull', { cwd: dirPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
    return { stdout };
  } catch (e) {
    return { error: e.stderr || e.message };
  }
});

ipcMain.handle('search:grep', async (_, dirPath, query, useRegex, caseSensitive) => {
  try {
    const caseFlag = caseSensitive ? '' : '-i';
    const regexFlag = useRegex ? '-E' : '-F';
    const cmd = `grep -rn ${caseFlag} ${regexFlag} -- "${query.replace(/"/g, '\\"')}" "${dirPath}" 2>/dev/null | head -200`;
    const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000, maxBuffer: 1024 * 1024 });
    return { stdout };
  } catch (e) {
    if (e.status === 1) return { stdout: '' }; // grep returns 1 for no matches
    return { error: e.message };
  }
});

// Code Runner — detect project tasks
ipcMain.handle('runner:detectTasks', async (_, dirPath) => {
  const tasks = [];
  let projectType = 'unknown';
  try {
    // Node.js — package.json
    const pkgPath = path.join(dirPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      projectType = 'node';
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts) {
          for (const [name, cmd] of Object.entries(pkg.scripts)) {
            tasks.push({ name: `npm run ${name}`, command: `npm run ${name}`, category: 'npm scripts', detail: cmd });
          }
        }
      } catch (e) { /* invalid JSON */ }
    }

    // Makefile
    const makePath = path.join(dirPath, 'Makefile');
    if (fs.existsSync(makePath)) {
      if (projectType === 'unknown') projectType = 'make';
      try {
        const content = fs.readFileSync(makePath, 'utf-8');
        const targets = content.match(/^[a-zA-Z_][a-zA-Z0-9_-]*(?=\s*:)/gm);
        if (targets) {
          const unique = [...new Set(targets)];
          for (const t of unique) {
            tasks.push({ name: `make ${t}`, command: `make ${t}`, category: 'Makefile' });
          }
        }
      } catch (e) { /* read error */ }
    }

    // Python — requirements.txt or pyproject.toml
    if (fs.existsSync(path.join(dirPath, 'requirements.txt'))) {
      if (projectType === 'unknown') projectType = 'python';
      tasks.push({ name: 'pip install -r requirements.txt', command: 'pip install -r requirements.txt', category: 'Python' });
    }
    if (fs.existsSync(path.join(dirPath, 'pyproject.toml'))) {
      if (projectType === 'unknown') projectType = 'python';
      tasks.push({ name: 'pip install -e .', command: 'pip install -e .', category: 'Python' });
    }
    if (fs.existsSync(path.join(dirPath, 'manage.py'))) {
      tasks.push({ name: 'python manage.py runserver', command: 'python3 manage.py runserver', category: 'Django' });
      tasks.push({ name: 'python manage.py migrate', command: 'python3 manage.py migrate', category: 'Django' });
    }

    // Rust — Cargo.toml
    if (fs.existsSync(path.join(dirPath, 'Cargo.toml'))) {
      projectType = 'rust';
      tasks.push({ name: 'cargo run', command: 'cargo run', category: 'Cargo' });
      tasks.push({ name: 'cargo build', command: 'cargo build', category: 'Cargo' });
      tasks.push({ name: 'cargo test', command: 'cargo test', category: 'Cargo' });
    }

    // Go — go.mod
    if (fs.existsSync(path.join(dirPath, 'go.mod'))) {
      projectType = 'go';
      tasks.push({ name: 'go run .', command: 'go run .', category: 'Go' });
      tasks.push({ name: 'go build', command: 'go build', category: 'Go' });
      tasks.push({ name: 'go test ./...', command: 'go test ./...', category: 'Go' });
    }

    // Docker
    if (fs.existsSync(path.join(dirPath, 'Dockerfile'))) {
      tasks.push({ name: 'docker build .', command: 'docker build -t app .', category: 'Docker' });
      tasks.push({ name: 'docker run', command: 'docker run --rm app', category: 'Docker' });
    }
    if (fs.existsSync(path.join(dirPath, 'docker-compose.yml')) || fs.existsSync(path.join(dirPath, 'compose.yml'))) {
      tasks.push({ name: 'docker compose up', command: 'docker compose up', category: 'Docker' });
      tasks.push({ name: 'docker compose down', command: 'docker compose down', category: 'Docker' });
    }

  } catch (e) { /* directory read error */ }
  return { type: projectType, tasks };
});

// ============ Snippets ============
const snippetsPath = path.join(app.getPath('home'), '.dterm-snippets.json');

ipcMain.handle('snippets:load', async () => {
  try {
    return JSON.parse(fs.readFileSync(snippetsPath, 'utf-8'));
  } catch {
    return [];
  }
});

ipcMain.handle('snippets:save', async (_, snippets) => {
  fs.writeFileSync(snippetsPath, JSON.stringify(snippets, null, 2));
});

// ============ Processes / Ports ============
ipcMain.handle('processes:list', async () => {
  try {
    const output = execSync('ps -eo pid,pcpu,pmem,comm --sort=-pcpu 2>/dev/null || ps aux', { encoding: 'utf-8', timeout: 5000 });
    const lines = output.split('\n').filter(l => l.trim());
    const header = lines.shift();
    return { header, processes: lines.slice(0, 100) };
  } catch (e) {
    return { header: '', processes: [], error: e.message };
  }
});

ipcMain.handle('processes:ports', async () => {
  try {
    const output = execSync('lsof -iTCP -sTCP:LISTEN -nP 2>/dev/null || netstat -tlnp 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
    const lines = output.split('\n').filter(l => l.trim());
    return lines;
  } catch (e) {
    return [];
  }
});

ipcMain.handle('processes:kill', async (_, pid) => {
  try {
    process.kill(parseInt(pid), 'SIGTERM');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ============ SSH Connections ============
const sshConnectionsPath = path.join(app.getPath('home'), '.dterm-ssh-connections.json');

ipcMain.handle('sshConnections:load', async () => {
  try {
    return JSON.parse(fs.readFileSync(sshConnectionsPath, 'utf-8'));
  } catch {
    return [];
  }
});

ipcMain.handle('sshConnections:save', async (_, connections) => {
  fs.writeFileSync(sshConnectionsPath, JSON.stringify(connections, null, 2));
});

// ============ Workspaces ============
const workspacesPath = path.join(app.getPath('home'), '.dterm-workspaces.json');

ipcMain.handle('workspaces:list', async () => {
  try {
    return JSON.parse(fs.readFileSync(workspacesPath, 'utf-8'));
  } catch {
    return [];
  }
});

ipcMain.handle('workspaces:save', async (_, name, data) => {
  let workspaces = [];
  try { workspaces = JSON.parse(fs.readFileSync(workspacesPath, 'utf-8')); } catch {}
  const existing = workspaces.findIndex(w => w.name === name);
  const entry = { name, data, savedAt: new Date().toISOString() };
  if (existing >= 0) workspaces[existing] = entry;
  else workspaces.push(entry);
  fs.writeFileSync(workspacesPath, JSON.stringify(workspaces, null, 2));
});

ipcMain.handle('workspaces:load', async (_, name) => {
  try {
    const workspaces = JSON.parse(fs.readFileSync(workspacesPath, 'utf-8'));
    return workspaces.find(w => w.name === name) || null;
  } catch {
    return null;
  }
});

ipcMain.handle('workspaces:delete', async (_, name) => {
  try {
    let workspaces = JSON.parse(fs.readFileSync(workspacesPath, 'utf-8'));
    workspaces = workspaces.filter(w => w.name !== name);
    fs.writeFileSync(workspacesPath, JSON.stringify(workspaces, null, 2));
  } catch {}
});

// ============ File Watcher ============
const watchers = new Map();

ipcMain.handle('fs:watch', async (_, dirPath) => {
  // Stop existing watcher for this path
  if (watchers.has(dirPath)) {
    watchers.get(dirPath).close();
    watchers.delete(dirPath);
  }
  try {
    let debounceTimer = null;
    const watcher = fs.watch(dirPath, { persistent: false }, (eventType, filename) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('fs:changed', dirPath, filename);
        }
      }, 500);
    });
    watcher.on('error', () => {
      watchers.delete(dirPath);
    });
    watchers.set(dirPath, watcher);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:unwatch', async (_, dirPath) => {
  if (watchers.has(dirPath)) {
    watchers.get(dirPath).close();
    watchers.delete(dirPath);
  }
  return true;
});

// ============ Broadcast ============
ipcMain.handle('cloud:getBroadcast', async () => {
  try {
    return await cloudRequest('broadcast.php', {});
  } catch { return { error: 'Failed to fetch broadcast' }; }
});

// ============ LastPass Vault ============
ipcMain.handle('lpass:checkInstalled', async () => {
  try {
    execSync('which lpass', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { installed: true };
  } catch {
    return { installed: false };
  }
});

ipcMain.handle('lpass:status', async () => {
  try {
    const stdout = execSync('lpass status', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
    const match = stdout.match(/Logged in as (.+)\./);
    return { loggedIn: true, email: match ? match[1].trim() : 'unknown' };
  } catch {
    return { loggedIn: false, email: null };
  }
});

ipcMain.handle('lpass:login', async (_, email) => {
  // lpass login requires interactive input for master password — use terminal instead
  // We return the command string for the renderer to run in a terminal tab
  return { command: `lpass login "${email.replace(/"/g, '\\"')}"` };
});

ipcMain.handle('lpass:logout', async () => {
  try {
    execSync('lpass logout --force', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('lpass:list', async () => {
  try {
    const stdout = execSync('lpass ls --format="%ai|%an|%al|%au|%ag"', {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000, maxBuffer: 5 * 1024 * 1024
    });
    const entries = stdout.trim().split('\n').filter(l => l).map(line => {
      const [id, name, url, username, group] = line.split('|');
      return { id, name, url, username, group: group || '' };
    });
    return { entries };
  } catch (e) {
    return { error: e.stderr || e.message, entries: [] };
  }
});

ipcMain.handle('lpass:search', async (_, query) => {
  try {
    const stdout = execSync(`lpass ls --format="%ai|%an|%al|%au|%ag" "${query.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 5 * 1024 * 1024
    });
    const entries = stdout.trim().split('\n').filter(l => l).map(line => {
      const [id, name, url, username, group] = line.split('|');
      return { id, name, url, username, group: group || '' };
    });
    return { entries };
  } catch (e) {
    if (e.status === 1) return { entries: [] };
    return { error: e.stderr || e.message, entries: [] };
  }
});

ipcMain.handle('lpass:show', async (_, id) => {
  try {
    const stdout = execSync(`lpass show --json "${id}"`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000
    });
    const data = JSON.parse(stdout);
    const entry = Array.isArray(data) ? data[0] : data;
    return { entry };
  } catch (e) {
    return { error: e.stderr || e.message };
  }
});

ipcMain.handle('lpass:getPassword', async (_, id) => {
  try {
    const stdout = execSync(`lpass show --password "${id}"`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000
    });
    return { password: stdout.trim() };
  } catch (e) {
    return { error: e.stderr || e.message };
  }
});

// Open external URL in default browser
ipcMain.handle('shell:openExternal', async (_, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { error: 'Invalid URL' };
});
