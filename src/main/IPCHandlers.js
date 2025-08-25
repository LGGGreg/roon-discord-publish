/**
 * IPCHandlers - Centralized IPC handler registration and management
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const ServiceUtils = require('../utils/ServiceUtils');

class IPCHandlers {
    constructor(services, logger, windowManager, configManager) {
        this.services = services;
        this.logger = logger;
        this.windowManager = windowManager;
        this.configManager = configManager;
    }

    /**
     * Register all IPC handlers
     */
    registerAll() {
        this.registerFileSystemHandlers();
        this.registerConfigHandlers();
        this.registerServiceHandlers();
        this.registerWindowHandlers();
        this.registerTestHandlers();
        this.registerSpecialServiceHandlers();
        
        this.logger?.info('IPC', 'All IPC handlers registered');
    }

    /**
     * Register file system related handlers
     */
    registerFileSystemHandlers() {
        ipcMain.handle('read-file', async (event, filePath) => {
            try {
                return fs.readFileSync(filePath, 'utf8');
            } catch (error) {
                console.error('Error reading file:', error);
                return null;
            }
        });

        ipcMain.handle('write-file', async (event, filePath, content) => {
            try {
                fs.writeFileSync(filePath, content, 'utf8');
                this.logger?.info('FileSystem', `File written successfully: ${filePath}`);
                return true;
            } catch (error) {
                this.logger?.error('FileSystem', `Failed to write file ${filePath}: ${error.message}`);
                return false;
            }
        });

        ipcMain.handle('show-save-dialog', async (event, options) => {
            try {
                const result = await dialog.showSaveDialog(this.windowManager.getMainWindow(), options);
                return result;
            } catch (error) {
                this.logger?.error('Dialog', `Failed to show save dialog: ${error.message}`);
                return { canceled: true };
            }
        });
    }

    /**
     * Register configuration related handlers
     */
    registerConfigHandlers() {
        ipcMain.handle('config-load', () => {
            return this.configManager?.getAll() || {};
        });

        ipcMain.handle('config-get-all', () => {
            return this.configManager?.getAll() || {};
        });

        ipcMain.handle('config-save', async (event, config) => {
            try {
                if (this.configManager) {
                    await this.configManager.saveConfig(config);
                    this.logger?.info('Config', 'Configuration saved successfully');
                    return { success: true };
                }
                return { success: false, error: 'Config manager not available' };
            } catch (error) {
                this.logger?.error('Config', `Failed to save config: ${error.message}`);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('config-validate', (event, config) => {
            try {
                if (this.configManager) {
                    return this.configManager.validateConfig(config);
                }
                return { valid: false, error: 'Config manager not available' };
            } catch (error) {
                this.logger?.error('Config', `Config validation failed: ${error.message}`);
                return { valid: false, error: error.message };
            }
        });

        ipcMain.handle('request-service-status', () => {
            // Send current status to renderer
            const services = this.services;
            const mainWindow = this.windowManager.getMainWindow();

            if (mainWindow) {
                Object.entries(services).forEach(([serviceName, service]) => {
                    if (service) {
                        const cleanName = serviceName.replace('Service', '');
                        const stats = service.getStats();
                        mainWindow.webContents.send('service-status-changed', {
                            service: cleanName,
                            status: stats.state,
                            details: stats.details,
                            error: stats.lastError
                        });
                    }
                });
            }

            return true;
        });
    }

    /**
     * Register basic service handlers using ServiceUtils
     */
    registerServiceHandlers() {
        // Register basic connect/disconnect/status handlers for all services
        ServiceUtils.registerAllServiceIPCHandlers(ipcMain, this.services, this.logger);

        // Service management handlers
        ipcMain.handle('service-reconnect-all', async () => {
            return await ServiceUtils.reconnectAllServices(this.services, this.logger);
        });

        ipcMain.handle('service-get-all-status', () => {
            return ServiceUtils.getAllServiceStatus(this.services);
        });
    }

    /**
     * Register special service-specific handlers that go beyond basic connect/disconnect/status
     */
    registerSpecialServiceHandlers() {
        // Discord specific handlers
        ipcMain.handle('discord-set-activity', async (event, trackInfo) => {
            if (!this.services.discordService) return false;
            this.logger?.info('Discord', 'Setting activity from GUI', trackInfo);
            return await this.services.discordService.setTrackActivity(trackInfo);
        });

        ipcMain.handle('discord-clear-activity', async () => {
            if (!this.services.discordService) return false;
            this.logger?.info('Discord', 'Clearing activity from GUI');
            return await this.services.discordService.clearActivity();
        });

        // Spotify specific handlers
        ipcMain.handle('spotify-search', async (event, title, artist, album) => {
            if (!this.services.spotifyService) return '';
            this.logger?.info('Spotify', `Searching for: ${title} by ${artist}`);
            return await this.services.spotifyService.searchTrack(title, artist, album);
        });

        // Imgur specific handlers
        ipcMain.handle('imgur-upload', async (event, imageData, imageKey) => {
            if (!this.services.imgurService) return null;
            this.logger?.info('Imgur', `Uploading image: ${imageKey || 'unnamed'}`);
            return await this.services.imgurService.uploadImage(imageData, imageKey);
        });

        // Roon specific handlers
        ipcMain.handle('roon-get-zones', () => {
            if (!this.services.roonService) return [];
            return this.services.roonService.getZones();
        });

        ipcMain.handle('roon-set-zone', async (event, zoneId) => {
            if (!this.services.roonService) return false;
            this.logger?.info('Roon', `Setting zone to: ${zoneId}`);
            return this.services.roonService.setCurrentZone(zoneId);
        });

        ipcMain.handle('roon-get-current-track', () => {
            if (!this.services.roonService) return null;
            return this.services.roonService.getCurrentTrack();
        });
    }

    /**
     * Register window management handlers
     */
    registerWindowHandlers() {
        ipcMain.handle('window-minimize', () => {
            const mainWindow = this.windowManager.getMainWindow();
            if (mainWindow) {
                mainWindow.minimize();
            }
        });

        ipcMain.handle('window-close', () => {
            const mainWindow = this.windowManager.getMainWindow();
            if (mainWindow) {
                mainWindow.close();
            }
        });

        ipcMain.handle('window-show', () => {
            this.windowManager.show();
        });

        ipcMain.handle('window-hide', () => {
            this.windowManager.hide();
        });
    }

    /**
     * Register test automation handlers (development only)
     */
    registerTestHandlers() {
        if (process.env.NODE_ENV === 'development') {
            // Get comprehensive service status for testing
            ipcMain.handle('test-get-all-status', () => {
                return ServiceUtils.getAllServiceStatus(this.services);
            });

            // Test service connections
            ipcMain.handle('test-service-connection', async (event, serviceName) => {
                const service = this.services[`${serviceName}Service`];
                if (!service) return { success: false, error: 'Service not found' };
                
                try {
                    const result = await service.reconnect(true);
                    return { success: result, service: serviceName };
                } catch (error) {
                    return { success: false, error: error.message, service: serviceName };
                }
            });

            // Get detailed service information for testing
            ipcMain.handle('test-get-service-details', (event, serviceName) => {
                const service = this.services[`${serviceName}Service`];
                if (!service) return null;
                
                return {
                    name: serviceName,
                    stats: service.getStats(),
                    isConnected: service.isConnected(),
                    config: service.getConfig ? service.getConfig() : null
                };
            });

            this.logger?.info('IPC', 'Test automation handlers registered');
        }
    }

    /**
     * Remove all IPC handlers (cleanup)
     */
    removeAll() {
        ipcMain.removeAllListeners();
        this.logger?.info('IPC', 'All IPC handlers removed');
    }
}

module.exports = IPCHandlers;
