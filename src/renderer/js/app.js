// Main application JavaScript
const { ipcRenderer } = require('electron');

// Application state
const AppState = {
    connections: {
        discord: { status: 'disconnected', details: 'Not connected to Discord' },
        roon: { status: 'disconnected', details: 'Not connected to Roon' },
        spotify: { status: 'disconnected', details: 'Not connected to Spotify API' },
        imgur: { status: 'disconnected', details: 'Not connected to Imgur API' }
    },
    currentTrack: {
        title: '-',
        artist: '-',
        album: '-',
        albumArt: null,
        progress: 0,
        duration: 0
    },
    config: {}
};

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function updateConnectionStatus(service, status, details) {
    AppState.connections[service] = { status, details };
    
    const statusElement = document.getElementById(`${service}-status`);
    const detailsElement = document.getElementById(`${service}-details`);
    
    if (statusElement && detailsElement) {
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('.status-text');
        
        // Update status indicator
        dot.className = `status-dot ${status}`;
        text.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        
        // Update details
        detailsElement.textContent = details;
    }
}

function updateCurrentTrack(trackInfo) {
    AppState.currentTrack = { ...AppState.currentTrack, ...trackInfo };
    
    const elements = {
        title: document.getElementById('track-title'),
        artist: document.getElementById('track-artist'),
        album: document.getElementById('track-album'),
        albumImage: document.getElementById('album-image'),
        noMusic: document.getElementById('no-music'),
        progressFill: document.getElementById('progress-fill'),
        currentTime: document.getElementById('current-time'),
        totalTime: document.getElementById('total-time')
    };
    
    if (trackInfo.title && trackInfo.title !== '-') {
        // Show track info
        elements.title.textContent = trackInfo.title;
        elements.artist.textContent = trackInfo.artist || '-';
        elements.album.textContent = trackInfo.album || '-';
        
        // Handle album art
        if (trackInfo.albumArt) {
            elements.albumImage.src = trackInfo.albumArt;
            elements.albumImage.style.display = 'block';
            elements.noMusic.style.display = 'none';
        } else {
            elements.albumImage.style.display = 'none';
            elements.noMusic.style.display = 'flex';
        }
        
        // Update progress
        if (trackInfo.duration > 0) {
            const progressPercent = (trackInfo.progress / trackInfo.duration) * 100;
            elements.progressFill.style.width = `${progressPercent}%`;
            elements.currentTime.textContent = formatTime(trackInfo.progress);
            elements.totalTime.textContent = formatTime(trackInfo.duration);
        }
    } else {
        // No music playing
        elements.title.textContent = '-';
        elements.artist.textContent = '-';
        elements.album.textContent = '-';
        elements.albumImage.style.display = 'none';
        elements.noMusic.style.display = 'flex';
        elements.progressFill.style.width = '0%';
        elements.currentTime.textContent = '0:00';
        elements.totalTime.textContent = '0:00';
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function addLogEntry(message, type = 'info') {
    const logsContent = document.getElementById('logs-content');
    const timestamp = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('p');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
    
    logsContent.appendChild(logEntry);
    logsContent.scrollTop = logsContent.scrollHeight;
}

// Event listeners for buttons
document.addEventListener('DOMContentLoaded', () => {
    // Reconnect buttons
    document.getElementById('discord-reconnect')?.addEventListener('click', () => {
        updateConnectionStatus('discord', 'connecting', 'Attempting to reconnect...');
        addLogEntry('Attempting to reconnect to Discord...', 'info');
        // TODO: Trigger Discord reconnection
    });
    
    document.getElementById('roon-reconnect')?.addEventListener('click', () => {
        updateConnectionStatus('roon', 'connecting', 'Attempting to reconnect...');
        addLogEntry('Attempting to reconnect to Roon...', 'info');
        // TODO: Trigger Roon reconnection
    });
    
    document.getElementById('spotify-reconnect')?.addEventListener('click', () => {
        updateConnectionStatus('spotify', 'connecting', 'Attempting to reconnect...');
        addLogEntry('Attempting to reconnect to Spotify...', 'info');
        // TODO: Trigger Spotify reconnection
    });
    
    document.getElementById('imgur-reconnect')?.addEventListener('click', () => {
        updateConnectionStatus('imgur', 'connecting', 'Attempting to reconnect...');
        addLogEntry('Attempting to reconnect to Imgur...', 'info');
        // TODO: Trigger Imgur reconnection
    });
    
    document.getElementById('reconnect-all')?.addEventListener('click', () => {
        addLogEntry('Reconnecting all services...', 'info');
        showNotification('Reconnecting all services...', 'info');
        // TODO: Trigger all reconnections
    });
    
    document.getElementById('clear-activity')?.addEventListener('click', () => {
        addLogEntry('Clearing Discord activity...', 'info');
        showNotification('Discord activity cleared', 'success');
        updateCurrentTrack({ title: '-', artist: '-', album: '-', albumArt: null });
        // TODO: Clear Discord activity
    });
    
    // Log controls
    document.getElementById('clear-logs')?.addEventListener('click', () => {
        const logsContent = document.getElementById('logs-content');
        logsContent.innerHTML = '<p class="log-entry info">Logs cleared</p>';
    });
    
    document.getElementById('export-logs')?.addEventListener('click', () => {
        const logsContent = document.getElementById('logs-content');
        const logs = logsContent.textContent;
        
        // TODO: Implement log export functionality
        showNotification('Log export functionality coming soon', 'info');
    });
    
    // Initialize with default state
    addLogEntry('Application initialized', 'success');
    
    // Simulate some initial connection attempts (for demo)
    setTimeout(() => {
        updateConnectionStatus('discord', 'connecting', 'Attempting to connect...');
        addLogEntry('Attempting to connect to Discord...', 'info');
    }, 1000);
    
    setTimeout(() => {
        updateConnectionStatus('roon', 'connecting', 'Searching for Roon Core...');
        addLogEntry('Searching for Roon Core...', 'info');
    }, 1500);
});

// IPC event listeners
ipcRenderer.on('reconnect-all', () => {
    document.getElementById('reconnect-all')?.click();
});

ipcRenderer.on('reconnect-discord', () => {
    document.getElementById('discord-reconnect')?.click();
});

ipcRenderer.on('reconnect-roon', () => {
    document.getElementById('roon-reconnect')?.click();
});

ipcRenderer.on('show-settings', () => {
    // Switch to config tab
    const configTab = document.querySelector('[data-tab="config"]');
    if (configTab) {
        configTab.click();
    }
});

// Export for use in other modules
window.AppState = AppState;
window.updateConnectionStatus = updateConnectionStatus;
window.updateCurrentTrack = updateCurrentTrack;
window.addLogEntry = addLogEntry;
window.showNotification = showNotification;
