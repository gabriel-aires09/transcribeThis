const { app, BrowserWindow, Menu, ipcMain, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { writeHeapSnapshot } = require('v8');

const secretsPath = path.join(app.getPath('userData'), 'secrets.bin');
//
// let loadURL;
//
// async function initServe() {
//   const { default: serve } = await import('electron-serve');
//   loadURL = serve({ directory: __dirname });
// }

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startLocalServer() {
  return new Promise((resolver) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
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

async function createWindow() {
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

  const port = await startLocalServer();
  win.loadURL(`http://127.0.0.1:${port}/index.html`);


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
