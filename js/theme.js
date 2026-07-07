// theme.js - Gerenciamento de tema claro/escuro

class ThemeManager {
    constructor() {
        this.themeToggleBtn = document.getElementById('themeToggle');
        this.sunIcon = document.getElementById('sunIcon');
        this.moonIcon = document.getElementById('moonIcon');
        this.currentTheme = this.loadTheme();
        
        this.init();
    }

    init() {
        // Aplicar tema salvo
        this.applyTheme(this.currentTheme);
        
        // Event listener para o botão
        this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    loadTheme() {
        // Carregar tema do localStorage ou usar tema claro como padrão
        return localStorage.getItem('theme') || 'light';
    }

    saveTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    applyTheme(theme) {
        const body = document.body;
        
        if (theme === 'dark') {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            this.sunIcon.style.display = 'none';
            this.moonIcon.style.display = 'block';
        } else {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            this.sunIcon.style.display = 'block';
            this.moonIcon.style.display = 'none';
        }
        
        this.currentTheme = theme;
        
        // Atualizar tema do CodeMirror se já estiver inicializado
        if (window.editorManager && window.editorManager.editor) {
            window.editorManager.updateTheme(theme);
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        this.saveTheme(newTheme);
    }

    getTheme() {
        return this.currentTheme;
    }
}

// Inicializar gerenciador de tema
window.themeManager = new ThemeManager();
