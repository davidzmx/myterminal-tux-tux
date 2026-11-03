const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // PTY operations
  createTerminal: (params) => ipcRenderer.invoke('terminal:create', params),
  writeTerminal: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
  killTerminal: (id) => ipcRenderer.invoke('terminal:kill', { id }),

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

  // SSH Profiles
  getProfiles: () => ipcRenderer.invoke('profiles:get'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profiles:save', profiles),

  // Saved Sessions (overall layouts)
  getSessions: () => ipcRenderer.invoke('sessions:get-all'),
  saveSession: (name, sessionData) => ipcRenderer.invoke('sessions:save', { name, sessionData }),
  deleteSession: (name) => ipcRenderer.invoke('sessions:delete', name),

  // Saved Tab Layouts (tab templates)
  getTabTemplates: () => ipcRenderer.invoke('tab-templates:get-all'),
  saveTabTemplate: (name, templateData) => ipcRenderer.invoke('tab-templates:save', { name, templateData }),
  deleteTabTemplate: (name) => ipcRenderer.invoke('tab-templates:delete', name),

  // System
  getSystemInfo: () => ipcRenderer.invoke('system:info')
});
