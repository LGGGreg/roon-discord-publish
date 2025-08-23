// Configuration management functionality
// This file will handle loading, saving, and validating configuration

document.addEventListener('DOMContentLoaded', () => {
    // Get ipcRenderer (avoiding global scope conflict)
    const { ipcRenderer } = require('electron');

    const configForm = {
        discordClientId: document.getElementById('discord-client-id'),
        spotifyClientId: document.getElementById('spotify-client-id'),
        spotifyClientSecret: document.getElementById('spotify-client-secret'),
        imgurClientId: document.getElementById('imgur-client-id'),
        roonCoreIp: document.getElementById('roon-core-ip'),
        roonZoneId: document.getElementById('roon-zone-id'),
        roonUseDiscovery: document.getElementById('roon-use-discovery'),
        appMinimizeToTray: document.getElementById('app-minimize-to-tray')
    };
    
    async function loadConfiguration() {
        try {
            if (window.addLogEntry) {
                window.addLogEntry('Loading configuration...', 'info');
            }

            const config = await ipcRenderer.invoke('config-get-all');

            // Populate form fields
            if (config.discord?.clientId) configForm.discordClientId.value = config.discord.clientId;
            if (config.spotify?.client) configForm.spotifyClientId.value = config.spotify.client;
            if (config.spotify?.secret) configForm.spotifyClientSecret.value = config.spotify.secret;
            if (config.imgur?.clientId) configForm.imgurClientId.value = config.imgur.clientId;
            if (config.core_ip) configForm.roonCoreIp.value = config.core_ip;
            if (config.zone_id) configForm.roonZoneId.value = config.zone_id;

            // Set checkboxes
            configForm.roonUseDiscovery.checked = config.app?.use_discovery !== false;
            configForm.appMinimizeToTray.checked = config.app?.minimize_to_tray !== false;

            if (window.addLogEntry) {
                window.addLogEntry('Configuration loaded successfully', 'success');
            }

            // Show configuration status
            displayConfigurationStatus(config);

        } catch (error) {
            console.error('Error loading configuration:', error);
            if (window.addLogEntry) {
                window.addLogEntry('Error loading configuration: ' + error.message, 'error');
            }
        }
    }
    
    async function saveConfiguration() {
        try {
            const config = {
                discord: {
                    clientId: configForm.discordClientId.value.trim()
                },
                spotify: {
                    client: configForm.spotifyClientId.value.trim(),
                    secret: configForm.spotifyClientSecret.value.trim()
                },
                imgur: {
                    clientId: configForm.imgurClientId.value.trim()
                },
                core_ip: configForm.roonCoreIp.value.trim(),
                zone_id: configForm.roonZoneId.value.trim(),
                app: {
                    use_discovery: configForm.roonUseDiscovery.checked,
                    minimize_to_tray: configForm.appMinimizeToTray.checked
                }
            };

            // Validate configuration
            const validation = await ipcRenderer.invoke('config-validate');

            // Save configuration
            const success = await ipcRenderer.invoke('config-save', config);

            if (success) {
                if (window.addLogEntry) {
                    window.addLogEntry('Configuration saved successfully', 'success');
                }

                if (window.showNotification) {
                    window.showNotification('Configuration saved successfully', 'success');
                }

                // Reload to show updated status
                await loadConfiguration();
            } else {
                throw new Error('Failed to save configuration');
            }

        } catch (error) {
            console.error('Error saving configuration:', error);
            if (window.addLogEntry) {
                window.addLogEntry('Error saving configuration: ' + error.message, 'error');
            }

            if (window.showNotification) {
                window.showNotification('Error saving configuration', 'error');
            }
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
    
    async function testConnection(service) {
        if (window.addLogEntry) {
            window.addLogEntry(`Testing ${service} connection...`, 'info');
        }

        try {
            // Get current form values
            const config = getCurrentConfig();

            // Send test connection request to main process
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('testServiceConnection', service.toLowerCase(), config);

            if (result.success) {
                if (window.addLogEntry) {
                    window.addLogEntry(`${service} connection test successful`, 'success');
                }

                // Show success notification
                if (window.showNotification) {
                    window.showNotification(`${service} connection successful!`, 'success');
                }
            } else {
                if (window.addLogEntry) {
                    window.addLogEntry(`${service} connection test failed: ${result.error}`, 'error');
                }

                // Show error notification
                if (window.showNotification) {
                    window.showNotification(`${service} connection failed: ${result.error}`, 'error');
                }
            }
        } catch (error) {
            console.error(`Error testing ${service} connection:`, error);
            if (window.addLogEntry) {
                window.addLogEntry(`${service} connection test error: ${error.message}`, 'error');
            }

            // Show error notification
            if (window.showNotification) {
                window.showNotification(`${service} connection test error`, 'error');
            }
        }
    }
    
    // Event listeners
    document.getElementById('save-config')?.addEventListener('click', saveConfiguration);
    document.getElementById('reset-config')?.addEventListener('click', resetConfiguration);
    
    document.getElementById('test-discord')?.addEventListener('click', () => testConnection('Discord'));
    document.getElementById('test-spotify')?.addEventListener('click', () => testConnection('Spotify'));
    document.getElementById('test-imgur')?.addEventListener('click', () => testConnection('Imgur'));
    
    const exportBtn = document.getElementById('export-config');
    const importBtn = document.getElementById('import-config');

    console.log('Export button found:', !!exportBtn);
    console.log('Import button found:', !!importBtn);

    if (exportBtn) {
        exportBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Export button clicked');
            await exportConfiguration();
        });
    } else {
        console.error('Export button not found!');
    }

    if (importBtn) {
        importBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Import button clicked');
            await importConfiguration();
        });
    } else {
        console.error('Import button not found!');
    }
    
    async function exportConfiguration() {
        console.log('exportConfiguration() called');
        try {
            const result = await ipcRenderer.invoke('show-save-dialog', {
                title: 'Export Configuration',
                defaultPath: 'roon-discord-config.json'
            });

            if (!result.canceled && result.filePath) {
                // Ask user if they want to include sensitive data
                const includeSecrets = confirm('Include sensitive data (API keys, tokens) in export?\n\nClick OK to include secrets, Cancel for settings only.');

                const configJson = await ipcRenderer.invoke('config-export', includeSecrets);
                const success = await ipcRenderer.invoke('write-file', result.filePath, configJson);

                if (success) {
                    if (window.addLogEntry) {
                        window.addLogEntry(`Configuration exported to ${result.filePath}`, 'success');
                    }
                    if (window.showNotification) {
                        window.showNotification('Configuration exported successfully', 'success');
                    }
                } else {
                    throw new Error('Failed to write configuration file');
                }
            }
        } catch (error) {
            console.error('Error exporting configuration:', error);
            if (window.addLogEntry) {
                window.addLogEntry('Error exporting configuration: ' + error.message, 'error');
            }
            if (window.showNotification) {
                window.showNotification('Error exporting configuration', 'error');
            }
        }
    }

    async function importConfiguration() {
        console.log('importConfiguration() called');
        try {
            const result = await ipcRenderer.invoke('show-open-dialog', {
                title: 'Import Configuration'
            });

            if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const configJson = await ipcRenderer.invoke('read-file', filePath);

                if (configJson) {
                    // Ask user if they want to merge or replace
                    const merge = confirm('Merge with existing configuration?\n\nClick OK to merge, Cancel to replace completely.');

                    const success = await ipcRenderer.invoke('config-import', configJson, merge);

                    if (success) {
                        if (window.addLogEntry) {
                            window.addLogEntry(`Configuration imported from ${filePath}`, 'success');
                        }
                        if (window.showNotification) {
                            window.showNotification('Configuration imported successfully', 'success');
                        }

                        // Reload the configuration display
                        await loadConfiguration();
                    } else {
                        throw new Error('Failed to import configuration');
                    }
                } else {
                    throw new Error('Failed to read configuration file');
                }
            }
        } catch (error) {
            console.error('Error importing configuration:', error);
            if (window.addLogEntry) {
                window.addLogEntry('Error importing configuration: ' + error.message, 'error');
            }
            if (window.showNotification) {
                window.showNotification('Error importing configuration', 'error');
            }
        }
    }

    function displayConfigurationStatus(config) {
        // Create or update configuration status display
        let statusDiv = document.getElementById('config-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'config-status';
            statusDiv.className = 'config-status';

            // Insert after the description
            const description = document.querySelector('.config-description');
            if (description) {
                description.parentNode.insertBefore(statusDiv, description.nextSibling);
            }
        }

        const hasDiscord = config.discord?.clientId;
        const hasSpotify = config.spotify?.client && config.spotify?.secret;
        const hasImgur = config.imgur?.clientId;
        const hasRoonPairing = config.roonstate?.paired_core_id;

        statusDiv.innerHTML = `
            <div class="status-summary">
                <h3>Configuration Status</h3>
                <div class="status-items">
                    <div class="status-item ${hasDiscord ? 'configured' : 'missing'}">
                        <span class="status-icon">${hasDiscord ? '✓' : '✗'}</span>
                        <span>Discord: ${hasDiscord ? 'Configured' : 'Required - Add Client ID'}</span>
                        ${!hasDiscord ? '<div class="status-help">Get your Client ID from <a href="https://discord.com/developers/applications" target="_blank">Discord Developer Portal</a></div>' : ''}
                    </div>
                    <div class="status-item ${hasSpotify ? 'configured' : 'optional'}">
                        <span class="status-icon">${hasSpotify ? '✓' : '○'}</span>
                        <span>Spotify: ${hasSpotify ? 'Configured' : 'Optional - For track info'}</span>
                        ${!hasSpotify ? '<div class="status-help">Add Client ID & Secret for enhanced track information</div>' : ''}
                    </div>
                    <div class="status-item ${hasImgur ? 'configured' : 'optional'}">
                        <span class="status-icon">${hasImgur ? '✓' : '○'}</span>
                        <span>Imgur: ${hasImgur ? 'Configured' : 'Optional - For album art'}</span>
                        ${!hasImgur ? '<div class="status-help">Add Client ID for album art sharing</div>' : ''}
                    </div>
                    <div class="status-item ${hasRoonPairing ? 'configured' : 'pending'}">
                        <span class="status-icon">${hasRoonPairing ? '✓' : '⏳'}</span>
                        <span>Roon: ${hasRoonPairing ? 'Paired' : 'Pairing Required'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Listen for configuration events from main process
    ipcRenderer.on('config-loaded', (event, config) => {
        console.log('Configuration loaded from main process');
        displayConfigurationStatus(config);
    });

    ipcRenderer.on('config-saved', (event, config) => {
        console.log('Configuration saved in main process');
        displayConfigurationStatus(config);
    });

    ipcRenderer.on('config-error', (event, error) => {
        console.error('Configuration error from main process:', error);
        if (window.addLogEntry) {
            window.addLogEntry('Configuration error: ' + error, 'error');
        }
    });

    // Load configuration on startup
    loadConfiguration();

    // Export functions for external use
    window.loadConfiguration = loadConfiguration;
    window.saveConfiguration = saveConfiguration;
    window.resetConfiguration = resetConfiguration;
    window.exportConfiguration = exportConfiguration;
    window.importConfiguration = importConfiguration;
});
