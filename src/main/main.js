const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Import our core services
const ConfigManager = require('../core/ConfigManager');
const DiscordService = require('../core/DiscordService');
const RoonService = require('../core/RoonService');
const SpotifyService = require('../core/SpotifyService');
const ImgurService = require('../core/ImgurService');
const StatusMonitor = require('../core/StatusMonitor');
const DebugManager = require('../core/DebugManager');
const Logger = require('../utils/Logger');

// Keep a global reference of the window object
let mainWindow;
let helpWindow;
let tray = null;
let isQuitting = false;

// Initialize core services
let configManager;
let discordService;
let roonService;
let spotifyService;
let imgurService;
let statusMonitor;
let debugManager;
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
        icon: path.join(__dirname, '../../assets/icon.png'),
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

    // Handle minimize to tray
    mainWindow.on('minimize', (event) => {
        if (tray && configManager.get('app.minimize_to_tray', true)) {
            // Hide window instead of minimizing to taskbar
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Handle close - minimize to tray instead of quitting
    mainWindow.on('close', (event) => {
        if (!isQuitting && tray) {
            // Prevent the window from closing and hide it instead
            event.preventDefault();
            mainWindow.hide();

            // Show notification on first minimize (optional)
            if (process.platform === 'win32') {
                tray.displayBalloon({
                    iconType: 'info',
                    title: 'Roon Discord Rich Presence',
                    content: 'Application was minimized to tray'
                });
            }
        }
    });
}

function createHelpWindow() {
    // Don't create multiple help windows
    if (helpWindow) {
        helpWindow.focus();
        return;
    }

    helpWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, '../../assets/icon.png'),
        title: 'Help - Roon Discord Rich Presence',
        parent: mainWindow,
        modal: false,
        show: false,
        resizable: true,
        minimizable: true,
        maximizable: true
    });

    // Load the help page
    helpWindow.loadFile(path.join(__dirname, '../renderer/help.html'));

    // Show when ready
    helpWindow.once('ready-to-show', () => {
        helpWindow.show();
    });

    // Clean up reference when closed
    helpWindow.on('closed', () => {
        helpWindow = null;
    });
}

function createTray() {
    try {
        // Use the existing PNG icon for the tray
        const iconPath = path.join(__dirname, '../../assets/icon.png');

        if (!fs.existsSync(iconPath)) {
            console.log('Tray icon not found at:', iconPath);
            return;
        }

        // Create the tray icon
        const icon = nativeImage.createFromPath(iconPath);

        // Resize icon for tray (16x16 on Windows/Linux, 22x22 on macOS)
        const trayIcon = icon.resize({ width: 16, height: 16 });

        tray = new Tray(trayIcon);

        // Set tooltip
        tray.setToolTip('Roon Discord Rich Presence');

        // Create context menu
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            {
                label: 'Hide',
                click: () => {
                    if (mainWindow) {
                        mainWindow.hide();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Settings',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                        // Switch to config tab
                        mainWindow.webContents.send('switch-tab', 'config');
                    }
                }
            },
            {
                label: 'Help',
                click: () => {
                    createHelpWindow();
                }
            },
            { type: 'separator' },
            {
                label: 'About',
                click: () => {
                    dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'About',
                        message: 'Roon Discord Rich Presence',
                        detail: 'A bridge between Roon and Discord to show your music status.\n\nVersion: 1.0.0'
                    });
                }
            },
            {
                label: 'Quit',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setContextMenu(contextMenu);

        // Handle tray click (show/hide window)
        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        });

        console.log('✅ System tray created successfully');

    } catch (error) {
        console.error('❌ Failed to create system tray:', error.message);
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

    // Initialize SpotifyService
    spotifyService = new SpotifyService(configManager);

    // Initialize ImgurService
    imgurService = new ImgurService(configManager);

    // Initialize StatusMonitor
    statusMonitor = new StatusMonitor(logger);

    // Initialize DebugManager
    debugManager = new DebugManager(logger);

    // Enable debug mode in development
    if (process.env.NODE_ENV === 'development') {
        debugManager.enableDebugMode({
            enableVerboseLogging: true,
            enablePerformanceTracking: true,
            enableNetworkDiagnostics: true
        });
    }

    // Register all services with the status monitor
    statusMonitor.registerService('discord', discordService);
    statusMonitor.registerService('roon', roonService);
    statusMonitor.registerService('spotify', spotifyService);
    statusMonitor.registerService('imgur', imgurService);

    // Start monitoring
    statusMonitor.startMonitoring();

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

    roonService.on('track-changed', (trackInfo) => {
        console.log('Main process received track-changed event:', JSON.stringify(trackInfo, null, 2));

        logger.info('Roon', `Track changed: ${trackInfo?.title || 'Unknown'}`, {
            title: trackInfo?.title,
            artist: trackInfo?.artist,
            album: trackInfo?.album,
            zoneName: trackInfo?.zoneName,
            image_key: trackInfo?.image_key
        });

        if (mainWindow) {
            // Get album art URL for frontend display
            getAlbumArtForTrack(trackInfo).then(albumArtUrl => {
                const trackInfoWithArt = {
                    ...trackInfo,
                    albumArt: albumArtUrl
                };
                mainWindow.webContents.send('roon-track-changed', trackInfoWithArt);
            }).catch(error => {
                console.error('Error getting album art:', error);
                mainWindow.webContents.send('roon-track-changed', trackInfo);
            });
        }

        // Update Discord activity if Discord is connected
        if (discordService && discordService.isConnected() && trackInfo) {
            updateDiscordActivityWithEnhancements(trackInfo);
        }
    });

    // Listen for track position changes (seek updates)
    roonService.on('track-position-changed', (trackInfo) => {
        // Update Discord activity with new position (but rate limited)
        if (discordService && discordService.isConnected() && trackInfo) {
            updateDiscordActivityWithEnhancements(trackInfo, true); // true = isPositionUpdate
        }

        // Send position update to frontend (less frequently to avoid spam)
        if (mainWindow && trackInfo) {
            const trackInfoWithArt = {
                ...trackInfo,
                albumArt: trackInfo.albumArt || null
            };
            mainWindow.webContents.send('roon-track-position-changed', trackInfoWithArt);
        }
    });

    // Set up Spotify service events
    spotifyService.on('state-changed', (event) => {
        logger.info('Spotify', `State: ${event.oldState} -> ${event.newState}`, {
            details: event.details,
            error: event.error?.message
        });

        if (mainWindow) {
            mainWindow.webContents.send('service-status-changed', {
                service: 'spotify',
                status: event.newState,
                details: event.details,
                error: event.error?.message
            });
        }
    });

    // Set up Imgur service events
    imgurService.on('state-changed', (event) => {
        logger.info('Imgur', `State: ${event.oldState} -> ${event.newState}`, {
            details: event.details,
            error: event.error?.message
        });

        if (mainWindow) {
            mainWindow.webContents.send('service-status-changed', {
                service: 'imgur',
                status: event.newState,
                details: event.details,
                error: event.error?.message
            });
        }
    });

    // Set up StatusMonitor events (performance monitoring only)
    statusMonitor.on('service-performance-checked', (serviceName, performanceData) => {
        if (mainWindow) {
            mainWindow.webContents.send('service-performance-checked', {
                service: serviceName,
                ...performanceData
            });
        }
    });

    statusMonitor.on('performance-alert', (serviceName, alert) => {
        logger.warn('StatusMonitor', `Performance Alert for ${serviceName}: ${alert.message}`, alert);
        if (mainWindow) {
            mainWindow.webContents.send('performance-alert', {
                service: serviceName,
                ...alert
            });
        }
    });

    statusMonitor.on('health-check-completed', (overallStatus) => {
        if (mainWindow) {
            mainWindow.webContents.send('health-check-completed', overallStatus);
        }
    });

    // Set up DebugManager events
    debugManager.on('debug-mode-enabled', (config) => {
        logger.info('DebugManager', 'Debug mode enabled', config);
        if (mainWindow) {
            mainWindow.webContents.send('debug-mode-changed', { enabled: true, config });
        }
    });

    debugManager.on('debug-mode-disabled', (info) => {
        logger.info('DebugManager', 'Debug mode disabled', info);
        if (mainWindow) {
            mainWindow.webContents.send('debug-mode-changed', { enabled: false, info });
        }
    });

    debugManager.on('performance-marker-completed', (performance) => {
        if (mainWindow) {
            mainWindow.webContents.send('debug-performance-marker', performance);
        }
    });

    debugManager.on('error-diagnostics-added', (errorDiagnostic) => {
        if (mainWindow) {
            mainWindow.webContents.send('debug-error-added', errorDiagnostic);
        }
    });

    debugManager.on('diagnostic-report-generated', (reportInfo) => {
        logger.info('DebugManager', 'Diagnostic report generated', reportInfo.path);
        if (mainWindow) {
            mainWindow.webContents.send('debug-report-generated', reportInfo);
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

    logger.info('System', 'Starting Spotify service...');
    spotifyService.reconnect(true).then(success => {
        if (success) {
            logger.info('Spotify', 'Initial connection successful');
        } else {
            logger.warn('Spotify', 'Initial connection failed, will retry automatically');
        }
    });

    logger.info('System', 'Starting Imgur service...');
    imgurService.reconnect(true).then(success => {
        if (success) {
            logger.info('Imgur', 'Initial connection successful');
        } else {
            logger.warn('Imgur', 'Initial connection failed, will retry automatically');
        }
    });
}

// Debouncing and race condition prevention for Discord updates
let discordUpdateTimeout = null;
let isUpdatingDiscord = false;
let lastDiscordUpdate = 0;

/**
 * Update Discord activity with Spotify and Imgur enhancements
 */
async function updateDiscordActivityWithEnhancements(trackInfo, isPositionUpdate = false) {
    // Prevent multiple simultaneous updates
    if (isUpdatingDiscord) {
        console.log('Discord: Update already in progress, skipping');
        return;
    }

    // For position updates, debounce more aggressively
    if (isPositionUpdate) {
        const now = Date.now();
        if (now - lastDiscordUpdate < 15000) { // 15 seconds for position updates
            console.log('Discord: Position update rate limited, skipping');
            return;
        }
    }

    // Clear any pending timeout
    if (discordUpdateTimeout) {
        clearTimeout(discordUpdateTimeout);
        discordUpdateTimeout = null;
    }

    // For position updates, add a small delay to allow for rapid changes to settle
    if (isPositionUpdate) {
        discordUpdateTimeout = setTimeout(() => {
            performDiscordUpdate(trackInfo);
        }, 1000);
        return;
    }

    // For track changes, update immediately
    await performDiscordUpdate(trackInfo);
}

/**
 * Perform the actual Discord update
 */
async function performDiscordUpdate(trackInfo) {
    if (isUpdatingDiscord) {
        return;
    }

    isUpdatingDiscord = true;
    lastDiscordUpdate = Date.now();
    try {
        let spotifyUrl = '';
        let largeImageUrl = '';
        let smallImageUrl = '';

        // Get Spotify URL if Spotify service is connected
        if (spotifyService && spotifyService.isConnected() && trackInfo.title && trackInfo.artist) {
            try {
                spotifyUrl = await spotifyService.searchTrack(trackInfo.title, trackInfo.artist, trackInfo.album);
                if (spotifyUrl) {
                    logger.info('Spotify', `Found Spotify URL for ${trackInfo.title}`);
                }
            } catch (error) {
                logger.warn('Spotify', `Failed to get Spotify URL: ${error.message}`);
            }
        }

        // Get album art URLs if Imgur service is connected and we have image keys
        // If Imgur is not connected yet, skip the retry to avoid race conditions
        if (imgurService && !imgurService.isConnected() && trackInfo.image_key) {
            console.log(`Imgur is not connected yet (state: ${imgurService.state}), using fallback images`);
            // Don't schedule a retry here to avoid race conditions
        }

        if (imgurService && imgurService.isConnected() && roonService && roonService.image) {
            try {
                // Upload album art (large image)
                if (trackInfo.image_key) {
                    console.log('Imgur: Uploading album art for', trackInfo.title, 'with image key:', trackInfo.image_key);

                    const largeImageResult = await imgurService.uploadRoonImage(roonService.image, trackInfo.image_key, {
                        scale: 'fit',
                        width: 512,
                        height: 512,
                        format: 'image/jpeg'
                    });

                    if (largeImageResult && largeImageResult.url) {
                        largeImageUrl = largeImageResult.url;
                        logger.info('Imgur', `Uploaded album art for ${trackInfo.title}: ${largeImageUrl}`);
                    }
                }

                // Upload artist art (small image) if available
                if (trackInfo.artist_image_key) {
                    console.log('Imgur: Uploading artist art for', trackInfo.artist, 'with image key:', trackInfo.artist_image_key);

                    const smallImageResult = await imgurService.uploadRoonImage(roonService.image, trackInfo.artist_image_key, {
                        scale: 'fit',
                        width: 256,
                        height: 256,
                        format: 'image/jpeg'
                    });

                    if (smallImageResult && smallImageResult.url) {
                        smallImageUrl = smallImageResult.url;
                        logger.info('Imgur', `Uploaded artist art for ${trackInfo.artist}: ${smallImageUrl}`);
                    }
                } else {
                    // Fallback: use album art for small image if no artist art available
                    console.log('Imgur: No artist art available, using album art for small image');
                    smallImageUrl = largeImageUrl;
                }
            } catch (error) {
                logger.warn('Imgur', `Failed to upload images: ${error.message}`);
                console.error('Imgur upload error details:', error);
            }
        }

        // Set Discord activity with enhancements
        const success = await discordService.setTrackActivity({
            title: trackInfo.title,
            artist: trackInfo.artist,
            album: trackInfo.album,
            zoneName: trackInfo.zoneName,
            duration: trackInfo.duration,
            position: trackInfo.position,
            spotifyUrl: spotifyUrl,
            largeImageUrl: largeImageUrl,
            smallImageUrl: smallImageUrl
        });

        if (success) {
            logger.info('Discord', 'Enhanced activity updated from Roon track change', {
                hasSpotifyUrl: !!spotifyUrl,
                hasLargeImage: !!largeImageUrl,
                hasSmallImage: !!smallImageUrl
            });
        } else {
            logger.warn('Discord', 'Failed to update enhanced activity from Roon track change');
        }

    } catch (error) {
        logger.error('Discord', 'Error updating enhanced activity', error.message);

        // Fallback to basic activity
        try {
            await discordService.setTrackActivity({
                title: trackInfo.title,
                artist: trackInfo.artist,
                album: trackInfo.album,
                zoneName: trackInfo.zoneName,
                duration: trackInfo.duration,
                position: trackInfo.position
            });
            logger.info('Discord', 'Fallback activity set successfully');
        } catch (fallbackError) {
            logger.error('Discord', 'Fallback activity also failed', fallbackError.message);
        }
    } finally {
        // Always reset the update flag
        isUpdatingDiscord = false;
    }
}

/**
 * Get default status details based on service and state
 */
function getDefaultStatusDetails(service, state) {
    switch (state) {
        case 'disconnected':
            return `Not connected to ${service.charAt(0).toUpperCase() + service.slice(1)}`;
        case 'connecting':
            return service === 'roon' ? 'Searching for Roon Core...' : 'Attempting to connect...';
        case 'connected':
            return 'Connection established';
        case 'reconnecting':
            return 'Reconnecting...';
        case 'error':
            return 'Connection failed';
        default:
            return '';
    }
}

/**
 * Get album art URL for track display in frontend
 */
async function getAlbumArtForTrack(trackInfo) {
    const imageKey = trackInfo?.image_key || trackInfo?.imageKey;
    console.log('getAlbumArtForTrack called with:', trackInfo?.title, imageKey);
    console.log('roonService available:', !!roonService);
    console.log('roonService.image available:', !!roonService?.image);

    if (!trackInfo || !imageKey || !roonService || !roonService.image) {
        console.log('getAlbumArtForTrack: Missing required data, returning null');
        console.log('  trackInfo:', !!trackInfo);
        console.log('  imageKey:', imageKey);
        console.log('  roonService:', !!roonService);
        console.log('  roonService.image:', !!roonService?.image);
        return null;
    }

    try {
        console.log('Getting album art for frontend display, image key:', imageKey);

        // Get image from Roon as data URL for frontend display
        const imageData = await new Promise((resolve, reject) => {
            roonService.image.get_image(imageKey, {
                scale: 'fit',
                width: 300,
                height: 300,
                format: 'image/jpeg'
            }, (error, contentType, image) => {
                if (error || !image) {
                    reject(new Error('Failed to get image from Roon'));
                    return;
                }
                resolve({ contentType, image });
            });
        });

        // Convert to data URL for frontend display
        const base64Image = imageData.image.toString('base64');
        const dataUrl = `data:${imageData.contentType};base64,${base64Image}`;

        console.log('Album art data URL created for frontend');
        return dataUrl;

    } catch (error) {
        console.error('Error getting album art for frontend:', error);
        return null;
    }
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
    // With tray functionality, don't quit when all windows are closed
    // The app will continue running in the system tray
    // Only quit if explicitly requested or on macOS without tray
    if (process.platform === 'darwin' && !tray) {
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;

    // Destroy tray
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

// System IPC handlers
ipcMain.handle('open-external', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        console.error('Failed to open external URL:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-help-window', async (event, section) => {
    try {
        createHelpWindow();

        // If a section is specified, navigate to it after the window loads
        if (section && helpWindow) {
            helpWindow.webContents.once('did-finish-load', () => {
                helpWindow.webContents.executeJavaScript(`
                    const element = document.getElementById('${section}');
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                `);
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to open help window:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('close-help-window', async (event) => {
    try {
        if (helpWindow) {
            helpWindow.close();
            helpWindow = null;
        }
        return { success: true };
    } catch (error) {
        console.error('Failed to close help window:', error);
        return { success: false, error: error.message };
    }
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

// Spotify service IPC handlers
ipcMain.handle('spotify-connect', async () => {
    if (!spotifyService) return false;
    logger.info('Spotify', 'Manual connection requested');
    return await spotifyService.reconnect(true);
});

ipcMain.handle('spotify-disconnect', async () => {
    if (!spotifyService) return false;
    logger.info('Spotify', 'Manual disconnection requested');
    return await spotifyService.disconnect();
});

ipcMain.handle('spotify-status', () => {
    if (!spotifyService) return null;
    return spotifyService.getStats();
});

ipcMain.handle('spotify-search', async (event, title, artist, album) => {
    if (!spotifyService) return '';
    logger.info('Spotify', `Searching for: ${title} by ${artist}`);
    return await spotifyService.searchTrack(title, artist, album);
});

// Imgur service IPC handlers
ipcMain.handle('imgur-connect', async () => {
    if (!imgurService) return false;
    logger.info('Imgur', 'Manual connection requested');
    return await imgurService.reconnect(true);
});

ipcMain.handle('imgur-disconnect', async () => {
    if (!imgurService) return false;
    logger.info('Imgur', 'Manual disconnection requested');
    return await imgurService.disconnect();
});

ipcMain.handle('imgur-status', () => {
    if (!imgurService) return null;
    return imgurService.getStats();
});

ipcMain.handle('imgur-upload', async (event, imageData, imageKey) => {
    if (!imgurService) return null;
    logger.info('Imgur', `Uploading image: ${imageKey || 'unnamed'}`);
    return await imgurService.uploadImage(imageData, imageKey);
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

// Status Monitor IPC handlers
ipcMain.handle('status-monitor-get-overall', () => {
    if (!statusMonitor) return null;
    return statusMonitor.getOverallStatus();
});

ipcMain.handle('status-monitor-get-service', (event, serviceName) => {
    if (!statusMonitor) return null;
    return statusMonitor.getServiceStatus(serviceName);
});

ipcMain.handle('status-monitor-get-all-metrics', () => {
    if (!statusMonitor) return {};
    return statusMonitor.getAllMetrics();
});

ipcMain.handle('status-monitor-reset-metrics', (event, serviceName) => {
    if (!statusMonitor) return false;
    statusMonitor.resetServiceMetrics(serviceName);
    return true;
});

ipcMain.handle('status-monitor-get-config', () => {
    if (!statusMonitor) return {};
    return statusMonitor.getConfig();
});

ipcMain.handle('status-monitor-update-config', (event, newConfig) => {
    if (!statusMonitor) return false;
    statusMonitor.updateConfig(newConfig);
    return true;
});

ipcMain.handle('status-monitor-start', () => {
    if (!statusMonitor) return false;
    statusMonitor.startMonitoring();
    return true;
});

ipcMain.handle('status-monitor-stop', () => {
    if (!statusMonitor) return false;
    statusMonitor.stopMonitoring();
    return true;
});

// Debug Manager IPC handlers
ipcMain.handle('debug-toggle-mode', (event, options) => {
    if (!debugManager) return false;
    return debugManager.toggleDebugMode(options);
});

ipcMain.handle('debug-enable-mode', (event, options) => {
    if (!debugManager) return false;
    debugManager.enableDebugMode(options);
    return true;
});

ipcMain.handle('debug-disable-mode', () => {
    if (!debugManager) return false;
    debugManager.disableDebugMode();
    return true;
});

ipcMain.handle('debug-get-summary', () => {
    if (!debugManager) return null;
    return debugManager.getDiagnosticsSummary();
});

ipcMain.handle('debug-generate-report', (event, includeSystemInfo, includePerformance) => {
    if (!debugManager) return null;
    return debugManager.generateDiagnosticReport(includeSystemInfo, includePerformance);
});

ipcMain.handle('debug-run-connection-diagnostics', (event, serviceName, connectionInfo) => {
    if (!debugManager) return null;
    return debugManager.runConnectionDiagnostics(serviceName, connectionInfo);
});

ipcMain.handle('debug-clear-diagnostics', () => {
    if (!debugManager) return false;
    debugManager.clearDiagnostics();
    return true;
});

ipcMain.handle('debug-start-performance-marker', (event, name) => {
    if (!debugManager) return false;
    debugManager.startPerformanceMarker(name);
    return true;
});

ipcMain.handle('debug-end-performance-marker', (event, name) => {
    if (!debugManager) return null;
    return debugManager.endPerformanceMarker(name);
});

// Helper function to get service status with credential checking
function getServiceStatusForUI(service, serviceName) {
    const stats = service.getStats();
    let status = stats.state;
    let details = stats.details;

    // Check if service has required credentials
    if (service.canConnect && !service.canConnect()) {
        status = 'error';
        switch (serviceName) {
            case 'discord':
                details = 'Required - Add Discord Client ID in Configuration';
                break;
            case 'spotify':
                details = 'Optional - Add Spotify credentials for enhanced features';
                break;
            case 'imgur':
                details = 'Optional - Add Imgur Client ID for album art sharing';
                break;
            default:
                details = 'Missing required credentials';
        }
    } else if (!details) {
        details = getDefaultStatusDetails(serviceName, status);
    }

    return {
        service: serviceName,
        status: status,
        details: details,
        error: stats.lastError
    };
}

// Request service status (for initial load)
ipcMain.handle('request-service-status', () => {
    console.log('Frontend requested service status');

    // Send current status to renderer
    if (mainWindow) {
        if (discordService) {
            const statusData = getServiceStatusForUI(discordService, 'discord');
            console.log('Sending Discord status:', statusData);
            mainWindow.webContents.send('service-status-changed', statusData);
        }

        if (roonService) {
            const statusData = getServiceStatusForUI(roonService, 'roon');
            console.log('Sending Roon status:', statusData);
            mainWindow.webContents.send('service-status-changed', statusData);
        }

        if (spotifyService) {
            const statusData = getServiceStatusForUI(spotifyService, 'spotify');
            console.log('Sending Spotify status:', statusData);
            mainWindow.webContents.send('service-status-changed', statusData);
        }

        if (imgurService) {
            const statusData = getServiceStatusForUI(imgurService, 'imgur');
            console.log('Sending Imgur status:', statusData);
            mainWindow.webContents.send('service-status-changed', statusData);
        }

        // Send current track state to frontend if available
        if (roonService && roonService.getCurrentTrack) {
            const currentTrack = roonService.getCurrentTrack();
            if (currentTrack && currentTrack.title && currentTrack.title !== '-') {
                console.log('Sending current track to frontend:', currentTrack.title);

                // Get album art and send track info to frontend
                getAlbumArtForTrack(currentTrack).then(albumArtUrl => {
                    const trackInfoWithArt = {
                        ...currentTrack,
                        albumArt: albumArtUrl
                    };
                    mainWindow.webContents.send('roon-track-changed', trackInfoWithArt);
                    console.log('✅ Current track sent to frontend with album art');
                }).catch(error => {
                    console.error('Error getting album art for current track:', error);
                    mainWindow.webContents.send('roon-track-changed', currentTrack);
                    console.log('✅ Current track sent to frontend without album art');
                });
            } else {
                console.log('No current track available to send to frontend');
            }
        }
    }

    return true;
});

// Test automation IPC handlers (only in development)
if (process.env.NODE_ENV === 'development') {
    // Get comprehensive service status for testing
    ipcMain.handle('test-get-all-status', () => {
        const status = {};

        if (discordService) {
            status.discord = discordService.getStats();
        }

        if (roonService) {
            status.roon = roonService.getStats();
        }

        if (spotifyService) {
            status.spotify = spotifyService.getStats();
        }

        if (imgurService) {
            status.imgur = imgurService.getStats();
        }

        return status;
    });

    // Trigger service reconnection for testing
    ipcMain.handle('test-trigger-reconnect', (event, service) => {
        console.log(`Test: Triggering reconnect for ${service}`);

        if (service === 'discord' && discordService) {
            discordService.reconnect(true);
            return { success: true, message: `Discord reconnect triggered` };
        }

        if (service === 'roon' && roonService) {
            roonService.reconnect(true);
            return { success: true, message: `Roon reconnect triggered` };
        }

        if (service === 'spotify' && spotifyService) {
            spotifyService.reconnect(true);
            return { success: true, message: `Spotify reconnect triggered` };
        }

        if (service === 'imgur' && imgurService) {
            imgurService.reconnect(true);
            return { success: true, message: `Imgur reconnect triggered` };
        }

        return { success: false, message: `Unknown service: ${service}` };
    });

    // Get window bounds for screenshot positioning
    ipcMain.handle('test-get-window-bounds', () => {
        if (mainWindow) {
            return mainWindow.getBounds();
        }
        return null;
    });

    // Test activity functions
    ipcMain.handle('test-clear-activity', () => {
        if (discordService) {
            discordService.clearActivity();
            return { success: true, message: 'Discord activity cleared' };
        }
        return { success: false, message: 'Discord service not available' };
    });

    ipcMain.handle('test-set-activity', (event, activity) => {
        if (discordService) {
            discordService.setActivity(activity);
            return { success: true, message: 'Discord activity set' };
        }
        return { success: false, message: 'Discord service not available' };
    });
}
