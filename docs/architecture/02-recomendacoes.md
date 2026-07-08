# Recomendações de Arquitetura e Organização de Código

> Documentação apenas — nenhuma edição foi feita no código-fonte, conforme a
> regra do `CLAUDE.md` ("DON'T MAKE ANY EDITS TO THE CODE"). Este documento
> não repete o conteúdo já detalhado em [architecture.md](architecture.md)
> (estado atual) e em `docs/frontend/00-overview.md`/`01-react.md`/
> `02-flutter.md` (guias de reescrita) — ele **sintetiza os dois** em um
> conjunto de recomendações e critérios de decisão. Onde houver código de
> exemplo, ele já existe nos guias referenciados; aqui o foco é o *porquê* e
> o *como decidir*.

## 1. Diagnóstico: por que mudar a organização atual

Resumo de [architecture.md § "Pontos de atenção arquiteturais"](architecture.md#pontos-de-atenção-arquiteturais),
como ponto de partida para as recomendações abaixo:

| Problema hoje | Efeito prático |
|---|---|
| Sem build step, sem TypeScript, sem verificação estática | Erros só aparecem em runtime, no navegador |
| Módulos acoplados por instanciação direta em `app.js` (sem event bus) | Adicionar um módulo novo exige editar `app.js` manualmente para ligar as referências |
| Regra de negócio misturada com DOM/rede (ex.: `transcription-ai.js`, 573 linhas fazendo validação + `fetch` + manipulação de UI no mesmo arquivo) | Impossível testar "isso é um arquivo válido para o Whisper?" sem montar a página inteira |
| Dependência de CDN em runtime (Carbon, CodeMirror, fonte) | App quebra visualmente sem internet |
| `alert()` como único mecanismo de erro | Sem estado visual consistente, sem acessibilidade |

Essas cinco linhas são a motivação de cada recomendação nas seções
seguintes — cada uma resolve um problema específico da tabela, não é
mudança por preferência estética.

## 2. Recomendação central: arquitetura em 4 camadas (Domain/Application/Infrastructure/Presentation)

Independente de qual framework for escolhido (seção 4), a recomendação de
organização de código é a mesma, já detalhada com exemplos completos em
[docs/frontend/00-overview.md § "Arquitetura comum às duas reescritas"](../frontend/00-overview.md#arquitetura-comum-às-duas-reescritas):

- **Domain** — entidades e regras puras (`Transcription`, `MediaSource`,
  `ApiCredential`), zero dependência de framework/rede/storage. Resolve o
  problema "regra de negócio misturada com DOM/rede" da tabela acima.
- **Application** — um caso de uso por ação do usuário
  (`TranscribeAudioUseCase`, `ToggleThemeUseCase`), recebendo dependências
  por injeção de construtor.
- **Infrastructure** — implementações concretas (chamada HTTP ao Whisper,
  secure storage do SO, adapter do CodeMirror), sempre atrás de uma
  interface ("port") definida no Domain.
- **Presentation** — telas e componentes visuais, sem regra de negócio.

Por que essa é a recomendação e não outra estrutura possível (ex.: MVC,
"feature folders" simples): o problema dominante hoje é
**testabilidade e acoplamento**, não organização por feature. Separar
Domain/Application do resto é o que permite testar "um arquivo de 30MB é
rejeitado" sem abrir um navegador — critério direto da tabela da seção 1.

### 2.1 Ports & Adapters como regra de dependência

Toda comunicação de Application/Domain com o mundo externo (rede, storage,
editor de texto, player) passa por uma interface definida no Domain e
implementada no Infrastructure — nunca o inverso. Nomes concretos e código
completo já existem nos guias:

- React: `src/domain/ports/*.js` + `src/infrastructure/*.js` — ver
  [01-react.md §§ 5–7](../frontend/01-react.md).
- Flutter: `lib/domain/repositories/*.dart` (abstract class) +
  `lib/data/*.dart` — ver [02-flutter.md §§ 6–7](../frontend/02-flutter.md).

Isso resolve concretamente: trocar o `TranscriptionGateway`/
`TranscriptionRepository` de "OpenAI Whisper" para outro provedor de IA no
futuro não deveria exigir tocar em `TranscribeAudioUseCase` — só trocar a
implementação injetada.

### 2.2 Design tokens como fonte única de verdade

Já extraídos 1:1 dos valores atuais de `css/styles.css` em
[00-overview.md § "Design tokens"](../frontend/00-overview.md#design-tokens-origem-real-não-inventados)
(cor, espaçamento, tipografia, raio, sombra). Recomendação: nenhum
componente novo, em nenhum dos dois frameworks, escreve um valor literal —
sempre uma referência a um token nomeado. Isso também é o momento indicado
para introduzir o token `color-danger` que hoje não existe (o app usa
`alert()`, sem cor própria — linha da tabela da seção 1).

### 2.3 Substituir acoplamento por instanciação direta

O problema "`app.js` precisa ser editado manualmente para conectar cada
módulo novo" (seção 1) se resolve, nas duas reescritas, por:

- **React**: estado + Context/hooks centralizados em `MainApp.jsx`, cada
  hook (`useMediaController`, `useTheme`) expõe uma API própria; novos
  componentes consomem via `props`/`context`, não por referência direta a
  instância de outro módulo.
- **Flutter**: `ValueNotifier`/`Provider` cumprindo o mesmo papel.

Não é necessário introduzir uma lib de state management dedicada (Redux,
Riverpod) — o app é pequeno o bastante para os primitivos do próprio
framework, evitando dependência não solicitada (já sinalizado em
[01-react.md § 2](../frontend/01-react.md#2-novas-dependências-pedem-sua-aprovação-explícita--regra-do-claudemd)).

## 3. Recomendação de organização de diretórios (visão unificada)

Estrutura-alvo, válida para os dois caminhos (detalhes específicos de cada
framework nos guias linkados):

```
domain/           # entidades + interfaces (ports/repositories) — sem dependência externa
application/      # casos de uso — um arquivo por ação do usuário
infrastructure/   # (React) ou data/ (Flutter) — implementações concretas dos ports
presentation/      # telas, componentes, design system, hooks/controllers
  design-system/    # tokens + componentes reutilizáveis (Button, Modal, ProgressBar...)
  screens/           # uma tela por estado do app (loading, seleção, principal)
test/              # espelha domain/ e application/ — TDD, ver seção 5
```

Mapeamento completo arquivo-a-arquivo do código atual para essa estrutura:
[01-react.md § 3](../frontend/01-react.md#3-nova-estrutura-de-diretórios) e
[02-flutter.md § 4](../frontend/02-flutter.md#4-nova-estrutura-de-diretórios).

**Regra de dependência entre camadas** (para revisão de código/PR, ao
migrar):

```
Presentation → Application → Domain
                    ↑
             Infrastructure (implementa interfaces do Domain)
```

Nenhuma seta aponta para trás — `Domain` não importa nada de
`Infrastructure` nem de `Presentation`. Essa é a checagem mais simples e
mais importante a fazer em qualquer revisão futura de código nesse modelo.

## 4. Critério de decisão: React (+ Electron/Tauri) vs. Flutter

Os dois guias já têm um comparativo técnico completo
([00-overview.md § "Comparativo rápido"](../frontend/00-overview.md#comparativo-rápido)).
Aqui, a recomendação é orientada por **pergunta de negócio**, não só por
tabela técnica:

| Se a prioridade é... | Recomendação |
|---|---|
| Menor risco e menor esforço de migração, aproveitando o máximo do código/CSS atual | **React + Electron** — CSS quase 1:1 reaproveitável, mesma linguagem (JS), CodeMirror+Vim e YouTube continuam funcionando nativamente sem WebView aninhada (ver ressalva do Flutter abaixo) |
| Expansão futura real para mobile (Android/iOS) e/ou web a partir da mesma base de código, e o time aceita reescrever do zero | **Flutter** — única opção que compila nativo para desktop **e** mobile/web sem reescrever `domain`/`application` no futuro |
| Instalador pequeno é um requisito duro (ex.: distribuição restrita, app precisa caber em disco limitado) | **Flutter** (~15-40MB) ou **Tauri** (~10-20MB) — não Electron (~150-200MB) |
| Manter o editor Vim e o player do YouTube exatamente como estão, sem risco de regressão nessas duas features | **React + Electron** — Flutter exige reintroduzir uma `InAppWebView` só para essas duas partes ([02-flutter.md § 8](../frontend/02-flutter.md#8-webview-residual-editor-vim-e-youtube)), o que anula parcialmente a vantagem "sem WebView" do Flutter *para este app específico* |

**Recomendação padrão, na ausência de um requisito explícito de
multi-dispositivo mobile/web:** React + Electron. É a opção de menor
esforço e menor risco dado que Electron já está em uso no projeto
(`main.js`/`preload.js` mudam pouco — [01-react.md § 9](../frontend/01-react.md#9-mainjs--ajuste-para-servir-o-build-do-vite)),
e a arquitetura em camadas da seção 2 já entrega a maior parte do ganho de
testabilidade/organização independente da escolha do framework de UI.

## 5. TDD como parte da organização, não só da implementação

Convenção de cenários Given/When/Then antes de cada caso de uso, já
padronizada em
[00-overview.md § "TDD"](../frontend/00-overview.md#tdd-convenção-de-cenários-usada-nos-dois-guias),
com testes completos de exemplo em
[01-react.md § 11](../frontend/01-react.md#11-tdd--cenários-e-testes) (Vitest)
e [02-flutter.md § 10](../frontend/02-flutter.md#10-tdd--cenários-e-testes)
(`flutter_test`/`mocktail`).

Recomendação de organização: a pasta `test/` espelha `domain/` e
`application/` 1:1 (um arquivo de teste por caso de uso/entidade). Como
essas duas camadas não dependem do framework de UI, os cenários de teste
são praticamente idênticos entre React e Flutter — só muda o test runner —
o que também significa que **a estrutura de teste não precisa ser
refeita** se a decisão da seção 4 mudar depois.

## 6. Estratégia de migração incremental recomendada

Migrar tudo de uma vez (reescrever `js/*.js` inteiro antes de validar
qualquer parte) é o maior risco do processo. Ordem recomendada, aplicável
aos dois frameworks:

1. **Extrair `domain/` primeiro, isolado, sem tocar UI.** As entidades
   (`MediaSource.assertTranscribable()`, `ApiCredential`, `Transcription`)
   são JS/Dart puro — dá para escrever e testar (seção 5) antes mesmo de
   decidir a estrutura final de `presentation/`. É o maior ganho de
   testabilidade pelo menor risco.
2. **Extrair `application/` (casos de uso), injetando adapters que ainda
   chamam o código atual por baixo.** Ex.: `TranscribeAudioUseCase` pode,
   temporariamente, injetar um `OpenAIWhisperGateway` que só encapsula o
   `fetch` que já existe em `transcription-ai.js`, sem mudar o
   comportamento.
3. **Só then migrar `presentation/`**, tela por tela — o design system
   (tokens + componentes, seção 2.2) primeiro, depois as telas que o
   consomem. Esta é a etapa que efetivamente depende da escolha do
   framework (seção 4).
4. **Infrastructure por último**, trocando os adapters temporários do passo
   2 pelas implementações reais do framework escolhido
   (`ElectronSecureCredentialStore`/`flutter_secure_storage`, etc.).

Essa ordem garante que, a qualquer momento do processo, `domain/` e
`application/` já estejam testados e estáveis — o risco fica concentrado
na camada de apresentação, que é também a mais fácil de verificar
visualmente.

## 7. Resumo executivo

| Recomendação | Resolve (seção 1) |
|---|---|
| Arquitetura em 4 camadas (Domain/Application/Infrastructure/Presentation) | Regra de negócio testável sem DOM/rede |
| Ports & Adapters para toda dependência externa | Troca de provedor (ex.: IA, storage) sem tocar regra de negócio |
| Design tokens únicos, incl. `color-danger` novo | Falta de estado visual de erro consistente (`alert()`) |
| Estado centralizado via hooks/Context (React) ou `ValueNotifier`/`Provider` (Flutter) | Acoplamento por instanciação direta em `app.js` |
| TDD com cenários Given/When/Then espelhando `domain/application` | Nenhuma verificação estática hoje |
| Migração incremental (domain → application → presentation → infra) | Risco de reescrever tudo de uma vez sem validação |
| React+Electron como padrão, Flutter só se multi-dispositivo mobile/web for requisito real | Evita custo de reescrita total (Flutter) sem ganho correspondente |

Detalhamento completo de cada item — estrutura de arquivos exata,
dependências novas (pendentes de sua aprovação, conforme `CLAUDE.md`),
código de exemplo por componente — está nos documentos já existentes:
[docs/architecture/architecture.md](architecture.md) (estado atual),
[docs/frontend/00-overview.md](../frontend/00-overview.md),
[docs/frontend/01-react.md](../frontend/01-react.md) e
[docs/frontend/02-flutter.md](../frontend/02-flutter.md).
