# Arquitetura da Aplicação

Documentação técnica do Transcritor de Áudio, para desenvolvedores. Para a
visão de usuário final, veja o [README.md](../README.md).

## Visão geral

A aplicação é composta por uma camada **web estática** (HTML/CSS/JavaScript
vanilla, sem framework e sem build step) e, opcionalmente, por uma **camada
desktop** (Electron), que empacota essa mesma camada web em uma janela
nativa. Não há backend próprio: toda a lógica roda no lado cliente, e a única
comunicação de rede é a chamada direta à API da OpenAI para transcrição via
IA.

```
┌─────────────────────────────────────────────┐
│              Camada Desktop (Electron)      │
│   main.js (processo principal) + preload.js │
│         — ver "Camada desktop", abaixo      │
└───────────────────┬─────────────────────────┘
                    │ carrega
┌───────────────────▼──────────────────────────────┐
│                index.html                        │
│   (Carbon Design System + CodeMirror via CDN)    │
├──────────────────────────────────────────────────┤
│                  js/*.js                         │
│   Módulos independentes, cada um com sua classe  │
│      instanciada e inicializada em app.js        │
└──────────────────────────────────────────────────┘
```

## Camada web

### Estrutura de arquivos

```
transcribeThis/
├── index.html              # marcação da UI + carregamento de dependências
├── css/
│   └── styles.css          # temas claro/escuro via variáveis CSS
├── js/
│   ├── app.js               # ponto de entrada — instancia e conecta os módulos
│   ├── theme.js              # ThemeManager
│   ├── screens.js            # ScreenManager
│   ├── editor.js              # EditorManager
│   ├── media-controls.js       # MediaController
│   ├── keyboard-shortcuts.js    # KeyboardShortcuts
│   ├── shortcuts-bar.js          # ShortcutsToggle
│   └── transcription-ai.js        # TranscriptionAI
└── assets/
    └── favicon.svg
```

Não há um bundler (Webpack/Vite/Rollup) nem módulos ES importados entre os
arquivos JS — cada arquivo é carregado via `<script>` clássico no
`index.html`, na ordem em que aparece, e cada um define uma classe global que
é instanciada em `app.js`.

### Módulos e responsabilidades

| Arquivo | Classe | Responsabilidade |
|---|---|---|
| `app.js` | `App` | Ponto de entrada. Instancia os demais módulos e conecta seus eventos entre si na inicialização da página. |
| `theme.js` | `ThemeManager` | Alterna entre tema claro/escuro e persiste a preferência. |
| `screens.js` | `ScreenManager` | Controla a troca entre as telas/estados visuais da aplicação (ex.: tela inicial vs. tela de transcrição ativa). |
| `editor.js` | `EditorManager` | Inicializa e configura a instância do CodeMirror (incluindo o keymap Vim) usada como campo de transcrição. |
| `media-controls.js` | `MediaController` | Controla a reprodução do `<audio>`/`<video>` (play/pause, avançar/voltar, barra de progresso) e integra com a YouTube IFrame API para vídeos do YouTube. |
| `keyboard-shortcuts.js` | `KeyboardShortcuts` | Captura teclas globais (F1/F2/F3) e as traduz em chamadas ao `MediaController`. |
| `shortcuts-bar.js` | `ShortcutsToggle` | Controla a exibição/ocultação da barra de atalhos na UI. |
| `transcription-ai.js` | `TranscriptionAI` | Gerencia a API key da OpenAI e faz a chamada à API do Whisper para transcrição automática (maior módulo do projeto, ~580 linhas). |

Esses módulos não têm um sistema de eventos centralizado (nenhum
`EventEmitter`/pub-sub) — a comunicação entre eles acontece por referência
direta de objeto, orquestrada em `app.js` (ex.: `keyboard-shortcuts.js`
recebe a instância do `MediaController` para chamar seus métodos
diretamente).

### Persistência de dados

- Texto da transcrição (autosave a cada alteração no editor).
- Preferência de tema (claro/escuro).

### Dependências externas

Carregadas via `<link>`/`<script>` de CDN no `index.html`, sem versionamento
local:

- **Carbon Design System** (IBM) — CSS de componentes de UI, via `unpkg.com`.
- **CodeMirror 5** + keymap Vim — editor de texto, via `cdnjs.cloudflare.com`.
- **Google Fonts** (JetBrains Mono) — tipografia monoespaçada do editor.
- **YouTube IFrame API** — permite carregar e controlar vídeos do YouTube
  como fonte de mídia (além de arquivos locais).

## Camada desktop (Electron)

Ao portar para desktop (ver [01-electron.md](01-electron.md)), a mesma
camada web acima passa a ser carregada dentro de uma janela do Electron, com
dois processos:

- **`main.js`** (processo principal, Node.js): cria a `BrowserWindow`,
  carrega `index.html` e expõe handlers de IPC (`ipcMain.handle`) para
  operações que exigem privilégios do sistema — atualmente, apenas o secure
  storage da API key da OpenAI via `safeStorage` (criptografia nativa do
  SO, com o resultado persistido em `secrets.bin` na pasta de dados do
  usuário).
- **`preload.js`** (ponte de contexto): roda com `contextIsolation: true` e
  `nodeIntegration: false` — a camada web (`index.html`/`js/*.js`) **não tem
  acesso direto** a APIs do Node.js. Em vez disso, `preload.js` expõe
  seletivamente, via `contextBridge.exposeInMainWorld`, apenas a API
  `window.secureStorage` (`set`/`get`/`clear`), que internamente dispara os
  handlers de IPC do `main.js`.

Esse modelo (contextIsolation + preload como única ponte) é a configuração
de segurança recomendada pela própria documentação do Electron, e limita a
superfície de ataque: mesmo que o conteúdo web seja comprometido, ele só
consegue chamar as 3 funções explicitamente expostas, não o Node.js
completo.

## Pontos de atenção arquiteturais

- **Sem build step:** simplicidade grande para manutenção, mas significa que
  não há minificação, tree-shaking, TypeScript ou verificação estática —
  qualquer erro de digitação em um dos módulos só é percebido em tempo de
  execução, no navegador/WebView.
- **Dependência de CDNs em tempo de execução:** sem conexão à internet, a UI
  perde os estilos do Carbon e o editor CodeMirror não carrega (ver
  [00-overview.md](00-overview.md) para o plano de vendorização local).
- **Acoplamento por instanciação direta:** como não há um barramento de
  eventos, adicionar um novo módulo que precise reagir a ações de outro
  exige editar `app.js` para conectar as referências manualmente.
