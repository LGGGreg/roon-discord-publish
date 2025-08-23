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
            await displayConfigurationStatus(config);

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

    function validateCredentialFormat(serviceName, serviceConfig) {
        switch (serviceName) {
            case 'discord':
                const discordClientId = serviceConfig?.clientId;
                if (!discordClientId || discordClientId.trim() === '') {
                    return false;
                }
                // Discord Client ID should be 17-19 digits
                return /^\d{17,19}$/.test(discordClientId.trim());

            case 'spotify':
                const spotifyClient = serviceConfig?.client;
                const spotifySecret = serviceConfig?.secret;
                if (!spotifyClient || spotifyClient.trim() === '' ||
                    !spotifySecret || spotifySecret.trim() === '') {
                    return false;
                }
                // Spotify credentials should be 32 character hex strings
                return /^[a-f0-9]{32}$/i.test(spotifyClient.trim()) &&
                       /^[a-f0-9]{32}$/i.test(spotifySecret.trim());

            case 'imgur':
                const imgurClientId = serviceConfig?.clientId;
                if (!imgurClientId || imgurClientId.trim() === '') {
                    return false;
                }
                // Imgur Client ID should be 10-20 alphanumeric characters
                return /^[a-zA-Z0-9]{10,20}$/.test(imgurClientId.trim());

            default:
                return false;
        }
    }

    function getCurrentConfig() {
        // Get current form values
        return {
            discord: {
                clientId: configForm.discordClientId?.value?.trim() || ''
            },
            spotify: {
                client: configForm.spotifyClientId?.value?.trim() || '',
                secret: configForm.spotifyClientSecret?.value?.trim() || ''
            },
            imgur: {
                clientId: configForm.imgurClientId?.value?.trim() || ''
            },
            core_ip: configForm.roonCoreIp?.value?.trim() || '',
            zone_id: configForm.roonZoneId?.value?.trim() || '',
            app: {
                use_discovery: configForm.roonUseDiscovery?.checked !== false,
                minimize_to_tray: configForm.appMinimizeToTray?.checked !== false
            }
        };
    }

    async function saveAndTestConnection(service) {
        if (window.addLogEntry) {
            window.addLogEntry(`Saving and testing ${service} connection...`, 'info');
        }

        try {
            // Step 1: Save configuration first
            await saveConfiguration();

            // Step 2: Get current form values for testing
            const config = getCurrentConfig();

            // Step 3: Test connection with saved credentials
            const { ipcRenderer } = require('electron');
            const testResult = await ipcRenderer.invoke('testServiceConnection', service.toLowerCase(), config);

            if (testResult.success) {
                if (window.addLogEntry) {
                    window.addLogEntry(`${service} connection test successful`, 'success');
                }

                // Show success notification
                if (window.showNotification) {
                    window.showNotification(`${service} test successful! Connecting...`, 'success');
                }

                // Step 4: If test succeeds, establish actual connection
                try {
                    const connectResult = await ipcRenderer.invoke(`${service.toLowerCase()}-connect`);

                    if (connectResult) {
                        if (window.addLogEntry) {
                            window.addLogEntry(`${service} connected successfully`, 'success');
                        }

                        if (window.showNotification) {
                            window.showNotification(`${service} connected successfully!`, 'success');
                        }
                    } else {
                        if (window.addLogEntry) {
                            window.addLogEntry(`${service} connection failed after successful test`, 'warning');
                        }

                        if (window.showNotification) {
                            window.showNotification(`${service} test passed but connection failed`, 'warning');
                        }
                    }
                } catch (connectError) {
                    console.error(`Error during ${service} connection:`, connectError);
                    if (window.addLogEntry) {
                        window.addLogEntry(`${service} connection error after successful test: ${connectError.message}`, 'warning');
                    }

                    if (window.showNotification) {
                        window.showNotification(`${service} test passed but connection error occurred`, 'warning');
                    }
                }

            } else {
                if (window.addLogEntry) {
                    window.addLogEntry(`${service} connection test failed: ${testResult.error}`, 'error');
                }

                // Show error notification
                if (window.showNotification) {
                    window.showNotification(`${service} test failed: ${testResult.error}`, 'error');
                }
            }
        } catch (error) {
            console.error(`Error in save and test ${service} connection:`, error);
            if (window.addLogEntry) {
                window.addLogEntry(`${service} save and test error: ${error.message}`, 'error');
            }

            // Show error notification
            if (window.showNotification) {
                window.showNotification(`${service} save and test error`, 'error');
            }
        }
    }
    
    // Event listeners
    document.getElementById('save-config')?.addEventListener('click', saveConfiguration);
    document.getElementById('reset-config')?.addEventListener('click', resetConfiguration);
    
    document.getElementById('test-discord')?.addEventListener('click', () => saveAndTestConnection('Discord'));
    document.getElementById('test-spotify')?.addEventListener('click', () => saveAndTestConnection('Spotify'));
    document.getElementById('test-imgur')?.addEventListener('click', () => saveAndTestConnection('Imgur'));
    
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

    async function displayConfigurationStatus(config) {
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

        // Get actual service status from main process
        const { ipcRenderer } = require('electron');
        let serviceStatus = {};
        try {
            serviceStatus = await ipcRenderer.invoke('service-get-all-status');
        } catch (error) {
            console.error('Error getting service status:', error);
        }

        // Enhanced status determination for each service
        const discordStatus = getEnhancedServiceStatus('discord', config.discord?.clientId, serviceStatus.discord, config.discord);
        const spotifyStatus = getEnhancedServiceStatus('spotify', config.spotify?.client && config.spotify?.secret, serviceStatus.spotify, config.spotify);
        const imgurStatus = getEnhancedServiceStatus('imgur', config.imgur?.clientId, serviceStatus.imgur, config.imgur);
        const hasRoonPairing = config.roonstate?.paired_core_id;

        statusDiv.innerHTML = `
            <div class="status-summary">
                <h3>Configuration Status</h3>
                <div class="status-items">
                    <div class="status-item ${discordStatus.cssClass}">
                        <span class="status-icon">${discordStatus.icon}</span>
                        <span>Discord: ${discordStatus.text}</span>
                        ${discordStatus.help ? `<div class="status-help">${discordStatus.help}</div>` : ''}
                    </div>
                    <div class="status-item ${spotifyStatus.cssClass}">
                        <span class="status-icon">${spotifyStatus.icon}</span>
                        <span>Spotify: ${spotifyStatus.text}</span>
                        ${spotifyStatus.help ? `<div class="status-help">${spotifyStatus.help}</div>` : ''}
                    </div>
                    <div class="status-item ${imgurStatus.cssClass}">
                        <span class="status-icon">${imgurStatus.icon}</span>
                        <span>Imgur: ${imgurStatus.text}</span>
                        ${imgurStatus.help ? `<div class="status-help">${imgurStatus.help}</div>` : ''}
                    </div>
                    <div class="status-item ${hasRoonPairing ? 'configured' : 'pending'}">
                        <span class="status-icon">${hasRoonPairing ? '✓' : '⏳'}</span>
                        <span>Roon: ${hasRoonPairing ? 'Paired' : 'Pairing Required'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Enhanced service status determination
    function getEnhancedServiceStatus(serviceName, isConfigured, serviceStats, serviceConfig = null) {
        if (!isConfigured) {
            // Not configured - RED
            return {
                cssClass: 'missing',
                icon: '✗',
                text: serviceName === 'discord' ? 'Required - Add Client ID' : 'Optional - Not configured',
                help: getServiceHelp(serviceName)
            };
        }

        // Configured - check connection status
        if (!serviceStats) {
            // No service stats available - YELLOW
            return {
                cssClass: 'configured-unknown',
                icon: '?',
                text: 'Configured - Connection status unknown',
                help: null
            };
        }

        switch (serviceStats.state) {
            case 'connected':
                // GREEN - configured and connected
                return {
                    cssClass: 'connected',
                    icon: '✓',
                    text: 'Configured and connected',
                    help: null
                };
            case 'connecting':
            case 'reconnecting':
                // Check if credentials are valid format
                const isValidFormat = validateCredentialFormat(serviceName, serviceConfig);

                if (isValidFormat) {
                    // BLUE - valid credentials attempting connection
                    return {
                        cssClass: 'connecting',
                        icon: '⟳',
                        text: 'Configured - Connecting...',
                        help: null
                    };
                } else {
                    // YELLOW - invalid credentials attempting connection
                    return {
                        cssClass: 'configured-disconnected',
                        icon: '⚠',
                        text: 'Configured but not connected',
                        help: null
                    };
                }
            case 'disconnected':
            case 'error':
            default:
                // YELLOW - configured but not connected
                return {
                    cssClass: 'configured-disconnected',
                    icon: '⚠',
                    text: 'Configured but not connected',
                    help: serviceStats.lastError ? `Error: ${serviceStats.lastError.message}` : null
                };
        }
    }

    function getServiceHelp(serviceName) {
        switch (serviceName) {
            case 'discord':
                return 'Get your Client ID from <a href="https://discord.com/developers/applications" target="_blank">Discord Developer Portal</a>';
            case 'spotify':
                return 'Add Client ID & Secret for enhanced track information';
            case 'imgur':
                return 'Add Client ID for album art sharing';
            default:
                return null;
        }
    }

    // Listen for configuration events from main process
    ipcRenderer.on('config-loaded', async (event, config) => {
        console.log('Configuration loaded from main process');
        await displayConfigurationStatus(config);
    });

    ipcRenderer.on('config-saved', async (event, config) => {
        console.log('Configuration saved in main process');
        await displayConfigurationStatus(config);
    });

    ipcRenderer.on('config-error', (event, error) => {
        console.error('Configuration error from main process:', error);
        if (window.addLogEntry) {
            window.addLogEntry('Configuration error: ' + error, 'error');
        }
    });

    // Listen for service status changes to update config page status
    ipcRenderer.on('service-status-changed', async (event, data) => {
        console.log('Service status changed, updating config status:', data);
        // Reload current config and update status display
        try {
            const config = await ipcRenderer.invoke('config-get-all');
            await displayConfigurationStatus(config);
        } catch (error) {
            console.error('Error updating config status after service change:', error);
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
