const { app, BrowserWindow, Menu, Tray, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;
let tray = null;
let isQuitting = false;

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

// App event handlers
app.whenReady().then(() => {
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

// IPC handlers will be added here as we develop the app
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
