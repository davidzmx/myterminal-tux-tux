const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (newConfig) => ipcRenderer.invoke('config:save', newConfig),
  resetButtonGroups: () => ipcRenderer.invoke('config:reset-button-groups'),
  exportAllConfig: () => ipcRenderer.invoke('config:export-all'),
  importAllConfig: () => ipcRenderer.invoke('config:import-all'),

  // Shells
  getAvailableShells: () => ipcRenderer.invoke('shells:get-available'),

  // PTY operations
  createTerminal: (params) => ipcRenderer.invoke('terminal:create', params),
  switchTerminalShell: (id, shellPath) => ipcRenderer.invoke('terminal:switch-shell', { id, shellPath }),
  writeTerminal: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
  killTerminal: (id) => ipcRenderer.invoke('terminal:kill', { id }),
  getTerminalCwd: (id) => ipcRenderer.invoke('terminal:get-cwd', { id }),
  getTerminalSshStatus: (id) => ipcRenderer.invoke('terminal:get-ssh-status', { id }),

  // Data listeners
  onTerminalData: (id, callback) => {
    const channel = `terminal:data:${id}`;
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onTerminalExit: (id, callback) => {
    const channel = `terminal:exit:${id}`;
    const listener = (event, info) => callback(info);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // Git integration
  getGitInfo: (id) => ipcRenderer.invoke('git:get-info', { id }),
  getGitStatusFiles: (id) => ipcRenderer.invoke('git:get-status-files', { id }),
  setGitUser: (id, name, email) => ipcRenderer.invoke('git:set-user', { id, name, email }),

  // SSH Profiles
  getProfiles: () => ipcRenderer.invoke('profiles:get'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profiles:save', profiles),
  testSshConnection: (profile) => ipcRenderer.invoke('ssh:test-connection', profile),

  // Saved Sessions (overall layouts)
  getSessions: () => ipcRenderer.invoke('sessions:get-all'),
  saveSession: (name, sessionData) => ipcRenderer.invoke('sessions:save', { name, sessionData }),
  deleteSession: (name) => ipcRenderer.invoke('sessions:delete', name),

  // Saved Tab Layouts (tab templates)
  getTabTemplates: () => ipcRenderer.invoke('tab-templates:get-all'),
  saveTabTemplate: (name, templateData) => ipcRenderer.invoke('tab-templates:save', { name, templateData }),
  deleteTabTemplate: (name) => ipcRenderer.invoke('tab-templates:delete', name),

  // Google Drive Cloud Sync
  gdrive: {
    getStatus: () => ipcRenderer.invoke('gdrive:get-status'),
    importCredentials: (customPath) => ipcRenderer.invoke('gdrive:import-client-credentials', customPath),
    login: () => ipcRenderer.invoke('gdrive:login'),
    logout: () => ipcRenderer.invoke('gdrive:logout'),
    checkRemote: () => ipcRenderer.invoke('gdrive:check-remote'),
    uploadSync: (masterPassword) => ipcRenderer.invoke('gdrive:upload-sync', { masterPassword }),
    downloadSync: (masterPassword) => ipcRenderer.invoke('gdrive:download-sync', { masterPassword }),
    syncNow: (masterPassword) => ipcRenderer.invoke('gdrive:sync-now', { masterPassword }),
    saveOptions: (options) => ipcRenderer.invoke('gdrive:save-sync-options', options),
    autoPull: () => ipcRenderer.invoke('gdrive:auto-pull'),
    setMasterPassword: (masterPassword) => ipcRenderer.invoke('gdrive:set-master-password', { masterPassword }),
    clearMasterPassword: () => ipcRenderer.invoke('gdrive:clear-master-password')
  },

  // System & Application
  getHomeDir: () => ipcRenderer.invoke('system:get-home'),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
  onRequestClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:request-close', listener);
    return () => ipcRenderer.removeListener('app:request-close', listener);
  },
  exitApp: () => ipcRenderer.invoke('app:exit')
});
