const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
let pty;
try {
  pty = require('node-pty');
} catch (err) {
  console.warn('node-pty could not be loaded directly:', err.message);
}

let mainWindow = null;
const ptys = new Map();

// Helper to determine default user shell
function getDefaultShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

// Storage paths
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: 'MyTerminal Tux Tux',
    backgroundColor: '#121317',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  // Remove default menu for a clean sleek Terminator look
  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    // Kill all running PTY processes on close
    for (const [id, ptyProcess] of ptys.entries()) {
      try {
        ptyProcess.kill();
      } catch (e) {}
    }
    ptys.clear();
    mainWindow = null;
  });
}

// Setup IPC handlers
function registerIpcHandlers() {
  // PTY: Create terminal process
  ipcMain.handle('terminal:create', async (event, { id, cols = 80, rows = 24, cwd, initialCommand }) => {
    if (!pty) {
      throw new Error('node-pty is not installed or available on this system.');
    }

    const shell = getDefaultShell();
    const workingDir = cwd && fs.existsSync(cwd) ? cwd : os.homedir();

    const ptyProcess = pty.spawn(shell, [], {
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

    ptys.set(id, ptyProcess);

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

    return { id, shell };
  });

  // PTY: Write data
  ipcMain.on('terminal:write', (event, { id, data }) => {
    const ptyProcess = ptys.get(id);
    if (ptyProcess) {
      try {
        ptyProcess.write(data);
      } catch (err) {
        console.error(`Error writing to terminal ${id}:`, err);
      }
    }
  });

  // PTY: Resize terminal
  ipcMain.on('terminal:resize', (event, { id, cols, rows }) => {
    const ptyProcess = ptys.get(id);
    if (ptyProcess && cols > 0 && rows > 0) {
      try {
        ptyProcess.resize(cols, rows);
      } catch (err) {
        // Can happen if process recently exited
      }
    }
  });

  // PTY: Kill process
  ipcMain.handle('terminal:kill', (event, { id }) => {
    const ptyProcess = ptys.get(id);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (err) {}
      ptys.delete(id);
      return true;
    }
    return false;
  });

  // SSH Profiles Storage
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

  // Session Layouts Storage
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

  // Tab Templates Storage
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

  // System info
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
