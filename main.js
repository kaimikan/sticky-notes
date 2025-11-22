const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, 'note-logs');
const iconPath = path.join(__dirname, 'icon.png'); // Load your custom icon

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
  fs.writeFileSync(path.join(dataDir, '.gitignore'), '*.json');
}

let managerWin = null;
let noteWindows = new Map(); // Map to track open notes by ID

// --- 1. The Manager Window (Dashboard) ---
function createManagerWindow() {
  if (managerWin) {
    managerWin.focus();
    return;
  }

  managerWin = new BrowserWindow({
    width: 400,
    height: 600,
    title: 'Notes Manager',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  managerWin.loadFile('manager.html');

  managerWin.on('closed', () => {
    managerWin = null;
    // Optional: Quit app when manager closes?
    // app.quit();
  });
}

// --- 2. The Sticky Note Window ---
function createNoteWindow(id = null) {
  // If ID is provided, load that note. If not, create new state.
  let state;

  if (id && fs.existsSync(path.join(dataDir, `${id}.json`))) {
    // If note is already open, focus it
    if (noteWindows.has(id)) {
      noteWindows.get(id).focus();
      return;
    }
    state = JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`)));
  } else {
    state = {
      id: uuidv4(),
      content: '',
      color: '#2d3436', // Default Dark Grey
      width: 300,
      height: 300,
      x: undefined,
      y: undefined,
      isPinned: false,
    };
    // Save immediately so it shows in manager
    fs.writeFileSync(
      path.join(dataDir, `${state.id}.json`),
      JSON.stringify(state)
    );
    refreshManager();
  }

  const noteWin = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 250,
    minHeight: 100, // CHANGED FROM 150/250 TO 100
    frame: false,
    transparent: true,
    alwaysOnTop: state.isPinned,
    skipTaskbar: true, // ANTI-CLUTTER: Won't show in taskbar
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  noteWin.loadFile('index.html');

  // Store reference
  noteWindows.set(state.id, noteWin);

  noteWin.webContents.once('dom-ready', () => {
    noteWin.webContents.send('load-note-data', state);
  });

  // Auto-save position
  const saveState = () => {
    const [w, h] = noteWin.getSize();
    const [x, y] = noteWin.getPosition();
    state.width = w;
    state.height = h;
    state.x = x;
    state.y = y;
    fs.writeFileSync(
      path.join(dataDir, `${state.id}.json`),
      JSON.stringify(state)
    );
  };

  noteWin.on('move', saveState);
  noteWin.on('resize', saveState);

  noteWin.on('closed', () => {
    noteWindows.delete(state.id);
  });
}

// Send updated list to Manager
function refreshManager() {
  if (managerWin) {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
    const notes = files.map((f) =>
      JSON.parse(fs.readFileSync(path.join(dataDir, f)))
    );
    managerWin.webContents.send('refresh-manager-list', notes);
  }
}

app.whenReady().then(() => {
  createManagerWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createManagerWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// Manager requesting list
ipcMain.on('request-notes-list', () => refreshManager());

// Open a note from manager
ipcMain.on('open-note', (e, id) => createNoteWindow(id));

// Create new note
ipcMain.on('create-new-note', () => createNoteWindow());

// Update content (and refresh manager preview)
ipcMain.on('update-note-content', (event, data) => {
  const filePath = path.join(dataDir, `${data.id}.json`);
  if (fs.existsSync(filePath)) {
    // Merge new data with existing (to keep x,y,width,height)
    const existing = JSON.parse(fs.readFileSync(filePath));
    const updated = { ...existing, ...data };
    fs.writeFileSync(filePath, JSON.stringify(updated));
    refreshManager();
  }
});

ipcMain.on('delete-note', (event, id) => {
  const filePath = path.join(dataDir, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  // Close window if open
  if (noteWindows.has(id)) noteWindows.get(id).close();

  refreshManager();
});

ipcMain.on('toggle-pin', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const isPinned = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(isPinned, 'screen-saver');
  win.webContents.send('pin-updated', isPinned);
});

ipcMain.on('minimize-note', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.minimize();
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.close();
});

ipcMain.on('resize-me', (event, sizeStr) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const [w, h] = win.getSize();
  let newHeight = 300;

  // Ensure these values are larger than minHeight (100)
  if (sizeStr === 'small') newHeight = 200;
  if (sizeStr === 'medium') newHeight = 450;
  if (sizeStr === 'large') newHeight = 700;

  win.setSize(w, newHeight, true);
});
