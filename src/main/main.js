const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile, execSync } = require('child_process');

let pty;
try {
  pty = require('node-pty');
} catch (err) {
  console.warn('node-pty could not be loaded directly:', err.message);
}

let mainWindow = null;
const ptys = new Map(); // id -> { process, shellPath, cwd }

// Helper: Detect installed shells across Linux, macOS, and Windows
function getAvailableShells() {
  const shells = [];
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows common shells
    const candidates = [
      { name: 'PowerShell', path: path.join(process.env.SystemRoot || 'C:\\Windows', 'System32\\WindowsPowerShell\\v1.0\\powershell.exe') },
      { name: 'PowerShell 7', path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' },
      { name: 'Command Prompt', path: path.join(process.env.SystemRoot || 'C:\\Windows', 'System32\\cmd.exe') },
      { name: 'Git Bash', path: 'C:\\Program Files\\Git\\bin\\bash.exe' },
      { name: 'Git Bash (x86)', path: 'C:\\Program Files (x86)\\Git\\bin\\bash.exe' },
      { name: 'Git Bash (Local)', path: path.join(process.env.LOCALAPPDATA || '', 'Programs\\Git\\bin\\bash.exe') },
      { name: 'Cygwin', path: 'C:\\cygwin64\\bin\\bash.exe' },
      { name: 'Cygwin (x86)', path: 'C:\\cygwin\\bin\\bash.exe' },
      { name: 'WSL', path: path.join(process.env.SystemRoot || 'C:\\Windows', 'System32\\wsl.exe') }
    ];

    for (const item of candidates) {
      if (fs.existsSync(item.path)) {
        shells.push(item);
      }
    }

    if (shells.length === 0) {
      shells.push({ name: 'Command Prompt', path: process.env.COMSPEC || 'cmd.exe' });
    }
  } else {
    // Linux / macOS
    const knownNames = {
      bash: 'Bash',
      dash: 'Dash',
      zsh: 'Zsh',
      fish: 'Fish',
      sh: 'Sh',
      ksh: 'Ksh',
      tcsh: 'Tcsh',
      csh: 'Csh'
    };

    const seenPaths = new Set();
    const candidatePaths = [];

    if (fs.existsSync('/etc/shells')) {
      try {
        const lines = fs.readFileSync('/etc/shells', 'utf-8').split('\n');
        for (let line of lines) {
          line = line.trim();
          if (line && !line.startsWith('#')) {
            candidatePaths.push(line);
          }
        }
      } catch (e) {}
    }

    ['/bin/bash', '/usr/bin/bash', '/bin/dash', '/usr/bin/dash', '/bin/zsh', '/usr/bin/zsh', '/usr/bin/fish', '/bin/sh'].forEach(p => {
      if (!candidatePaths.includes(p)) candidatePaths.push(p);
    });

    for (const shellPath of candidatePaths) {
      if (fs.existsSync(shellPath)) {
        try {
          const real = fs.realpathSync(shellPath);
          if (!seenPaths.has(real)) {
            seenPaths.add(real);
            const base = path.basename(shellPath).toLowerCase();
            const displayName = knownNames[base] || (base.charAt(0).toUpperCase() + base.slice(1));
            shells.push({
              name: displayName,
              path: shellPath
            });
          }
        } catch (e) {}
      }
    }

    if (shells.length === 0) {
      shells.push({ name: 'Bash', path: process.env.SHELL || '/bin/bash' });
    }
  }

  return shells;
}

function getDefaultShell() {
  const available = getAvailableShells();
  if (available.length > 0) {
    return available[0].path;
  }
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function getStoragePath(fileName) {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, fileName);
}

function loadJsonFile(fileName, defaultValue) {
  try {
    const filePath = getStoragePath(fileName);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error loading ${fileName}:`, err);
  }
  return defaultValue;
}

function saveJsonFile(fileName, data) {
  try {
    const filePath = getStoragePath(fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error saving ${fileName}:`, err);
    return false;
  }
}

function getPtyCwd(id) {
  const item = ptys.get(id);
  if (!item) return process.cwd();

  if (process.platform === 'linux' && item.process && item.process.pid) {
    try {
      const procCwd = fs.readlinkSync(`/proc/${item.process.pid}/cwd`);
      if (procCwd && fs.existsSync(procCwd)) {
        item.cwd = procCwd;
        return procCwd;
      }
    } catch (e) {}
  }
  return item.cwd || process.cwd();
}

function getGitInfoForDir(dir) {
  try {
    if (!dir || !fs.existsSync(dir)) {
      return { isRepo: false };
    }

    const isInside = execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000
    }).trim();

    if (isInside !== 'true') {
      return { isRepo: false };
    }

    let branch = '';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: dir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 1000
      }).trim();
    } catch (e) {
      branch = 'HEAD detached';
    }

    let userName = '';
    try {
      userName = execSync('git config user.name', {
        cwd: dir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 1000
      }).trim();
    } catch (e) {}

    let userEmail = '';
    try {
      userEmail = execSync('git config user.email', {
        cwd: dir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 1000
      }).trim();
    } catch (e) {}

    let branches = [];
    try {
      const branchOutput = execSync('git branch --list --no-color', {
        cwd: dir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 1000
      });
      branches = branchOutput
        .split('\n')
        .map(b => b.replace('*', '').trim())
        .filter(b => Boolean(b));
    } catch (e) {}

    return {
      isRepo: true,
      branch: branch || 'master',
      userName: userName || 'Git User',
      userEmail: userEmail,
      branches: branches.length > 0 ? branches : [branch || 'master'],
      cwd: dir
    };
  } catch (err) {
    return { isRepo: false };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 700,
    minHeight: 500,
    title: 'MyTerminal Tux Tux',
    backgroundColor: '#121317',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    for (const [id, item] of ptys.entries()) {
      try {
        if (item.process) item.process.kill();
      } catch (e) {}
    }
    ptys.clear();
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle('shells:get-available', () => {
    return getAvailableShells();
  });

  ipcMain.handle('terminal:create', async (event, { id, cols = 80, rows = 24, cwd, shellPath, initialCommand }) => {
    if (!pty) {
      throw new Error('node-pty is not installed or available on this system.');
    }

    const targetShell = shellPath && fs.existsSync(shellPath) ? shellPath : getDefaultShell();
    const workingDir = cwd && fs.existsSync(cwd) ? cwd : process.cwd();

    const ptyProcess = pty.spawn(targetShell, [], {
      name: 'xterm-256color',
      cols: Math.max(10, cols),
      rows: Math.max(5, rows),
      cwd: workingDir,
      env: {
        ...process.env,
        COLORTERM: 'truecolor',
        TERM: 'xterm-256color'
      }
    });

    ptys.set(id, {
      process: ptyProcess,
      shellPath: targetShell,
      cwd: workingDir
    });

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:data:${id}`, data);
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:exit:${id}`, { exitCode, signal });
      }
      ptys.delete(id);
    });

    if (initialCommand) {
      setTimeout(() => {
        try {
          ptyProcess.write(`${initialCommand}\r`);
        } catch (e) {}
      }, 300);
    }

    return { id, shellPath: targetShell, cwd: workingDir };
  });

  ipcMain.handle('terminal:switch-shell', async (event, { id, shellPath, cols = 80, rows = 24 }) => {
    const existing = ptys.get(id);
    const cwd = getPtyCwd(id);

    if (existing && existing.process) {
      try {
        existing.process.kill();
      } catch (e) {}
    }

    const ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: Math.max(10, cols),
      rows: Math.max(5, rows),
      cwd: cwd,
      env: {
        ...process.env,
        COLORTERM: 'truecolor',
        TERM: 'xterm-256color'
      }
    });

    ptys.set(id, {
      process: ptyProcess,
      shellPath: shellPath,
      cwd: cwd
    });

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:data:${id}`, data);
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal:exit:${id}`, { exitCode, signal });
      }
      ptys.delete(id);
    });

    return { id, shellPath, cwd };
  });

  ipcMain.on('terminal:write', (event, { id, data }) => {
    const item = ptys.get(id);
    if (item && item.process) {
      try {
        item.process.write(data);
      } catch (err) {
        console.error(`Error writing to terminal ${id}:`, err);
      }
    }
  });

  ipcMain.on('terminal:resize', (event, { id, cols, rows }) => {
    const item = ptys.get(id);
    if (item && item.process && cols > 0 && rows > 0) {
      try {
        item.process.resize(cols, rows);
      } catch (err) {}
    }
  });

  ipcMain.handle('terminal:kill', (event, { id }) => {
    const item = ptys.get(id);
    if (item && item.process) {
      try {
        item.process.kill();
      } catch (err) {}
      ptys.delete(id);
      return true;
    }
    return false;
  });

  ipcMain.handle('git:get-info', (event, { id }) => {
    const cwd = getPtyCwd(id);
    return getGitInfoForDir(cwd);
  });

  ipcMain.handle('git:set-user', (event, { id, name, email }) => {
    const cwd = getPtyCwd(id);
    try {
      if (name) execSync(`git config user.name "${name.replace(/"/g, '\\"')}"`, { cwd });
      if (email) execSync(`git config user.email "${email.replace(/"/g, '\\"')}"`, { cwd });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('profiles:get', () => {
    return loadJsonFile('ssh-profiles.json', [
      {
        id: 'sample-local',
        name: 'Localhost (Demo)',
        host: '127.0.0.1',
        port: 22,
        username: os.userInfo().username || 'user',
        authType: 'password',
        keyPath: '',
        extraArgs: ''
      }
    ]);
  });

  ipcMain.handle('profiles:save', (event, profiles) => {
    return saveJsonFile('ssh-profiles.json', profiles);
  });

  ipcMain.handle('sessions:get-all', () => {
    return loadJsonFile('sessions.json', {});
  });

  ipcMain.handle('sessions:save', (event, { name, sessionData }) => {
    const sessions = loadJsonFile('sessions.json', {});
    sessions[name] = {
      name,
      savedAt: new Date().toISOString(),
      ...sessionData
    };
    return saveJsonFile('sessions.json', sessions);
  });

  ipcMain.handle('sessions:delete', (event, name) => {
    const sessions = loadJsonFile('sessions.json', {});
    delete sessions[name];
    return saveJsonFile('sessions.json', sessions);
  });

  ipcMain.handle('tab-templates:get-all', () => {
    return loadJsonFile('tab-templates.json', {
      'Single Terminal': {
        name: 'Single Terminal',
        layout: { type: 'terminal' }
      },
      '2 Terminals Vertical': {
        name: '2 Terminals Vertical',
        layout: {
          type: 'split',
          orientation: 'vertical',
          ratio: 0.5,
          first: { type: 'terminal' },
          second: { type: 'terminal' }
        }
      },
      '2 Terminals Horizontal': {
        name: '2 Terminals Horizontal',
        layout: {
          type: 'split',
          orientation: 'horizontal',
          ratio: 0.5,
          first: { type: 'terminal' },
          second: { type: 'terminal' }
        }
      },
      '4 Terminals (2x2 Grid)': {
        name: '4 Terminals (2x2 Grid)',
        layout: {
          type: 'split',
          orientation: 'horizontal',
          ratio: 0.5,
          first: {
            type: 'split',
            orientation: 'vertical',
            ratio: 0.5,
            first: { type: 'terminal' },
            second: { type: 'terminal' }
          },
          second: {
            type: 'split',
            orientation: 'vertical',
            ratio: 0.5,
            first: { type: 'terminal' },
            second: { type: 'terminal' }
          }
        }
      }
    });
  });

  ipcMain.handle('tab-templates:save', (event, { name, templateData }) => {
    const templates = loadJsonFile('tab-templates.json', {});
    templates[name] = {
      name,
      savedAt: new Date().toISOString(),
      ...templateData
    };
    return saveJsonFile('tab-templates.json', templates);
  });

  ipcMain.handle('tab-templates:delete', (event, name) => {
    const templates = loadJsonFile('tab-templates.json', {});
    delete templates[name];
    return saveJsonFile('tab-templates.json', templates);
  });

  ipcMain.handle('system:info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      homedir: os.homedir(),
      username: os.userInfo().username
    };
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
