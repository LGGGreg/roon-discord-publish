const { app, shell, ipcMain } = require('electron');
const path = require('path');

// Import our modular components
const WindowManager = require('./WindowManager');
const IPCHandlers = require('./IPCHandlers');
const ServiceCoordinator = require('./ServiceCoordinator');
const Logger = require('../utils/Logger');

// Global instances
let windowManager;
let serviceCoordinator;
let ipcHandlers;
let logger;

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
    require('electron-reload')(__dirname, {
        electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron'),
        hardResetMethod: 'exit'
    });
}

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        // Initialize logger
        logger = new Logger();
        logger.info('App', 'Starting Roon Discord Rich Presence...');

        // Initialize window manager
        windowManager = new WindowManager(logger);

        // Initialize service coordinator
        serviceCoordinator = new ServiceCoordinator(logger, windowManager);
        await serviceCoordinator.initialize();

        // Initialize IPC handlers
        ipcHandlers = new IPCHandlers(
            serviceCoordinator.getServices(),
            logger,
            windowManager,
            serviceCoordinator.getConfigManager()
        );
        ipcHandlers.registerAll();

        // Create main window and menu
        windowManager.createMainWindow();
        windowManager.createMenu();

        // Start services
        await serviceCoordinator.startServices();

        logger.info('App', 'Application initialized successfully');
        return true;

    } catch (error) {
        console.error('Failed to initialize application:', error);
        logger?.error('App', `Initialization failed: ${error.message}`);
        return false;
    }
}

// Legacy functions removed - functionality moved to WindowManager

// Legacy help window function removed

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

// All event handlers and service initialization moved to ServiceCoordinator

// All service event handlers moved to ServiceCoordinator

// All remaining event handlers and service initialization moved to ServiceCoordinator

// All Discord update logic moved to ServiceCoordinator

// All Discord update functions moved to ServiceCoordinator

// All helper functions moved to ServiceCoordinator and ServiceUtils

// App event handlers
app.whenReady().then(async () => {
    const success = await initializeApp();
    if (!success) {
        console.error('Failed to initialize application');
        app.quit();
    }

    app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (windowManager) {
            windowManager.show();
        }
    });
});

app.on('window-all-closed', () => {
    // With tray functionality, don't quit when all windows are closed
    // The app will continue running in the system tray
    if (process.platform !== 'darwin') {
        // On Windows/Linux, keep running in background
        return;
    }
    // On macOS, quit when all windows closed
    app.quit();
});

app.on('before-quit', async () => {
    if (windowManager) {
        windowManager.quit();
    }

    // Stop all services
    if (serviceCoordinator) {
        await serviceCoordinator.cleanup();
    }

    // Remove IPC handlers
    if (ipcHandlers) {
        ipcHandlers.removeAll();
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

// Help window functionality moved to WindowManager
ipcMain.handle('open-help-window', async (event, section) => {
    try {
        // TODO: Implement help window in WindowManager
        console.log('Help window functionality needs to be implemented in WindowManager');
        return { success: false, error: 'Help window not yet implemented in refactored version' };
    } catch (error) {
        console.error('Failed to open help window:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('close-help-window', async (event) => {
    try {
        // TODO: Implement help window in WindowManager
        return { success: true };
    } catch (error) {
        console.error('Failed to close help window:', error);
        return { success: false, error: error.message };
    }
});

// Configuration IPC handlers moved to IPCHandlers class

// File dialog handlers moved to IPCHandlers class

// General IPC handlers moved to IPCHandlers class

// File system handlers moved to IPCHandlers class

// All service IPC handlers moved to IPCHandlers class

// Service management IPC handlers moved to IPCHandlers class

// All remaining IPC handlers moved to IPCHandlers class

// Helper functions moved to ServiceUtils

// All monitoring and debug IPC handlers moved to IPCHandlers class

// All debug IPC handlers moved to IPCHandlers class

// All helper functions moved to ServiceUtils and ServiceCoordinator

// All service status IPC handlers moved to IPCHandlers class

// All test automation IPC handlers moved to IPCHandlers class
