// Test Perpetual Retry System
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;
let testStartTime;
let retryEvents = [];

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
    
    console.log('🔄 PERPETUAL RETRY TEST STARTED');
    console.log('📡 Testing infinite retry system...');
    testStartTime = Date.now();
    
    // Monitor for 60 seconds to see retry behavior
    setTimeout(() => {
        generateFinalReport();
        app.quit();
    }, 60000);
    
    // Check status every 5 seconds
    setInterval(checkServiceStatus, 5000);
}

async function checkServiceStatus() {
    try {
        const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
        
        const serviceStatus = await mainWindow.webContents.executeJavaScript(`
            (() => {
                const { ipcRenderer } = require('electron');
                
                return Promise.all([
                    ipcRenderer.invoke('roon-status').catch(e => ({ error: e.message })),
                    ipcRenderer.invoke('discord-status').catch(e => ({ error: e.message })),
                    ipcRenderer.invoke('spotify-status').catch(e => ({ error: e.message }))
                ]).then(([roon, discord, spotify]) => ({
                    roon,
                    discord,
                    spotify,
                    timestamp: Date.now()
                }));
            })()
        `);
        
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`\n⏰ [${elapsed}s] SERVICE STATUS CHECK:`);
        console.log(`🎵 Roon: ${serviceStatus.roon.state || 'ERROR'} (attempts: ${serviceStatus.roon.connectionAttempts || 'N/A'})`);
        console.log(`🎮 Discord: ${serviceStatus.discord.state || 'ERROR'} (attempts: ${serviceStatus.discord.connectionAttempts || 'N/A'})`);
        console.log(`🎧 Spotify: ${serviceStatus.spotify.state || 'ERROR'} (attempts: ${serviceStatus.spotify.connectionAttempts || 'N/A'})`);
        
        // Track retry events
        retryEvents.push({
            timestamp: elapsed,
            roon: {
                state: serviceStatus.roon.state,
                attempts: serviceStatus.roon.connectionAttempts,
                details: serviceStatus.roon.details
            },
            discord: {
                state: serviceStatus.discord.state,
                attempts: serviceStatus.discord.connectionAttempts,
                details: serviceStatus.discord.details
            },
            spotify: {
                state: serviceStatus.spotify.state,
                attempts: serviceStatus.spotify.connectionAttempts,
                details: serviceStatus.spotify.details
            }
        });
        
        // Check for perpetual retry behavior
        const roonRetrying = serviceStatus.roon.state === 'reconnecting' || serviceStatus.roon.state === 'connecting';
        const discordRetrying = serviceStatus.discord.state === 'reconnecting' || serviceStatus.discord.state === 'connecting';
        
        if (roonRetrying || discordRetrying) {
            console.log('✅ PERPETUAL RETRY ACTIVE!');
            if (roonRetrying) console.log(`   🎵 Roon retrying: ${serviceStatus.roon.details}`);
            if (discordRetrying) console.log(`   🎮 Discord retrying: ${serviceStatus.discord.details}`);
        }
        
        // Check if any service is in ERROR state (should not happen with perpetual retry)
        const roonError = serviceStatus.roon.state === 'error';
        const discordError = serviceStatus.discord.state === 'error';
        
        if (roonError || discordError) {
            console.log('❌ ERROR STATE DETECTED (should not happen with perpetual retry):');
            if (roonError) console.log(`   🎵 Roon error: ${serviceStatus.roon.details}`);
            if (discordError) console.log(`   🎮 Discord error: ${serviceStatus.discord.details}`);
        }
        
    } catch (error) {
        console.log(`❌ Error checking service status: ${error.message}`);
    }
}

function generateFinalReport() {
    const totalTime = Math.floor((Date.now() - testStartTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERPETUAL RETRY TEST FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`⏰ Test duration: ${totalTime} seconds`);
    console.log(`📡 Status checks performed: ${retryEvents.length}`);
    
    // Analyze retry behavior
    let maxRoonAttempts = 0;
    let maxDiscordAttempts = 0;
    let errorStatesDetected = 0;
    let retryingStatesDetected = 0;
    
    retryEvents.forEach(event => {
        if (event.roon.attempts > maxRoonAttempts) maxRoonAttempts = event.roon.attempts;
        if (event.discord.attempts > maxDiscordAttempts) maxDiscordAttempts = event.discord.attempts;
        
        if (event.roon.state === 'error' || event.discord.state === 'error') {
            errorStatesDetected++;
        }
        
        if (event.roon.state === 'reconnecting' || event.roon.state === 'connecting' ||
            event.discord.state === 'reconnecting' || event.discord.state === 'connecting') {
            retryingStatesDetected++;
        }
    });
    
    console.log('\n🔍 RETRY ANALYSIS:');
    console.log(`🎵 Max Roon attempts: ${maxRoonAttempts}`);
    console.log(`🎮 Max Discord attempts: ${maxDiscordAttempts}`);
    console.log(`❌ Error states detected: ${errorStatesDetected}`);
    console.log(`🔄 Retrying states detected: ${retryingStatesDetected}`);
    
    // Determine test results
    console.log('\n🎯 TEST RESULTS:');
    
    if (errorStatesDetected === 0) {
        console.log('✅ SUCCESS: No error states detected - perpetual retry working!');
    } else {
        console.log('❌ FAILURE: Error states detected - perpetual retry not working properly');
    }
    
    if (maxRoonAttempts > 15 || maxDiscordAttempts > 15) {
        console.log('✅ SUCCESS: Services exceeded old retry limits - infinite retries working!');
    } else {
        console.log('⚠️  WARNING: Services did not exceed old retry limits - may need more time to test');
    }
    
    if (retryingStatesDetected > 0) {
        console.log('✅ SUCCESS: Retry activity detected - services are actively retrying');
    } else {
        console.log('⚠️  INFO: No retry activity detected - services may be connected or not started');
    }
    
    console.log('\n🚀 PERPETUAL RETRY SYSTEM TEST COMPLETED!');
    console.log('='.repeat(60));
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
