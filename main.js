const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Store references to windows to prevent garbage collection
let notes = [];

function createNote() {
  const noteWin = new BrowserWindow({
    width: 300,
    height: 300,
    minWidth: 200,
    minHeight: 200,
    frame: false, // This removes the standard OS chrome (close buttons, title bar)
    transparent: true, // Allows for custom shapes/shadows
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  noteWin.loadFile('index.html');

  // Clean up reference when closed
  noteWin.on('closed', () => {
    notes = notes.filter((n) => n !== noteWin);
  });

  notes.push(noteWin);
}

app.whenReady().then(() => {
  createNote(); // Open first note on launch

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createNote();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS (Communication between UI and Logic) ---

// 1. Create a New Note
ipcMain.on('create-new-note', () => {
  createNote();
});

// 2. Close a specific note
ipcMain.on('close-note', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.close();
});

// 3. Toggle Pin (Always On Top)
ipcMain.on('toggle-pin', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const isPinned = win.isAlwaysOnTop();

  // If currently pinned, unpin. If not, pin on top of everything.
  win.setAlwaysOnTop(!isPinned, 'screen-saver');

  // Tell the frontend the status changed (to change icon color)
  win.webContents.send('pin-status', !isPinned);
});
