// IPC Communication Debug Test
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let ipcEvents = [];
let trackEvents = [];

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('src/renderer/index.html');
    
    console.log('🔍 IPC Communication Debug Test Started');
    console.log('📡 Monitoring all IPC events...');
    
    // Monitor all IPC events from renderer
    mainWindow.webContents.on('ipc-message', (event, channel, ...args) => {
        const timestamp = new Date().toLocaleTimeString();
        const eventInfo = {
            timestamp,
            direction: 'RENDERER → MAIN',
            channel,
            args: args.length > 0 ? args : 'no args'
        };
        ipcEvents.push(eventInfo);
        console.log(`📤 [${timestamp}] RENDERER → MAIN: ${channel}`, args.length > 0 ? args : '');
    });
    
    // Monitor all IPC events to renderer
    const originalSend = mainWindow.webContents.send;
    mainWindow.webContents.send = function(channel, ...args) {
        const timestamp = new Date().toLocaleTimeString();
        const eventInfo = {
            timestamp,
            direction: 'MAIN → RENDERER',
            channel,
            args: args.length > 0 ? args : 'no args'
        };
        ipcEvents.push(eventInfo);
        
        // Special tracking for track events
        if (channel === 'roon-track-changed') {
            trackEvents.push({
                timestamp,
                trackInfo: args[0],
                hasAlbumArt: !!(args[0] && args[0].albumArt)
            });
            console.log(`🎵 [${timestamp}] TRACK EVENT:`, {
                title: args[0]?.title || 'NO_TITLE',
                artist: args[0]?.artist || 'NO_ARTIST',
                albumArt: args[0]?.albumArt ? 'HAS_ALBUM_ART' : 'NO_ALBUM_ART'
            });
        }
        
        console.log(`📥 [${timestamp}] MAIN → RENDERER: ${channel}`, args.length > 0 ? args : '');
        return originalSend.call(this, channel, ...args);
    };
    
    // Wait for page to load, then start monitoring
    mainWindow.webContents.once('did-finish-load', () => {
        console.log('✅ Page loaded successfully');
        
        // Check frontend state every 2 seconds
        setInterval(checkFrontendState, 2000);
        
        // Generate report every 10 seconds
        setInterval(generateReport, 10000);
    });
}

async function checkFrontendState() {
    try {
        const frontendState = await mainWindow.webContents.executeJavaScript(`
            (() => {
                const trackTitle = document.getElementById('track-title');
                const trackArtist = document.getElementById('track-artist');
                const albumImage = document.getElementById('album-image');
                
                return {
                    title: trackTitle ? trackTitle.textContent : 'ELEMENT_NOT_FOUND',
                    artist: trackArtist ? trackArtist.textContent : 'ELEMENT_NOT_FOUND',
                    albumArt: albumImage ? {
                        src: albumImage.src,
                        visible: albumImage.style.display !== 'none',
                        naturalWidth: albumImage.naturalWidth,
                        naturalHeight: albumImage.naturalHeight
                    } : 'ELEMENT_NOT_FOUND',
                    timestamp: Date.now()
                };
            })()
        `);
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🖥️  [${timestamp}] FRONTEND STATE:`, {
            title: frontendState.title,
            artist: frontendState.artist,
            albumArt: frontendState.albumArt !== 'ELEMENT_NOT_FOUND' ? 
                (frontendState.albumArt.src ? 'HAS_SRC' : 'NO_SRC') : 'NOT_FOUND'
        });
        
    } catch (error) {
        console.log(`❌ Error checking frontend state: ${error.message}`);
    }
}

function generateReport() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n📊 [${timestamp}] IPC COMMUNICATION REPORT:`);
    console.log(`📡 Total IPC events: ${ipcEvents.length}`);
    console.log(`🎵 Track events: ${trackEvents.length}`);
    
    // Show recent IPC events
    const recentEvents = ipcEvents.slice(-10);
    console.log(`\n📋 Recent IPC Events (last 10):`);
    recentEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. [${event.timestamp}] ${event.direction}: ${event.channel}`);
    });
    
    // Show track events
    if (trackEvents.length > 0) {
        console.log(`\n🎵 Track Events:`);
        trackEvents.forEach((event, index) => {
            console.log(`  ${index + 1}. [${event.timestamp}] ${event.trackInfo?.title || 'NO_TITLE'} - ${event.hasAlbumArt ? 'WITH_ART' : 'NO_ART'}`);
        });
    } else {
        console.log(`\n⚠️  NO TRACK EVENTS DETECTED!`);
        console.log(`   This suggests the main process is not sending track data to the renderer.`);
    }
    
    // Check for common issues
    const hasConfigRequests = ipcEvents.some(e => e.channel.includes('config'));
    const hasServiceRequests = ipcEvents.some(e => e.channel.includes('service'));
    const hasRoonEvents = ipcEvents.some(e => e.channel.includes('roon'));
    
    console.log(`\n🔍 Communication Analysis:`);
    console.log(`   Config requests: ${hasConfigRequests ? '✅' : '❌'}`);
    console.log(`   Service requests: ${hasServiceRequests ? '✅' : '❌'}`);
    console.log(`   Roon events: ${hasRoonEvents ? '✅' : '❌'}`);
    
    if (!hasRoonEvents) {
        console.log(`\n🚨 ISSUE DETECTED: No Roon events found!`);
        console.log(`   Possible causes:`);
        console.log(`   1. Roon service not connected`);
        console.log(`   2. No music playing`);
        console.log(`   3. IPC handlers not registered`);
        console.log(`   4. Main process not running properly`);
    }
    
    console.log(`\n${'='.repeat(60)}\n`);
}

// Set up IPC handlers to catch any missing handlers
ipcMain.handle('config-get-all', () => {
    console.log('🔧 Config request received (test handler)');
    return {};
});

ipcMain.handle('request-service-status', () => {
    console.log('📊 Service status request received (test handler)');
    return { message: 'Test handler - main process not fully loaded' };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    console.log('\n📋 FINAL IPC REPORT:');
    console.log(`Total IPC events captured: ${ipcEvents.length}`);
    console.log(`Total track events captured: ${trackEvents.length}`);
    
    if (trackEvents.length === 0) {
        console.log('\n❌ CRITICAL ISSUE: No track events were captured!');
        console.log('The main process is not sending track data to the renderer.');
    } else {
        console.log('\n✅ Track events were captured successfully.');
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
