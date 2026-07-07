# Guia: Empacotando com Electron

Ver considerações gerais (CDN, API key da OpenAI) em [00-overview.md](00-overview.md).

## 1. Pré-requisitos

- Node.js LTS instalado (18+ recomendado).
- `npm` ou `pnpm`/`yarn`.

## 2. Nova estrutura de diretórios

Nenhum arquivo existente muda de lugar. Você só **adiciona** arquivos na raiz:

```
transcribeThis/
├── index.html            # (sem mudanças de lógica)
├── css/
├── js/
├── assets/
├── package.json          # NOVO
├── main.js                # NOVO — processo principal do Electron
├── preload.js             # NOVO — ponte segura entre main e renderer
└── build/                 # NOVO — ícones para o instalador (opcional)
    ├── icon.ico          # Windows
    ├── icon.icns         # macOS
    └── icon.png          # Linux
```

## 3. Instalação de dependências

```bash
npm init -y
npm install --save-dev electron electron-builder
```

## 4. `package.json` (novo arquivo, na raiz)

```json
{
  "name": "transcritor-audio",
  "version": "1.0.0",
  "description": "Transcritor de Áudio manual com editor Vim",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3"
  },
  "build": {
    "appId": "com.transcribethis.app",
    "productName": "Transcritor de Áudio",
    "files": [
      "index.html",
      "css/**/*",
      "js/**/*",
      "assets/**/*",
      "main.js",
      "preload.js"
    ],
    "directories": {
      "output": "release"
    },
    "win": {
      "target": "nsis",
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "build/icon.icns",
      "category": "public.app-category.productivity"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "build/icon.png",
      "category": "Utility"
    }
  }
}
```

## 5. `main.js` (novo arquivo, na raiz) — processo principal

```js
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

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
```

## 6. `preload.js` (novo arquivo, na raiz)

Com `contextIsolation: true` e `nodeIntegration: false` (configuração
recomendada de segurança), o `index.html` continua rodando exatamente como
hoje — `localStorage`, `fetch`, `<audio>`/`<video>`, CodeMirror, tudo
funciona sem tocar no preload. Deixe-o vazio por enquanto (placeholder para
futuras integrações nativas, como diálogos de arquivo do SO):

```js
// Intencionalmente vazio no port inicial.
// Se no futuro quiser abrir arquivos via diálogo nativo do SO em vez do
// <input type="file"> do browser, exponha uma API aqui via contextBridge.
```

## 7. Rodando em desenvolvimento

```bash
npm start
```

Isso abre o app em uma janela nativa do Electron carregando o `index.html`
local — sem servidor HTTP necessário.

## 8. Gerando instaladores para Windows/Linux/macOS

```bash
npm run dist
```

- **Importante sobre cross-compilation:** o `electron-builder` consegue gerar
  o `.exe` (Windows) e `.AppImage`/`.deb` (Linux) a partir do Linux/macOS, mas
  para gerar o `.dmg`/`.app` de **macOS assinado**, você precisa rodar em uma
  máquina macOS (ou usar CI como GitHub Actions com runner `macos-latest`).
- Sem assinatura de código, os instaladores funcionam mas o SO (principalmente
  Windows SmartScreen e macOS Gatekeeper) vai exibir avisos de "app não
  verificado". Assinatura de código é um passo separado, opcional.

## 9. Ajuste recomendado (não obrigatório): dependências offline

Para o app funcionar sem internet (exceto YouTube e chamadas à OpenAI),
baixe os arquivos hoje carregados via CDN em `index.html` (linhas 24-34 e
188-189) e sirva localmente.

### 9.1. Criar a pasta `vendor/`

```bash
mkdir -p vendor/codemirror/theme
```

### 9.2. Baixar cada arquivo com `curl`

```bash
# Carbon Design System (CSS)
curl -L -o vendor/carbon-components.min.css \
  https://unpkg.com/carbon-components@10.58.0/css/carbon-components.min.css

# CodeMirror (CSS + temas)
curl -L -o vendor/codemirror/codemirror.min.css \
  https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css
curl -L -o vendor/codemirror/theme/material.min.css \
  https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/material.min.css
curl -L -o vendor/codemirror/theme/dracula.min.css \
  https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/dracula.min.css

# CodeMirror (JS + vim keymap)
curl -L -o vendor/codemirror/codemirror.min.js \
  https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js
curl -L -o vendor/codemirror/vim.min.js \
  https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/keymap/vim.min.js
```

> **Google Fonts (JetBrains Mono) é o caso mais chato de vendorizar:** o link
> do Google Fonts (linha 26) na verdade entrega um CSS que referencia outras
> URLs de `fonts.gstatic.com` (os arquivos `.woff2` reais, com URLs que mudam
> por versão/navegador). Não dá pra simplesmente `curl` numa URL fixa. O
> caminho mais simples é usar o gerador
> [google-webfonts-helper](https://gwfh.mranftl.com/fonts) (baixa um `.zip`
> com os `.woff2` + um CSS `@font-face` já pronto para uso local) e salvar o
> resultado em `vendor/fonts/`. Alternativa: manter só esse recurso via CDN
> (é o único puramente estético) e vendorizar apenas Carbon + CodeMirror.

### 9.3. Diff exato para aplicar em `index.html` (manual)

```diff
     <!-- Google Fonts - JetBrains Mono -->
-    <link rel="preconnect" href="https://fonts.googleapis.com">
-    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
-    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
+    <link rel="stylesheet" href="vendor/fonts/jetbrains-mono.css">

     <!-- Carbon Design System -->
-    <link href="https://unpkg.com/carbon-components@10.58.0/css/carbon-components.min.css" rel="stylesheet">
+    <link href="vendor/carbon-components.min.css" rel="stylesheet">

     <!-- CodeMirror -->
-    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css">
-    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/material.min.css">
-    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/dracula.min.css">
+    <link rel="stylesheet" href="vendor/codemirror/codemirror.min.css">
+    <link rel="stylesheet" href="vendor/codemirror/theme/material.min.css">
+    <link rel="stylesheet" href="vendor/codemirror/theme/dracula.min.css">
```

E mais abaixo, nos `<script>` (linhas 188-189):

```diff
     <!-- CodeMirror Scripts -->
-    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
-    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/keymap/vim.min.js"></script>
+    <script src="vendor/codemirror/codemirror.min.js"></script>
+    <script src="vendor/codemirror/vim.min.js"></script>
```

A linha 202 (`<script src="https://www.youtube.com/iframe_api">`) **não deve
ser alterada** — o player do YouTube só funciona online, então vendorizar
esse script não teria efeito (ele precisa buscar o vídeo real do YouTube de
qualquer forma).

### 9.4. Incluir `vendor/` no empacotamento do Electron

Como o `electron-builder` só empacota o que está listado em `files` no
`package.json` (ver seção 4), adicione a pasta nova:

```diff
     "files": [
       "index.html",
       "css/**/*",
       "js/**/*",
+      "vendor/**/*",
       "assets/**/*",
       "main.js",
       "preload.js"
     ],
```

### 9.5. Testar

Depois de baixar os arquivos e aplicar o diff no `index.html`, abra o
DevTools do Electron (`Ctrl+Shift+I` durante `npm start`) → aba **Network** →
desative o Wi-Fi/desconecte a internet → recarregue (`Ctrl+R`) → confirme que
Carbon CSS e CodeMirror carregam sem erro 404/`net::ERR_INTERNET_DISCONNECTED`
(YouTube e a transcrição via OpenAI continuarão falhando, como esperado, sem
internet).

## 10. Secure Storage nativo para a API Key da OpenAI

Hoje a chave é salva em texto puro no `localStorage` em
`js/transcription-ai.js`:

```js
// linhas ~150-162 (código atual, sem alterações)
saveApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('openai_api_key', key);
    console.log('API Key salva com sucesso');
}

loadApiKey() {
    this.apiKey = localStorage.getItem('openai_api_key');
    if (this.apiKey && this.transcribeBtn) {
        this.transcribeBtn.disabled = false;
        console.log('API Key carregada do localStorage');
    }
}
```

Existem duas opções nativas do Electron. **Recomendação: `safeStorage`**, por
já vir embutido no Electron (não exige compilar módulo nativo). `keytar` é a
alternativa mais tradicional (usa o cofre de senhas do próprio SO —
Keychain/Credential Vault/libsecret), mas o pacote está **arquivado/sem
manutenção** desde 2023 e exige `node-gyp`/toolchain de compilação nativa por
plataforma — mais fricção de setup. Ambas as opções abaixo são detalhadas.

### Opção A — `safeStorage` (recomendada)

`safeStorage` só existe no processo principal (`main.js`) e só
criptografa/descriptografa buffers em memória — a persistência em disco
(arquivo) é responsabilidade sua. A chave real fica protegida pelo cofre de
credenciais do SO (Keychain no macOS, DPAPI no Windows, `kwallet`/`gnome-libsecret`
no Linux).

**`main.js` — adicionar (sem remover o que já existe):**

```js
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
```

**`preload.js` — substituir o conteúdo (hoje vazio):**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('secureStorage', {
  set: (value) => ipcRenderer.invoke('secure-storage:set', value),
  get: () => ipcRenderer.invoke('secure-storage:get'),
  clear: () => ipcRenderer.invoke('secure-storage:clear'),
});
```

**`js/transcription-ai.js` — diff ilustrativo (aplicação manual):**

```diff
- saveApiKey(key) {
-     this.apiKey = key;
-     localStorage.setItem('openai_api_key', key);
-     console.log('API Key salva com sucesso');
- }
+ async saveApiKey(key) {
+     this.apiKey = key;
+     await window.secureStorage.set(key);
+     console.log('API Key salva com sucesso (safeStorage)');
+ }

- loadApiKey() {
-     this.apiKey = localStorage.getItem('openai_api_key');
-     if (this.apiKey && this.transcribeBtn) {
-         this.transcribeBtn.disabled = false;
-         console.log('API Key carregada do localStorage');
-     }
- }
+ async loadApiKey() {
+     this.apiKey = await window.secureStorage.get();
+     if (this.apiKey && this.transcribeBtn) {
+         this.transcribeBtn.disabled = false;
+         console.log('API Key carregada do safeStorage');
+     }
+ }
```

> Como `saveApiKey`/`loadApiKey` passam a ser `async`, os pontos onde são
> chamadas (ex.: no listener de `confirmBtn` e na inicialização) precisam de
> `await` — ajuste conforme o fluxo real do arquivo.

### Opção B — `keytar`

```bash
npm install keytar
```

```js
// main.js ou um módulo separado — roda no processo principal
const keytar = require('keytar');
const SERVICE = 'transcritor-audio';
const ACCOUNT = 'openai_api_key';

ipcMain.handle('secure-storage:set', (_e, key) => keytar.setPassword(SERVICE, ACCOUNT, key));
ipcMain.handle('secure-storage:get', () => keytar.getPassword(SERVICE, ACCOUNT));
ipcMain.handle('secure-storage:clear', () => keytar.deletePassword(SERVICE, ACCOUNT));
```

O restante (`preload.js` e diff em `transcription-ai.js`) é idêntico à Opção
A. A diferença é só na implementação do lado do `main.js`: `keytar` grava
diretamente no cofre do SO (sem precisar gerenciar um arquivo `secrets.bin`),
mas exige compilação nativa (`node-gyp`) em cada plataforma de build.

## 11. Resumo do esforço

- Arquivos novos: `package.json`, `main.js`, `preload.js`, ícones.
- Zero mudança obrigatória em `js/*.js` ou `css/styles.css`.
- Mudança opcional: vendorizar CDNs para uso offline.
- Mudança opcional (segurança): trocar `localStorage` por `safeStorage`
  (recomendado) ou `keytar` para a API key da OpenAI, via `preload.js` +
  ajuste em `saveApiKey`/`loadApiKey`.
