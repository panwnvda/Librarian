'use strict';

const { app, BrowserWindow, shell, Menu, MenuItem, nativeTheme } = require('electron');
const path = require('path');

// True when running via `npm run electron:dev`, false in a packaged build.
const isDev = !app.isPackaged;

// Windows taskbar grouping — must match build.appId in package.json.
// Without this, Windows pins the app under "electron.app.Librarian" generically.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.librarian.app');
}

// Prevent multiple instances of the app from running simultaneously.
// On Windows, double-clicking the shortcut while running would otherwise spawn a second process.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

nativeTheme.themeSource = 'dark';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // External links open in the system browser, not a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Right-click context menu with spell-check suggestions and an
  // "Add to dictionary" option, so the user can permanently dismiss
  // technical jargon (tool names, MITRE technique IDs, etc.) that
  // Electron's bundled spellchecker flags with red squiggles.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();
    const word = params.misspelledWord;

    if (word) {
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        }));
      }
      if (params.dictionarySuggestions.length === 0) {
        menu.append(new MenuItem({ label: 'No suggestions', enabled: false }));
      }
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({
        label: 'Add to dictionary',
        click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(word),
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    if (params.isEditable || params.selectionText) {
      menu.append(new MenuItem({ role: 'cut', enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ role: 'copy', enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ role: 'paste', enabled: params.editFlags.canPaste }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'selectAll' }));
    }

    if (menu.items.length > 0) {
      menu.popup({ window: mainWindow });
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Focus the existing window if the user tries to launch a second instance.
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
