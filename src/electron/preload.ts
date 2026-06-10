import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('jarvisAPI', {
  runCommand: (command: string) => ipcRenderer.invoke('jarvis:run', command),
  synthesize: (text: string) => ipcRenderer.invoke('jarvis:synthesize', text),
  transcribe: (base64Audio: string) => ipcRenderer.invoke('jarvis:transcribe', base64Audio),
  onProgress: (callback: (stage: string, message: string) => void) => {
    ipcRenderer.on('jarvis:progress', (_event, data) => callback(data.stage, data.message));
  },
  getMemories: () => ipcRenderer.invoke('jarvis:get-memories'),
  deleteMemory: (id: number) => ipcRenderer.invoke('jarvis:delete-memory', id),
  hideWindow: () => ipcRenderer.send('jarvis:hide'),
  removeListeners: () => {
    ipcRenderer.removeAllListeners('jarvis:progress');
  }
});
