// js/transcription-ai.js - Transcrição automática com IA

class TranscriptionAI {
    constructor() {
        this.apiKey = null;
        this.isTranscribing = false;
        this.currentAudioFile = null;
        
        // Botões
        this.transcribeBtn = null;
        this.settingsBtn = null;
        this.apiKeyInput = null;
        
        this.init();
    }

    init() {
        this.loadApiKey();
        this.createTranscriptionUI();
        this.setupFileWatcher();
    }

    setupFileWatcher() {
        // Monitorar quando um arquivo é carregado
        const audioFileInput = document.getElementById('audioFile');
        if (audioFileInput) {
            audioFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.currentAudioFile = e.target.files[0];
                    console.log('Arquivo carregado para transcrição:', this.currentAudioFile.name);
                }
            });
        }
    }

    createTranscriptionUI() {
        // Adicionar botão de transcrição no header
        const headerControls = document.querySelector('.header-controls');
        if (!headerControls) {
            console.error('Header controls não encontrado');
            return;
        }

        // Botão de configurar API
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'control-btn-compact';
        settingsBtn.id = 'aiSettingsBtn';
        settingsBtn.title = 'Configurar IA (Whisper)';
        settingsBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 01-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 01.872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 012.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 012.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 01.872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 01-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 01-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 100-5.86 2.929 2.929 0 000 5.858z"/>
            </svg>
        `;
        
        // Botão de transcrever
        const transcribeBtn = document.createElement('button');
        transcribeBtn.className = 'control-btn-compact ai-btn';
        transcribeBtn.id = 'transcribeBtn';
        transcribeBtn.title = 'Transcrever com IA (Whisper)';
        transcribeBtn.disabled = true;
        transcribeBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.5 6.5A.5.5 0 014 7v1a4 4 0 008 0V7a.5.5 0 011 0v1a5 5 0 01-4.5 4.975V14h3a.5.5 0 010 1h-7a.5.5 0 010-1h3v-1.025A5 5 0 013 8V7a.5.5 0 01.5-.5z"/>
                <path d="M10 8a2 2 0 11-4 0V3a2 2 0 114 0v5zM8 0a3 3 0 00-3 3v5a3 3 0 006 0V3a3 3 0 00-3-3z"/>
            </svg>
        `;

        this.transcribeBtn = transcribeBtn;
        this.settingsBtn = settingsBtn;

        // Inserir antes do botão de tema
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn && themeBtn.parentNode) {
            themeBtn.parentNode.insertBefore(settingsBtn, themeBtn);
            themeBtn.parentNode.insertBefore(transcribeBtn, themeBtn);
        }

        // Event listeners
        settingsBtn.addEventListener('click', () => this.showSettingsModal());
        transcribeBtn.addEventListener('click', () => this.transcribeAudio());
    }

    showSettingsModal() {
        const modal = document.createElement('div');
        modal.className = 'ai-settings-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="ai-modal-overlay"></div>
            <div class="ai-modal-content">
                <button class="ai-modal-close" id="closeAiSettings">✕</button>
                <h2 class="ai-modal-title">🤖 Configurar API de Transcrição</h2>
                
                <div class="ai-settings-content">
                    <label for="apiKeyInput">OpenAI API Key:</label>
                    <input type="password" 
                           class="ai-modal-input" 
                           id="apiKeyInput" 
                           placeholder="sk-..."
                           value="${this.apiKey || ''}">
                    
                    <p class="ai-settings-info">
                       Obtenha sua chave em: <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>
                    </p>
                    
                </div>
                
                <div class="ai-modal-buttons">
                    <button class="ai-modal-btn cancel" id="cancelAiSettings">Cancelar</button>
                    <button class="ai-modal-btn confirm" id="saveAiSettings">Salvar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('#closeAiSettings');
        const cancelBtn = modal.querySelector('#cancelAiSettings');
        const saveBtn = modal.querySelector('#saveAiSettings');
        const overlay = modal.querySelector('.ai-modal-overlay');
        const input = modal.querySelector('#apiKeyInput');

        const closeModal = () => modal.remove();

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
        
        saveBtn.addEventListener('click', () => {
            const key = input.value.trim();
            if (key) {
                this.saveApiKey(key);
                this.transcribeBtn.disabled = false;
                alert('✅ API Key salva com sucesso!\n\nAgora você pode transcrever áudios clicando no botão do microfone 🎤');
            } else {
                alert('❌ Por favor, insira uma API Key válida');
            }
            closeModal();
        });

        // Focar no input
        setTimeout(() => input.focus(), 100);
    }

    async saveApiKey(key) {
        this.apiKey = key;
        await window.secureStorage.set(key);
        console.log('API Key salva com sucesso');
    }

    async loadApiKey() {
        this.apiKey = await window.secureStorage.get();
        if (this.apiKey && this.transcribeBtn) {
            this.transcribeBtn.disabled = false;
            console.log('API Key carregada');
        }
    }

    async transcribeAudio() {
        if (!this.apiKey) {
            alert('❌ Configure sua API Key primeiro!');
            this.showSettingsModal();
            return;
        }

        // Obter arquivo de áudio atual
        const audioFile = this.getCurrentAudioFile();
        if (!audioFile) {
            alert('❌ Nenhum arquivo de áudio/vídeo carregado!\n\nPor favor, selecione um arquivo primeiro.');
            return;
        }

        // Confirmar antes de transcrever
        const fileSize = (audioFile.size / 1024 / 1024).toFixed(2);
        const estimatedCost = (audioFile.size / 1024 / 1024 / 10 * 0.006).toFixed(4); // Estimativa grosseira
        
        const confirmMsg = `Transcrever este arquivo?\n\n` +
            `Arquivo: ${audioFile.name}\n` +
            `Tamanho: ${fileSize} MB\n` +
            `Custo estimado: ~$${estimatedCost}\n\n` +
            `A transcrição pode levar alguns minutos.`;
        
        if (!confirm(confirmMsg)) {
            return;
        }

        console.log('Iniciando transcrição do arquivo:', audioFile.name);

        this.isTranscribing = true;
        this.updateTranscribeButton(true);

        try {
            const transcription = await this.sendToWhisper(audioFile);
            this.insertTranscription(transcription);
            alert('✅ Transcrição concluída com sucesso!\n\nO texto foi inserido no editor.');
        } catch (error) {
            console.error('Erro na transcrição:', error);
            let errorMsg = '❌ Erro na transcrição:\n\n';
            
            if (error.message.includes('API key') || error.message.includes('Incorrect API key')) {
                errorMsg += 'API Key inválida ou expirada.\nVerifique sua chave em platform.openai.com';
            } else if (error.message.includes('rate limit')) {
                errorMsg += 'Limite de requisições atingido.\nAguarde alguns minutos e tente novamente.';
            } else if (error.message.includes('file size')) {
                errorMsg += 'Arquivo muito grande (máximo 25MB).\nTente comprimir o áudio primeiro.';
            } else if (error.message.includes('Formato não suportado')) {
                errorMsg += error.message;
            } else if (error.message.includes('insufficient_quota')) {
                errorMsg += 'Créditos insuficientes na sua conta OpenAI.\nAdicione créditos em platform.openai.com/account/billing';
            } else {
                errorMsg += error.message;
            }
            
            alert(errorMsg);
        } finally {
            this.isTranscribing = false;
            this.updateTranscribeButton(false);
        }
    }

    async sendToWhisper(audioFile) {
        // Verificar tamanho do arquivo (máximo 25MB para Whisper)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (audioFile.size > maxSize) {
            throw new Error('file size: Arquivo muito grande. Máximo: 25MB');
        }

        // Verificar formato do arquivo
        const supportedFormats = [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4',
            'audio/webm', 'audio/ogg', 'video/mp4', 'video/mpeg', 'video/webm'
        ];
        
        const fileExtension = audioFile.name.split('.').pop().toLowerCase();
        const supportedExtensions = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];
        
        if (!supportedExtensions.includes(fileExtension)) {
            throw new Error(`Formato não suportado: .${fileExtension}\n\nFormatos aceitos: mp3, mp4, wav, m4a, webm, ogg`);
        }

        console.log('Enviando arquivo para Whisper API...');
        console.log('Nome:', audioFile.name);
        console.log('Tipo:', audioFile.type);
        console.log('Tamanho:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');

        const formData = new FormData();
        
        // Criar um novo File com nome e tipo corretos
        const fileBlob = new File([audioFile], audioFile.name, {
            type: audioFile.type || 'audio/mpeg'
        });
        
        formData.append('file', fileBlob);
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt'); // Português
        formData.append('response_format', 'json'); // Formato de resposta

        try {
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const error = await response.json();
                    console.error('Erro da API:', error);
                    errorMessage = error.error?.message || errorMessage;
                } catch (e) {
                    // Se não conseguir parsear JSON, usar texto
                    const errorText = await response.text();
                    console.error('Erro da API (text):', errorText);
                    if (errorText) errorMessage = errorText;
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Transcrição recebida com sucesso');
            console.log('Texto:', result.text.substring(0, 100) + '...');
            return result.text;
            
        } catch (error) {
            console.error('Erro ao enviar para Whisper:', error);
            throw error;
        }
    }

    getCurrentAudioFile() {
        // Primeiro tentar pegar do cache
        if (this.currentAudioFile) {
            return this.currentAudioFile;
        }

        // Tentar pegar do input
        const fileInput = document.getElementById('audioFile');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            this.currentAudioFile = fileInput.files[0];
            return this.currentAudioFile;
        }

        // Se for YouTube, mostrar mensagem específica
        if (window.mediaController && window.mediaController.currentPlayer === 'youtube') {
            alert('❌ Não é possível transcrever vídeos do YouTube diretamente.\n\nBaixe o áudio primeiro ou use um arquivo local.');
            return null;
        }

        return null;
    }

    insertTranscription(text) {
        if (!window.editorManager) {
            console.error('Editor não encontrado');
            return;
        }
        
        // Inserir no editor
        const currentText = window.editorManager.getValue();
        const timestamp = new Date().toLocaleString('pt-BR');
        const separator = currentText ? '\n\n---\n\n' : '';
        const header = `[Transcrição - ${timestamp}]\n\n`;
        const newText = currentText + separator + header + text;
        
        window.editorManager.setValue(newText);
        
        console.log('Transcrição inserida no editor');
    }

    updateTranscribeButton(isLoading) {
        if (!this.transcribeBtn) return;

        if (isLoading) {
            this.transcribeBtn.disabled = true;
            this.transcribeBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" class="spinning">
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
                    <path d="M8 2a6 6 0 00-6 6h2a4 4 0 014-4V2z"/>
                </svg>
            `;
        } else {
            this.transcribeBtn.disabled = !this.apiKey;
            this.transcribeBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.5 6.5A.5.5 0 014 7v1a4 4 0 008 0V7a.5.5 0 011 0v1a5 5 0 01-4.5 4.975V14h3a.5.5 0 010 1h-7a.5.5 0 010-1h3v-1.025A5 5 0 013 8V7a.5.5 0 01.5-.5z"/>
                    <path d="M10 8a2 2 0 11-4 0V3a2 2 0 114 0v5zM8 0a3 3 0 00-3 3v5a3 3 0 006 0V3a3 3 0 00-3-3z"/>
                </svg>
            `;
        }
    }
}

// Estilo CSS para os botões e animações
const style = document.createElement('style');
style.textContent = `
    .ai-btn {
        background-color: #10a37f !important;
    }
    
    .ai-btn:hover:not(:disabled) {
        background-color: #0d8c6c !important;
    }
    
    .spinning {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .ai-settings-content {
        margin: 20px 0;
        text-align: left;
    }
    
    .ai-settings-content label {
        display: block;
        color: #ffffff;
        font-size: 0.9rem;
        margin-bottom: 8px;
        font-weight: 500;
    }
    
    .ai-settings-info {
        color: #cccccc;
        font-size: 0.85rem;
        margin: 15px 0;
        line-height: 1.8;
    }
    
    .ai-settings-info a {
        color: #0f62fe;
        text-decoration: none;
    }
    
    .ai-settings-info a:hover {
        text-decoration: underline;
    }
`;
document.head.appendChild(style);

// Estilos para o modal da API (centralizado)
const aiModalStyle = document.createElement('style');
aiModalStyle.textContent = `
    /* Modal de configuração da API */
    .ai-settings-modal {
        position: fixed;
        top: 56px;                    /* ← Começa abaixo do header */
        left: 0;
        width: 100%;
        height: calc(100vh - 56px);   /* ← Altura menos o header */
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .ai-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
    }
    
    .ai-modal-content {
        position: relative;
        background-color: #2C2C2C;
        border-radius: 12px;
        padding: 30px 40px;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 1;
        animation: modalSlideIn 0.3s ease-out;
    }
    
    @keyframes modalSlideIn {
        from {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }
    
    .ai-modal-close {
        position: absolute;
        top: 15px;
        right: 15px;
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 24px;
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .ai-modal-close:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }
    
    .ai-modal-title {
        color: #ffffff;
        font-size: 1.5rem;
        font-weight: 500;
        margin: 0 0 25px 0;
        text-align: center;
    }
    
    .ai-modal-input {
        width: 100%;
        padding: 15px;
        font-size: 1rem;
        border: 2px solid #4A4A4A;
        border-radius: 6px;
        background-color: #1C1C1C;
        color: #ffffff;
        outline: none;
        transition: border-color 0.2s;
        margin-bottom: 20px;
        font-family: 'IBM Plex Mono', monospace;
    }
    
    .ai-modal-input:focus {
        border-color: #0f62fe;
    }
    
    .ai-modal-input::placeholder {
        color: #888;
    }
    
    .ai-modal-buttons {
        display: flex;
        gap: 15px;
        justify-content: flex-end;
        margin-top: 25px;
    }
    
    .ai-modal-btn {
        padding: 12px 30px;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .ai-modal-btn.cancel {
        background-color: #4A4A4A;
        color: white;
    }
    
    .ai-modal-btn.cancel:hover {
        background-color: #5A5A5A;
    }
    
    .ai-modal-btn.confirm {
        background-color: #0f62fe;
        color: white;
    }
    
    .ai-modal-btn.confirm:hover {
        background-color: #0353e9;
    }
`;
document.head.appendChild(aiModalStyle);

// Inicializar quando a aplicação principal estiver carregada
function initTranscriptionAI() {
    // Aguardar a aplicação principal carregar
    const checkInterval = setInterval(() => {
        const mainApp = document.getElementById('mainApp');
        if (mainApp && mainApp.style.display !== 'none') {
            clearInterval(checkInterval);
            console.log('Inicializando Transcrição com IA...');
            window.transcriptionAI = new TranscriptionAI();
        }
    }, 500);
    
    // Timeout de segurança (30 segundos)
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.transcriptionAI) {
            console.warn('Timeout ao inicializar Transcrição com IA');
        }
    }, 30000);
}

// Inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTranscriptionAI);
} else {
    initTranscriptionAI();
}
