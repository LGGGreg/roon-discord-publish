const { _electron: electron } = require('playwright');
const path = require('path');

/**
 * Debug Track Change Detection
 * Launches the app and monitors console logs for track change events
 */
class TrackChangeDebugger {
    constructor() {
        this.electronApp = null;
        this.page = null;
        this.logs = [];
        this.trackChangeEvents = [];
    }

    async launch() {
        console.log('🚀 Launching Electron app for track change debugging...');
        
        this.electronApp = await electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'production'  // Disable dev console for cleaner logs
            }
        });
        
        this.page = await this.electronApp.firstWindow();
        console.log('✅ App launched successfully');
        
        // Set up console log monitoring
        this.setupLogMonitoring();
        
        // Wait for app to fully load
        await this.page.waitForTimeout(10000);
        console.log('⏳ App initialization complete, monitoring for track changes...');
    }

    setupLogMonitoring() {
        // Monitor console logs from the main process and renderer
        this.page.on('console', (msg) => {
            const text = msg.text();
            const timestamp = new Date().toISOString();
            
            // Store all logs
            this.logs.push({ timestamp, text, type: msg.type() });
            
            // Print relevant logs to our console
            if (this.isRelevantLog(text)) {
                console.log(`[${timestamp}] ${text}`);
            }
            
            // Track track change events specifically
            if (text.includes('NEW TRACK detected') || 
                text.includes('track-changed event') ||
                text.includes('RENDERER RECEIVED roon-track-changed') ||
                text.includes('updateCurrentTrack CALLED') ||
                text.includes('updateDiscordActivity CALLED')) {
                
                this.trackChangeEvents.push({ timestamp, text });
                console.log(`🎵 TRACK EVENT: ${text}`);
            }
        });

        // Monitor page errors
        this.page.on('pageerror', (error) => {
            console.log(`❌ Page Error: ${error.message}`);
            this.logs.push({ 
                timestamp: new Date().toISOString(), 
                text: `ERROR: ${error.message}`, 
                type: 'error' 
            });
        });
    }

    isRelevantLog(text) {
        const relevantKeywords = [
            '🎵', '🚀', '🎯', '🖥️', '🎮', '⏱️',
            'NEW TRACK detected',
            'track-changed event',
            'ServiceCoordinator RECEIVED',
            'RENDERER RECEIVED',
            'updateCurrentTrack',
            'updateDiscordActivity',
            'NOTIFYING renderer',
            'Position update',
            'Roon connected',
            'Discord connected',
            'zones_seek_changed',
            'zones_changed'
        ];
        
        return relevantKeywords.some(keyword => text.includes(keyword));
    }

    async monitorForDuration(minutes = 5) {
        console.log(`\n🔍 Monitoring for track changes for ${minutes} minutes...`);
        console.log('📝 Change tracks in Roon to see the debug output');
        console.log('⏹️  Press Ctrl+C to stop monitoring early\n');
        
        const startTime = Date.now();
        const endTime = startTime + (minutes * 60 * 1000);
        
        // Monitor for the specified duration
        while (Date.now() < endTime) {
            await this.page.waitForTimeout(1000);
            
            // Print periodic status
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            if (elapsed % 30 === 0 && elapsed > 0) {
                console.log(`\n⏰ Monitoring for ${elapsed}s - ${this.trackChangeEvents.length} track events detected`);
                this.printRecentEvents();
            }
        }
        
        console.log(`\n✅ Monitoring complete after ${minutes} minutes`);
        this.generateReport();
    }

    printRecentEvents() {
        const recent = this.trackChangeEvents.slice(-5);
        if (recent.length > 0) {
            console.log('📋 Recent track events:');
            recent.forEach(event => {
                console.log(`  ${event.timestamp}: ${event.text}`);
            });
        }
    }

    async checkCurrentState() {
        console.log('\n🔍 Checking current application state...');
        
        try {
            // Check if services are connected
            const serviceStatus = await this.page.evaluate(() => {
                return {
                    hasAppState: typeof window.AppState !== 'undefined',
                    currentTrack: window.AppState?.currentTrack,
                    connections: window.AppState?.connections
                };
            });
            
            console.log('📊 Service Status:', JSON.stringify(serviceStatus, null, 2));
            
            // Check DOM elements
            const domState = await this.page.evaluate(() => {
                const trackTitle = document.getElementById('track-title');
                const trackArtist = document.getElementById('track-artist');
                const discordStatus = document.querySelector('[data-service="discord"] .status-indicator');
                const roonStatus = document.querySelector('[data-service="roon"] .status-indicator');
                
                return {
                    trackTitle: trackTitle?.textContent || 'Not found',
                    trackArtist: trackArtist?.textContent || 'Not found',
                    discordStatus: discordStatus?.textContent || 'Not found',
                    roonStatus: roonStatus?.textContent || 'Not found'
                };
            });
            
            console.log('🖥️ DOM State:', JSON.stringify(domState, null, 2));
            
        } catch (error) {
            console.log('❌ Error checking state:', error.message);
        }
    }

    generateReport() {
        console.log('\n📊 TRACK CHANGE DEBUG REPORT');
        console.log('=' .repeat(50));
        
        console.log(`Total logs captured: ${this.logs.length}`);
        console.log(`Track change events: ${this.trackChangeEvents.length}`);
        
        if (this.trackChangeEvents.length > 0) {
            console.log('\n🎵 Track Change Events Timeline:');
            this.trackChangeEvents.forEach((event, index) => {
                console.log(`${index + 1}. [${event.timestamp}] ${event.text}`);
            });
        } else {
            console.log('\n⚠️ NO TRACK CHANGE EVENTS DETECTED');
            console.log('This suggests either:');
            console.log('1. No tracks were changed during monitoring');
            console.log('2. Roon is not connected');
            console.log('3. Track change detection is not working');
        }
        
        // Analyze the event chain
        this.analyzeEventChain();
        
        // Save detailed logs
        this.saveLogs();
    }

    analyzeEventChain() {
        console.log('\n🔍 Event Chain Analysis:');
        
        const eventTypes = {
            detection: this.trackChangeEvents.filter(e => e.text.includes('NEW TRACK detected')),
            emission: this.trackChangeEvents.filter(e => e.text.includes('EMITTING IMMEDIATE')),
            reception: this.trackChangeEvents.filter(e => e.text.includes('ServiceCoordinator RECEIVED')),
            notification: this.trackChangeEvents.filter(e => e.text.includes('NOTIFYING renderer')),
            rendering: this.trackChangeEvents.filter(e => e.text.includes('RENDERER RECEIVED')),
            uiUpdate: this.trackChangeEvents.filter(e => e.text.includes('updateCurrentTrack CALLED')),
            discordUpdate: this.trackChangeEvents.filter(e => e.text.includes('updateDiscordActivity CALLED'))
        };
        
        Object.entries(eventTypes).forEach(([type, events]) => {
            const status = events.length > 0 ? '✅' : '❌';
            console.log(`${status} ${type}: ${events.length} events`);
        });
        
        if (eventTypes.detection.length === 0) {
            console.log('\n⚠️ No track detection events - check if Roon is connected and playing');
        } else if (eventTypes.emission.length === 0) {
            console.log('\n⚠️ Track detected but not emitted - check emitTrackChanged method');
        } else if (eventTypes.reception.length === 0) {
            console.log('\n⚠️ Events emitted but not received - check ServiceCoordinator event listeners');
        } else if (eventTypes.rendering.length === 0) {
            console.log('\n⚠️ Events received but not sent to renderer - check notifyRenderer calls');
        } else if (eventTypes.uiUpdate.length === 0) {
            console.log('\n⚠️ Renderer received events but UI not updating - check renderer event handlers');
        }
    }

    saveLogs() {
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `track-change-debug-${timestamp}.json`;
        
        const report = {
            timestamp: new Date().toISOString(),
            totalLogs: this.logs.length,
            trackChangeEvents: this.trackChangeEvents.length,
            logs: this.logs,
            trackEvents: this.trackChangeEvents
        };
        
        fs.writeFileSync(filename, JSON.stringify(report, null, 2));
        console.log(`\n💾 Detailed logs saved to: ${filename}`);
    }

    async close() {
        if (this.electronApp) {
            await this.electronApp.close();
            console.log('App closed');
        }
    }
}

// Run the debugger
async function runDebug() {
    const trackDebugger = new TrackChangeDebugger();
    
    try {
        await trackDebugger.launch();
        await trackDebugger.checkCurrentState();
        await trackDebugger.monitorForDuration(3); // Monitor for 3 minutes

    } catch (error) {
        console.error('❌ Debug session failed:', error);
    } finally {
        await trackDebugger.close();
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
    console.log('\n⏹️ Stopping debug session...');
    process.exit(0);
});

if (require.main === module) {
    runDebug().catch(console.error);
}

module.exports = TrackChangeDebugger;
