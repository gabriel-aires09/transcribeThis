// media-controls.js - Gerenciamento de controles de áudio/vídeo

class MediaController {
    constructor() {
        this.audioPlayer = document.getElementById('audioPlayer');
        this.videoPlayer = document.getElementById('videoPlayer');
        this.videoSection = document.getElementById('videoSection');
        this.youtubePlayerDiv = document.getElementById('youtubePlayer');
        this.closeVideoBtn = document.getElementById('closeVideoBtn');
        this.audioFileInput = document.getElementById('audioFile');
        this.youtubeUrlInput = document.getElementById('youtubeModalInput');
        this.loadYoutubeBtn = document.getElementById('confirmYoutubeBtn');
        this.fileName = document.getElementById('fileNameHeader');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.backBtn = document.getElementById('backBtn');
        this.forwardBtn = document.getElementById('forwardBtn');
        this.progressBar = document.getElementById('progressBar');
        this.timeDisplay = document.getElementById('timeDisplay');
        this.playIcon = document.getElementById('playIcon');
        this.pauseIcon = document.getElementById('pauseIcon');
        
        this.skipAmount = 1; // segundos
        this.currentPlayer = null; // 'audio', 'video', ou 'youtube'
        this.youtubePlayer = null;
        this.updateInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadYouTubeAPI();
    }

    setupEventListeners() {
        // Carregar arquivo local
        this.audioFileInput.addEventListener('change', (e) => this.loadFile(e));
        
        // Fechar vídeo
        this.closeVideoBtn.addEventListener('click', () => this.closeVideo());
        
        // Botões de controle
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.backBtn.addEventListener('click', () => this.skipBackward());
        this.forwardBtn.addEventListener('click', () => this.skipForward());
        
        // Barra de progresso
        this.progressBar.addEventListener('input', (e) => this.seekTo(e));
        
        // Eventos do player de áudio
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('loadedmetadata', () => this.onMediaLoaded());
        this.audioPlayer.addEventListener('ended', () => this.onMediaEnded());
        
        // Eventos do player de vídeo
        this.videoPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.videoPlayer.addEventListener('loadedmetadata', () => this.onMediaLoaded());
        this.videoPlayer.addEventListener('ended', () => this.onMediaEnded());
    }

    loadYouTubeAPI() {
        // A API do YouTube será carregada automaticamente via script tag
        window.onYouTubeIframeAPIReady = () => {
            console.log('YouTube API carregada');
        };
    }

    extractYouTubeId(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }

    loadYouTube() {
        const url = this.youtubeUrlInput.value.trim();
        if (!url) return;
        
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            alert('URL do YouTube inválida!');
            return;
        }
        
        this.loadYouTubeVideo(videoId, url);
    }

    loadYouTubeFromURL(url) {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            alert('URL do YouTube inválida!');
            return;
        }
        
        this.loadYouTubeVideo(videoId, url);
    }

    loadYouTubeVideo(videoId, url) {
        // Limpar players anteriores
        this.stopAllPlayers();
        
        // Mostrar seção de vídeo
        this.videoSection.style.display = 'block';
        this.youtubePlayerDiv.style.display = 'block';
        this.videoPlayer.style.display = 'none';
        
        // Criar player do YouTube
        this.youtubePlayer = new YT.Player('youtubePlayer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'controls': 1,
                'rel': 0
            },
            events: {
                'onReady': (event) => this.onYouTubeReady(event),
                'onStateChange': (event) => this.onYouTubeStateChange(event)
            }
        });
        
        this.currentPlayer = 'youtube';
        this.fileName.textContent = 'Vídeo do YouTube';
        this.enableControls();
    }

    onYouTubeReady(event) {
        console.log('YouTube player pronto');
        // Iniciar atualização de progresso
        this.startProgressUpdate();
    }

    onYouTubeStateChange(event) {
        // YT.PlayerState.PLAYING = 1
        // YT.PlayerState.PAUSED = 2
        // YT.PlayerState.ENDED = 0
        if (event.data === 1) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        } else if (event.data === 2 || event.data === 0) {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
        }
    }

    startProgressUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            if (this.currentPlayer === 'youtube' && this.youtubePlayer) {
                this.updateYouTubeProgress();
            }
        }, 100);
    }

    updateYouTubeProgress() {
        if (!this.youtubePlayer || !this.youtubePlayer.getCurrentTime) return;
        
        const currentTime = this.youtubePlayer.getCurrentTime();
        const duration = this.youtubePlayer.getDuration();
        
        if (duration) {
            const progress = (currentTime / duration) * 100;
            this.progressBar.value = progress;
            
            const currentTimeStr = this.formatTime(currentTime);
            const durationStr = this.formatTime(duration);
            this.timeDisplay.textContent = `${currentTimeStr} / ${durationStr}`;
        }
    }

    loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Limpar players anteriores
        this.stopAllPlayers();
        
        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video/');
        
        if (isVideo) {
            this.videoPlayer.src = url;
            this.currentPlayer = 'video';
            this.videoSection.style.display = 'block';
            this.videoPlayer.style.display = 'block';
            this.youtubePlayerDiv.style.display = 'none';
        } else {
            this.audioPlayer.src = url;
            this.currentPlayer = 'audio';
            this.videoSection.style.display = 'none';
        }
        
        this.fileName.textContent = file.name;
        this.enableControls();
    }

    stopAllPlayers() {
        // Pausar áudio
        this.audioPlayer.pause();
        this.audioPlayer.src = '';
        
        // Pausar vídeo
        this.videoPlayer.pause();
        this.videoPlayer.src = '';
        
        // Pausar YouTube
        if (this.youtubePlayer && this.youtubePlayer.pauseVideo) {
            this.youtubePlayer.pauseVideo();
            this.youtubePlayer.destroy();
            this.youtubePlayer = null;
        }
        
        // Limpar intervalo
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    closeVideo() {
        this.videoSection.style.display = 'none';
        if (this.currentPlayer === 'video') {
            this.videoPlayer.pause();
            this.videoPlayer.src = '';
            this.currentPlayer = null;
        } else if (this.currentPlayer === 'youtube') {
            if (this.youtubePlayer) {
                this.youtubePlayer.destroy();
                this.youtubePlayer = null;
            }
            this.currentPlayer = null;
        }
    }

    getActivePlayer() {
        if (this.currentPlayer === 'youtube') return this.youtubePlayer;
        if (this.currentPlayer === 'video') return this.videoPlayer;
        if (this.currentPlayer === 'audio') return this.audioPlayer;
        return null;
    }

    enableControls() {
        this.playPauseBtn.disabled = false;
        this.backBtn.disabled = false;
        this.forwardBtn.disabled = false;
        this.progressBar.disabled = false;
    }

    togglePlayPause() {
        if (this.currentPlayer === 'youtube') {
            const state = this.youtubePlayer.getPlayerState();
            if (state === 1) { // playing
                this.youtubePlayer.pauseVideo();
            } else {
                this.youtubePlayer.playVideo();
            }
        } else {
            const player = this.getActivePlayer();
            if (player) {
                if (player.paused) {
                    this.play();
                } else {
                    this.pause();
                }
            }
        }
    }

    play() {
        const player = this.getActivePlayer();
        if (player && player.play) {
            player.play();
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        }
    }

    pause() {
        const player = this.getActivePlayer();
        if (player && player.pause) {
            player.pause();
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
        }
    }

    skipBackward() {
        if (this.currentPlayer === 'youtube') {
            const currentTime = this.youtubePlayer.getCurrentTime();
            this.youtubePlayer.seekTo(Math.max(0, currentTime - this.skipAmount), true);
        } else {
            const player = this.getActivePlayer();
            if (player) {
                player.currentTime = Math.max(0, player.currentTime - this.skipAmount);
            }
        }
    }

    skipForward() {
        if (this.currentPlayer === 'youtube') {
            const currentTime = this.youtubePlayer.getCurrentTime();
            const duration = this.youtubePlayer.getDuration();
            this.youtubePlayer.seekTo(Math.min(duration, currentTime + this.skipAmount), true);
        } else {
            const player = this.getActivePlayer();
            if (player) {
                const duration = player.duration || 0;
                player.currentTime = Math.min(duration, player.currentTime + this.skipAmount);
            }
        }
    }

    seekTo(event) {
        if (this.currentPlayer === 'youtube') {
            const duration = this.youtubePlayer.getDuration();
            const time = (event.target.value / 100) * duration;
            this.youtubePlayer.seekTo(time, true);
        } else {
            const player = this.getActivePlayer();
            if (player && player.duration) {
                const time = (event.target.value / 100) * player.duration;
                player.currentTime = time;
            }
        }
    }

    updateProgress() {
        const player = this.getActivePlayer();
        if (!player || !player.duration) return;
        
        const progress = (player.currentTime / player.duration) * 100;
        this.progressBar.value = progress;
        
        const currentTime = this.formatTime(player.currentTime);
        const duration = this.formatTime(player.duration);
        this.timeDisplay.textContent = `${currentTime} / ${duration}`;
    }

    onMediaLoaded() {
        this.updateProgress();
        if (this.currentPlayer === 'youtube') {
            this.startProgressUpdate();
        }
    }

    onMediaEnded() {
        const player = this.getActivePlayer();
        if (player) {
            player.currentTime = 0;
            this.pause();
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    isPlaying() {
        if (this.currentPlayer === 'youtube') {
            return this.youtubePlayer && this.youtubePlayer.getPlayerState() === 1;
        }
        const player = this.getActivePlayer();
        return player && !player.paused;
    }

    isMediaLoaded() {
        return !this.playPauseBtn.disabled;
    }
}

// Inicializar controlador de mídia
window.mediaController = new MediaController();
