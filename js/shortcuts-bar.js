// js/shortcuts-toggle.js - Controle de exibição da barra de atalhos

class ShortcutsToggle {
    constructor() {
        this.shortcutsInfo = document.getElementById('shortcutsBar');
        this.closeBtn = document.getElementById('closeShortcutsBtn');
        this.toggleBtn = document.getElementById('toggleShortcutsBtn');
        
        this.init();
    }

    init() {
        // Carregar preferência salva
        this.loadPreference();
        
        // Event listeners
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hideShortcuts());
        }
        
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.showShortcuts());
        }
    }

    hideShortcuts() {
        if (!this.shortcutsInfo || !this.toggleBtn) return;
        
        // Adicionar classe de animação
        this.shortcutsInfo.classList.add('shortcuts-hiding');
        
        // Aguardar animação terminar
        setTimeout(() => {
            this.shortcutsInfo.style.display = 'none';
            this.toggleBtn.style.display = 'flex';
            this.toggleBtn.classList.add('help-btn-showing');
            this.savePreference(false);
        }, 300); // Duração da animação
    }

    showShortcuts() {
        if (!this.shortcutsInfo || !this.toggleBtn) return;
        
        this.toggleBtn.style.display = 'none';
        this.toggleBtn.classList.remove('help-btn-showing');
        this.shortcutsInfo.style.display = 'flex';
        this.shortcutsInfo.classList.remove('shortcuts-hiding');
        this.shortcutsInfo.classList.add('shortcuts-showing');
        
        // Remover classe de animação após completar
        setTimeout(() => {
            this.shortcutsInfo.classList.remove('shortcuts-showing');
        }, 300);
        
        this.savePreference(true);
    }

    savePreference(isVisible) {
        localStorage.setItem('shortcuts_visible', isVisible ? 'true' : 'false');
    }

    loadPreference() {
        const isVisible = localStorage.getItem('shortcuts_visible');
        
        // Se nunca foi definido, mostrar por padrão
        if (isVisible === null) {
            return;
        }
        
        // Aplicar preferência salva
        if (isVisible === 'false') {
            // Ocultar sem animação
            if (this.shortcutsInfo && this.toggleBtn) {
                this.shortcutsInfo.style.display = 'none';
                this.toggleBtn.style.display = 'flex';
            }
        }
    }
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.shortcutsToggle = new ShortcutsToggle();
    });
} else {
    window.shortcutsToggle = new ShortcutsToggle();
}