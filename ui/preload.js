const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
    hideWindow: () => ipcRenderer.invoke('window-hide'),

    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    isMaximized: () => ipcRenderer.invoke('is-maximized'),

    // Window state
    toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),

    // Platform info
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,
    }
});
