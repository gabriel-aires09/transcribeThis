const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('secureStorage', {
  set: (value) => ipcRenderer.invoke('secure-storage:set', value),
  get: () => ipcRenderer.invoke('secure-storage:get'),
  clear: () => ipcRenderer.invoke('secure-storage:clear'),
});
