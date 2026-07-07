# Guia: Corrigindo "Erro 153" no player de vídeo do YouTube (build Windows)

> **Apenas material de referência.** Nenhuma edição foi feita no código-fonte
> (`main.js`, `preload.js`, `js/media-controls.js`). Aplique os diffs abaixo
> manualmente, conforme a regra do `CLAUDE.md`.

## 1. Sintoma

Ao usar a função de vídeo do YouTube no app empacotado para Windows:

```
Assistir o vídeo no YouTube
Erro 153
Erro de configuração do player de vídeo
```

Esse erro aparece **dentro do iframe do player**, não é um `alert()` do app.

## 2. Causa raiz

O YouTube IFrame Player API (carregado em [`index.html:202`](../../index.html#L202)
e instanciado em [`js/media-controls.js:107`](../../js/media-controls.js#L107)
via `new YT.Player(...)`) faz um handshake por `postMessage` que exige uma
**origem HTTP(S) válida** para a página que o hospeda.

O processo principal do Electron carrega a interface assim:

```js
// main.js, linha 39 (código atual)
win.loadFile('index.html');
```

`loadFile` serve o HTML pelo protocolo `file://`. Nesse protocolo,
`document.location.origin` é `"file://"` (uma origem nula/não padrão) — o que
o YouTube rejeita, retornando a tela de **"Erro 153: Erro de configuração do
player de vídeo"**.

Isso explica por que o problema só aparece no app **empacotado** (Windows,
mas também ocorreria em macOS/Linux): qualquer execução via `file://` tem o
mesmo problema. Rodar o `index.html` num navegador comum apontando para um
servidor `http://` (ex.: `http-server`, `live-server`) não teria esse erro,
porque a origem já é válida.

## 3. Correção recomendada — servidor HTTP local no processo principal

Em vez de `loadFile`, o Electron sobe um mini servidor HTTP (só com o módulo
nativo `http` do Node — **sem novas dependências**, respeitando a regra do
`CLAUDE.md`) e carrega a UI via `http://localhost:<porta>`.

### 3.1. Diff em `main.js`

```diff
 const { app, BrowserWindow, Menu, ipcMain, safeStorage } = require('electron');
 const fs = require('fs');
 const path = require('path');
+const http = require('http');

 const secretsPath = path.join(app.getPath('userData'), 'secrets.bin');
+
+const MIME_TYPES = {
+  '.html': 'text/html',
+  '.js': 'text/javascript',
+  '.css': 'text/css',
+  '.svg': 'image/svg+xml',
+  '.png': 'image/png',
+  '.ico': 'image/x-icon',
+};
+
+function startLocalServer() {
+  return new Promise((resolve) => {
+    const server = http.createServer((req, res) => {
+      const filePath = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
+      fs.readFile(filePath, (err, data) => {
+        if (err) {
+          res.writeHead(404);
+          res.end('Not found');
+          return;
+        }
+        const ext = path.extname(filePath);
+        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
+        res.end(data);
+      });
+    });
+    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
+  });
+}

 ipcMain.handle('secure-storage:set', (_event, plainText) => {
   ...
 });

-function createWindow() {
+async function createWindow() {
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

-  win.loadFile('index.html');
+  const port = await startLocalServer();
+  win.loadURL(`http://127.0.0.1:${port}/index.html`);

   Menu.setApplicationMenu(null);
 }
```

> **Por que `listen(0, ...)`:** porta `0` pede ao SO uma porta livre
> automaticamente, evitando conflito com outro processo já usando uma porta
> fixa (ex.: 3000, 8080).
>
> **Por que servir só arquivos dentro de `__dirname`:** o app é local e
> empacotado, então não há necessidade de validação extra de path traversal
> aqui (não há input externo controlando `req.url` — quem "navega" é sempre o
> próprio `index.html` pedindo seus próprios assets, ex. `/js/app.js`,
> `/css/styles.css`).

### 3.2. Diff em `js/media-controls.js` (opcional, mas recomendado)

Passar o parâmetro `origin` explicitamente no `playerVars` deixa o handshake
mais robusto, já que agora a origem é previsível (`http://127.0.0.1:<porta>`):

```diff
         this.youtubePlayer = new YT.Player('youtubePlayer', {
             height: '100%',
             width: '100%',
             videoId: videoId,
             playerVars: {
                 'playsinline': 1,
                 'controls': 1,
-                'rel': 0
+                'rel': 0,
+                'origin': window.location.origin
             },
             events: {
                 'onReady': (event) => this.onYouTubeReady(event),
                 'onStateChange': (event) => this.onYouTubeStateChange(event)
             }
         });
```

## 4. Testando a correção

1. Aplicar os dois diffs acima manualmente.
2. `npm start` — a janela deve abrir normalmente (visualmente idêntica; a
   troca de `file://` para `http://127.0.0.1:<porta>` é transparente para
   `css/`, `js/`, `localStorage`, etc., pois todos os caminhos em
   `index.html` já são relativos).
3. Abrir o DevTools (`Ctrl+Shift+I`) → aba **Console** → confirmar
   `YouTube API carregada` (log já existente em
   [`js/media-controls.js:64`](../../js/media-controls.js#L64)).
4. Colar uma URL do YouTube e carregar o vídeo → deve reproduzir
   normalmente, sem o Erro 153.
5. Gerar o instalador (`npm run dist`) e repetir o teste no `.exe` do
   Windows.

## 5. Alternativa com `electron-serve`

> **Requer aprovação:** este pacote é uma **nova dependência** no
> `package.json`, o que exige autorização explícita antes de instalar
> (regra do `CLAUDE.md`, seção "GENERAL RULES"). Os passos abaixo são só
> referência para aplicação manual, caso você aprove esse caminho em vez do
> servidor HTTP manual da seção 3.

`electron-serve` registra um protocolo customizado (`app://`, por padrão)
que serve os arquivos da pasta do app com uma origem estável e válida —
resolvendo o Erro 153 da mesma forma que a seção 3, mas com menos código
próprio para manter.

> **Atenção — versão atual (3.0.1) é ESM-only:** o pacote publicado hoje
> (`npm view electron-serve` → `latest: 3.0.1`) tem `"type": "module"` no
> seu `package.json` e exige **Electron 37+** e **Node 20+**. Como o
> `main.js` deste projeto é CommonJS (`require(...)`), não dá para fazer
> `const serve = require('electron-serve')` diretamente — isso lança
> `ERR_REQUIRE_ESM`. O diff abaixo já usa `import()` dinâmico dentro de uma
> função `async` para contornar isso sem converter o projeto inteiro para
> ESM. `electron` no `package.json` já está em `^43.0.0`, então o requisito
> de versão do Electron está satisfeito.

### 5.1. Instalação

```bash
npm install electron-serve
```

### 5.2. Diff em `package.json`

```diff
   "devDependencies": {
     "electron": "^43.0.0",
     "electron-builder": "^26.15.3"
   },
+  "dependencies": {
+    "electron-serve": "^3.0.1"
+  },
```

> `electron-serve` roda no processo principal empacotado, então entra em
> `dependencies` (não `devDependencies`) — precisa estar presente no app
> final, diferente de `electron`/`electron-builder`, que só servem para
> desenvolvimento/build.

### 5.3. Diff em `main.js`

```diff
 const { app, BrowserWindow, Menu, ipcMain, safeStorage } = require('electron');
 const fs = require('fs');
 const path = require('path');

 const secretsPath = path.join(app.getPath('userData'), 'secrets.bin');
+
+// electron-serve@3 é ESM-only — carregado via import() dinâmico dentro de
+// initServe(), pois main.js é CommonJS. A chamada de serve({...}) precisa
+// acontecer antes de app.whenReady() (registra protocolo privilegiado).
+let loadURL;
+async function initServe() {
+  const { default: serve } = await import('electron-serve');
+  loadURL = serve({ directory: __dirname });
+}

 ipcMain.handle('secure-storage:set', (_event, plainText) => {
   ...
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

-  win.loadFile('index.html');
+  loadURL(win);

   Menu.setApplicationMenu(null);
 }

-app.whenReady().then(createWindow);
+initServe().then(() => app.whenReady()).then(createWindow);
```

> `initServe()` roda **antes** de `app.whenReady()` porque `serve({...})`
> registra o protocolo customizado com `protocol.registerSchemesAsPrivileged`
> internamente, e isso só é válido se feito antes do app ficar pronto.
> `loadURL(win)` navega a janela para `app://-/index.html` (a origem passa a
> ser `app://-`, válida para o YouTube).

### 5.4. Diff em `js/media-controls.js` (opcional, mesma razão da seção 3.2)

```diff
         this.youtubePlayer = new YT.Player('youtubePlayer', {
             height: '100%',
             width: '100%',
             videoId: videoId,
             playerVars: {
                 'playsinline': 1,
                 'controls': 1,
-                'rel': 0
+                'rel': 0,
+                'origin': window.location.origin
             },
             events: {
                 'onReady': (event) => this.onYouTubeReady(event),
                 'onStateChange': (event) => this.onYouTubeStateChange(event)
             }
         });
```

### 5.5. Diff em `package.json` — incluir no empacotamento

`electron-builder` já inclui `node_modules` das `dependencies` de produção
automaticamente, então nenhuma mudança é necessária na lista `files`.

### 5.6. Testando

1. `npm install electron-serve` (após aprovação).
2. Aplicar os diffs de `main.js` e (opcionalmente) `js/media-controls.js`.
3. `npm start` → confirmar no DevTools (aba **Console**) que
   `window.location.href` começa com `app://` em vez de `file://`.
4. Colar uma URL do YouTube e carregar o vídeo → deve reproduzir sem o
   Erro 153.
5. Gerar o instalador (`npm run dist`) e repetir o teste no `.exe` do
   Windows.

### 5.7. Comparação rápida com a seção 3

| | Servidor HTTP manual (seção 3) | `electron-serve` (seção 5) |
|---|---|---|
| Novas dependências | Nenhuma | `electron-serve` |
| Linhas em `main.js` | ~25 (servidor + mime types) | ~3 |
| Origem final | `http://127.0.0.1:<porta>` | `app://-` |
| Manutenção | Por sua conta (mime types, erros) | Delegada ao pacote |
