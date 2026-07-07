# Guia: Empacotando com Neutralino.js

Ver considerações gerais (CDN, API key da OpenAI) em [00-overview.md](00-overview.md).

## 1. Pré-requisitos

- Node.js (16+) — só para rodar o CLI `@neutralinojs/neu` via `npx`/`npm`.
  Não é necessário para o app rodar depois de empacotado (o binário final não
  embute Node nem Rust — é um executável nativo pequeno + o WebView do SO).

## 2. Nova estrutura de diretórios

O Neutralino tem uma convenção própria de pastas. A forma mais simples de
migrar sem duplicar arquivos é apontar a config para as pastas já existentes:

```
transcribeThis/
├── index.html            # (sem mudanças de lógica)
├── css/
├── js/
├── assets/
├── neutralino.config.json  # NOVO
├── resources.neu           # GERADO automaticamente no build (não versionar)
└── bin/                     # GERADO pelo `neu update` — binários do Neutralino runtime por plataforma
```

Diferente do Electron/Tauri, não é obrigatório criar um "processo principal"
em JS/Rust — o Neutralino já fornece um runtime binário pronto (`neutralino-*`)
que você só configura via JSON.

## 3. Instalação do CLI

```bash
npm install -g @neutralinojs/neu
```

Ou sem instalar globalmente:

```bash
npx @neutralinojs/neu create transcritor-audio --template minimal
```

> Como você já tem o `index.html`/`css`/`js` prontos, o caminho recomendado é
> criar um projeto novo em uma pasta temporária só para copiar o
> `neutralino.config.json` e a pasta `bin/` gerada, e então apontar o
> `documentRoot` de volta para a raiz do seu projeto atual (detalhado no
> passo 4).

## 4. `neutralino.config.json` (novo arquivo, na raiz)

```json
{
  "applicationId": "com.transcribethis.app",
  "version": "1.0.0",
  "defaultMode": "window",
  "port": 0,
  "documentRoot": "/",
  "url": "/index.html",
  "enableServer": true,
  "enableNativeAPI": true,
  "globalVariables": {},
  "modes": {
    "window": {
      "title": "Transcritor de Áudio",
      "width": 1400,
      "height": 900,
      "minWidth": 900,
      "minHeight": 600,
      "icon": "/assets/favicon.svg",
      "enableInspector": false,
      "exitProcessOnClose": true
    }
  },
  "cli": {
    "binaryName": "transcritor-audio",
    "resourcesPath": "/resources/",
    "extensionsPath": "/extensions/",
    "clientLibrary": "/js/neutralino.js",
    "binaryVersion": "5.5.0",
    "clientVersion": "5.5.0"
  }
}
```

> **Nota:** `enableServer: true` faz o Neutralino levantar um servidor HTTP
> local (em `port`, `0` = porta aleatória livre) para servir os arquivos
> estáticos — importante porque seu `js/transcription-ai.js` faz `fetch`
> para a OpenAI, e isso funciona melhor com origem `http://` do que
> `file://`.

## 5. Cliente JS do Neutralino

O runtime do Neutralino expõe uma API nativa (sistema de arquivos, storage,
notificações, etc.) via um script client-side que precisa ser incluído no
`index.html`:

```bash
npx @neutralinojs/neu update
```

Isso baixa os binários (`bin/`) e o arquivo `js/neutralino.js` (client
library) referenciado no `clientLibrary` do config acima.

Adicionar no final do `<body>` do `index.html`, antes dos outros scripts:

```html
<script src="js/neutralino.js"></script>
<script>
  Neutralino.init();
</script>
```

(Isso é uma sugestão de diff — a edição real do `index.html` é manual,
conforme a regra do projeto.)

## 6. Rodando em desenvolvimento

```bash
npx @neutralinojs/neu run
```

## 7. Gerando binários para Windows/Linux/macOS

```bash
npx @neutralinojs/neu build --release
```

Isso gera, por padrão, binários para **as três plataformas ao mesmo tempo**
(Windows `.exe`, Linux, macOS) dentro de `dist/`, mesmo compilando de uma
única máquina — essa é a maior vantagem prática do Neutralino em relação a
Electron/Tauri, que geralmente exigem a plataforma nativa (ou CI) para gerar
o instalador daquele SO. Importante: isso gera o **binário/executável**, não
um instalador nativo (`.msi`, `.dmg`, `.deb`) — para instaladores completos
com ícone no menu, atalho, etc., é necessário um passo extra de empacotamento
(ex.: `electron-builder` não se aplica aqui; ferramentas como `makeself`,
`NSIS` manual, ou `pkgbuild` no macOS precisariam ser configuradas
separadamente).

## 8. Ajuste recomendado (não obrigatório): dependências offline

Mesma recomendação dos outros dois guias — vendorizar Carbon CSS, CodeMirror
e a fonte para dentro do projeto, já que o Neutralino não resolve isso
automaticamente.

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

O Neutralino expõe `Neutralino.storage`, uma API nativa de key-value que
persiste os dados em arquivos gerenciados pelo próprio runtime do app (fora
do perfil de `localStorage` do WebView). **Importante:** por padrão
`Neutralino.storage` **não criptografa** o conteúdo — é apenas um storage
"nativo" (fora do sandbox do WebView), não um cofre seguro. Para atender ao
pedido de secure storage de fato, o caminho recomendado é combinar
`Neutralino.storage` com criptografia via `Neutralino.os.execCommand`,
delegando ao cofre de credenciais do próprio SO.

### 9.1. Permissões necessárias

Em `neutralino.config.json`, garantir que o app pode chamar comandos do SO:

```json
{
  "nativeAllowList": [
    "app.*",
    "os.execCommand",
    "storage.*",
    "events.*",
    "window.*"
  ]
}
```

### 9.2. Opção simples — `Neutralino.storage` (sem criptografia extra)

Substitui só a origem do dado (sai do WebView, vai para o storage do app):

```js
async function saveApiKey(key) {
  this.apiKey = key;
  await Neutralino.storage.setData('openai_api_key', key);
  console.log('API Key salva com sucesso (Neutralino.storage)');
}

async function loadApiKey() {
  try {
    this.apiKey = await Neutralino.storage.getData('openai_api_key');
  } catch {
    this.apiKey = null;
  }
  if (this.apiKey && this.transcribeBtn) {
    this.transcribeBtn.disabled = false;
    console.log('API Key carregada do Neutralino.storage');
  }
}
```

### 9.3. Opção recomendada — delegar ao cofre de credenciais do SO

Usa `Neutralino.os.execCommand` para chamar as ferramentas nativas de
keychain de cada plataforma. Isso exige detectar o SO em tempo de execução:

```js
const SERVICE = 'transcritor-audio';
const ACCOUNT = 'openai_api_key';

async function setSecretOS(value) {
  const os = NL_OS; // variável global exposta pelo Neutralino: 'Windows', 'Linux', 'Darwin'
  if (os === 'Darwin') {
    await Neutralino.os.execCommand(
      `security add-generic-password -U -a ${ACCOUNT} -s ${SERVICE} -w '${value}'`
    );
  } else if (os === 'Linux') {
    await Neutralino.os.execCommand(
      `echo -n '${value}' | secret-tool store --label='${SERVICE}' service ${SERVICE} account ${ACCOUNT}`
    );
  } else if (os === 'Windows') {
    // DPAPI via PowerShell (criptografado por usuário/máquina do Windows)
    await Neutralino.os.execCommand(
      `powershell -Command "$s = ConvertTo-SecureString '${value}' -AsPlainText -Force; $s | ConvertFrom-SecureString | Out-File $env:APPDATA\\transcritor-audio-secret.txt"`
    );
  }
}

async function getSecretOS() {
  const os = NL_OS;
  try {
    if (os === 'Darwin') {
      const r = await Neutralino.os.execCommand(
        `security find-generic-password -a ${ACCOUNT} -s ${SERVICE} -w`
      );
      return r.stdOut.trim();
    } else if (os === 'Linux') {
      const r = await Neutralino.os.execCommand(
        `secret-tool lookup service ${SERVICE} account ${ACCOUNT}`
      );
      return r.stdOut.trim();
    } else if (os === 'Windows') {
      const r = await Neutralino.os.execCommand(
        `powershell -Command "$s = Get-Content $env:APPDATA\\transcritor-audio-secret.txt | ConvertTo-SecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($s))"`
      );
      return r.stdOut.trim();
    }
  } catch {
    return null;
  }
}
```

> Isso exige `secret-tool` instalado no Linux (pacote `libsecret-tools`),
> geralmente já presente em ambientes GNOME. No macOS/Windows usa apenas
> ferramentas já nativas do sistema.

**`js/transcription-ai.js` — diff ilustrativo (aplicação manual):**

```diff
- saveApiKey(key) {
-     this.apiKey = key;
-     localStorage.setItem('openai_api_key', key);
-     console.log('API Key salva com sucesso');
- }
+ async saveApiKey(key) {
+     this.apiKey = key;
+     await setSecretOS(key);
+     console.log('API Key salva com sucesso (keychain do SO)');
+ }

- loadApiKey() {
-     this.apiKey = localStorage.getItem('openai_api_key');
-     if (this.apiKey && this.transcribeBtn) {
-         this.transcribeBtn.disabled = false;
-         console.log('API Key carregada do localStorage');
-     }
- }
+ async loadApiKey() {
+     this.apiKey = await getSecretOS();
+     if (this.apiKey && this.transcribeBtn) {
+         this.transcribeBtn.disabled = false;
+         console.log('API Key carregada do keychain do SO');
+     }
+ }
```

> **Cuidado com injeção de shell:** os exemplos acima interpolam `value`
> diretamente no comando. Se a API key da OpenAI puder conter aspas simples
> ou caracteres especiais, isso quebra o comando (ou, em teoria, permite
> injeção). Na aplicação real, escape o valor ou grave-o primeiro em um
> arquivo temporário e leia o conteúdo do arquivo no comando, em vez de
> interpolar a string diretamente.

## 10. Resumo do esforço

- Arquivo novo: `neutralino.config.json`.
- Pequena adição no `index.html`: 2 linhas de `<script>` para inicializar o
  client do Neutralino (não é estritamente obrigatório para o app funcionar,
  mas é necessário se quiser usar qualquer API nativa como diálogos de
  arquivo do SO ou notificações).
- Zero mudança obrigatória em `js/*.js` ou `css/styles.css`.
- Trade-off: build multiplataforma mais simples, porém ecossistema/comunidade
  bem menores que Electron/Tauri, e sem geração automática de instaladores
  nativos completos (só binário).
- Mudança opcional (segurança): `Neutralino.storage` tira a chave do
  `localStorage` do WebView, mas não criptografa por si só — para um cofre
  real, delegar ao keychain do SO via `Neutralino.os.execCommand`, com
  cuidado especial para evitar injeção de shell ao montar os comandos.
