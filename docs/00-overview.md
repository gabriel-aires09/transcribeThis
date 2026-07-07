# Transformar o Transcritor de Áudio em App Desktop — Visão Geral

> **Este documento e os demais em `docs/` são apenas material de referência.**
> Nenhuma edição foi feita no código-fonte (`index.html`, `css/`, `js/`). Todos os
> passos abaixo devem ser aplicados manualmente por você, conforme a regra do
> `CLAUDE.md` ("DON'T MAKE ANY EDITS TO THE CODE").

## Ponto de partida

O projeto atual é 100% estático, sem build step e sem backend:

```
transcribeThis/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── editor.js
│   ├── keyboard-shortcuts.js
│   ├── media-controls.js
│   ├── screens.js
│   ├── shortcuts-bar.js
│   ├── theme.js
│   └── transcription-ai.js
└── assets/
    └── favicon.svg
```

Isso é uma vantagem enorme: qualquer um dos três frameworks abaixo consegue
empacotar o app **sem reescrever a lógica existente**. O trabalho é
essencialmente de "casca" (shell) + ajustes de dependências externas.

## Dependências externas via CDN (precisam de atenção em todos os casos)

Hoje `index.html` carrega estes recursos via `<link>`/`<script>` remotos:

| Recurso | URL | Observação |
|---|---|---|
| Google Fonts (JetBrains Mono) | `fonts.googleapis.com` | Requer internet |
| Carbon Design System CSS | `unpkg.com/carbon-components@10.58.0` | Requer internet |
| CodeMirror 5 (CSS + JS) + tema `material`/`dracula` | `cdnjs.cloudflare.com` | Requer internet |
| Vim keymap do CodeMirror | `cdnjs.cloudflare.com` | Requer internet |
| YouTube iframe API | `youtube.com/iframe_api` | Requer internet, e é **sempre** online (não pode ser vendorizado, pois carrega vídeos do YouTube) |

**Recomendação para os 3 frameworks:** baixar os arquivos estáticos
(Carbon CSS, CodeMirror CSS/JS, fonte) e servi-los localmente em
`vendor/` dentro do app, para que o app funcione **offline** — exceto a
funcionalidade de YouTube e a transcrição via API da OpenAI, que sempre vão
precisar de rede.

## Chamada de rede sensível: OpenAI Whisper API

`js/transcription-ai.js` (~linha 264) faz `fetch` direto do frontend para
`https://api.openai.com/v1/audio/transcriptions`, usando uma API key salva em
`localStorage`. Isso funciona hoje porque é uma página aberta localmente no
navegador. Em todos os 3 frameworks:

- A chamada **continua funcionando do jeito que está** (é só `fetch`, e todos
  os frameworks abaixo permitem requisições HTTP de saída).
- **Ponto de atenção de segurança:** ao empacotar como app nativo, o
  `localStorage` passa a viver dentro de um perfil do WebView isolado do app —
  ou seja, a chave da OpenAI fica um pouco mais protegida do que "qualquer site
  aberto no Chrome", mas ainda é armazenada em texto puro. Se quiser reforçar,
  em qualquer um dos 3 frameworks é possível usar um "secure storage" nativo
  (Electron: `keytar`/`safeStorage`; Tauri: plugin `tauri-plugin-store` +
  `stronghold`; Neutralino: API de storage nativa) — isso é uma melhoria
  **opcional**, fora do escopo mínimo de portar o app.

## Comparativo rápido

| | Electron | Tauri | Neutralino.js |
|---|---|---|---|
| Motor de renderização | Chromium embutido | WebView nativo do SO (WebView2/WebKit) | WebView nativo do SO |
| Runtime | Node.js embutido | Rust (binário compilado) | Binário próprio leve (sem Node/Rust obrigatório) |
| Tamanho do instalador | ~150-200 MB | ~10-20 MB | ~5-15 MB |
| Toolchain necessário | Node.js + npm | Rust + Cargo + Node.js (para o CLI) | Node.js (opcional) ou apenas o binário CLI |
| Maturidade/ecossistema | Muito madura, enorme | Madura, crescendo rápido | Pequena, menos madura |
| Alterações no código atual | Mínimas | Mínimas | Mínimas |
| Empacotamento Win/Linux/macOS | Sim (`electron-builder`) | Sim (`tauri build`, cross-compile parcial) | Sim (`neu build`) |

Os três guias a seguir (`01-electron.md`, `02-tauri.md`, `03-neutralino.md`)
detalham passo a passo, estrutura de diretórios e snippets de configuração
para cada abordagem.
