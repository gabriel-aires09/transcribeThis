const { app, BrowserWindow, Menu, ipcMain, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const { writeHeapSnapshot } = require('v8');

const secretsPath = path.join(app.getPath('userData'), 'secrets.bin');

let loadURL;

async function initServe() {
  const { default: serve } = await import('electron-serve');
  loadURL = serve({ directory: __dirname });
}

ipcMain.handle('secure-storage:set', (_event, plainText) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Criptografia nativa não disponível neste sistema.');
  }
  const encrypted = safeStorage.encryptString(plainText);
  fs.writeFileSync(secretsPath, encrypted);
});

ipcMain.handle('secure-storage:get', () => {
  if (!fs.existsSync(secretsPath)) return null;
  const encrypted = fs.readFileSync(secretsPath);
  return safeStorage.decryptString(encrypted);
});

ipcMain.handle('secure-storage:clear', () => {
  if (fs.existsSync(secretsPath)) fs.unlinkSync(secretsPath);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'favicon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadURL(win);

  // Remova em produção se quiser esconder o menu padrão do Electron
  Menu.setApplicationMenu(null);
}

initServe().then(() => app.whenReady()).then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
