# Reescrita da Camada de Apresentação: React vs. Flutter — Visão Geral

> **Este documento e os demais em `docs/frontend/` são apenas material de
> referência.** Nenhuma edição foi feita no código-fonte (`index.html`,
> `css/`, `js/`, `main.js`, `preload.js`). Todos os passos abaixo devem ser
> aplicados manualmente por você, conforme a regra do `CLAUDE.md` ("DON'T
> MAKE ANY EDITS TO THE CODE").

## Como isso difere dos guias em `docs/desktop/`

Os guias `docs/desktop/01-electron.md`, `02-tauri.md` e `03-neutralino.md`
descrevem **cascas de empacotamento**: o `index.html`/`css/`/`js/` atual é
carregado sem alterações dentro de uma janela nativa — "zero mudança
obrigatória em `js/*.js`", como dizem os resumos de esforço de cada um.

React e Flutter são categoricamente diferentes: **não são cascas, são
reescritas da camada de apresentação**. Nenhum dos dois consegue carregar
`index.html`/`js/*.js` como estão. Isso muda o escopo do trabalho — de
"empacotar" para "reescrever a UI preservando o comportamento".

Além disso, esta rodada tem requisitos adicionais que os guias de desktop não
tinham:

1. **Desktop nativo, multi-dispositivo** — o app deve compilar para binários
   nativos em várias plataformas (não apenas embutir um WebView).
2. **Design system** — tokens de design (cor, tipografia, espaçamento) e
   componentes reutilizáveis, em vez de CSS solto + Carbon via CDN.
3. **Domain-Driven Design (DDD)** — separar regras de negócio (o que é uma
   transcrição, como validar uma API key, como decidir se um arquivo é
   suportado pelo Whisper) da UI e da infraestrutura (fetch, storage, editor).
4. **Test-Driven Development (TDD)** — cenários de teste e testes unitários,
   escritos **antes** da implementação de cada caso de uso.

Esses 4 pontos valem para os dois frameworks e são descritos de forma
unificada abaixo; os detalhes específicos de cada um estão em
[01-react.md](01-react.md) e [02-flutter.md](02-flutter.md).

## "Nativo para diversos dispositivos": o que isso significa em cada caminho

| | React | Flutter |
|---|---|---|
| Como vira "nativo" | Continua precisando de uma casca (Electron, hoje já usado no projeto — ver [docs/desktop/01-electron.md](../desktop/01-electron.md) — ou Tauri, mais leve, ver [02-tauri.md](../desktop/02-tauri.md)). O React em si só produz HTML/JS; quem torna isso um binário nativo é a casca. | Compila para binário nativo de verdade por plataforma (`flutter build linux/windows/macos`), sem Chromium embutido. Mesma base de código Dart também compila para mobile (Android/iOS) e web, se desejado no futuro — vantagem real de "diversos dispositivos". |
| Motor de renderização | DOM do WebView da casca escolhida | Skia/Impeller (engine gráfica própria do Flutter) — desenha os widgets diretamente, sem HTML/CSS |
| Tamanho do instalador | Herda da casca (~150-200 MB Electron, ~10-20 MB Tauri) | ~15-40 MB (não embute Chromium) |
| **Ressalva importante** | — | Duas funcionalidades do app atual (editor com keybindings Vim via CodeMirror, e player embutido do YouTube) **não têm equivalente nativo maduro em Flutter** — ver seção "WebView residual" em [02-flutter.md](02-flutter.md#webview-residual-editor-vim-e-youtube). Na prática, uma `WebView` embutida (`flutter_inappwebview`) acaba sendo necessária só para essas duas partes, o que reduz — mas não elimina — a vantagem de "sem WebView" do Flutter para este app específico. |

## Arquitetura comum às duas reescritas

Independente do framework, a recomendação é organizar o código em 4 camadas,
seguindo os princípios de DDD/Clean Architecture. Isso é o que torna o app
testável (TDD) e o que separa "regra de negócio" de "como a tela é
desenhada":

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (+ Design System)                         │
│  Telas, componentes visuais, hooks/controllers.          │
│  Depende de Application. NÃO contém regra de negócio.    │
├─────────────────────────────────────────────────────────┤
│  Application (Use Cases)                                 │
│  Um caso de uso por ação do usuário                      │
│  (TranscribeAudio, SaveApiKey, ToggleTheme...).           │
│  Depende de Domain + interfaces de Infrastructure.        │
├─────────────────────────────────────────────────────────┤
│  Domain                                                   │
│  Entidades e regras puras (Transcription, MediaSource,    │
│  ApiCredential). ZERO dependência de framework, storage    │
│  ou rede. 100% testável sem mocks pesados.                │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                            │
│  Implementações concretas: OpenAI Whisper via fetch/http,  │
│  secure storage do SO, editor de código, player de vídeo.  │
│  Implementa interfaces ("ports") definidas no Domain.       │
└─────────────────────────────────────────────────────────┘
```

Mapeamento do código atual para essas camadas (referência para os dois
guias):

| Módulo atual | Camada de destino | Responsabilidade |
|---|---|---|
| Lógica de "o que é" uma transcrição/mídia/credencial válida | **Domain** (novo — não existe hoje como conceito isolado) | Entidades e validações puras |
| `js/transcription-ai.js` linhas 221-293 (`sendToWhisper`) | **Infrastructure** | Chamada HTTP à API da OpenAI |
| `main.js` linhas 44-60 + `preload.js` (`secureStorage`) | **Infrastructure** | Persistência segura da API key |
| `js/editor.js` (CodeMirror + Vim) | **Infrastructure** (adapter) + **Presentation** (componente que o envolve) | Editor de texto |
| `js/media-controls.js` (players + YouTube) | **Infrastructure** (adapter) + **Presentation** | Reprodução de mídia |
| `js/theme.js`, `js/shortcuts-bar.js`, `js/screens.js` | **Presentation** | Estado de UI, sem regra de negócio relevante |
| "Confirmar antes de transcrever", "validar tamanho/formato do arquivo" (`js/transcription-ai.js` linhas 173-185, 222-239) | **Application** (caso de uso `TranscribeAudioUseCase`) | Orquestração + regra de negócio |

## Design tokens: origem real (não inventados)

Regra para os dois guias: **nenhum valor solto** (`#0f62fe`, `8px`,
`0.85rem`, `0 4px 12px rgba(...)`) pode aparecer direto dentro de um
componente — cor, espaçamento, tamanho de fonte, raio de borda e sombra são
sempre uma referência a uma variável nomeada (token). Isso vale tanto para o
CSS-in-JS/tokens.css do React quanto para as classes `AppColors` /
`AppSpacing` / `AppTypography` / `AppRadius` / `AppShadows` do Flutter,
detalhadas em cada guia.

Os tokens não são inventados — são extraídos dos valores que já existem
espalhados em `css/styles.css`, agrupados em uma escala consistente.

### Cor

`css/styles.css` já define tokens via CSS custom properties — reaproveitados
1:1:

```css
/* tema claro (css/styles.css linhas 3-18) */
--bg-primary: #ffffff;
--bg-secondary: #f4f4f4;
--bg-header: #161616;
--text-primary: #161616;
--text-secondary: #525252;
--text-inverse: #ffffff;
--border-color: #e0e0e0;
--border-strong: #8d8d8d;
--btn-primary-bg: #0f62fe;
--btn-primary-hover: #0353e9;
--btn-secondary-bg: #5A6872;
--btn-secondary-hover: #4A5862;
--btn-disabled-bg: #c6c6c6;
--progress-bg: #e0e0e0;
--progress-thumb: #0f62fe;
--shortcuts-bg: #e8e8e8;

/* tema escuro (css/styles.css linhas 22-37) */
--bg-primary: #262626;
--bg-secondary: #161616;
--bg-header: #000000;
--text-primary: #f4f4f4;
--text-secondary: #c6c6c6;
--text-inverse: #f4f4f4;
--border-color: #393939;
--border-strong: #6f6f6f;
--btn-secondary-bg: #6A7882;
--btn-secondary-hover: #7A8892;
--btn-disabled-bg: #525252;
--progress-bg: #393939;
--shortcuts-bg: #161616;
/* --btn-primary-bg, --btn-primary-hover e --progress-thumb repetem os
   valores do tema claro (#0f62fe / #0353e9) — é a cor de destaque (accent)
   da marca e não muda entre temas. */
```

> `--btn-primary-bg` (`#0f62fe`) tem contraste ~4.6:1 sobre `--bg-primary`
> claro (`#ffffff`) — passa em WCAG AA para texto/ícones em tamanho normal.
> Ao definir os tokens no framework novo, rode os pares
> texto-sobre-fundo/ícone-sobre-fundo por um checker de contraste (ex.:
> WebAIM) antes de fechar a paleta — é o momento certo para pegar qualquer
> combinação que hoje passe despercebida por estar "só" em CSS solto.

### Espaçamento (extraído dos `padding`/`margin`/`gap` hoje soltos no CSS)

Os valores usados hoje (`0.125rem`, `0.25rem`, `0.5rem`, `0.75rem`, `1rem`,
`1.25rem`, `1.5rem`, `20px`, `25px`, `30px`, `40px`...) mapeiam numa escala
de base 4px:

| Token | Valor |
|---|---|
| `space-1` | 4px (`0.25rem`) |
| `space-2` | 8px (`0.5rem`) |
| `space-3` | 12px (`0.75rem`) |
| `space-4` | 16px (`1rem`) |
| `space-5` | 20px (`1.25rem`) |
| `space-6` | 24px (`1.5rem`) |
| `space-8` | 32px (`2rem`) |
| `space-10` | 40px (`2.5rem`) |

### Tipografia

- **Família monoespaçada** (editor + atalhos): `JetBrains Mono` (via Google
  Fonts hoje, `index.html` linha 26), com fallback `IBM Plex Mono` /
  `Courier New` (ver `css/styles.css` linhas 429, 585, 644, 655, 737 — hoje
  repetido inline em cada seletor, vira token único).
- **Família da UI** (Carbon Design System): sans-serif padrão do
  `carbon-components` (IBM Plex Sans), usada implicitamente ao redor do
  editor.
- **Escala de tamanho** (extraída de `font-size` hoje solto em ~20 seletores
  de `css/styles.css`):

| Token | Valor | Uso hoje (exemplos) |
|---|---|---|
| `font-size-xs` | 0.7rem | badges de atalho (linha 656) |
| `font-size-sm` | 0.85rem | textos secundários (linha 780) |
| `font-size-base` | 1rem | corpo padrão |
| `font-size-md` | 1.1rem | botões de seleção (linha 163) |
| `font-size-lg` | 1.3rem | títulos de modal (linha 259) |
| `font-size-xl` | 2.5rem | títulos de tela (linhas 80, 136) |
| `font-size-display` | 80–100px | ícone da tela de loading/seleção (linhas 74, 131) |

### Raio de borda

| Token | Valor | Uso hoje |
|---|---|---|
| `radius-sm` | 3px | badges, botões pequenos (linhas 450, 654, 671) |
| `radius-md` | 4px | inputs, ícones (linhas 363, 405, 552) |
| `radius-lg` | 6px | botões de modal (linhas 270, 295) |
| `radius-xl` | 8px | cards, modais (linhas 162, 228, 775) |
| `radius-full` | 50% | botões circulares (linhas 90, 460, 468, 692) |

### Sombra

| Token | Valor | Uso hoje |
|---|---|---|
| `shadow-sm` | `0 2px 8px rgba(0,0,0,.1)` | hover leve (linha 167) |
| `shadow-md` | `0 4px 12px rgba(0,0,0,.2)` | elevação padrão (linha 172) |
| `shadow-lg` | `0 6px 16px rgba(0,0,0,.4)` | botão flutuante hover (linha 706) |
| `shadow-xl` | `0 8px 32px rgba(0,0,0,.5)` | modal (linha 232) |
| `shadow-focus-accent` | `0 4px 20px rgba(15,98,254,.6)` | glow de foco/destaque (linha 716) |

Cada guia (React/Flutter) mostra como declarar essa mesma tabela como
variáveis tipadas na linguagem correspondente — nunca como literais dentro
de um componente.

## Estados de componente e acessibilidade (obrigatório para todo componente do design system)

Todo componente interativo do design system (botão, input, toggle, item de
lista) precisa definir explicitamente os seguintes estados — não apenas o
estado "normal":

| Estado | O que muda | Token envolvido |
|---|---|---|
| `normal` | Aparência padrão | cor base, sem sombra |
| `hover` | Só em dispositivos com ponteiro | `*-hover` (ex.: `btn-primary-hover`) |
| `focus` | Obrigatório para navegação por teclado — nunca usar `outline: none` sem substituto | `shadow-focus-accent` ou borda de 2px na cor de destaque |
| `disabled` | Contraste reduzido, sem interação | `btn-disabled-bg` |
| `loading` | Feedback visual de operação em andamento (ex.: botão "Transcrever" hoje troca o ícone por spinner, `js/transcription-ai.js` linhas 338-345) | reaproveita ícone/spinner do componente, não um novo padrão visual |
| `error` | Estado que hoje só existe via `alert()` (ex.: `js/transcription-ai.js` linhas 196-215) — na reescrita deve virar um estado visual do próprio componente (borda/texto de erro), não um modal bloqueante do SO | nova cor semântica `color-danger` a definir (não existe token equivalente hoje — ponto de atenção: `alert()` não tem cor, é preciso escolher uma) |

Requisitos de acessibilidade que valem para os dois frameworks:

- **Contraste**: todo par texto/ícone-sobre-fundo checado contra WCAG AA
  (4.5:1 para texto normal, 3:1 para texto grande/ícone) — os tokens de cor
  atuais (seção acima) em sua maioria passam, mas isso precisa ser
  verificado de novo se qualquer tom mudar durante a reescrita.
- **Navegação por teclado**: todo elemento clicável hoje (`<button>`,
  `<input>`) precisa continuar alcançável por Tab/Shift+Tab e acionável por
  Enter/Espaço — atenção especial ao modal de configurações de API
  (`js/transcription-ai.js` linhas 84-143) e ao modal do YouTube
  (`js/screens.js` linhas 115-127), que hoje são `<div>`s sem
  gerenciamento de foco (sem *focus trap*, sem devolver o foco ao elemento
  que abriu o modal ao fechar).
- **Labels**: todo controle sem texto visível precisa de rótulo acessível —
  hoje vários botões só têm `title` (tooltip), que **não é lido de forma
  consistente por leitores de tela** (ex.: `playPauseBtn`, `themeToggle`,
  `closeVideoBtn` em `index.html`). Na reescrita, cada um recebe também
  `aria-label` (React) ou `Semantics`/`tooltip` (Flutter) — detalhado por
  componente em cada guia.

Cada componente do design system, nos dois guias, é especificado com uma
pequena tabela de estados + notas de acessibilidade antes do código —
mesmo padrão da tabela acima, repetido por componente.

## TDD: convenção de cenários usada nos dois guias

Antes de cada caso de uso, os dois guias listam cenários no formato
Given/When/Then (linguagem de especificação, não amarrada a nenhuma lib de
BDD específica) e depois o teste unitário correspondente. Exemplo do padrão
que se repete:

```
Cenário: transcrever um arquivo dentro do limite de tamanho
  Dado um arquivo de áudio de 10MB em formato suportado (mp3)
  E uma API key configurada
  Quando o usuário aciona TranscribeAudioUseCase
  Então o adapter de Whisper é chamado com o arquivo
  E o texto retornado é anexado ao rascunho da transcrição

Cenário: rejeitar arquivo acima do limite do Whisper
  Dado um arquivo de áudio de 30MB
  Quando o usuário aciona TranscribeAudioUseCase
  Então uma exceção de validação é lançada
  E o adapter de Whisper NUNCA é chamado
```

Como as entidades e casos de uso do Domain/Application não dependem de
React nem de Flutter, os mesmos cenários acima geram testes quase idênticos
nos dois guias — só muda o test runner (Vitest no React, `flutter_test` no
Flutter).

## Comparativo rápido

| | React (+ Electron/Tauri) | Flutter |
|---|---|---|
| Linguagem | JavaScript/TypeScript | Dart |
| Reaproveitamento do código atual | Parcial — CSS quase 1:1 (tokens já existem), HTML vira JSX equivalente, lógica de cada módulo é portada para hooks/use-cases | Nenhum — Dart não lê HTML/CSS/JS. Só o *comportamento* é portado, como especificação |
| Editor com Vim bindings | CodeMirror 5 (atual) continua funcionando, envolvido em wrapper React | Sem opção nativa madura — ver ressalva de WebView |
| Player embutido do YouTube | `<iframe>`/YouTube IFrame API funciona igual, só muda quem monta o DOM | Sem player nativo para iframe do YouTube — ver ressalva de WebView |
| Ecossistema de testes | Vitest + Testing Library (padrão de mercado, madura) | `flutter_test` + `mocktail` (madura, oficial do time Flutter) |
| Build step | Sim, obrigatório (Vite) — decisão já aprovada para este projeto | Sim, obrigatório (toolchain do Flutter) |
| Curva de adoção dado o projeto atual | Menor — mesma linguagem (JS), reaproveita CSS e parte da estrutura mental do DOM | Maior — linguagem nova (Dart), paradigma de widgets, nenhum reaproveitamento de arquivos |

Os guias detalhados a seguir (`01-react.md`, `02-flutter.md`) trazem
estrutura de diretórios, dependências (todas sinalizadas para sua aprovação
explícita, conforme regra do `CLAUDE.md` sobre novas bibliotecas), o
mapeamento completo Domain/Application/Infrastructure/Presentation, os
componentes de design system, e os cenários + testes unitários de TDD.
