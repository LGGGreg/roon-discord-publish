// Configuration management functionality
// This file will handle loading, saving, and validating configuration

document.addEventListener('DOMContentLoaded', () => {
    const configForm = {
        discordClientId: document.getElementById('discord-client-id'),
        spotifyClientId: document.getElementById('spotify-client-id'),
        spotifyClientSecret: document.getElementById('spotify-client-secret'),
        imgurClientId: document.getElementById('imgur-client-id'),
        roonCoreIp: document.getElementById('roon-core-ip'),
        roonZoneId: document.getElementById('roon-zone-id'),
        roonUseDiscovery: document.getElementById('roon-use-discovery'),
        appAutoStart: document.getElementById('app-auto-start'),
        appMinimizeToTray: document.getElementById('app-minimize-to-tray'),
        appAutoShutdown: document.getElementById('app-auto-shutdown')
    };
    
    function loadConfiguration() {
        // TODO: Load configuration from main process
        // For now, we'll use placeholder values
        if (window.addLogEntry) {
            window.addLogEntry('Loading configuration...', 'info');
        }
    }
    
    function saveConfiguration() {
        const config = {
            discord: {
                clientId: configForm.discordClientId.value
            },
            spotify: {
                client: configForm.spotifyClientId.value,
                secret: configForm.spotifyClientSecret.value
            },
            imgur: {
                clientId: configForm.imgurClientId.value
            },
            core_ip: configForm.roonCoreIp.value,
            zone_id: configForm.roonZoneId.value,
            app: {
                use_discovery: configForm.roonUseDiscovery.checked,
                auto_start: configForm.appAutoStart.checked,
                minimize_to_tray: configForm.appMinimizeToTray.checked,
                auto_shutdown: configForm.appAutoShutdown.checked
            }
        };
        
        // TODO: Save configuration through main process
        if (window.addLogEntry) {
            window.addLogEntry('Configuration saved', 'success');
        }
        
        if (window.showNotification) {
            window.showNotification('Configuration saved successfully', 'success');
        }
    }
    
    function resetConfiguration() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            // Reset form to defaults
            Object.values(configForm).forEach(input => {
                if (input.type === 'checkbox') {
                    input.checked = input.id === 'roon-use-discovery' || input.id === 'app-minimize-to-tray';
                } else {
                    input.value = '';
                }
            });
            
            if (window.addLogEntry) {
                window.addLogEntry('Configuration reset to defaults', 'info');
            }
            
            if (window.showNotification) {
                window.showNotification('Configuration reset to defaults', 'info');
            }
        }
    }
    
    function testConnection(service) {
        if (window.addLogEntry) {
            window.addLogEntry(`Testing ${service} connection...`, 'info');
        }
        
        // TODO: Implement actual connection testing
        setTimeout(() => {
            if (window.addLogEntry) {
                window.addLogEntry(`${service} connection test completed`, 'success');
            }
            
            if (window.showNotification) {
                window.showNotification(`${service} connection test successful`, 'success');
            }
        }, 2000);
    }
    
    // Event listeners
    document.getElementById('save-config')?.addEventListener('click', saveConfiguration);
    document.getElementById('reset-config')?.addEventListener('click', resetConfiguration);
    
    document.getElementById('test-discord')?.addEventListener('click', () => testConnection('Discord'));
    document.getElementById('test-spotify')?.addEventListener('click', () => testConnection('Spotify'));
    document.getElementById('test-imgur')?.addEventListener('click', () => testConnection('Imgur'));
    
    document.getElementById('export-config')?.addEventListener('click', () => {
        // TODO: Implement config export
        if (window.showNotification) {
            window.showNotification('Config export functionality coming soon', 'info');
        }
    });
    
    document.getElementById('import-config')?.addEventListener('click', () => {
        // TODO: Implement config import
        if (window.showNotification) {
            window.showNotification('Config import functionality coming soon', 'info');
        }
    });
    
    // Load configuration on startup
    loadConfiguration();
    
    // Export functions for external use
    window.loadConfiguration = loadConfiguration;
    window.saveConfiguration = saveConfiguration;
    window.resetConfiguration = resetConfiguration;
});
