const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const net = require('net');
const { execFile, execSync } = require('child_process');

let pty;
try {
  pty = require('node-pty');
} catch (err) {
  console.warn('node-pty could not be loaded directly:', err.message);
}

let mainWindow = null;
let isQuitting = false;
const ptys = new Map(); // id -> { process, shellPath, cwd }

// Helper: Detect installed shells across Linux, macOS, and Windows
function getAvailableShells() {
  const shells = [];
  const platform = process.platform;

  if (platform === 'win32') {
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

    // Prioritize Bash first for Linux
    ['/bin/bash', '/usr/bin/bash'].forEach(p => candidatePaths.push(p));

    if (fs.existsSync('/etc/shells')) {
      try {
        const lines = fs.readFileSync('/etc/shells', 'utf-8').split('\n');
        for (let line of lines) {
          line = line.trim();
          if (line && !line.startsWith('#') && !candidatePaths.includes(line)) {
            candidatePaths.push(line);
          }
        }
      } catch (e) {}
    }

    ['/bin/dash', '/usr/bin/dash', '/bin/zsh', '/usr/bin/zsh', '/usr/bin/fish', '/bin/sh'].forEach(p => {
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

// Default Configuration
function getDefaultConfig() {
  const available = getAvailableShells();
  let defaultShellPath = '';

  if (process.platform === 'win32') {
    const ps = available.find(s => s.name.includes('PowerShell'));
    defaultShellPath = ps ? ps.path : (process.env.COMSPEC || 'powershell.exe');
  } else {
    // Linux: default to bash
    const bash = available.find(s => s.path === '/bin/bash' || s.path === '/usr/bin/bash' || s.name.toLowerCase() === 'bash');
    defaultShellPath = bash ? bash.path : (available[0]?.path || '/bin/bash');
  }

  return {
    theme: 'dark',
    defaultShell: defaultShellPath,
    fontSize: 13,
    fontFamily: 'Consolas, "Fira Code", monospace',
    scrollback: 5000,
    defaultDir: 'cwd',
    sshHeaderColor: '#b91c1c',
    activeButtonGroup: 'group-git',
    buttonGroups: [
      {
        id: 'group-git',
        name: 'Git',
        icon: '🌿',
        isGit: true,
        actions: [
          { id: 'act-status', label: 'Status', cmd: 'git status', enabled: true },
          { id: 'act-add', label: 'Add', cmd: 'git add -A', enabled: true },
          { id: 'act-unstage', label: 'Unstage', cmd: 'git reset', enabled: true },
          { id: 'act-commit', label: 'Commit', cmd: 'git commit -m "{prompt:Mensaje de commit}"', enabled: true },
          { id: 'act-push', label: 'Push', cmd: 'git push', enabled: true },
          { id: 'act-pull', label: 'Pull', cmd: 'git pull', enabled: true },
          { id: 'act-fetch', label: 'Fetch', cmd: 'git fetch', enabled: true },
          { id: 'act-diff', label: 'Diff', cmd: 'git diff', enabled: true },
          { id: 'act-log', label: 'Log', cmd: 'git log --oneline -n 10', enabled: true }
        ]
      },
      {
        id: 'group-sys',
        name: 'Sistema',
        icon: '💻',
        isGit: false,
        actions: [
          { id: 'act-sys-top', label: 'Top', cmd: 'top', enabled: true },
          { id: 'act-sys-df', label: 'Disco (df)', cmd: 'df -h', enabled: true },
          { id: 'act-sys-free', label: 'RAM (free)', cmd: 'free -h', enabled: true },
          { id: 'act-sys-ps', label: 'Procesos', cmd: 'ps aux --sort=-%mem | head -n 15', enabled: true },
          { id: 'act-sys-ports', label: 'Puertos (ss)', cmd: 'ss -tulpn', enabled: true },
          { id: 'act-sys-uname', label: 'Kernel', cmd: 'uname -a', enabled: true },
          { id: 'act-sys-uptime', label: 'Uptime', cmd: 'uptime', enabled: true },
          { id: 'act-sys-ip', label: 'IPs', cmd: 'ip -brief addr', enabled: true }
        ]
      },
      {
        id: 'group-docker',
        name: 'Docker',
        icon: '🐳',
        isGit: false,
        actions: [
          { id: 'act-doc-ps', label: 'ps', cmd: 'docker ps', enabled: true },
          { id: 'act-doc-images', label: 'images', cmd: 'docker images', enabled: true },
          { id: 'act-doc-logs', label: 'logs', cmd: 'docker logs --tail 50 -f {prompt:ID o contenedor}', enabled: true },
          { id: 'act-doc-stats', label: 'stats', cmd: 'docker stats --no-stream', enabled: true },
          { id: 'act-doc-up', label: 'compose up', cmd: 'docker compose up -d', enabled: true },
          { id: 'act-doc-down', label: 'compose down', cmd: 'docker compose down', enabled: true }
        ]
      },
      {
        id: 'group-npm',
        name: 'Node / NPM',
        icon: '📦',
        isGit: false,
        actions: [
          { id: 'act-npm-start', label: 'npm start', cmd: 'npm start', enabled: true },
          { id: 'act-npm-test', label: 'npm test', cmd: 'npm test', enabled: true },
          { id: 'act-npm-build', label: 'npm run build', cmd: 'npm run build', enabled: true },
          { id: 'act-npm-outdated', label: 'npm outdated', cmd: 'npm outdated', enabled: true }
        ]
      }
    ],
    gitActions: [
      { id: 'act-status', label: 'Status', cmd: 'git status', enabled: true },
      { id: 'act-add', label: 'Add', cmd: 'git add -A', enabled: true },
      { id: 'act-unstage', label: 'Unstage', cmd: 'git reset', enabled: true },
      { id: 'act-commit', label: 'Commit', cmd: 'git commit -m "{prompt:Mensaje de commit}"', enabled: true },
      { id: 'act-push', label: 'Push', cmd: 'git push', enabled: true },
      { id: 'act-pull', label: 'Pull', cmd: 'git pull', enabled: true },
      { id: 'act-fetch', label: 'Fetch', cmd: 'git fetch', enabled: true },
      { id: 'act-diff', label: 'Diff', cmd: 'git diff', enabled: true },
      { id: 'act-log', label: 'Log', cmd: 'git log --oneline -n 10', enabled: true }
    ],
    favorites: [
      { id: 'fav-home', name: 'Inicio (~)', path: os.homedir() }
    ]
  };
}

function getUserConfig() {
  const defaults = getDefaultConfig();
  const saved = loadJsonFile('config.json', {});
  let buttonGroups = saved.buttonGroups;

  if (!buttonGroups || !Array.isArray(buttonGroups) || buttonGroups.length === 0) {
    buttonGroups = JSON.parse(JSON.stringify(defaults.buttonGroups));
    if (saved.gitActions && Array.isArray(saved.gitActions) && saved.gitActions.length > 0) {
      const gitGroup = buttonGroups.find((g) => g.id === 'group-git');
      if (gitGroup) {
        gitGroup.actions = saved.gitActions.filter(
          (a) => a.action !== 'user-git' && a.label !== 'user Git'
        );
      }
    }
  }

  const gitGroup = buttonGroups.find((g) => g.isGit || g.id === 'group-git');
  const gitActions = gitGroup ? gitGroup.actions : defaults.gitActions;

  let favorites = saved.favorites;
  if (!favorites || !Array.isArray(favorites)) {
    favorites = JSON.parse(JSON.stringify(defaults.favorites));
  }

  return {
    ...defaults,
    ...saved,
    buttonGroups,
    gitActions,
    favorites
  };
}

function getDefaultShell() {
  const config = getUserConfig();
  if (config.defaultShell && fs.existsSync(config.defaultShell)) {
    return config.defaultShell;
  }
  return getDefaultConfig().defaultShell;
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

function getGitStatusFiles(dir) {
  try {
    if (!dir || !fs.existsSync(dir)) {
      return { isRepo: false, files: [] };
    }

    const isInside = execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000
    }).trim();

    if (isInside !== 'true') {
      return { isRepo: false, files: [] };
    }

    const output = execSync('git status --porcelain=v1 -u', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 2000
    });

    const lines = output.split('\n');
    const files = [];

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (line.length < 4) continue;
      const x = line[0];
      const y = line[1];
      let filePath = line.substring(3).trim();
      if (filePath.includes(' -> ')) {
        filePath = filePath.split(' -> ')[1].trim();
      }
      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1);
      }

      const isUntracked = (x === '?' && y === '?');
      const isStaged = (x !== ' ' && x !== '?');
      const isUnstaged = (y !== ' ');

      let stagedLabel = '';
      if (x === 'M') stagedLabel = 'Modificado';
      else if (x === 'A') stagedLabel = 'Agregado';
      else if (x === 'D') stagedLabel = 'Eliminado';
      else if (x === 'R') stagedLabel = 'Renombrado';
      else if (x === 'C') stagedLabel = 'Copiado';

      let unstagedLabel = '';
      if (isUntracked) unstagedLabel = 'Sin seguimiento';
      else if (y === 'M') unstagedLabel = 'Modificado';
      else if (y === 'D') unstagedLabel = 'Eliminado';

      files.push({
        path: filePath,
        x,
        y,
        isUntracked,
        isStaged,
        isUnstaged,
        stagedLabel,
        unstagedLabel
      });
    }

    return { isRepo: true, files };
  } catch (err) {
    return { isRepo: false, files: [] };
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

  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:request-close');
    }
  });

  mainWindow.on('closed', () => {
    for (const [id, item] of ptys.entries()) {
      try {
        if (item.process) {
          item.process.removeAllListeners();
          item.process.kill();
        }
      } catch (e) {}
    }
    ptys.clear();
    mainWindow = null;
  });
}

function getTerminalSshStatus(id) {
  const item = ptys.get(id);
  if (!item || !item.process || !item.process.pid) {
    return { connected: false, hasSsh: false };
  }

  if (process.platform !== 'linux') {
    return { connected: true, hasSsh: true };
  }

  const shellPid = item.process.pid;
  try {
    const descendants = [];
    const queue = [shellPid];
    while (queue.length > 0) {
      const parent = queue.shift();
      try {
        const out = execSync(`pgrep -P ${parent}`, { encoding: 'utf-8', timeout: 300 }).trim();
        if (out) {
          const children = out.split(/\s+/).map(Number).filter(Boolean);
          for (const c of children) {
            descendants.push(c);
            queue.push(c);
          }
        }
      } catch (e) {}
    }

    let sshPid = null;
    let cmdline = '';

    for (const p of descendants) {
      try {
        const comm = fs.readFileSync(`/proc/${p}/comm`, 'utf-8').trim();
        if (comm.toLowerCase().includes('ssh')) {
          sshPid = p;
          try {
            cmdline = fs.readFileSync(`/proc/${p}/cmdline`, 'utf-8').replace(/\0/g, ' ').trim();
          } catch (e) {}
          break;
        }
      } catch (e) {}
    }

    if (!sshPid) {
      return { connected: false, hasSsh: false };
    }

    // Check if the ssh process has an ESTABLISHED TCP connection
    try {
      const ssOut = execSync('ss -tnp', { encoding: 'utf-8', timeout: 500 });
      const lines = ssOut.split('\n');
      const isEstab = lines.some((line) => line.includes('ESTAB') && line.includes(`pid=${sshPid}`));
      return {
        connected: isEstab,
        hasSsh: true,
        sshPid,
        cmdline
      };
    } catch (e) {
      return { connected: false, hasSsh: true, sshPid, cmdline };
    }
  } catch (err) {
    return { connected: false, hasSsh: false };
  }
}

function registerIpcHandlers() {
  // Config
  ipcMain.handle('config:get', () => {
    return getUserConfig();
  });

  ipcMain.handle('config:save', (event, newConfig) => {
    return saveJsonFile('config.json', newConfig);
  });

  // Export / Import All Configuration (Backup across computers)
  ipcMain.handle('config:export-all', async () => {
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const defaultFilename = `myterminal-config-${dateStr}.json`;

      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exportar Configuración Completa de MyTerminal Tux Tux',
        defaultPath: defaultFilename,
        filters: [
          { name: 'Archivos JSON (*.json)', extensions: ['json'] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { canceled: true };
      }

      const bundle = {
        app: 'myterminal-tux-tux',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        config: getUserConfig(),
        profiles: loadJsonFile('ssh-profiles.json', []),
        sessions: loadJsonFile('sessions.json', {}),
        tabTemplates: loadJsonFile('tab-templates.json', {})
      };

      fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), 'utf-8');
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('config:import-all', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Importar Configuración Completa de MyTerminal Tux Tux',
        filters: [
          { name: 'Archivos JSON (*.json)', extensions: ['json'] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (canceled || !filePaths || filePaths.length === 0) {
        return { canceled: true };
      }

      const raw = fs.readFileSync(filePaths[0], 'utf-8');
      let data;
      try {
        data = JSON.parse(raw);
      } catch (parseErr) {
        return { success: false, error: 'El archivo seleccionado no es un JSON válido.' };
      }

      if (!data || typeof data !== 'object') {
        return { success: false, error: 'El archivo seleccionado no contiene un formato de configuración válido.' };
      }

      if (data.config && typeof data.config === 'object') {
        // Cross-platform sanitization for defaultShell
        if (data.config.defaultShell) {
          const available = getAvailableShells();
          const exists = available.some((s) => s.path === data.config.defaultShell);
          if (!exists) {
            // Fallback to host's default shell
            let defaultShellPath = available[0]?.path || '';
            if (process.platform === 'win32') {
              const ps = available.find(s => s.name.includes('PowerShell'));
              defaultShellPath = ps ? ps.path : (process.env.COMSPEC || 'powershell.exe');
            } else {
              const bash = available.find(s => s.path === '/bin/bash' || s.path === '/usr/bin/bash' || s.name.toLowerCase() === 'bash');
              defaultShellPath = bash ? bash.path : (available[0]?.path || '/bin/bash');
            }
            data.config.defaultShell = defaultShellPath;
          }
        }
        saveJsonFile('config.json', data.config);
      }
      if (Array.isArray(data.profiles)) {
        saveJsonFile('ssh-profiles.json', data.profiles);
      }
      if (data.sessions && typeof data.sessions === 'object') {
        saveJsonFile('sessions.json', data.sessions);
      }
      if (data.tabTemplates && typeof data.tabTemplates === 'object') {
        saveJsonFile('tab-templates.json', data.tabTemplates);
      }

      return {
        success: true,
        filePath: filePaths[0],
        importedData: {
          config: data.config || null,
          profiles: data.profiles || null,
          sessions: data.sessions || null,
          tabTemplates: data.tabTemplates || null
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('config:reset-button-groups', () => {
    return getDefaultConfig().buttonGroups;
  });

  // Available Shells
  ipcMain.handle('shells:get-available', () => {
    return getAvailableShells();
  });

  // PTY: Create terminal process
  ipcMain.handle('terminal:create', async (event, { id, cols = 80, rows = 24, cwd, shellPath, initialCommand }) => {
    if (!pty) {
      throw new Error('node-pty is not installed or available on this system.');
    }

    const config = getUserConfig();
    const targetShell = shellPath && fs.existsSync(shellPath) ? shellPath : getDefaultShell();
    
    let defaultWorkingDir = process.cwd();
    if (config.defaultDir === 'home') {
      defaultWorkingDir = os.homedir();
    }
    const workingDir = cwd && fs.existsSync(cwd) ? cwd : defaultWorkingDir;

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
      const current = ptys.get(id);
      if (current && current.process === ptyProcess) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(`terminal:exit:${id}`, { exitCode, signal });
        }
        ptys.delete(id);
      }
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

  // PTY: Switch shell safely without breaking listeners or killing new process
  ipcMain.handle('terminal:switch-shell', async (event, { id, shellPath, cols = 80, rows = 24 }) => {
    const existing = ptys.get(id);
    const cwd = getPtyCwd(id);

    if (existing && existing.process) {
      try {
        // Disarm old process exit listener before killing so it doesn't delete the new entry
        existing.process.removeAllListeners('exit');
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
      const current = ptys.get(id);
      if (current && current.process === ptyProcess) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(`terminal:exit:${id}`, { exitCode, signal });
        }
        ptys.delete(id);
      }
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
    } else {
      console.warn(`Attempted write to non-existent or dead terminal: ${id}`);
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
        item.process.removeAllListeners();
        item.process.kill();
      } catch (err) {}
      ptys.delete(id);
      return true;
    }
    return false;
  });

  ipcMain.handle('terminal:get-cwd', (event, { id }) => {
    return getPtyCwd(id);
  });

  ipcMain.handle('terminal:get-ssh-status', (event, { id }) => {
    return getTerminalSshStatus(id);
  });

  // Git
  ipcMain.handle('git:get-info', (event, { id }) => {
    const cwd = getPtyCwd(id);
    return getGitInfoForDir(cwd);
  });

  ipcMain.handle('git:get-status-files', (event, { id }) => {
    const cwd = getPtyCwd(id);
    return getGitStatusFiles(cwd);
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

  // SSH Profiles (with password support)
  ipcMain.handle('profiles:get', () => {
    return loadJsonFile('ssh-profiles.json', [
      {
        id: 'sample-local',
        name: 'Localhost (Demo)',
        host: '127.0.0.1',
        port: 22,
        username: os.userInfo().username || 'user',
        authType: 'password',
        password: '',
        keyPath: '',
        passphrase: '',
        extraArgs: ''
      }
    ]);
  });

  ipcMain.handle('profiles:save', (event, profiles) => {
    return saveJsonFile('ssh-profiles.json', profiles);
  });

  // SSH Test Connection (checks host/port reachability, banner, and optional authentication)
  ipcMain.handle('ssh:test-connection', async (event, profile) => {
    if (!profile || !profile.host) {
      return { success: false, error: 'Host o dirección IP no especificada.' };
    }
    const host = String(profile.host).trim();
    const port = parseInt(profile.port, 10) || 22;
    const username = (profile.username || '').trim();
    const authType = profile.authType || 'password';
    const password = profile.password || '';
    const keyPath = profile.keyPath || '';
    const passphrase = profile.passphrase || '';

    // Step 1: TCP connection & SSH Protocol Banner
    let banner = '';
    try {
      banner = await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port, timeout: 4500 });
        let received = '';
        socket.on('data', (chunk) => {
          received += chunk.toString();
          if (received.includes('\n') || received.length > 20) {
            socket.destroy();
            resolve(received.trim());
          }
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error(`Tiempo de espera agotado (4.5s) al conectar con ${host}:${port}`));
        });
        socket.on('error', (err) => {
          socket.destroy();
          let msg = err.message;
          if (err.code === 'ECONNREFUSED') msg = 'Conexión rechazada (el puerto no está abierto o el servicio SSH no está activo).';
          if (err.code === 'ENOTFOUND') msg = 'Host o dominio no encontrado (error DNS).';
          if (err.code === 'EHOSTUNREACH') msg = 'Host no alcanzable (la máquina está apagada o no hay ruta).';
          if (err.code === 'ETIMEDOUT') msg = 'Tiempo de espera agotado.';
          reject(new Error(msg));
        });
      });
    } catch (tcpErr) {
      return {
        success: false,
        error: `No se pudo conectar a ${host}:${port} - ${tcpErr.message}`
      };
    }

    // If username is empty or pty is not available, report TCP reachability success
    if (!username || !pty) {
      return {
        success: true,
        message: `Servidor SSH alcanzable en ${host}:${port}. Versión detectada: ${banner}`
      };
    }

    // Step 2: Test SSH authentication via pseudo-terminal
    try {
      const authResult = await new Promise((resolve) => {
        let responded = false;
        let ptyProcess = null;

        const done = (res) => {
          if (!responded) {
            responded = true;
            try {
              if (ptyProcess) ptyProcess.kill();
            } catch (e) {}
            resolve(res);
          }
        };

        const timer = setTimeout(() => {
          done({
            success: false,
            error: 'Tiempo de espera agotado esperando autenticación SSH (9s).'
          });
        }, 9000);

        const sshArgs = [
          '-p', String(port),
          '-o', 'StrictHostKeyChecking=accept-new',
          '-o', 'ConnectTimeout=5',
          '-o', 'NumberOfPasswordPrompts=1'
        ];

        if (authType === 'key' && keyPath) {
          sshArgs.push('-i', keyPath);
        }

        sshArgs.push(`${username}@${host}`, 'echo __MYTERM_SSH_TEST_SUCCESS__');

        try {
          ptyProcess = pty.spawn('ssh', sshArgs, {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: os.homedir(),
            env: process.env
          });
        } catch (spawnErr) {
          clearTimeout(timer);
          return resolve({
            success: true,
            message: `Servidor SSH alcanzable en ${host}:${port} (${banner}).`
          });
        }

        let output = '';
        let sentSecret = false;

        ptyProcess.onData((data) => {
          output += data;
          if (output.includes('__MYTERM_SSH_TEST_SUCCESS__')) {
            clearTimeout(timer);
            done({
              success: true,
              message: `¡Conexión y autenticación exitosas! (${banner})`
            });
            return;
          }

          const isPrompt = /(password|passphrase|contraseña|password for [^:]+):\s*$/i.test(output.trim());
          if (isPrompt && !sentSecret) {
            sentSecret = true;
            const secret = (authType === 'key' ? passphrase : password) || '';
            if (secret) {
              setTimeout(() => {
                try {
                  ptyProcess.write(`${secret}\r`);
                } catch (e) {}
              }, 120);
            } else {
              clearTimeout(timer);
              done({
                success: true,
                warning: true,
                message: `Servidor SSH alcanzable (${banner}), pero solicita contraseña y el campo está vacío en el formulario.`
              });
            }
          }

          if (/(permission denied|authentication failed)/i.test(output)) {
            clearTimeout(timer);
            done({
              success: false,
              error: 'Autenticación rechazada (Permission denied). Revisa tu usuario y contraseña/llave.'
            });
          }
        });

        ptyProcess.onExit(({ exitCode }) => {
          clearTimeout(timer);
          if (output.includes('__MYTERM_SSH_TEST_SUCCESS__') || exitCode === 0) {
            done({
              success: true,
              message: `¡Conexión y autenticación exitosas! (${banner})`
            });
          } else if (/(permission denied|authentication failed)/i.test(output)) {
            done({
              success: false,
              error: 'Autenticación rechazada (Permission denied). Revisa usuario o credenciales.'
            });
          } else if (sentSecret) {
            done({
              success: false,
              error: 'Credencial incorrecta o el host cerró la conexión.'
            });
          } else {
            done({
              success: true,
              message: `Servidor SSH alcanzable en ${host}:${port} (${banner}).`
            });
          }
        });
      });

      return authResult;
    } catch (err) {
      return {
        success: true,
        message: `Servidor SSH alcanzable en ${host}:${port} (${banner}).`
      };
    }
  });

  // Sessions
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

  // Tab Templates
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

  // Application exit
  ipcMain.handle('app:exit', () => {
    isQuitting = true;
    for (const [id, item] of ptys.entries()) {
      try {
        if (item.process) {
          item.process.removeAllListeners();
          item.process.kill();
        }
      } catch (e) {}
    }
    ptys.clear();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    app.quit();
  });

  // System info
  ipcMain.handle('system:get-home', () => {
    return os.homedir();
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

app.on('before-quit', (e) => {
  if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    mainWindow.webContents.send('app:request-close');
  }
});

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
