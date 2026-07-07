# Guia: Empacotando com Tauri

Ver considerações gerais (CDN, API key da OpenAI) em [00-overview.md](00-overview.md).

## 1. Pré-requisitos

- Node.js LTS (18+) — só para rodar o CLI do Tauri.
- **Rust** + Cargo (via [rustup](https://rustup.rs/)).
- Dependências de sistema por plataforma:
  - **Windows:** Microsoft Visual Studio C++ Build Tools + WebView2 (já vem
    pré-instalado no Windows 10/11 recentes).
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`).
  - **Linux:** `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`,
    `libayatana-appindicator3-dev`, `librsvg2-dev` (nomes variam por
    distro — Tauri tem um guia oficial de setup por distro).

## 2. Nova estrutura de diretórios

O Tauri exige que os assets web fiquem numa pasta "frontend" referenciada
pelo config. Você pode manter tudo na raiz e só criar a pasta `src-tauri/`:

```
transcribeThis/
├── index.html            # (sem mudanças de lógica) — vira o "frontendDist"
├── css/
├── js/
├── assets/
├── package.json           # NOVO — só para rodar o CLI @tauri-apps/cli
└── src-tauri/              # NOVO — projeto Rust do Tauri
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── src/
    │   └── main.rs
    └── icons/
        ├── icon.ico
        ├── icon.icns
        └── icon.png (+ variações 32x32, 128x128 etc.)
```

## 3. Instalação

```bash
npm init -y
npm install --save-dev @tauri-apps/cli
npm install @tauri-apps/api
```

Depois, dentro da raiz do projeto:

```bash
npx tauri init
```

O comando pergunta:
- **App name:** `Transcritor de Áudio`
- **Window title:** `Transcritor de Áudio`
- **Web assets location (frontendDist):** `../` (a raiz do projeto, já que
  `index.html` está lá)
- **Dev server URL:** deixe em branco / `../index.html` (não há dev server,
  é HTML estático)
- **Dev command / build command:** deixe em branco (sem build step)

Isso gera a pasta `src-tauri/` com os arquivos padrão.

## 4. `src-tauri/tauri.conf.json` (ajustado)

```json
{
  "productName": "Transcritor de Áudio",
  "version": "1.0.0",
  "identifier": "com.transcribethis.app",
  "build": {
    "frontendDist": "../"
  },
  "app": {
    "windows": [
      {
        "title": "Transcritor de Áudio",
        "width": 1400,
        "height": 900,
        "minWidth": 900,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "icon": [
      "icons/icon.ico",
      "icons/icon.icns",
      "icons/icon.png"
    ],
    "targets": ["nsis", "deb", "appimage", "dmg"]
  }
}
```

> **Nota sobre `security.csp`:** por padrão o Tauri aplica uma Content
> Security Policy restritiva. Como o app carrega CSS/JS de CDNs externas
> (`unpkg.com`, `cdnjs.cloudflare.com`, `fonts.googleapis.com`) e faz `fetch`
> para `api.openai.com`, você precisa ou desabilitar o CSP (`"csp": null`,
> como acima — mais simples, ok para uso pessoal/desktop) ou declarar
> explicitamente os domínios permitidos, ex.:
> ```json
> "csp": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://www.youtube.com; connect-src 'self' https://api.openai.com; img-src 'self' data:; font-src https://fonts.gstatic.com"
> ```

## 5. `src-tauri/src/main.rs` (gerado pelo `tauri init`, geralmente não precisa editar)

```rust
fn main() {
    tauri_app_lib::run()
}
```

(o nome exato do módulo depende da versão do CLI — o `tauri init` já deixa
isso funcional sem intervenção manual para um app sem comandos Rust
customizados).

## 6. Rodando em desenvolvimento

```bash
npx tauri dev
```

Abre uma janela nativa carregando `index.html` via WebView do sistema
(WebView2 no Windows, WKWebView no macOS, WebKitGTK no Linux).

## 7. Gerando instaladores para Windows/Linux/macOS

```bash
npx tauri build
```

- **Cross-compilation é limitada:** assim como no Electron, para gerar o
  `.dmg` de macOS você precisa compilar em uma máquina macOS; para o `.msi`/
  `.exe` do Windows, compilar no Windows (ou usar CI multiplataforma —
  GitHub Actions com matrix de runners é o caminho recomendado pela própria
  documentação do Tauri).
- Sem assinatura de código, mesmos avisos de SO que o Electron.

## 8. Ajuste recomendado (não obrigatório): dependências offline

Mesma recomendação do guia do Electron — vendorizar Carbon CSS, CodeMirror e
a fonte JetBrains Mono para dentro do projeto e trocar as URLs absolutas no
`index.html` por caminhos relativos. Isso também simplifica a CSP do passo 4
(menos domínios externos = CSP mais restritiva e segura).

## 9. Secure Storage nativo para a API Key da OpenAI

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

A combinação recomendada usa dois plugins com papéis diferentes:

- **`tauri-plugin-store`** — armazenamento simples em JSON no disco, útil
  para preferências não sensíveis (tema, últimos atalhos etc.). **Não é
  criptografado** — não deve guardar a API key por si só.
- **`tauri-plugin-stronghold`** — cofre criptografado (baseado no
  [IOTA Stronghold](https://github.com/iotaledger/stronghold.rs)), protegido
  por uma senha/chave derivada. É aqui que a API key da OpenAI deve ficar.

### 9.1. Instalação dos plugins (Rust + JS)

```bash
cd src-tauri
cargo add tauri-plugin-store
cargo add tauri-plugin-stronghold
cd ..
npm install @tauri-apps/plugin-store @tauri-apps/plugin-stronghold
```

### 9.2. `src-tauri/src/main.rs` — registrar os plugins

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            // Deriva a chave de criptografia do cofre a partir de uma senha.
            // Para uso desktop single-user, pode ser um segredo fixo por
            // instalação (ex.: gerado uma vez e salvo em local protegido do
            // SO) em vez de pedir senha ao usuário a cada abertura.
            let config = argon2::Config::default();
            argon2::hash_raw(password.as_bytes(), b"transcritor-audio-salt", &config)
                .expect("failed to hash password")
        })
        .build())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> `argon2` precisa ser adicionado com `cargo add argon2` em `src-tauri/`.
> Esse é o mesmo padrão usado nos exemplos oficiais do plugin stronghold.

### 9.3. `src-tauri/tauri.conf.json` — permissões

Na versão 2 do Tauri, plugins expõem comandos que precisam ser liberados no
sistema de *capabilities*. Em `src-tauri/capabilities/default.json`
(gerado pelo `tauri init`), adicionar:

```json
{
  "permissions": [
    "store:default",
    "stronghold:default"
  ]
}
```

### 9.4. Uso no frontend — substituindo `localStorage`

```js
// no topo de js/transcription-ai.js, ou em um módulo novo secure-storage.js
import { Stronghold, Client } from '@tauri-apps/plugin-stronghold';
import { appDataDir } from '@tauri-apps/api/path';

const VAULT_PASSWORD = 'troque-por-um-segredo-gerado-na-instalacao';
let stronghold, client;

async function getVault() {
  if (stronghold) return client;
  const vaultPath = `${await appDataDir()}/vault.hold`;
  stronghold = await Stronghold.load(vaultPath, VAULT_PASSWORD);
  try {
    client = await stronghold.loadClient('transcritor-audio');
  } catch {
    client = await stronghold.createClient('transcritor-audio');
  }
  return client;
}

export async function setSecret(key, value) {
  const c = await getVault();
  const store = c.getStore();
  await store.insert(key, Array.from(new TextEncoder().encode(value)));
  await stronghold.save();
}

export async function getSecret(key) {
  const c = await getVault();
  const store = c.getStore();
  const raw = await store.get(key);
  return raw ? new TextDecoder().decode(new Uint8Array(raw)) : null;
}
```

**`js/transcription-ai.js` — diff ilustrativo (aplicação manual):**

```diff
+ import { setSecret, getSecret } from './secure-storage.js';

- saveApiKey(key) {
-     this.apiKey = key;
-     localStorage.setItem('openai_api_key', key);
-     console.log('API Key salva com sucesso');
- }
+ async saveApiKey(key) {
+     this.apiKey = key;
+     await setSecret('openai_api_key', key);
+     console.log('API Key salva com sucesso (stronghold)');
+ }

- loadApiKey() {
-     this.apiKey = localStorage.getItem('openai_api_key');
-     if (this.apiKey && this.transcribeBtn) {
-         this.transcribeBtn.disabled = false;
-         console.log('API Key carregada do localStorage');
-     }
- }
+ async loadApiKey() {
+     this.apiKey = await getSecret('openai_api_key');
+     if (this.apiKey && this.transcribeBtn) {
+         this.transcribeBtn.disabled = false;
+         console.log('API Key carregada do stronghold');
+     }
+ }
```

> Como `js/transcription-ai.js` hoje é carregado via `<script>` clássico
> (sem `type="module"`), usar `import` exige ajustar a tag no `index.html`
> para `<script type="module" src="js/transcription-ai.js">` — outra edição
> manual a ser avaliada por você, já que pode ter efeito nos demais scripts
> não-module do projeto.

> `VAULT_PASSWORD` fixo no código-fonte não é ideal — o padrão recomendado
> pelos exemplos oficiais é gerar essa senha uma vez na primeira execução
> (ex.: via `crypto.getRandomValues`) e guardá-la fora do vault, em um
> arquivo de config simples (`tauri-plugin-store`) — daí o motivo de usar os
> dois plugins juntos.

## 10. Resumo do esforço

- Arquivos novos: `package.json`, pasta `src-tauri/` inteira (gerada pelo
  CLI), ícones.
- Zero mudança obrigatória em `js/*.js` ou `css/styles.css`.
- Exige toolchain Rust instalado — maior barreira de setup que Electron, mas
  binário final ~10x menor.
- Mudança opcional (segurança): `tauri-plugin-store` (config não sensível) +
  `tauri-plugin-stronghold` (cofre criptografado) para a API key da OpenAI,
  substituindo `localStorage` em `saveApiKey`/`loadApiKey`.
