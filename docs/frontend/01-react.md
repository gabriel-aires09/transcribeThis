# Guia: Reescrita em React (+ Electron/Tauri como casca nativa)

> Documentação apenas — nenhuma edição foi feita no código-fonte. Ver
> considerações gerais (arquitetura em camadas, tokens de design, convenção
> de TDD) em [00-overview.md](00-overview.md).

## 1. Pré-requisitos

- Node.js LTS (18+), `npm`.
- Continua precisando de uma casca desktop nativa (já aprovado nesta
  conversa: manter **Electron**, hoje já usado no projeto — `main.js` /
  `preload.js` seguem existindo e mudam pouco, só o que é carregado dentro
  da janela muda). Tauri é uma alternativa mais leve, documentada em
  [docs/desktop/02-tauri.md](../desktop/02-tauri.md), e se aplica aqui do
  mesmo jeito.

## 2. Novas dependências (pedem sua aprovação explícita — regra do `CLAUDE.md`)

| Pacote | Tipo | Motivo |
|---|---|---|
| `react`, `react-dom` | dependency | framework de UI |
| `vite`, `@vitejs/plugin-react` | devDependency | build step com JSX (decisão já tomada nesta conversa) |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` | devDependency | TDD — test runner + testes de componente |

Nenhuma lib de state management (Redux/Zustand/Riverpod-like) é necessária —
o app é pequeno o bastante para `useState`/`useReducer` + Context, evitando
dependência extra não solicitada.

```bash
npm install react react-dom
npm install --save-dev vite @vitejs/plugin-react vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## 3. Nova estrutura de diretórios

```
transcribeThis/
├── main.js                      # quase inalterado — ver seção 9
├── preload.js                   # inalterado
├── package.json                 # scripts novos: dev/build (vite) — ver seção 8
├── vite.config.js               # NOVO
├── index.html                   # NOVO conteúdo — vira o entrypoint do Vite (raiz do projeto, convenção Vite)
├── src/                         # NOVO — tudo daqui pra baixo substitui js/*.js
│   ├── main.jsx                  # ponto de entrada React (equivalente ao antigo app.js)
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Transcription.js
│   │   │   ├── MediaSource.js
│   │   │   └── ApiCredential.js
│   │   └── ports/                # interfaces que a Infrastructure implementa
│   │       ├── CredentialStore.js
│   │       ├── DraftStore.js
│   │       └── TranscriptionGateway.js
│   ├── application/
│   │   ├── TranscribeAudioUseCase.js
│   │   ├── SaveApiKeyUseCase.js
│   │   ├── LoadApiKeyUseCase.js
│   │   ├── SaveDraftUseCase.js
│   │   ├── LoadDraftUseCase.js
│   │   └── ToggleThemeUseCase.js
│   ├── infrastructure/
│   │   ├── ElectronSecureCredentialStore.js   # wraps window.secureStorage
│   │   ├── LocalStorageDraftStore.js
│   │   ├── OpenAIWhisperGateway.js
│   │   ├── CodeMirrorEditorAdapter.js
│   │   └── YouTubeIframeAdapter.js
│   └── presentation/
│       ├── design-system/
│       │   ├── tokens.css        # ← única fonte de cor/espaçamento/fonte/raio/sombra
│       │   ├── Button.jsx
│       │   ├── Button.test.jsx
│       │   ├── IconButton.jsx
│       │   ├── ProgressBar.jsx
│       │   ├── Modal.jsx
│       │   └── Modal.test.jsx
│       ├── screens/
│       │   ├── LoadingScreen.jsx
│       │   ├── MediaSelectionScreen.jsx
│       │   ├── YoutubeUrlModal.jsx
│       │   └── MainApp.jsx
│       └── hooks/
│           ├── useTheme.js
│           ├── useTranscriptionDraft.js
│           └── useMediaController.js
├── css/                          # (opcional) global.css com reset + import de tokens.css
├── assets/                       # inalterado
└── test/
    └── application/               # testes dos use cases (TDD) — ver seção 11
```

`js/*.js` inteiro deixa de ser carregado (sem `<script>` clássico) — cada
módulo tem um destino explícito na tabela abaixo.

| Arquivo atual | Vira |
|---|---|
| `js/theme.js` | `application/ToggleThemeUseCase.js` + `presentation/hooks/useTheme.js` |
| `js/screens.js` | `presentation/screens/*.jsx` + estado em `main.jsx` (`'loading'\|'selection'\|'main'`) |
| `js/editor.js` | `infrastructure/CodeMirrorEditorAdapter.js` + componente `EditorPane.jsx` |
| `js/media-controls.js` | `infrastructure/YouTubeIframeAdapter.js` + `presentation/hooks/useMediaController.js` |
| `js/keyboard-shortcuts.js` | `useEffect` de `keydown` dentro de `MainApp.jsx` (chama o hook de mídia) |
| `js/shortcuts-bar.js` | estado local em `MainApp.jsx` (`useState` + `localStorage`) |
| `js/transcription-ai.js` (573 linhas) | dividido em `TranscribeAudioUseCase.js` + `OpenAIWhisperGateway.js` + `SaveApiKeyUseCase.js`/`LoadApiKeyUseCase.js` + componente `TranscribeButton.jsx`/`ApiKeyModal.jsx` |

## 4. Design tokens — `src/presentation/design-system/tokens.css`

Única fonte de verdade; **nenhum componente escreve um valor literal**, só
`var(--token)`. Valores extraídos de `css/styles.css` (detalhados em
[00-overview.md](00-overview.md#design-tokens-origem-real-não-inventados)):

```css
:root {
  /* cor — tema claro (padrão) */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f4f4f4;
  --color-bg-header: #161616;
  --color-text-primary: #161616;
  --color-text-secondary: #525252;
  --color-text-inverse: #ffffff;
  --color-border: #e0e0e0;
  --color-border-strong: #8d8d8d;
  --color-accent: #0f62fe;
  --color-accent-hover: #0353e9;
  --color-btn-secondary: #5A6872;
  --color-btn-secondary-hover: #4A5862;
  --color-disabled: #c6c6c6;
  --color-danger: #da1e28;       /* NOVO — não existia token equivalente; usado no estado "error" dos componentes (ver seção 7) */
  --color-danger-bg: #fff1f1;    /* NOVO — fundo do estado de erro */

  /* espaçamento */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;

  /* tipografia */
  --font-family-mono: 'JetBrains Mono', 'IBM Plex Mono', 'Courier New', monospace;
  --font-family-ui: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 0.7rem;  --font-size-sm: 0.85rem; --font-size-base: 1rem;
  --font-size-md: 1.1rem;  --font-size-lg: 1.3rem;  --font-size-xl: 2.5rem;
  --font-size-display: 80px;

  /* raio */
  --radius-sm: 3px; --radius-md: 4px; --radius-lg: 6px; --radius-xl: 8px; --radius-full: 50%;

  /* sombra */
  --shadow-sm: 0 2px 8px rgba(0,0,0,.1);
  --shadow-md: 0 4px 12px rgba(0,0,0,.2);
  --shadow-lg: 0 6px 16px rgba(0,0,0,.4);
  --shadow-xl: 0 8px 32px rgba(0,0,0,.5);
  --shadow-focus-accent: 0 0 0 3px rgba(15,98,254,.4); /* anel de foco — ver seção 7 */
}

[data-theme='dark'] {
  --color-bg-primary: #262626;
  --color-bg-secondary: #161616;
  --color-bg-header: #000000;
  --color-text-primary: #f4f4f4;
  --color-text-secondary: #c6c6c6;
  --color-border: #393939;
  --color-border-strong: #6f6f6f;
  --color-btn-secondary: #6A7882;
  --color-btn-secondary-hover: #7A8892;
  --color-disabled: #525252;
  --color-danger: #ff8389;
  --color-danger-bg: #2a1214;
}
```

> A troca de tema (`js/theme.js` linhas 30-51, hoje via classe
> `light-theme`/`dark-theme` no `<body>`) vira `document.documentElement
> .setAttribute('data-theme', 'dark' | 'light')`, disparado pelo
> `ToggleThemeUseCase`.

## 5. Camada de Domínio (`src/domain/`)

Puro — sem `import` de React, sem `fetch`, sem `localStorage`. É o que
permite testar regra de negócio sem montar componente nem mockar rede.

```js
// src/domain/entities/ApiCredential.js
export class ApiCredential {
  constructor(key) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('API key não pode ser vazia');
    }
    this.value = key.trim();
  }
}
```

```js
// src/domain/entities/MediaSource.js
const SUPPORTED_EXTENSIONS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];
const MAX_WHISPER_SIZE_BYTES = 25 * 1024 * 1024; // limite documentado da API Whisper

export class MediaSource {
  constructor({ file, youtubeUrl }) {
    this.file = file ?? null;
    this.youtubeUrl = youtubeUrl ?? null;
  }

  get isYouTube() {
    return !!this.youtubeUrl;
  }

  assertTranscribable() {
    if (this.isYouTube) {
      throw new Error('Não é possível transcrever vídeos do YouTube diretamente. Baixe o áudio primeiro ou use um arquivo local.');
    }
    if (!this.file) {
      throw new Error('Nenhum arquivo de áudio/vídeo carregado.');
    }
    const ext = this.file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new Error(`Formato não suportado: .${ext}`);
    }
    if (this.file.size > MAX_WHISPER_SIZE_BYTES) {
      throw new Error('Arquivo muito grande. Máximo: 25MB');
    }
  }
}
```

```js
// src/domain/entities/Transcription.js
export class Transcription {
  constructor(text = '') {
    this.text = text;
  }

  appendTimestamped(newText, timestamp = new Date()) {
    const header = `[Transcrição - ${timestamp.toLocaleString('pt-BR')}]\n\n`;
    const separator = this.text ? '\n\n---\n\n' : '';
    return new Transcription(this.text + separator + header + newText);
  }

  get stats() {
    const words = this.text.trim().split(/\s+/).filter(Boolean).length;
    return { words, characters: this.text.length, lines: this.text.split('\n').length };
  }
}
```

```js
// src/domain/ports/TranscriptionGateway.js
/** @interface — implementada por OpenAIWhisperGateway em infrastructure/ */
export class TranscriptionGateway {
  /** @returns {Promise<string>} */
  async transcribe(_file, _apiKey) { throw new Error('not implemented'); }
}
```

(`CredentialStore` e `DraftStore` seguem o mesmo padrão de interface —
`get`/`set` — omitidos aqui por brevidade, detalhados no repositório real.)

## 6. Camada de Aplicação (`src/application/`) — casos de uso

Cada caso de uso recebe as dependências (ports) por injeção no construtor —
isso é o que permite testar sem mockar módulos globais.

```js
// src/application/TranscribeAudioUseCase.js
export class TranscribeAudioUseCase {
  constructor({ transcriptionGateway, credentialStore }) {
    this.transcriptionGateway = transcriptionGateway;
    this.credentialStore = credentialStore;
  }

  async execute(mediaSource, currentTranscription) {
    const apiKey = await this.credentialStore.get();
    if (!apiKey) throw new Error('Configure sua API Key primeiro!');

    mediaSource.assertTranscribable(); // lança erro de domínio se inválido

    const text = await this.transcriptionGateway.transcribe(mediaSource.file, apiKey);
    return currentTranscription.appendTimestamped(text);
  }
}
```

```js
// src/application/ToggleThemeUseCase.js
export class ToggleThemeUseCase {
  constructor({ themeStore }) {
    this.themeStore = themeStore;
  }

  execute(currentTheme) {
    const next = currentTheme === 'light' ? 'dark' : 'light';
    this.themeStore.save(next);
    return next;
  }
}
```

`SaveApiKeyUseCase`/`LoadApiKeyUseCase`/`SaveDraftUseCase`/`LoadDraftUseCase`
seguem o mesmo formato — um método `execute`, dependências injetadas, sem
tocar DOM/React.

## 7. Camada de Infraestrutura (`src/infrastructure/`)

```js
// src/infrastructure/OpenAIWhisperGateway.js — porta de js/transcription-ai.js linhas 221-293
import { TranscriptionGateway } from '../domain/ports/TranscriptionGateway.js';

export class OpenAIWhisperGateway extends TranscriptionGateway {
  async transcribe(file, apiKey) {
    const formData = new FormData();
    formData.append('file', new File([file], file.name, { type: file.type || 'audio/mpeg' }));
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error?.message ?? `HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result.text;
  }
}
```

```js
// src/infrastructure/ElectronSecureCredentialStore.js — wraps window.secureStorage
// (preload.js + main.js linhas 44-60 continuam exatamente como estão)
export class ElectronSecureCredentialStore {
  async get() { return window.secureStorage.get(); }
  async set(value) { return window.secureStorage.set(value); }
  async clear() { return window.secureStorage.clear(); }
}
```

`CodeMirrorEditorAdapter` e `YouTubeIframeAdapter` são detalhados junto dos
componentes que os usam (seção 9), já que precisam de uma ref de DOM.

## 8. `package.json` e `vite.config.js`

```diff
   "scripts": {
     "start": "electron .",
-    "dist": "electron-builder"
+    "dist": "electron-builder",
+    "dev": "vite",
+    "build": "vite build",
+    "test": "vitest run"
   },
   "devDependencies": {
     "electron": "^43.0.0",
-    "electron-builder": "^26.15.3"
+    "electron-builder": "^26.15.3",
+    "vite": "^5.0.0",
+    "@vitejs/plugin-react": "^4.0.0",
+    "vitest": "^2.0.0",
+    "@testing-library/react": "^16.0.0",
+    "@testing-library/jest-dom": "^6.0.0",
+    "@testing-library/user-event": "^14.0.0",
+    "jsdom": "^25.0.0"
   },
+  "dependencies": {
+    "react": "^18.3.0",
+    "react-dom": "^18.3.0"
+  },
```

```js
// vite.config.js — NOVO
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  build: {
    outDir: 'dist',
  },
});
```

## 9. `main.js` — ajuste para servir o build do Vite

O `startLocalServer` (linhas 25-42) e os handlers de `secureStorage`
(linhas 44-60) **continuam idênticos**. Só o destino do `win.loadURL` muda,
de servir a raiz do projeto para servir `dist/` (saída do `vite build`):

```diff
 function startLocalServer() {
   return new Promise((resolve) => {
     const server = http.createServer((req, res) => {
-      const filePath = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
+      const root = path.join(__dirname, 'dist');
+      const filePath = path.join(root, decodeURIComponent(req.url.split('?')[0]));
       fs.readFile(filePath, (err, data) => {
```

> Em desenvolvimento, alternativa mais prática: rodar `npm run dev`
> (servidor do Vite, com hot reload, em `http://localhost:5173`) em paralelo
> a uma versão do `main.js` que aponta `win.loadURL` direto para essa URL
> quando `process.env.NODE_ENV === 'development'`. Isso evita precisar
> rebuildar a cada mudança durante o desenvolvimento — ajuste a avaliar por
> você, não obrigatório.

`preload.js` **não muda em nada**.

## 10. Design system — exemplo completo: `Button.jsx`

Todo componente interativo documenta estados + acessibilidade antes do
código (convenção de [00-overview.md](00-overview.md#estados-de-componente-e-acessibilidade-obrigatório-para-todo-componente-do-design-system)):

| Estado | Implementação |
|---|---|
| `normal` | `background: var(--color-accent)` |
| `hover` | `background: var(--color-accent-hover)` (só via `:hover`, não afeta touch) |
| `focus` | `box-shadow: var(--shadow-focus-accent)` — visível mesmo sem mouse (`:focus-visible`) |
| `disabled` | `background: var(--color-disabled)`, `cursor: not-allowed`, `aria-disabled="true"` |
| `loading` | `aria-busy="true"`, ícone trocado por spinner, mantém o mesmo texto para leitor de tela via `aria-label` |
| `error` | variante `variant="danger"` usa `--color-danger` — usado por ex. quando `TranscribeAudioUseCase` rejeita o arquivo |

```jsx
// src/presentation/design-system/Button.jsx
import './tokens.css';
import './Button.css';

export function Button({ variant = 'primary', loading = false, disabled = false, children, ...props }) {
  return (
    <button
      className={`ds-button ds-button--${variant}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="ds-button__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
```

```css
/* Button.css — só var(--token), nenhum literal */
.ds-button {
  font-family: var(--font-family-ui);
  font-size: var(--font-size-base);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  border: none;
  cursor: pointer;
}
.ds-button--primary { background: var(--color-accent); color: var(--color-text-inverse); }
.ds-button--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
.ds-button--danger { background: var(--color-danger); color: var(--color-text-inverse); }
.ds-button:focus-visible { outline: none; box-shadow: var(--shadow-focus-accent); }
.ds-button:disabled { background: var(--color-disabled); cursor: not-allowed; }
```

`IconButton`, `ProgressBar` e `Modal` seguem o mesmo padrão (tabela de
estados → CSS só com tokens → `aria-label`/`role` explícitos). O `Modal`
merece nota à parte: hoje (`js/transcription-ai.js` linhas 84-143 e
`js/screens.js` linhas 115-127) é um `<div>` sem *focus trap* — a versão
React deve usar `<dialog>` nativo (que já traz foco preso e fechamento por
ESC de graça) ou a lib de acessibilidade do próprio React se optar por não
usar `<dialog>` — decisão a confirmar com você antes de detalhar mais, já
que pode implicar em mais uma dependência (`react-aria`/`@radix-ui/react-dialog`)
não aprovada ainda.

## 11. TDD — cenários e testes

Cenário (formato definido em
[00-overview.md](00-overview.md#tdd-convenção-de-cenários-usada-nos-dois-guias)):

```
Cenário: rejeitar transcrição de vídeo do YouTube
  Dado um MediaSource criado a partir de uma URL do YouTube
  Quando TranscribeAudioUseCase.execute é chamado
  Então uma exceção é lançada com a mensagem sobre YouTube
  E o TranscriptionGateway NUNCA é chamado
```

```js
// test/application/TranscribeAudioUseCase.test.js
import { describe, it, expect, vi } from 'vitest';
import { TranscribeAudioUseCase } from '../../src/application/TranscribeAudioUseCase.js';
import { MediaSource } from '../../src/domain/entities/MediaSource.js';
import { Transcription } from '../../src/domain/entities/Transcription.js';

describe('TranscribeAudioUseCase', () => {
  it('rejeita transcrição de vídeo do YouTube sem chamar o gateway', async () => {
    const transcriptionGateway = { transcribe: vi.fn() };
    const credentialStore = { get: vi.fn().mockResolvedValue('sk-fake') };
    const useCase = new TranscribeAudioUseCase({ transcriptionGateway, credentialStore });
    const youtubeSource = new MediaSource({ youtubeUrl: 'https://youtu.be/abc123' });

    await expect(useCase.execute(youtubeSource, new Transcription())).rejects.toThrow(/YouTube/);
    expect(transcriptionGateway.transcribe).not.toHaveBeenCalled();
  });

  it('anexa o texto transcrito ao rascunho existente', async () => {
    const file = new File(['x'], 'audio.mp3', { type: 'audio/mpeg' });
    const transcriptionGateway = { transcribe: vi.fn().mockResolvedValue('texto transcrito') };
    const credentialStore = { get: vi.fn().mockResolvedValue('sk-fake') };
    const useCase = new TranscribeAudioUseCase({ transcriptionGateway, credentialStore });

    const result = await useCase.execute(new MediaSource({ file }), new Transcription('rascunho anterior'));

    expect(result.text).toContain('rascunho anterior');
    expect(result.text).toContain('texto transcrito');
  });
});
```

```jsx
// src/presentation/design-system/Button.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button.jsx';

describe('Button', () => {
  it('fica desabilitado e com aria-busy durante loading', () => {
    render(<Button loading>Transcrever</Button>);
    const btn = screen.getByRole('button', { name: /transcrever/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('dispara onClick ao acionar por teclado (Enter)', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

Rodar com `npm test`. A recomendação de TDD é escrever o teste do caso de
uso (camada Application/Domain) **antes** de implementar cada regra —
como esses testes não montam componente nem tocam rede real, o ciclo
red-green-refactor é rápido.

## 12. Resumo do esforço

- Todo `js/*.js` (≈1540 linhas) é reescrito e redistribuído entre
  `domain/`, `application/`, `infrastructure/` e `presentation/` — não é
  cópia, é reestruturação.
- `css/styles.css` é quase 1:1 reaproveitável: os valores viram tokens
  (seção 4), a estrutura de seletores muda para classes de componente.
- `main.js`/`preload.js`: mudança pequena (aponta para `dist/` em vez da
  raiz) — o modelo de segurança (contextIsolation + secureStorage) não muda.
- Novo: suíte de testes (Vitest) cobrindo casos de uso (regra de negócio) e
  componentes de design system (estados + acessibilidade).
- Pendente de decisão sua: biblioteca de modal acessível (seção 10) e se
  quer introduzir TypeScript (não incluído aqui para não adicionar mais uma
  dependência sem aprovação).
