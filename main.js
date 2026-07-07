const { app, BrowserWindow, Menu, ipcMain, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const secretsPath = path.join(app.getPath('userData'), 'secrets.bin');

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

  win.loadFile('index.html');

  // Remova em produção se quiser esconder o menu padrão do Electron
  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
