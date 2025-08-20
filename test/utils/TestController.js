const { _electron: electron } = require('playwright');
const screenshot = require('screenshot-desktop');
const path = require('path');
const fs = require('fs');

/**
 * Test Controller for Roon Discord Rich Presence
 * Provides programmatic control and screenshot capabilities
 */
class TestController {
    constructor() {
        this.electronApp = null;
        this.page = null;
        this.screenshotDir = 'test-results/screenshots';
        this.isConnected = false;
        
        // Ensure screenshot directory exists
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    /**
     * Launch the Electron application
     */
    async launch() {
        if (this.electronApp) {
            console.log('App already launched');
            return;
        }

        console.log('Launching Electron app...');
        this.electronApp = await electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'development'
            }
        });
        
        this.page = await this.electronApp.firstWindow();
        this.isConnected = true;
        
        // Wait for app to initialize
        await this.page.waitForTimeout(2000);
        console.log('App launched successfully');
    }

    /**
     * Close the Electron application
     */
    async close() {
        if (this.electronApp) {
            await this.electronApp.close();
            this.electronApp = null;
            this.page = null;
            this.isConnected = false;
            console.log('App closed');
        }
    }

    /**
     * Take a screenshot using Playwright
     */
    async takeScreenshot(filename) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const filepath = path.join(this.screenshotDir, filename);
        await this.page.screenshot({ 
            path: filepath,
            fullPage: true 
        });
        console.log(`Screenshot saved: ${filepath}`);
        return filepath;
    }

    /**
     * Take a native desktop screenshot (alternative method)
     */
    async takeNativeScreenshot(filename) {
        const filepath = path.join(this.screenshotDir, filename);
        await screenshot({ filename: filepath });
        console.log(`Native screenshot saved: ${filepath}`);
        return filepath;
    }

    /**
     * Get service status using IPC
     */
    async getServiceStatus() {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const status = await this.page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-get-all-status');
        });

        return status;
    }

    /**
     * Get service status from GUI elements
     */
    async getGUIStatus() {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const discordStatus = await this.page.locator('[data-testid="discord-status-text"]').textContent();
        const roonStatus = await this.page.locator('[data-testid="roon-status-text"]').textContent();
        const spotifyStatus = await this.page.locator('[data-testid="spotify-status-text"]').textContent();
        const imgurStatus = await this.page.locator('[data-testid="imgur-status-text"]').textContent();

        return {
            discord: discordStatus,
            roon: roonStatus,
            spotify: spotifyStatus,
            imgur: imgurStatus
        };
    }

    /**
     * Trigger service reconnection
     */
    async reconnectService(service) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const result = await this.page.evaluate(async (serviceName) => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-trigger-reconnect', serviceName);
        }, service);

        console.log(`Reconnect ${service}:`, result);
        return result;
    }

    /**
     * Click a GUI element
     */
    async clickElement(selector) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        await this.page.locator(selector).click();
        console.log(`Clicked element: ${selector}`);
    }

    /**
     * Wait for element to be visible
     */
    async waitForElement(selector, timeout = 5000) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        await this.page.locator(selector).waitFor({ timeout });
        console.log(`Element visible: ${selector}`);
    }

    /**
     * Switch to a specific tab
     */
    async switchTab(tabName) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        await this.page.locator(`[data-tab="${tabName}"]`).click();
        await this.page.waitForTimeout(500);
        console.log(`Switched to tab: ${tabName}`);
    }

    /**
     * Wait for services to connect
     */
    async waitForConnection(timeout = 15000) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        console.log('Waiting for services to connect...');
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const status = await this.getGUIStatus();

            // Check core services (Discord and Roon)
            const coreConnected = status.discord === 'Connected' && status.roon === 'Connected';

            if (coreConnected) {
                console.log('Core services connected!');
                console.log(`All Status: Discord=${status.discord}, Roon=${status.roon}, Spotify=${status.spotify}, Imgur=${status.imgur}`);
                return true;
            }

            console.log(`Status: Discord=${status.discord}, Roon=${status.roon}, Spotify=${status.spotify}, Imgur=${status.imgur}`);
            await this.page.waitForTimeout(1000);
        }

        console.log('Timeout waiting for core connections');
        return false;
    }

    /**
     * Run a comprehensive status check
     */
    async runStatusCheck() {
        console.log('\n=== Running Status Check ===');
        
        // Take initial screenshot
        await this.takeScreenshot('status-check-start.png');
        
        // Get GUI status
        const guiStatus = await this.getGUIStatus();
        console.log('GUI Status:', guiStatus);
        
        // Get IPC status
        const ipcStatus = await this.getServiceStatus();
        console.log('IPC Status:', ipcStatus);
        
        // Take final screenshot
        await this.takeScreenshot('status-check-end.png');
        
        return {
            gui: guiStatus,
            ipc: ipcStatus,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Test Spotify search functionality
     */
    async testSpotifySearch(title = 'Bohemian Rhapsody', artist = 'Queen', album = 'A Night at the Opera') {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        console.log(`Testing Spotify search: ${title} by ${artist}`);

        const result = await this.page.evaluate(async (searchTitle, searchArtist, searchAlbum) => {
            const { ipcRenderer } = require('electron');
            try {
                return await ipcRenderer.invoke('spotify-search', searchTitle, searchArtist, searchAlbum);
            } catch (error) {
                return { error: error.message };
            }
        }, title, artist, album);

        console.log('Spotify search result:', result);
        return result;
    }

    /**
     * Test enhanced Discord activity
     */
    async testEnhancedActivity() {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const testTrack = {
            title: 'Test Enhanced Song',
            artist: 'Test Enhanced Artist',
            album: 'Test Enhanced Album',
            zoneName: 'Test Zone',
            duration: 240,
            position: 60
        };

        console.log('Testing enhanced Discord activity...');

        const result = await this.page.evaluate(async (track) => {
            const { ipcRenderer } = require('electron');
            try {
                return await ipcRenderer.invoke('discord-set-activity', track);
            } catch (error) {
                return { error: error.message };
            }
        }, testTrack);

        console.log('Enhanced activity result:', result);

        // Wait for activity to be processed
        await this.page.waitForTimeout(2000);

        // Check if now playing is updated
        const nowPlaying = await this.getNowPlaying();
        console.log('Now playing after activity:', nowPlaying);

        return { activityResult: result, nowPlaying };
    }

    /**
     * Get current now playing information
     */
    async getNowPlaying() {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const trackTitle = await this.page.locator('[data-testid="track-title"]').textContent();
        const trackArtist = await this.page.locator('[data-testid="track-artist"]').textContent();
        const trackAlbum = await this.page.locator('[data-testid="track-album"]').textContent();
        const trackZone = await this.page.locator('[data-testid="track-zone"]').textContent();

        return {
            title: trackTitle,
            artist: trackArtist,
            album: trackAlbum,
            zone: trackZone
        };
    }

    /**
     * Run comprehensive service tests
     */
    async runServiceTests() {
        console.log('\n=== Running Comprehensive Service Tests ===');

        // Take initial screenshot
        await this.takeScreenshot('service-tests-start.png');

        // Test 1: Basic status check
        console.log('\n1. Basic Status Check');
        const statusCheck = await this.runStatusCheck();

        // Test 2: Spotify search
        console.log('\n2. Spotify Search Test');
        const spotifyResult = await this.testSpotifySearch();

        // Test 3: Enhanced Discord activity
        console.log('\n3. Enhanced Discord Activity Test');
        const activityResult = await this.testEnhancedActivity();

        // Test 4: Service reconnection
        console.log('\n4. Service Reconnection Test');
        const reconnectResults = {};
        for (const service of ['discord', 'roon', 'spotify', 'imgur']) {
            reconnectResults[service] = await this.reconnectService(service);
            await this.page.waitForTimeout(1000);
        }

        // Take final screenshot
        await this.takeScreenshot('service-tests-end.png');

        const results = {
            statusCheck,
            spotifySearch: spotifyResult,
            enhancedActivity: activityResult,
            reconnectResults,
            timestamp: new Date().toISOString()
        };

        console.log('\n=== Service Tests Complete ===');
        console.log('Results:', JSON.stringify(results, null, 2));

        return results;
    }
}

module.exports = TestController;
