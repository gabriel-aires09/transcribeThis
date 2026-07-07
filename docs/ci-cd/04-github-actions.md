# Guia: GitHub Actions — Build + Release automático

Ver os guias de empacotamento em [01-electron.md](01-electron.md),
[02-tauri.md](02-tauri.md) e [03-neutralino.md](03-neutralino.md). Este
documento assume que **um dos três** já foi implementado manualmente (os
arquivos `package.json`/`src-tauri/`/`neutralino.config.json` já existem no
repositório).

> **Pré-requisito:** o projeto precisa ser um repositório Git com remote no
> GitHub (hoje a pasta local não é um repositório Git). Sem isso, não há
> onde o GitHub Actions rodar nem onde publicar a Release.

## Como funciona, em geral

1. Você cria uma tag de versão (`git tag v1.0.0 && git push origin v1.0.0`)
   ou dá push em `main`.
2. O workflow do GitHub Actions dispara, roda em 3 runners (Windows, macOS,
   Linux) em paralelo, cada um gera o binário da sua própria plataforma.
3. Ao final, uma **Release** é criada (ou atualizada) na página de Releases
   do repositório, com os binários de cada SO anexados.

Estrutura de arquivo necessária (nova, dentro do repositório):

```
transcribeThis/
└── .github/
    └── workflows/
        └── release.yml     # NOVO
```

Escolha a seção abaixo (9.x) correspondente ao framework que você
efetivamente implementou.

---

## A. Workflow para Electron

Usa `electron-builder` (já configurado no `package.json`, ver
[01-electron.md](01-electron.md)) em uma matrix de 3 SOs, publicando via
`electron-builder --publish always` diretamente para a Release do GitHub
(o `electron-builder` já sabe conversar com a API de Releases do GitHub).

```yaml
# .github/workflows/release.yml
name: Build and Release (Electron)

on:
  push:
    tags:
      - "v*.*.*"

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Instalar dependências
        run: npm ci

      - name: Build e publicar na Release
        run: npx electron-builder --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- `GITHUB_TOKEN` é gerado automaticamente pelo GitHub Actions — não precisa
  criar nenhum secret manualmente.
- O `electron-builder` cria a Release (como *draft* por padrão, dependendo da
  config) e sobe `.exe`/`.dmg`/`.AppImage`/`.deb` de cada runner.
- Se preferir controlar manualmter quando a release é publicada (em vez de
  automático), troque `--publish always` por `--publish onTagOrDraft` e
  publique manualmente pela UI do GitHub depois que os 3 jobs terminarem.

---

## B. Workflow para Tauri

A própria equipe do Tauri mantém uma Action oficial
(`tauri-apps/tauri-action`) que compila e publica em um único step por SO.

```yaml
# .github/workflows/release.yml
name: Build and Release (Tauri)

on:
  push:
    tags:
      - "v*.*.*"

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - name: Instalar dependências de sistema (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
            libayatana-appindicator3-dev librsvg2-dev

      - uses: dtolnay/rust-toolchain@stable

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Instalar dependências Node
        run: npm ci

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "Transcritor de Áudio v__VERSION__"
          releaseDraft: true
          prerelease: false
```

- `tauri-apps/tauri-action` já sabe rodar `tauri build` e subir os artefatos
  certos (`.msi`/`.exe`, `.dmg`, `.deb`/`.AppImage`) para a Release
  correspondente à tag.
- `releaseDraft: true` cria a Release como rascunho, para você revisar antes
  de publicar; mude para `false` se quiser publicação 100% automática.

---

## C. Workflow para Neutralino.js

Não existe Action oficial mantida pela comunidade Neutralino tão madura
quanto as duas acima. O caminho é rodar o CLI `neu build` (que já gera
binários para as 3 plataformas a partir de um único runner, ver
[03-neutralino.md](03-neutralino.md)) e subir os artefatos manualmente com
uma Action genérica de upload de Release.

```yaml
# .github/workflows/release.yml
name: Build and Release (Neutralino)

on:
  push:
    tags:
      - "v*.*.*"

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Instalar CLI do Neutralino
        run: npm install -g @neutralinojs/neu

      - name: Baixar binários do runtime
        run: neu update

      - name: Build para as 3 plataformas
        run: neu build --release

      - name: Publicar binários na Release
        uses: softprops/action-gh-release@v2
        with:
          files: dist/**/*
          tag_name: ${{ github.ref_name }}
          draft: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- Como `neu build --release` já produz os 3 binários (Windows/Linux/macOS) a
  partir de um único runner Linux, este workflow não precisa de matrix —
  roda um job só.
- `softprops/action-gh-release` é a Action de terceiros mais usada da
  comunidade para "subir arquivos numa Release do GitHub"; se preferir evitar
  Actions de terceiros, o mesmo resultado pode ser obtido chamando a
  `gh release upload` via `gh` CLI (já vem pré-instalado nos runners do
  GitHub).

---

## Observações comuns aos 3 workflows

- **Assinatura de código não está incluída.** Os binários gerados não são
  assinados — Windows SmartScreen e macOS Gatekeeper vão exibir avisos de
  "app não verificado" ao abrir. Assinatura (e, no caso do macOS,
  *notarization*) é um passo adicional que exige certificados pagos (Apple
  Developer / certificado de code signing Windows) e não está no escopo
  deste guia.
- **Segredos:** nenhum dos três workflows acima precisa de secrets além do
  `GITHUB_TOKEN` automático — a menos que você adicione assinatura de
  código no futuro, aí sim seria necessário cadastrar os certificados como
  *encrypted secrets* do repositório.
- **Disparo por push em vez de tag:** se preferir gerar builds a cada push em
  `main` (em vez de só em tags), troque o bloco `on:` por:
  ```yaml
  on:
    push:
      branches: [main]
  ```
  Nesse caso, normalmente você quer publicar como *pre-release*/rascunho
  (não uma Release "oficial" a cada commit) — ajuste `draft`/`prerelease`
  conforme preferir.
