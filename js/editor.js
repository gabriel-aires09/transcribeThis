// editor.js - Gerenciamento do editor CodeMirror com Vim bindings

class EditorManager {
    constructor() {
        this.editor = null;
        this.autoSaveInterval = null;
        this.init();
    }

    init() {
        // Inicializar CodeMirror com vim bindings
        const textarea = document.getElementById('transcriptionEditor');
        
        this.editor = CodeMirror.fromTextArea(textarea, {
            mode: 'text/plain',
            keyMap: 'vim',
            lineNumbers: true,
            lineWrapping: true,
            theme: 'default',
            autofocus: true,
            extraKeys: {
                // ESC apenas para modo normal do Vim
                'Esc': 'vim-escape'
            }
        });

        // Aplicar tema inicial
        this.updateTheme(window.themeManager.getTheme());

        // Carregar conteúdo salvo
        this.loadContent();

        // Configurar auto-save
        this.setupAutoSave();
    }

    updateTheme(theme) {
        if (theme === 'dark') {
            this.editor.setOption('theme', 'dracula');
        } else {
            this.editor.setOption('theme', 'default');
        }
    }

    loadContent() {
        const savedText = localStorage.getItem('transcription');
        if (savedText) {
            this.editor.setValue(savedText);
        }
    }

    saveContent() {
        const content = this.editor.getValue();
        localStorage.setItem('transcription', content);
    }

    setupAutoSave() {
        // Salvar a cada mudança (com debounce implícito do CodeMirror)
        this.editor.on('change', () => {
            this.saveContent();
        });
    }

    isInInsertMode() {
        // Verificar se está no modo insert do Vim
        return this.editor.state.vim && this.editor.state.vim.insertMode;
    }

    getValue() {
        return this.editor.getValue();
    }

    setValue(content) {
        this.editor.setValue(content);
    }

    focus() {
        this.editor.focus();
    }
}

// Inicializar editor quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.editorManager = new EditorManager();
    });
} else {
    window.editorManager = new EditorManager();
}
