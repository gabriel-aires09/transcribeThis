// keyboard-shortcuts.js - Gerenciamento de atalhos de teclado

class KeyboardShortcuts {
    constructor() {
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    handleKeyPress(event) {
        // F1 - Play/Pause
        if (event.key === 'F1') {
            event.preventDefault();
            if (window.mediaController.isMediaLoaded()) {
                window.mediaController.togglePlayPause();
            }
            return;
        }

        // F2 - Voltar 1s
        if (event.key === 'F2') {
            event.preventDefault();
            if (window.mediaController.isMediaLoaded()) {
                window.mediaController.skipBackward();
            }
            return;
        }

        // F3 - Avançar 1s
        if (event.key === 'F3') {
            event.preventDefault();
            if (window.mediaController.isMediaLoaded()) {
                window.mediaController.skipForward();
            }
            return;
        }

        // ESC - Apenas para modo normal do Vim (já tratado pelo CodeMirror)
        // Não interferir com o ESC do Vim
    }
}

// Inicializar atalhos de teclado
window.keyboardShortcuts = new KeyboardShortcuts();
