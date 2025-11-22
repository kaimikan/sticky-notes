const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createNewNote: () => ipcRenderer.send('create-new-note'),
  closeNote: () => ipcRenderer.send('close-note'),
  togglePin: () => ipcRenderer.send('toggle-pin'),
  onPinStatus: (callback) => ipcRenderer.on('pin-status', callback),
});
