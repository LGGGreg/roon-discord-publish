const { app, BrowserWindow, Menu, Tray, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Import our core services
const ConfigManager = require('../core/ConfigManager');
const DiscordService = require('../core/DiscordService');
const RoonService = require('../core/RoonService');
const Logger = require('../utils/Logger');

// Keep a global reference of the window object
let mainWindow;
let tray = null;
let isQuitting = false;

// Initialize core services
let configManager;
let discordService;
let roonService;
let logger;

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
    require('electron-reload')(__dirname, {
        electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron'),
        hardResetMethod: 'exit'
    });
}

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        icon: path.join(__dirname, '../../assets/icon.svg'),
        show: false, // Don't show until ready
        titleBarStyle: 'default'
    });

    // Load the index.html of the app
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Open DevTools in development
        if (process.env.NODE_ENV === 'development') {
            mainWindow.webContents.openDevTools();
        }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle minimize to tray (disabled for now)
    mainWindow.on('minimize', (event) => {
        // Tray functionality will be implemented later
        // For now, just minimize normally
    });

    // Handle close (quit app for now, will change when tray is implemented)
    mainWindow.on('close', (event) => {
        // For now, just quit the app
        // Later we'll implement minimize to tray
    });
}

function createTray() {
    // Create tray icon - use a simple built-in icon for now
    // We'll create a proper icon later
    try {
        // Try to create tray with a simple icon
        const iconPath = path.join(__dirname, '../../assets/icon.svg');

        // For now, let's skip the tray if we can't create it
        if (fs.existsSync(iconPath)) {
            // SVG not supported for tray, skip for now
            console.log('Tray icon creation skipped - will implement proper PNG icon later');
            return;
        }
    } catch (error) {
        console.log('Tray creation failed:', error.message);
        return;
    }
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('show-settings');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Connection',
            submenu: [
                {
                    label: 'Reconnect Discord',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('reconnect-discord');
                        }
                    }
                },
                {
                    label: 'Reconnect Roon',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('reconnect-roon');
                        }
                    }
                },
                {
                    label: 'Reconnect All',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('reconnect-all');
                        }
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About',
                            message: 'Roon Discord Rich Presence',
                            detail: 'Version 0.7.0\nA GUI application for displaying Roon playback status in Discord.'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Initialize services
function initializeServices() {
    // Initialize Logger
    logger = new Logger({
        level: process.env.NODE_ENV === 'development' ? Logger.LogLevel.DEBUG : Logger.LogLevel.INFO,
        enableConsole: true,
        enableFile: true,
        enableGui: true
    });

    // Initialize ConfigManager
    configManager = new ConfigManager();

    // Initialize DiscordService
    discordService = new DiscordService(configManager);

    // Initialize RoonService
    roonService = new RoonService(configManager);

    // Set up logger GUI integration
    logger.on('log-entry', (logEntry) => {
        if (mainWindow) {
            mainWindow.webContents.send('log-entry', logEntry);
        }
    });

    // Listen for config events
    configManager.on('config-loaded', (config) => {
        logger.info('Config', 'Configuration loaded');
        if (mainWindow) {
            mainWindow.webContents.send('config-loaded', config);
        }
    });

    configManager.on('config-saved', (config) => {
        logger.info('Config', 'Configuration saved');
        if (mainWindow) {
            mainWindow.webContents.send('config-saved', config);
        }
    });

    configManager.on('config-error', (error) => {
        logger.error('Config', 'Configuration error', error.message);
        if (mainWindow) {
            mainWindow.webContents.send('config-error', error.message);
        }
    });

    // Set up Discord service events
    discordService.on('state-changed', (event) => {
        logger.info('Discord', `State: ${event.oldState} -> ${event.newState}`, {
            details: event.details,
            error: event.error?.message
        });

        if (mainWindow) {
            mainWindow.webContents.send('service-status-changed', {
                service: 'discord',
                status: event.newState,
                details: event.details,
                error: event.error?.message
            });
        }
    });

    discordService.on('discord-ready', (user) => {
        logger.info('Discord', `Ready for user: ${user.username}#${user.discriminator}`, user);
        if (mainWindow) {
            mainWindow.webContents.send('discord-ready', user);
        }
    });

    discordService.on('activity-set', (activity) => {
        logger.info('Discord', 'Activity set', activity);
        if (mainWindow) {
            mainWindow.webContents.send('discord-activity-set', activity);
        }
    });

    discordService.on('activity-error', (error) => {
        logger.error('Discord', 'Activity error', error.message);
        if (mainWindow) {
            mainWindow.webContents.send('discord-activity-error', error.message);
        }
    });

    // Set up Roon service events
    roonService.on('state-changed', (event) => {
        logger.info('Roon', `State: ${event.oldState} -> ${event.newState}`, {
            details: event.details,
            error: event.error?.message
        });

        if (mainWindow) {
            mainWindow.webContents.send('service-status-changed', {
                service: 'roon',
                status: event.newState,
                details: event.details,
                error: event.error?.message
            });
        }
    });

    roonService.on('core-paired', (core) => {
        logger.info('Roon', `Core paired: ${core.display_name}`, {
            core_id: core.core_id,
            display_name: core.display_name,
            display_version: core.display_version
        });
        if (mainWindow) {
            mainWindow.webContents.send('roon-core-paired', core);
        }
    });

    roonService.on('zones-updated', (zones) => {
        logger.info('Roon', `Zones updated: ${zones.length} zones available`);
        if (mainWindow) {
            mainWindow.webContents.send('roon-zones-updated', zones);
        }
    });

    roonService.on('zone-selected', (zone) => {
        logger.info('Roon', `Zone selected: ${zone.display_name}`);
        if (mainWindow) {
            mainWindow.webContents.send('roon-zone-selected', zone);
        }
    });

    roonService.on('track-changed', (track) => {
        const trackInfo = roonService.getCurrentTrack();
        logger.info('Roon', `Track changed: ${trackInfo?.title || 'Unknown'}`, {
            title: trackInfo?.title,
            artist: trackInfo?.artist,
            album: trackInfo?.album,
            zoneName: trackInfo?.zoneName
        });

        if (mainWindow) {
            mainWindow.webContents.send('roon-track-changed', trackInfo);
        }

        // Update Discord activity if Discord is connected
        if (discordService && discordService.isConnected() && trackInfo) {
            discordService.setTrackActivity({
                title: trackInfo.title,
                artist: trackInfo.artist,
                album: trackInfo.album,
                zoneName: trackInfo.zoneName,
                duration: trackInfo.duration,
                position: trackInfo.position
            }).then(success => {
                if (success) {
                    logger.info('Discord', 'Activity updated from Roon track change');
                } else {
                    logger.warn('Discord', 'Failed to update activity from Roon track change');
                }
            });
        }
    });

    // Start services
    logger.info('System', 'Starting Discord service...');
    discordService.reconnect(true).then(success => {
        if (success) {
            logger.info('Discord', 'Initial connection successful');
        } else {
            logger.warn('Discord', 'Initial connection failed, will retry automatically');
        }
    });

    logger.info('System', 'Starting Roon service...');
    roonService.reconnect(true).then(success => {
        if (success) {
            logger.info('Roon', 'Initial connection successful');
        } else {
            logger.warn('Roon', 'Initial connection failed, will retry automatically');
        }
    });
}

// App event handlers
app.whenReady().then(() => {
    initializeServices();
    createWindow();
    createTray();
    createMenu();

    app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
        }
    });
});

app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
});

// Configuration IPC handlers
ipcMain.handle('config-get-all', () => {
    return configManager ? configManager.getAll() : {};
});

ipcMain.handle('config-get', (event, path, defaultValue) => {
    return configManager ? configManager.get(path, defaultValue) : defaultValue;
});

ipcMain.handle('config-set', (event, path, value, save = false) => {
    return configManager ? configManager.set(path, value, save) : false;
});

ipcMain.handle('config-save', (event, newConfig = null) => {
    return configManager ? configManager.saveConfig(newConfig) : false;
});

ipcMain.handle('config-validate', () => {
    return configManager ? configManager.validate() : { isValid: false, errors: ['ConfigManager not initialized'] };
});

ipcMain.handle('config-reset', (event, preserveRoonPairing = true) => {
    return configManager ? configManager.reset(preserveRoonPairing) : false;
});

ipcMain.handle('config-export', (event, includeSecrets = false) => {
    return configManager ? configManager.export(includeSecrets) : '{}';
});

ipcMain.handle('config-import', (event, jsonConfig, merge = true) => {
    return configManager ? configManager.import(jsonConfig, merge) : false;
});

// File dialog handlers for import/export
ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Configuration',
        defaultPath: 'roon-discord-config.json',
        filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        ...options
    });
    return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Configuration',
        filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile'],
        ...options
    });
    return result;
});

// General IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('show-error-dialog', async (event, title, content) => {
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: title,
        message: content,
        buttons: ['OK']
    });
    return result;
});

ipcMain.handle('show-info-dialog', async (event, title, content) => {
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: title,
        message: content,
        buttons: ['OK']
    });
    return result;
});

ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing file:', error);
        return false;
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
});

// Discord service IPC handlers
ipcMain.handle('discord-connect', async () => {
    if (!discordService) return false;
    logger.info('Discord', 'Manual connection requested');
    return await discordService.reconnect(true);
});

ipcMain.handle('discord-disconnect', async () => {
    if (!discordService) return false;
    logger.info('Discord', 'Manual disconnection requested');
    return await discordService.disconnect();
});

ipcMain.handle('discord-status', () => {
    if (!discordService) return null;
    return discordService.getStats();
});

ipcMain.handle('discord-set-activity', async (event, trackInfo) => {
    if (!discordService) return false;
    logger.info('Discord', 'Setting activity from GUI', trackInfo);
    return await discordService.setTrackActivity(trackInfo);
});

ipcMain.handle('discord-clear-activity', async () => {
    if (!discordService) return false;
    logger.info('Discord', 'Clearing activity from GUI');
    return await discordService.clearActivity();
});

// Roon service IPC handlers
ipcMain.handle('roon-connect', async () => {
    if (!roonService) return false;
    logger.info('Roon', 'Manual connection requested');
    return await roonService.reconnect(true);
});

ipcMain.handle('roon-disconnect', async () => {
    if (!roonService) return false;
    logger.info('Roon', 'Manual disconnection requested');
    return await roonService.disconnect();
});

ipcMain.handle('roon-status', () => {
    if (!roonService) return null;
    return roonService.getStats();
});

ipcMain.handle('roon-get-zones', () => {
    if (!roonService) return [];
    return roonService.getZones();
});

ipcMain.handle('roon-set-zone', async (event, zoneId) => {
    if (!roonService) return false;
    logger.info('Roon', `Setting zone to: ${zoneId}`);
    return roonService.setCurrentZone(zoneId);
});

ipcMain.handle('roon-get-current-track', () => {
    if (!roonService) return null;
    return roonService.getCurrentTrack();
});

// Service management IPC handlers
ipcMain.handle('service-reconnect-all', async () => {
    logger.info('System', 'Reconnecting all services');
    const results = {};

    if (discordService) {
        results.discord = await discordService.reconnect(true);
    }

    if (roonService) {
        results.roon = await roonService.reconnect(true);
    }

    return results;
});

ipcMain.handle('service-get-all-status', () => {
    const status = {};

    if (discordService) {
        status.discord = discordService.getStats();
    }

    if (roonService) {
        status.roon = roonService.getStats();
    }

    return status;
});

// Request service status (for initial load)
ipcMain.handle('request-service-status', () => {
    console.log('Frontend requested service status');

    // Send current status to renderer
    if (mainWindow) {
        if (discordService) {
            const discordStats = discordService.getStats();
            console.log('Sending Discord status:', discordStats);
            mainWindow.webContents.send('service-status-changed', {
                service: 'discord',
                status: discordStats.state,
                details: discordStats.details || 'Connection established',
                error: discordStats.lastError
            });
        }

        if (roonService) {
            const roonStats = roonService.getStats();
            console.log('Sending Roon status:', roonStats);
            mainWindow.webContents.send('service-status-changed', {
                service: 'roon',
                status: roonStats.state,
                details: roonStats.details || 'Connecting to Roon Core...',
                error: roonStats.lastError
            });
        }

        // Send default status for services not yet implemented
        mainWindow.webContents.send('service-status-changed', {
            service: 'spotify',
            status: 'disconnected',
            details: 'Not connected to Spotify API',
            error: null
        });

        mainWindow.webContents.send('service-status-changed', {
            service: 'imgur',
            status: 'disconnected',
            details: 'Not connected to Imgur API',
            error: null
        });
    }

    return true;
});
