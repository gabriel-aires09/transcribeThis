# Guia: Reescrita em Flutter (nativo multi-dispositivo)

> Documentação apenas — nenhuma edição foi feita no código-fonte. Ver
> considerações gerais (arquitetura em camadas, tokens de design, convenção
> de TDD) em [00-overview.md](00-overview.md). **Diferente do guia React,
> aqui não há reaproveitamento de arquivo nenhum** — `index.html`, `css/`,
> `js/*.js`, `main.js` e `preload.js` são só a *especificação de
> comportamento* a ser reproduzida em Dart. `package.json`/`node_modules`
> deixam de existir no app final.

## 1. Pré-requisitos

- Flutter SDK (canal stable) + Dart — via [flutter.dev](https://flutter.dev)/`flutter doctor`.
- Suporte desktop habilitado: `flutter config --enable-linux-desktop --enable-windows-desktop --enable-macos-desktop`.
- Toolchain por plataforma (igual ao Electron/Tauri — sem atalho aqui):
  - **Linux:** `clang`, `cmake`, `ninja-build`, `libgtk-3-dev`.
  - **Windows:** Visual Studio (workload "Desktop development with C++").
  - **macOS:** Xcode.

## 2. "Multi-dispositivo": o que Flutter dá que React+Electron não dá

A mesma base `lib/` compila nativamente para Linux, Windows, macOS **e**,
sem reescrever a camada de domínio/aplicação, para Android/iOS/web no
futuro (`flutter build apk`, `flutter build web`) — só a camada de
Presentation precisaria de ajustes de layout responsivo. É a motivação
central de escolher Flutter aqui. A ressalva da seção 8 (WebView residual)
não compromete isso: mesmo as duas telas que dependem de WebView continuam
compilando nos mesmos alvos.

## 3. Novas dependências (pedem sua aprovação explícita — regra do `CLAUDE.md`)

Nenhuma delas é do npm — é o equivalente Dart/pub.dev, mas a regra do
`CLAUDE.md` sobre novas bibliotecas se aplica igual:

| Pacote | Motivo |
|---|---|
| `flutter_secure_storage` | equivalente ao `safeStorage` do Electron (`main.js` linhas 44-60) — usa Keychain/DPAPI/libsecret nativos |
| `http` | chamada REST ao Whisper (equivalente ao `fetch` de `js/transcription-ai.js` linha 259) |
| `flutter_inappwebview` | **WebView residual** — necessário só para o editor com Vim e o player do YouTube, ver seção 8 |
| `window_manager` | controla tamanho/posição da janela nativa (equivalente a `width`/`height`/`minWidth`/`minHeight` de `main.js` linhas 63-67) |
| `media_kit` + `media_kit_video` | reprodução de áudio/vídeo local — mais robusto que o `video_player` padrão para desktop (cobre os mesmos formatos que o `<audio>`/`<video>` HTML5 cobre hoje: mp3, mp4, wav, webm, ogg) |
| `path_provider` | localizar diretório de dados do usuário para persistir o rascunho da transcrição (equivalente ao `localStorage` de `js/editor.js` linha 54) |
| `mocktail` | dev — mocks para TDD (seção 10) |

`flutter_test` já vem embutido no SDK, sem instalação separada.

```yaml
# pubspec.yaml — dependencies/dev_dependencies (trecho novo)
dependencies:
  flutter_secure_storage: ^9.0.0
  http: ^1.2.0
  flutter_inappwebview: ^6.0.0
  window_manager: ^0.4.0
  media_kit: ^1.1.0
  media_kit_video: ^1.2.0
  path_provider: ^2.1.0

dev_dependencies:
  mocktail: ^1.0.0
  flutter_test:
    sdk: flutter
```

## 4. Nova estrutura de diretórios

```
transcritor_audio/                  # projeto Flutter novo (fora ou substituindo a raiz atual — a decidir)
├── pubspec.yaml
├── lib/
│   ├── main.dart                    # equivalente a main.js + app.js
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── transcription.dart
│   │   │   ├── media_source.dart
│   │   │   └── api_credential.dart
│   │   └── repositories/            # interfaces (abstract class) — "ports"
│   │       ├── credential_repository.dart
│   │       ├── draft_repository.dart
│   │       └── transcription_repository.dart
│   ├── application/
│   │   ├── transcribe_audio_use_case.dart
│   │   ├── save_api_key_use_case.dart
│   │   ├── load_api_key_use_case.dart
│   │   ├── save_draft_use_case.dart
│   │   ├── load_draft_use_case.dart
│   │   └── toggle_theme_use_case.dart
│   ├── data/                         # implementações concretas das interfaces do domain
│   │   ├── secure_credential_repository.dart
│   │   ├── openai_whisper_repository.dart
│   │   └── file_draft_repository.dart
│   └── presentation/
│       ├── design_system/
│       │   ├── app_colors.dart
│       │   ├── app_spacing.dart
│       │   ├── app_typography.dart
│       │   ├── app_radius.dart
│       │   ├── app_shadows.dart
│       │   ├── app_theme.dart        # monta ThemeData a partir dos tokens acima
│       │   ├── app_button.dart
│       │   ├── app_icon_button.dart
│       │   ├── app_progress_bar.dart
│       │   └── app_modal.dart
│       ├── screens/
│       │   ├── loading_screen.dart
│       │   ├── media_selection_screen.dart
│       │   ├── youtube_url_dialog.dart
│       │   └── main_app_screen.dart
│       ├── editor/
│       │   ├── codemirror_editor.dart   # widget WebView — ver seção 8
│       │   └── vendor/codemirror/       # CodeMirror 5 + vim.min.js vendorizados (mesmos arquivos citados em docs/desktop/01-electron.md §9.2)
│       └── media/
│           └── youtube_embed.dart       # widget WebView — ver seção 8
└── test/
    ├── application/                   # testes de caso de uso (TDD) — ver seção 10
    └── presentation/design_system/    # testes de widget — ver seção 10
```

Mapeamento do código atual:

| Arquivo/trecho atual | Vira |
|---|---|
| `js/theme.js` | `ToggleThemeUseCase` + `AppTheme` (Dart `ThemeMode`) |
| `js/screens.js` | `main_app_screen.dart` + `Navigator`/estado de tela em `main.dart` |
| `js/editor.js` (CodeMirror+Vim) | `codemirror_editor.dart` (WebView, seção 8) |
| `js/media-controls.js` — parte local (linhas 175-199, 291-372) | `media_kit` dentro de `main_app_screen.dart` |
| `js/media-controls.js` — parte YouTube (linhas 61-173) | `youtube_embed.dart` (WebView, seção 8) |
| `js/keyboard-shortcuts.js` | `Focus`/`Shortcuts`+`Actions` do Flutter (`LogicalKeyboardKey.f1/f2/f3`) em `main_app_screen.dart` |
| `js/shortcuts-bar.js` | estado local (`ValueNotifier`) em `main_app_screen.dart` |
| `main.js` linhas 44-60 (`safeStorage`) | `data/secure_credential_repository.dart` (`flutter_secure_storage`) |
| `main.js` linhas 63-74 (tamanho da janela) | `window_manager` em `main.dart` |
| `js/transcription-ai.js` (573 linhas) | dividido em `TranscribeAudioUseCase` + `OpenAIWhisperRepository` + `main_app_screen.dart` (botão) + `app_modal.dart` (configurar API key) |

## 5. Design tokens — Dart tipado

Mesmos valores de [00-overview.md](00-overview.md#design-tokens-origem-real-não-inventados),
como classes com constantes nomeadas — nunca um `Color(0x...)` ou número
solto dentro de um widget:

```dart
// lib/presentation/design_system/app_colors.dart
import 'package:flutter/material.dart';

class AppColors {
  final Color bgPrimary, bgSecondary, bgHeader;
  final Color textPrimary, textSecondary, textInverse;
  final Color border, borderStrong;
  final Color accent, accentHover;
  final Color btnSecondary, btnSecondaryHover;
  final Color disabled;
  final Color danger, dangerBg;

  const AppColors({
    required this.bgPrimary, required this.bgSecondary, required this.bgHeader,
    required this.textPrimary, required this.textSecondary, required this.textInverse,
    required this.border, required this.borderStrong,
    required this.accent, required this.accentHover,
    required this.btnSecondary, required this.btnSecondaryHover,
    required this.disabled, required this.danger, required this.dangerBg,
  });

  static const light = AppColors(
    bgPrimary: Color(0xFFFFFFFF), bgSecondary: Color(0xFFF4F4F4), bgHeader: Color(0xFF161616),
    textPrimary: Color(0xFF161616), textSecondary: Color(0xFF525252), textInverse: Color(0xFFFFFFFF),
    border: Color(0xFFE0E0E0), borderStrong: Color(0xFF8D8D8D),
    accent: Color(0xFF0F62FE), accentHover: Color(0xFF0353E9),
    btnSecondary: Color(0xFF5A6872), btnSecondaryHover: Color(0xFF4A5862),
    disabled: Color(0xFFC6C6C6), danger: Color(0xFFDA1E28), dangerBg: Color(0xFFFFF1F1),
  );

  static const dark = AppColors(
    bgPrimary: Color(0xFF262626), bgSecondary: Color(0xFF161616), bgHeader: Color(0xFF000000),
    textPrimary: Color(0xFFF4F4F4), textSecondary: Color(0xFFC6C6C6), textInverse: Color(0xFFF4F4F4),
    border: Color(0xFF393939), borderStrong: Color(0xFF6F6F6F),
    accent: Color(0xFF0F62FE), accentHover: Color(0xFF0353E9), // accent não muda entre temas
    btnSecondary: Color(0xFF6A7882), btnSecondaryHover: Color(0xFF7A8892),
    disabled: Color(0xFF525252), danger: Color(0xFFFF8389), dangerBg: Color(0xFF2A1214),
  );
}
```

```dart
// lib/presentation/design_system/app_spacing.dart
class AppSpacing {
  static const s1 = 4.0, s2 = 8.0, s3 = 12.0, s4 = 16.0, s5 = 20.0, s6 = 24.0, s8 = 32.0, s10 = 40.0;
}

// lib/presentation/design_system/app_radius.dart
class AppRadius {
  static const sm = 3.0, md = 4.0, lg = 6.0, xl = 8.0;
  static const full = 9999.0; // BorderRadius.circular(full) equivale ao 50% do CSS
}

// lib/presentation/design_system/app_typography.dart
import 'package:flutter/material.dart';

class AppTypography {
  static const fontFamilyMono = 'JetBrains Mono'; // fonte vendorizada em assets/fonts/ (não há CDN em app nativo)
  static const fontFamilyUi = 'IBM Plex Sans';

  static const xs = 11.2, sm = 13.6, base = 16.0, md = 17.6, lg = 20.8, xl = 40.0; // rem*16 convertido pra px lógico
}
```

`app_shadows.dart` segue o mesmo padrão com `BoxShadow` nomeados
(`shadowSm`, `shadowMd`, `shadowLg`, `shadowXl`, `shadowFocusAccent`).
`app_theme.dart` monta um `ThemeData`/`ColorScheme` a partir dessas classes
para os widgets nativos do Material herdarem os tokens automaticamente.

> Diferente da web, não existe Google Fonts via CDN em um app desktop
> nativo — `JetBrains Mono` e `IBM Plex Sans` precisam ser baixadas (mesmo
> processo citado em
> [docs/desktop/01-electron.md §9.2](../desktop/01-electron.md), via
> google-webfonts-helper) e declaradas em `pubspec.yaml` → `fonts:`.

## 6. Camada de Domínio (`lib/domain/`)

```dart
// lib/domain/entities/media_source.dart
class MediaSource {
  final String? filePath;
  final String? fileName;
  final int? fileSizeBytes;
  final String? youtubeUrl;

  const MediaSource.file({required this.filePath, required this.fileName, required this.fileSizeBytes})
      : youtubeUrl = null;
  const MediaSource.youtube(this.youtubeUrl)
      : filePath = null, fileName = null, fileSizeBytes = null;

  bool get isYouTube => youtubeUrl != null;

  static const _supportedExtensions = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];
  static const _maxWhisperSizeBytes = 25 * 1024 * 1024;

  void assertTranscribable() {
    if (isYouTube) {
      throw DomainException('Não é possível transcrever vídeos do YouTube diretamente. Baixe o áudio primeiro ou use um arquivo local.');
    }
    if (fileName == null) {
      throw DomainException('Nenhum arquivo de áudio/vídeo carregado.');
    }
    final ext = fileName!.split('.').last.toLowerCase();
    if (!_supportedExtensions.contains(ext)) {
      throw DomainException('Formato não suportado: .$ext');
    }
    if ((fileSizeBytes ?? 0) > _maxWhisperSizeBytes) {
      throw DomainException('Arquivo muito grande. Máximo: 25MB');
    }
  }
}

class DomainException implements Exception {
  final String message;
  DomainException(this.message);
  @override
  String toString() => message;
}
```

```dart
// lib/domain/repositories/credential_repository.dart
abstract class CredentialRepository {
  Future<String?> get();
  Future<void> set(String value);
  Future<void> clear();
}
```

`Transcription` e `TranscriptionRepository`/`DraftRepository` seguem o
mesmo padrão do guia React (métodos puros de entidade + interface
abstrata implementada em `data/`).

## 7. Camada de Aplicação (`lib/application/`)

```dart
// lib/application/transcribe_audio_use_case.dart
class TranscribeAudioUseCase {
  final TranscriptionRepository transcriptionRepository;
  final CredentialRepository credentialRepository;

  TranscribeAudioUseCase({required this.transcriptionRepository, required this.credentialRepository});

  Future<Transcription> call(MediaSource source, Transcription current) async {
    final apiKey = await credentialRepository.get();
    if (apiKey == null) throw DomainException('Configure sua API Key primeiro!');

    source.assertTranscribable();

    final text = await transcriptionRepository.transcribe(source.filePath!, apiKey);
    return current.appendTimestamped(text);
  }
}
```

## 8. WebView residual: editor Vim e YouTube

Este é o ponto de atenção mais importante do guia. Duas partes do app não
têm equivalente nativo maduro em Flutter:

**Editor com keybindings Vim** — pacotes Flutter de edição de código
(`re_editor`, `code_text_field`) cobrem *syntax highlighting*, mas nenhum
reproduz o modo Vim completo (`hjkl`, `dd`, `yy`, `p`, modos Normal/Insert)
com a mesma maturidade do CodeMirror 5 + `vim.min.js` já usado hoje.
Caminho recomendado: **reaproveitar o CodeMirror+Vim tal como está**,
rodando dentro de uma `InAppWebView` que carrega um HTML local
vendorizado (mesmos arquivos citados em
[docs/desktop/01-electron.md §9](../desktop/01-electron.md)), comunicando
com o Dart via `JavaScriptHandler`:

```dart
// lib/presentation/editor/codemirror_editor.dart (esqueleto)
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

class CodeMirrorEditor extends StatefulWidget {
  final ValueChanged<String> onChanged;
  const CodeMirrorEditor({super.key, required this.onChanged});
  // ...
}

class _CodeMirrorEditorState extends State<CodeMirrorEditor> {
  InAppWebViewController? _controller;

  @override
  Widget build(BuildContext context) {
    return InAppWebView(
      initialFile: 'assets/editor/index.html', // carrega CodeMirror 5 + vim.min.js vendorizados
      onWebViewCreated: (controller) {
        _controller = controller;
        controller.addJavaScriptHandler(
          handlerName: 'onEditorChange',
          callback: (args) => widget.onChanged(args.first as String),
        );
      },
    );
  }

  Future<void> setValue(String text) =>
      _controller?.evaluateJavascript(source: 'editor.setValue(${jsonEncode(text)})') ?? Future.value();
}
```

**Player embutido do YouTube** — mesma lógica: `youtube_player_iframe` (que
por baixo também usa uma WebView) ou `InAppWebView` carregando o
`https://www.youtube.com/embed/<id>` diretamente, reproduzindo o mesmo
comportamento de `js/media-controls.js` linhas 97-126.

> **Consequência honesta:** para este app específico, a vantagem de
> "Flutter não embute um WebView" (diferente de Electron/Tauri/Neutralino)
> se perde parcialmente — as duas telas mais complexas do app (editor e
> player de YouTube) acabam rodando dentro de uma `InAppWebView` de
> qualquer jeito. A vantagem real que sobra é: reprodução de mídia local,
> seleção de tela/telas de navegação, modais, botões e barra de progresso
> são 100% nativos (Skia), só essas duas partes usam WebView — contra
> Electron, onde o app inteiro roda em WebView.

## 9. Janela nativa — `window_manager`

```dart
// lib/main.dart (trecho) — equivalente a main.js linhas 63-74
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await windowManager.ensureInitialized();

  const windowOptions = WindowOptions(
    size: Size(1400, 900),
    minimumSize: Size(900, 600),
    title: 'transcribeThis',
  );
  windowManager.waitUntilReadyToShow(windowOptions, () async {
    await windowManager.show();
  });

  runApp(const TranscribeThisApp());
}
```

## 10. TDD — cenários e testes

Mesmo cenário Given/When/Then de
[00-overview.md](00-overview.md#tdd-convenção-de-cenários-usada-nos-dois-guias)
e do guia React (seção 11 de [01-react.md](01-react.md)) — a regra de
negócio é idêntica, só o test runner muda:

```dart
// test/application/transcribe_audio_use_case_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockTranscriptionRepository extends Mock implements TranscriptionRepository {}
class MockCredentialRepository extends Mock implements CredentialRepository {}

void main() {
  late MockTranscriptionRepository transcriptionRepository;
  late MockCredentialRepository credentialRepository;
  late TranscribeAudioUseCase useCase;

  setUp(() {
    transcriptionRepository = MockTranscriptionRepository();
    credentialRepository = MockCredentialRepository();
    useCase = TranscribeAudioUseCase(
      transcriptionRepository: transcriptionRepository,
      credentialRepository: credentialRepository,
    );
  });

  test('rejeita transcrição de vídeo do YouTube sem chamar o repositório', () async {
    when(() => credentialRepository.get()).thenAnswer((_) async => 'sk-fake');
    final youtubeSource = const MediaSource.youtube('https://youtu.be/abc123');

    expect(
      () => useCase.call(youtubeSource, Transcription('')),
      throwsA(isA<DomainException>()),
    );
    verifyNever(() => transcriptionRepository.transcribe(any(), any()));
  });

  test('anexa o texto transcrito ao rascunho existente', () async {
    when(() => credentialRepository.get()).thenAnswer((_) async => 'sk-fake');
    when(() => transcriptionRepository.transcribe(any(), any()))
        .thenAnswer((_) async => 'texto transcrito');
    final source = const MediaSource.file(filePath: '/tmp/audio.mp3', fileName: 'audio.mp3', fileSizeBytes: 1024);

    final result = await useCase.call(source, Transcription('rascunho anterior'));

    expect(result.text, contains('rascunho anterior'));
    expect(result.text, contains('texto transcrito'));
  });
}
```

```dart
// test/presentation/design_system/app_button_test.dart — testa estados (seção "Estados de componente" do overview)
testWidgets('AppButton fica desabilitado durante loading e expõe Semantics', (tester) async {
  await tester.pumpWidget(MaterialApp(home: AppButton(label: 'Transcrever', loading: true, onPressed: () {})));

  final buttonFinder = find.byType(AppButton);
  expect(tester.widget<AppButton>(buttonFinder).loading, isTrue);
  expect(find.bySemanticsLabel('Transcrever'), findsOneWidget);
});
```

Rodar com `flutter test`. Assim como no guia React, a recomendação é
escrever o teste do caso de uso antes da implementação — como
`domain`/`application` não dependem de `flutter_test` (só de Dart puro,
poderiam até rodar com `dart test`), o ciclo é rápido e não exige montar
widget nem WebView.

## 11. Build e distribuição por plataforma

```bash
flutter build linux --release
flutter build windows --release
flutter build macos --release
```

- **Cross-compilation não é suportada** — mesma limitação de
  Electron/Tauri: gerar o binário de Windows exige compilar em uma máquina
  Windows (ou CI com runner correspondente), idem macOS.
- Empacotamento em instalador (`.msi`, `.dmg`, `.deb`) é um passo separado
  do `flutter build` — ferramentas como `msix` (Windows, pacote pub.dev) ou
  scripts de `dpkg`/`pkgbuild` continuam necessárias, mesmo trade-off dos
  outros guias.

## 12. Resumo do esforço

- **Reescrita completa** — nenhum arquivo do projeto atual é reaproveitado
  diretamente; `index.html`/`css/`/`js/*.js`/`main.js`/`preload.js` servem
  só como especificação de comportamento.
- Maior barreira de adoção que React: linguagem nova (Dart), paradigma de
  widgets, toolchain própria.
- Duas partes do app (editor Vim, player do YouTube) continuam dependendo
  de WebView — não é uma reescrita 100% nativa "de ponta a ponta" para
  *este* app específico, apesar de Flutter permitir isso para a maior parte
  da UI.
- Ganho real e verificável: mesma base de código compila nativamente para
  Linux/Windows/macOS hoje, e para mobile/web no futuro sem reescrever
  `domain/`/`application/` — a camada que concentra a regra de negócio.
- Estrutura em camadas (Domain/Application/Data/Presentation) e a suíte de
  testes são espelhadas 1:1 com o guia React — o comportamento coberto por
  teste é o mesmo, só a sintaxe muda.
