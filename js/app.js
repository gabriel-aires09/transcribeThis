// app.js - Inicialização e coordenação da aplicação

class App {
    constructor() {
        this.init();
    }

    init() {
        console.log('🎙️ Transcritor de Áudio inicializado');
        console.log('Módulos carregados:');
        console.log('  ✓ Theme Manager');
        console.log('  ✓ Editor Manager');
        console.log('  ✓ Media Controller');
        console.log('  ✓ Keyboard Shortcuts');
        
        this.setupWelcomeMessage();
    }

    setupWelcomeMessage() {
        // Verificar se é a primeira visita
        const hasVisited = localStorage.getItem('hasVisited');
        
        if (!hasVisited) {
            localStorage.setItem('hasVisited', 'true');
            
            // Mensagem de boas-vindas no editor
            if (window.editorManager) {
                const welcomeMessage = `# Bem-vindo ao Transcritor de Áudio!

Instruções:
1. Selecione um arquivo de áudio ou vídeo usando o botão acima
2. Use os controles de reprodução ou os atalhos de teclado
3. Digite suas transcrições neste editor

Atalhos de teclado:
- F1: Play/Pause
- F2: Voltar 1 segundo
- F3: Avançar 1 segundo

Editor Vim:
- Pressione 'i' para entrar no modo Insert
- Pressione ESC para voltar ao modo Normal
- Use comandos Vim como hjkl, dd, yy, p, etc.

Suas transcrições são salvas automaticamente!

---

`;
                window.editorManager.setValue(welcomeMessage);
            }
        }
    }

    exportTranscription() {
        if (!window.editorManager) return;
        
        const content = window.editorManager.getValue();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcricao_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearTranscription() {
        if (!window.editorManager) return;
        
        if (confirm('Tem certeza que deseja limpar toda a transcrição?')) {
            window.editorManager.setValue('');
        }
    }

    getStats() {
        if (!window.editorManager) return null;
        
        const content = window.editorManager.getValue();
        const words = content.trim().split(/\s+/).filter(w => w.length > 0).length;
        const characters = content.length;
        const lines = content.split('\n').length;
        
        return {
            words,
            characters,
            lines
        };
    }
}

// Inicializar aplicação quando tudo estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}

// Exportar funções úteis para o console
window.exportTranscription = () => window.app.exportTranscription();
window.clearTranscription = () => window.app.clearTranscription();
window.getStats = () => {
    const stats = window.app.getStats();
    if (stats) {
        console.log('📊 Estatísticas da Transcrição:');
        console.log(`   Palavras: ${stats.words}`);
        console.log(`   Caracteres: ${stats.characters}`);
        console.log(`   Linhas: ${stats.lines}`);
    }
    return stats;
};
