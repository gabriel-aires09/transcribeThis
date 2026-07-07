// screens.js - Gerenciamento de fluxo de telas

class ScreenManager {
    constructor() {
        this.loadingScreen = document.getElementById('loadingScreen');
        this.mediaSelectionScreen = document.getElementById('mediaSelectionScreen');
        this.mainApp = document.getElementById('mainApp');
        this.youtubeModal = document.getElementById('youtubeModal');
        
        // Botões
        this.selectFileBtn = document.getElementById('selectFileBtn');
        this.selectYoutubeBtn = document.getElementById('selectYoutubeBtn');
        this.changeMediaBtn = document.getElementById('changeMediaBtn');
        this.audioFileInput = document.getElementById('audioFile');
        
        // Modal YouTube
        this.youtubeModalInput = document.getElementById('youtubeModalInput');
        this.confirmYoutubeBtn = document.getElementById('confirmYoutubeBtn');
        this.cancelYoutubeBtn = document.getElementById('cancelYoutubeBtn');
        this.closeYoutubeModal = document.getElementById('closeYoutubeModal');
        this.youtubeModalOverlay = document.getElementById('youtubeModalOverlay');
        
        // Info
        this.fileNameHeader = document.getElementById('fileNameHeader');
        this.lastFileInfo = document.getElementById('lastFileInfo');
        
        this.init();
    }

    init() {
        // Simular carregamento
        setTimeout(() => {
            this.showMediaSelection();
        }, 2000);
        
        this.setupEventListeners();
        this.loadLastFileInfo();
    }

    setupEventListeners() {
        // Botão selecionar arquivo
        this.selectFileBtn.addEventListener('click', () => {
            this.audioFileInput.click();
        });
        
        // Quando arquivo é selecionado
        this.audioFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                this.saveLastFileInfo(file.name, 'local');
                this.showMainApp(file.name);
            }
        });
        
        // Botão YouTube
        this.selectYoutubeBtn.addEventListener('click', () => {
            this.showYoutubeModal();
        });
        
        // Botão trocar mídia
        this.changeMediaBtn.addEventListener('click', () => {
            this.returnToSelection();
        });
        
        // Modal YouTube - Confirmar
        this.confirmYoutubeBtn.addEventListener('click', () => {
            this.handleYoutubeConfirm();
        });
        
        // Modal YouTube - Cancelar
        this.cancelYoutubeBtn.addEventListener('click', () => {
            this.hideYoutubeModal();
        });
        
        // Modal YouTube - Fechar X
        this.closeYoutubeModal.addEventListener('click', () => {
            this.hideYoutubeModal();
        });
        
        // Modal YouTube - Click no overlay
        this.youtubeModalOverlay.addEventListener('click', () => {
            this.hideYoutubeModal();
        });
        
        // Modal YouTube - Enter no input
        this.youtubeModalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleYoutubeConfirm();
            }
        });
    }

    showMediaSelection() {
        this.loadingScreen.style.display = 'none';
        this.mediaSelectionScreen.style.display = 'flex';
        this.mainApp.style.display = 'none';
    }

    showMainApp(fileName = 'Nenhum arquivo') {
        this.loadingScreen.style.display = 'none';
        this.mediaSelectionScreen.style.display = 'none';
        this.mainApp.style.display = 'block';
        this.fileNameHeader.textContent = fileName;
    }

    returnToSelection() {
        // Pausar e limpar mídia
        if (window.mediaController) {
            window.mediaController.stopAllPlayers();
        }
        
        this.showMediaSelection();
    }

    showYoutubeModal() {
        this.youtubeModal.style.display = 'flex';
        this.youtubeModalInput.value = '';
        // Focar no input após um pequeno delay para garantir que o modal está visível
        setTimeout(() => {
            this.youtubeModalInput.focus();
        }, 100);
    }

    hideYoutubeModal() {
        this.youtubeModal.style.display = 'none';
        this.youtubeModalInput.value = '';
    }

    handleYoutubeConfirm() {
        const url = this.youtubeModalInput.value.trim();
        
        if (!url) {
            alert('Por favor, cole uma URL do YouTube');
            return;
        }
        
        // Validar URL básica
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            alert('URL inválida. Por favor, cole uma URL do YouTube válida.');
            return;
        }
        
        this.hideYoutubeModal();
        this.saveLastFileInfo(url, 'youtube');
        this.showMainApp('Vídeo do YouTube');
        
        // Disparar evento para o media controller carregar o vídeo
        setTimeout(() => {
            if (window.mediaController) {
                window.mediaController.loadYouTubeFromURL(url);
            }
        }, 500);
    }

    saveLastFileInfo(name, type) {
        const info = {
            name: name,
            type: type,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('lastFile', JSON.stringify(info));
    }

    loadLastFileInfo() {
        const saved = localStorage.getItem('lastFile');
        if (saved) {
            try {
                const info = JSON.parse(saved);
                const date = new Date(info.timestamp);
                const dateStr = date.toLocaleDateString('pt-BR');
                
                if (info.type === 'local') {
                    this.lastFileInfo.textContent = `Último ficheiro: ${info.name} (${dateStr})`;
                } else if (info.type === 'youtube') {
                    this.lastFileInfo.textContent = `Último vídeo: YouTube (${dateStr})`;
                }
            } catch (e) {
                console.error('Erro ao carregar última info:', e);
            }
        }
    }
}

// Inicializar gerenciador de telas
window.screenManager = new ScreenManager();
