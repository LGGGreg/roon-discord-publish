/**
 * WindowManager - Handles Electron window creation and management
 */

const { BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

class WindowManager {
    constructor(logger) {
        this.logger = logger;
        this.mainWindow = null;
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
                this.mainWindow.hide();
                
                if (process.platform === 'darwin') {
                    // On macOS, keep app running in dock
                    this.logger?.info('Window', 'Window hidden, app still running');
                } else {
                    // On Windows/Linux, minimize to system tray if available
                    this.logger?.info('Window', 'Window minimized to system tray');
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
                            this.mainWindow?.webContents.send('show-preferences');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Quit',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            this.quit();
                        }
                    }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' }
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
                        label: 'About',
                        click: () => {
                            this.mainWindow?.webContents.send('show-about');
                        }
                    },
                    {
                        label: 'Learn More',
                        click: () => {
                            shell.openExternal('https://github.com/your-repo/roon-discord');
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
