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
    // Update app state only - let status.js handle the UI updates
    AppState.connections[service] = { status, details };

    // Note: UI updates are now handled by the status.js module to avoid conflicts
    // This function now only maintains the app state for other components
}

function updateCurrentTrack(trackInfo) {
    AppState.currentTrack = { ...AppState.currentTrack, ...trackInfo };
    
    const elements = {
        title: document.getElementById('track-title'),
        artist: document.getElementById('track-artist'),
        album: document.getElementById('track-album'),
        zone: document.getElementById('track-zone'),
        albumImage: document.getElementById('album-image'),
        noMusic: document.getElementById('no-music'),
        progressFill: document.getElementById('progress-fill'),
        currentTime: document.getElementById('current-time'),
        totalTime: document.getElementById('total-time'),
        trackActions: document.getElementById('track-actions'),
        spotifyLink: document.getElementById('spotify-link')
    };
    
    if (trackInfo.title && trackInfo.title !== '-') {
        // Show track info
        elements.title.textContent = trackInfo.title;
        elements.artist.textContent = trackInfo.artist || '-';
        elements.album.textContent = trackInfo.album || '-';
        elements.zone.textContent = trackInfo.zoneName ? `Zone: ${trackInfo.zoneName}` : '-';
        
        // Handle album art - only update if albumArt is explicitly provided
        if (trackInfo.hasOwnProperty('albumArt')) {
            if (trackInfo.albumArt) {
                elements.albumImage.src = trackInfo.albumArt;
                elements.albumImage.style.display = 'block';
                elements.noMusic.style.display = 'none';
            } else {
                elements.albumImage.style.display = 'none';
                elements.noMusic.style.display = 'flex';
            }
        }
        
        // Update progress
        if (trackInfo.duration > 0) {
            const progressPercent = (trackInfo.progress / trackInfo.duration) * 100;
            elements.progressFill.style.width = `${progressPercent}%`;
            elements.currentTime.textContent = formatTime(trackInfo.progress);
            elements.totalTime.textContent = formatTime(trackInfo.duration);
        }

        // Show track actions
        if (elements.trackActions) {
            elements.trackActions.style.display = 'flex';
        }

        // Handle Spotify link
        if (elements.spotifyLink) {
            if (trackInfo.spotifyUrl) {
                elements.spotifyLink.style.display = 'inline-block';
                elements.spotifyLink.onclick = () => {
                    require('electron').shell.openExternal(trackInfo.spotifyUrl);
                };
            } else {
                elements.spotifyLink.style.display = 'none';
                // Try to get Spotify URL asynchronously
                getSpotifyUrl(trackInfo.title, trackInfo.artist, trackInfo.album);
            }
        }
    } else {
        // No music playing
        elements.title.textContent = '-';
        elements.artist.textContent = '-';
        elements.album.textContent = '-';
        if (elements.zone) elements.zone.textContent = '-';
        elements.albumImage.style.display = 'none';
        elements.noMusic.style.display = 'flex';
        elements.progressFill.style.width = '0%';
        elements.currentTime.textContent = '0:00';
        elements.totalTime.textContent = '0:00';
        if (elements.trackActions) elements.trackActions.style.display = 'none';
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get Spotify URL for current track
async function getSpotifyUrl(title, artist, album) {
    if (!title || !artist) return;

    try {
        const spotifyUrl = await ipcRenderer.invoke('spotify-search', title, artist, album);
        if (spotifyUrl) {
            // Update the current track with Spotify URL
            const spotifyLink = document.getElementById('spotify-link');
            if (spotifyLink) {
                spotifyLink.style.display = 'inline-block';
                spotifyLink.onclick = () => {
                    require('electron').shell.openExternal(spotifyUrl);
                };
            }

            // Update app state
            AppState.currentTrack.spotifyUrl = spotifyUrl;
            addLogEntry(`Found Spotify link for ${title}`, 'success');
        }
    } catch (error) {
        console.error('Error getting Spotify URL:', error);
        addLogEntry(`Failed to get Spotify link: ${error.message}`, 'error');
    }
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
    document.getElementById('discord-reconnect')?.addEventListener('click', async () => {
        updateConnectionStatus('discord', 'connecting', 'Attempting to reconnect...');
        addLogEntry('Attempting to reconnect to Discord...', 'info');

        try {
            const success = await ipcRenderer.invoke('discord-connect');
            if (success) {
                addLogEntry('Discord reconnection initiated', 'info');
            } else {
                addLogEntry('Discord reconnection failed', 'error');
                updateConnectionStatus('discord', 'error', 'Reconnection failed');
            }
        } catch (error) {
            addLogEntry(`Discord reconnection error: ${error.message}`, 'error');
            updateConnectionStatus('discord', 'error', error.message);
        }
    });
    
    document.getElementById('roon-reconnect')?.addEventListener('click', async () => {
        updateConnectionStatus('roon', 'connecting', 'Attempting to reconnect...');
        addLogEntry('Attempting to reconnect to Roon...', 'info');

        try {
            const success = await ipcRenderer.invoke('roon-connect');
            if (success) {
                addLogEntry('Roon reconnection initiated', 'info');
            } else {
                addLogEntry('Roon reconnection failed', 'error');
                updateConnectionStatus('roon', 'error', 'Reconnection failed');
            }
        } catch (error) {
            addLogEntry(`Roon reconnection error: ${error.message}`, 'error');
            updateConnectionStatus('roon', 'error', error.message);
        }
    });
    
    document.getElementById('spotify-reconnect')?.addEventListener('click', async () => {
        updateConnectionStatus('spotify', 'connecting', 'Attempting to reconnect...');
        addLogEntry('Attempting to reconnect to Spotify...', 'info');

        try {
            const success = await ipcRenderer.invoke('spotify-connect');
            if (success) {
                addLogEntry('Spotify reconnection initiated', 'info');
            } else {
                addLogEntry('Spotify reconnection failed', 'error');
                updateConnectionStatus('spotify', 'error', 'Reconnection failed');
            }
        } catch (error) {
            addLogEntry(`Spotify reconnection error: ${error.message}`, 'error');
            updateConnectionStatus('spotify', 'error', error.message);
        }
    });

    document.getElementById('imgur-reconnect')?.addEventListener('click', async () => {
        updateConnectionStatus('imgur', 'connecting', 'Attempting to reconnect...');
        addLogEntry('Attempting to reconnect to Imgur...', 'info');

        try {
            const success = await ipcRenderer.invoke('imgur-connect');
            if (success) {
                addLogEntry('Imgur reconnection initiated', 'info');
            } else {
                addLogEntry('Imgur reconnection failed', 'error');
                updateConnectionStatus('imgur', 'error', 'Reconnection failed');
            }
        } catch (error) {
            addLogEntry(`Imgur reconnection error: ${error.message}`, 'error');
            updateConnectionStatus('imgur', 'error', error.message);
        }
    });
    
    document.getElementById('reconnect-all')?.addEventListener('click', async () => {
        addLogEntry('Reconnecting all services...', 'info');
        showNotification('Reconnecting all services...', 'info');

        try {
            const results = await ipcRenderer.invoke('service-reconnect-all');
            addLogEntry(`Reconnection results: ${JSON.stringify(results)}`, 'info');
        } catch (error) {
            addLogEntry(`Reconnection error: ${error.message}`, 'error');
        }
    });

    document.getElementById('clear-activity')?.addEventListener('click', async () => {
        addLogEntry('Clearing Discord activity...', 'info');

        try {
            const success = await ipcRenderer.invoke('discord-clear-activity');
            if (success) {
                showNotification('Discord activity cleared', 'success');
                updateCurrentTrack({ title: '-', artist: '-', album: '-', albumArt: null });
                addLogEntry('Discord activity cleared successfully', 'success');
            } else {
                addLogEntry('Failed to clear Discord activity', 'error');
            }
        } catch (error) {
            addLogEntry(`Error clearing Discord activity: ${error.message}`, 'error');
        }
    });

    document.getElementById('test-activity')?.addEventListener('click', async () => {
        addLogEntry('Setting test Discord activity...', 'info');

        const testTrack = {
            title: 'Test Song from GUI',
            artist: 'Test Artist',
            album: 'Test Album',
            zoneName: 'GUI Test Zone',
            duration: 180,
            position: 30
        };

        try {
            const success = await ipcRenderer.invoke('discord-set-activity', testTrack);
            if (success) {
                showNotification('Test activity set successfully', 'success');
                updateCurrentTrack(testTrack);
                addLogEntry('Test Discord activity set successfully', 'success');
            } else {
                addLogEntry('Failed to set test Discord activity', 'error');
            }
        } catch (error) {
            addLogEntry(`Error setting test Discord activity: ${error.message}`, 'error');
        }
    });

    // Refresh activity button removed - app now automatically updates Discord activity
    
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
});

// IPC event listeners for menu actions
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

// IPC event listeners for service events
// Note: service-status-changed is now handled by status.js
// We only handle logging here
ipcRenderer.on('service-status-changed', (event, data) => {
    console.log('Service status changed:', data);
    addLogEntry(`${data.service}: ${data.status}${data.details ? ` (${data.details})` : ''}`,
                data.status === 'error' ? 'error' :
                data.status === 'connected' ? 'success' : 'info');
});

ipcRenderer.on('discord-ready', (event, user) => {
    console.log('Discord ready:', user);
    // Status updates are handled by status.js via 'service-status-changed' events
    addLogEntry(`Discord connected as ${user.username}#${user.discriminator}`, 'success');
});

ipcRenderer.on('discord-activity-set', (event, activity) => {
    console.log('Discord activity set:', activity);
    addLogEntry(`Discord activity set: ${activity.details}`, 'success');
});

ipcRenderer.on('discord-activity-error', (event, error) => {
    console.log('Discord activity error:', error);
    addLogEntry(`Discord activity error: ${error}`, 'error');
});

ipcRenderer.on('log-entry', (event, logEntry) => {
    // Add log entry from main process
    const logsContent = document.getElementById('logs-content');
    if (logsContent) {
        const logElement = document.createElement('p');
        logElement.className = `log-entry ${logEntry.levelName.toLowerCase()}`;

        const timeString = new Date(logEntry.timestamp).toLocaleTimeString();
        const category = logEntry.category ? `[${logEntry.category}]` : '';
        logElement.innerHTML = `<span class="timestamp">[${timeString}]</span> ${category} ${logEntry.message}`;

        logsContent.appendChild(logElement);
        logsContent.scrollTop = logsContent.scrollHeight;
    }
});

// Roon event listeners
ipcRenderer.on('roon-core-paired', (event, core) => {
    console.log('Roon core paired:', core);
    // Status updates are handled by status.js via 'service-status-changed' events
    addLogEntry(`Roon connected to core: ${core.display_name}`, 'success');
});

ipcRenderer.on('roon-tokens-saved', (event, tokenInfo) => {
    console.log('Roon tokens saved automatically:', tokenInfo);
    addLogEntry(tokenInfo.message, 'success');
    showNotification(`✅ ${tokenInfo.message}`, 'success');
});

ipcRenderer.on('roon-zones-updated', (event, zones) => {
    console.log('Roon zones updated:', zones);
    addLogEntry(`Roon zones updated: ${zones.length} zones available`, 'info');
});

ipcRenderer.on('roon-zone-selected', (event, zone) => {
    console.log('Roon zone selected:', zone);
    addLogEntry(`Roon zone selected: ${zone.display_name}`, 'info');
});

ipcRenderer.on('roon-track-changed', (event, trackInfo) => {
    console.log('Roon track changed:', trackInfo);
    if (trackInfo && trackInfo.title && trackInfo.title !== '-') {
        // Valid track info received
        updateCurrentTrack({
            title: trackInfo.title,
            artist: trackInfo.artist,
            album: trackInfo.album,
            duration: trackInfo.duration,
            progress: trackInfo.position,
            albumArt: trackInfo.albumArt,
            zoneName: trackInfo.zoneName
        });
        addLogEntry(`Now playing: ${trackInfo.title} by ${trackInfo.artist}`, 'success');
    } else if (trackInfo && trackInfo.title === '-') {
        // Explicit stop signal
        updateCurrentTrack({ title: '-', artist: '-', album: '-' });
        addLogEntry('Playback stopped', 'info');
    } else {
        // Null or invalid trackInfo - ignore to prevent flickering
        console.log('Ignoring invalid track info to prevent flickering:', trackInfo);
    }
});

// Listen for track position changes (seek updates)
ipcRenderer.on('roon-track-position-changed', (event, trackInfo) => {
    if (trackInfo && AppState.currentTrack.title && AppState.currentTrack.title !== '-') {
        // Only update the progress and duration, preserve existing track data
        // Don't call updateCurrentTrack as it might reset the display
        // Instead, directly update the progress elements
        const progressFill = document.getElementById('progress-fill');
        const currentTime = document.getElementById('current-time');
        const totalTime = document.getElementById('total-time');

        if (trackInfo.duration > 0 && progressFill && currentTime && totalTime) {
            const progressPercent = (trackInfo.position / trackInfo.duration) * 100;
            progressFill.style.width = `${progressPercent}%`;
            currentTime.textContent = formatTime(trackInfo.position);
            totalTime.textContent = formatTime(trackInfo.duration);

            // Update app state without triggering display reset
            AppState.currentTrack.duration = trackInfo.duration;
            AppState.currentTrack.progress = trackInfo.position;
        }
    }
});

// Export for use in other modules
window.AppState = AppState;
window.updateConnectionStatus = updateConnectionStatus;
window.updateCurrentTrack = updateCurrentTrack;
window.addLogEntry = addLogEntry;
window.showNotification = showNotification;
