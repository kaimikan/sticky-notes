const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Note Actions
  saveNote: (data) => ipcRenderer.send('update-note-content', data),
  togglePin: () => ipcRenderer.send('toggle-pin'),
  minimizeWindow: () => ipcRenderer.send('minimize-note'),
  closeWindow: () => ipcRenderer.send('close-window'),
  resizeWindow: (size) => ipcRenderer.send('resize-me', size),
  deleteNote: (id) => ipcRenderer.send('delete-note', id),

  // Manager Actions
  requestNotes: () => ipcRenderer.send('request-notes-list'),
  openNote: (id) => ipcRenderer.send('open-note', id),
  createNewNote: () => ipcRenderer.send('create-new-note'),

  // Listeners
  onLoadData: (cb) => ipcRenderer.on('load-note-data', cb),
  onPinUpdated: (cb) => ipcRenderer.on('pin-updated', cb),
  onRefreshManager: (cb) => ipcRenderer.on('refresh-manager-list', cb),
});
