/**
 * WindowManager - Handles Electron window creation and management
 */

const { BrowserWindow, Menu, shell, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

class WindowManager {
    constructor(logger, configManager) {
        this.logger = logger;
        this.configManager = configManager;
        this.mainWindow = null;
        this.tray = null;
        this.isQuitting = false;
    }

    /**
     * Create the main application window
     */
    createMainWindow() {
        // Create the browser window
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            },
            icon: path.join(__dirname, '../../assets/icon.png'),
            show: false, // Don't show until ready
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
        });

        // Load the app
        this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

        // Show window when ready to prevent visual flash
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            
            // Focus on window (in case user clicked on dock)
            if (this.mainWindow.isMinimized()) {
                this.mainWindow.restore();
            }
            this.mainWindow.focus();
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Handle window close attempt
        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting) {
                event.preventDefault();

                const minimizeToTray = this.configManager?.get('app.minimize_to_tray', true);

                if (minimizeToTray && this.tray) {
                    this.mainWindow.hide();
                    this.logger?.info('Window', 'Window minimized to system tray');
                } else {
                    this.mainWindow.minimize();
                    this.logger?.info('Window', 'Window minimized to taskbar');
                }
            }
        });

        // Handle external links
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

        // Development tools
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }

        this.logger?.info('Window', 'Main window created');
        return this.mainWindow;
    }

    /**
     * Create application menu
     */
    createMenu() {
        const template = [
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Preferences',
                        accelerator: 'CmdOrCtrl+,',
                        click: () => {
                            this.mainWindow?.webContents.send('navigate-to-tab', 'config');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Export Configuration...',
                        click: () => {
                            this.mainWindow?.webContents.send('export-config-from-menu');
                        }
                    },
                    {
                        label: 'Import Configuration...',
                        click: () => {
                            this.mainWindow?.webContents.send('import-config-from-menu');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Quit',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            // Use proper app quit instead of just window close
                            const { app } = require('electron');
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
                label: 'Services',
                submenu: [
                    {
                        label: 'Reconnect All',
                        click: () => {
                            this.mainWindow?.webContents.send('reconnect-all-services');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Discord',
                        submenu: [
                            {
                                label: 'Connect',
                                click: () => {
                                    this.mainWindow?.webContents.send('service-action', 'discord', 'connect');
                                }
                            },
                            {
                                label: 'Disconnect',
                                click: () => {
                                    this.mainWindow?.webContents.send('service-action', 'discord', 'disconnect');
                                }
                            }
                        ]
                    },
                    {
                        label: 'Roon',
                        submenu: [
                            {
                                label: 'Connect',
                                click: () => {
                                    this.mainWindow?.webContents.send('service-action', 'roon', 'connect');
                                }
                            },
                            {
                                label: 'Disconnect',
                                click: () => {
                                    this.mainWindow?.webContents.send('service-action', 'roon', 'disconnect');
                                }
                            }
                        ]
                    }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'close' }
                ]
            },
            {
                label: 'Help',
                submenu: [
                    {
                        label: 'Setup',
                        click: () => {
                            this.mainWindow?.webContents.send('navigate-to-tab', 'help');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'About',
                        click: () => {
                            shell.openExternal('https://github.com/LGGGreg/roon-discord-publish');
                        }
                    }
                ]
            }
        ];

        // macOS specific menu adjustments
        if (process.platform === 'darwin') {
            template.unshift({
                label: 'Roon Discord',
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            });

            // Window menu
            template[5].submenu = [
                { role: 'close' },
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' }
            ];
        }

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
        
        this.logger?.info('Window', 'Application menu created');
    }

    /**
     * Create system tray
     */
    createTray() {
        try {
            // Check if tray should be enabled
            const minimizeToTray = this.configManager?.get('app.minimize_to_tray', true);
            if (!minimizeToTray) {
                this.logger?.info('Window', 'System tray disabled in configuration');
                return;
            }

            // Use the existing PNG icon for the tray
            const iconPath = path.join(__dirname, '../../assets/icon.png');

            if (!fs.existsSync(iconPath)) {
                this.logger?.warn('Window', 'Tray icon not found at:', iconPath);
                return;
            }

            // Create the tray icon
            const icon = nativeImage.createFromPath(iconPath);

            // Resize icon for tray (16x16 on Windows/Linux, 22x22 on macOS)
            const trayIcon = icon.resize({ width: 16, height: 16 });

            this.tray = new Tray(trayIcon);

            // Set tooltip
            this.tray.setToolTip('Roon Discord Rich Presence');

            // Create context menu
            const contextMenu = Menu.buildFromTemplate([
                {
                    label: 'Show',
                    click: () => {
                        this.show();
                    }
                },
                {
                    label: 'Hide',
                    click: () => {
                        this.hide();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Settings',
                    click: () => {
                        this.show();
                        // Switch to config tab
                        this.mainWindow?.webContents.send('navigate-to-tab', 'config');
                    }
                },
                { type: 'separator' },
                {
                    label: 'About',
                    click: () => {
                        dialog.showMessageBox(this.mainWindow, {
                            type: 'info',
                            title: 'About',
                            message: 'Roon Discord Rich Presence',
                            detail: 'A bridge between Roon and Discord to show your music status.\n\nVersion: 0.7.0'
                        });
                    }
                },
                {
                    label: 'Quit',
                    click: () => {
                        this.quit();
                    }
                }
            ]);

            this.tray.setContextMenu(contextMenu);

            // Handle tray click (show/hide window)
            this.tray.on('click', () => {
                if (this.mainWindow) {
                    if (this.mainWindow.isVisible()) {
                        this.hide();
                    } else {
                        this.show();
                    }
                }
            });

            this.logger?.info('Window', 'System tray created successfully');

        } catch (error) {
            this.logger?.error('Window', `Failed to create system tray: ${error.message}`);
        }
    }

    /**
     * Show the main window
     */
    show() {
        if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) {
                this.mainWindow.restore();
            }
            this.mainWindow.show();
            this.mainWindow.focus();
        }
    }

    /**
     * Hide the main window
     */
    hide() {
        if (this.mainWindow) {
            this.mainWindow.hide();
        }
    }

    /**
     * Get the main window instance
     */
    getMainWindow() {
        return this.mainWindow;
    }

    /**
     * Quit the application
     */
    quit() {
        this.isQuitting = true;

        // Destroy tray
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }

        if (this.mainWindow) {
            this.mainWindow.close();
        }
    }

    /**
     * Check if the application is quitting
     */
    isAppQuitting() {
        return this.isQuitting;
    }
}

module.exports = WindowManager;
