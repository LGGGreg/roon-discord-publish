// Simple album art stability test
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

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

    // Wait for page to load
    mainWindow.webContents.once('did-finish-load', () => {
        console.log('✅ Page loaded successfully');
    });

    // Monitor album art changes
    let albumArtChanges = [];
    let lastSrc = null;
    let changeCount = 0;
    
    console.log('🔍 Starting album art stability monitoring...');
    
    const checkAlbumArt = async () => {
        try {
            const result = await mainWindow.webContents.executeJavaScript(`
                (() => {
                    // Check if page is loaded
                    const body = document.body;
                    if (!body) return { error: 'Page not loaded' };

                    // Check for track title to see if track info is available
                    const trackTitle = document.getElementById('track-title');
                    const albumArt = document.getElementById('album-image');

                    return {
                        pageLoaded: true,
                        trackTitle: trackTitle ? trackTitle.textContent : 'NOT_FOUND',
                        albumArtExists: !!albumArt,
                        albumArt: albumArt ? {
                            src: albumArt.src,
                            visible: !albumArt.hidden && albumArt.style.display !== 'none',
                            naturalWidth: albumArt.naturalWidth,
                            naturalHeight: albumArt.naturalHeight
                        } : null
                    };
                })()
            `);

            if (result && result.pageLoaded) {
                const timestamp = Date.now();

                // Log page status
                console.log(`Page status: title="${result.trackTitle}", albumArt=${result.albumArtExists}`);

                if (result.albumArt) {
                    const currentSrc = result.albumArt.src;

                    if (lastSrc !== currentSrc) {
                        changeCount++;
                        console.log(`[${changeCount}] Album art changed: ${lastSrc} → ${currentSrc}`);
                        albumArtChanges.push({
                            timestamp,
                            oldSrc: lastSrc,
                            newSrc: currentSrc,
                            visible: result.albumArt.visible,
                            naturalWidth: result.albumArt.naturalWidth,
                            naturalHeight: result.albumArt.naturalHeight
                        });
                        lastSrc = currentSrc;
                    }
                } else if (result.albumArtExists) {
                    console.log('Album art element exists but no data available');
                } else {
                    console.log('Album art element not found on page');
                }
            } else if (result && result.error) {
                console.log(`Page error: ${result.error}`);
            }
        } catch (error) {
            console.log(`Error checking album art: ${error.message}`);
        }
    };
    
    // Check every 500ms for 30 seconds
    const interval = setInterval(checkAlbumArt, 500);
    
    setTimeout(() => {
        clearInterval(interval);
        console.log('\n📊 Album Art Stability Report:');
        console.log(`Total changes detected: ${changeCount}`);
        console.log(`Changes per minute: ${(changeCount / 0.5).toFixed(1)}`);
        
        if (changeCount === 0) {
            console.log('✅ No album art changes detected - very stable!');
        } else if (changeCount <= 2) {
            console.log('✅ Minimal album art changes - acceptable stability');
        } else if (changeCount <= 5) {
            console.log('⚠️ Some album art changes - moderate flickering');
        } else {
            console.log('❌ Many album art changes - significant flickering detected');
        }
        
        console.log('\nDetailed changes:');
        albumArtChanges.forEach((change, index) => {
            console.log(`  ${index + 1}. ${new Date(change.timestamp).toLocaleTimeString()}: ${change.oldSrc} → ${change.newSrc}`);
        });
        
        console.log('\n🏁 Test completed. You can close the window now.');
    }, 30000); // 30 seconds
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
