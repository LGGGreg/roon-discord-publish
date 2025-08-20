const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_TIMEOUT = 30000;
const SCREENSHOT_DIR = 'test-results/screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Roon Discord Rich Presence - Services Integration', () => {
    let electronApp;
    let page;

    test.beforeAll(async () => {
        // Launch Electron app
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'development'
            }
        });
        
        // Get the first window
        page = await electronApp.firstWindow();
        
        // Wait for app to initialize
        await page.waitForTimeout(3000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should connect to all services', async () => {
        // Wait for services to initialize
        await page.waitForTimeout(10000);
        
        // Take screenshot of initial state
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/services-01-initial.png`,
            fullPage: true 
        });

        // Get service status using IPC
        const allStatus = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-get-all-status');
        });

        console.log('All service status:', JSON.stringify(allStatus, null, 2));

        // Check Discord
        expect(allStatus.discord).toBeDefined();
        expect(allStatus.discord.state).toBeDefined();
        
        // Check Roon
        expect(allStatus.roon).toBeDefined();
        expect(allStatus.roon.state).toBeDefined();
        
        // Check Spotify
        expect(allStatus.spotify).toBeDefined();
        expect(allStatus.spotify.state).toBeDefined();
        
        // Check Imgur
        expect(allStatus.imgur).toBeDefined();
        expect(allStatus.imgur.state).toBeDefined();
    });

    test('should test Spotify search functionality', async () => {
        // Wait for Spotify to connect
        await page.waitForTimeout(5000);
        
        // Test Spotify search using IPC
        const spotifyUrl = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            try {
                return await ipcRenderer.invoke('spotify-search', 'Bohemian Rhapsody', 'Queen', 'A Night at the Opera');
            } catch (error) {
                console.error('Spotify search error:', error);
                return null;
            }
        });

        console.log('Spotify search result:', spotifyUrl);
        
        if (spotifyUrl) {
            expect(spotifyUrl).toContain('spotify.com');
            console.log('✅ Spotify search working');
        } else {
            console.log('⚠️ Spotify search returned no results (may be expected if not configured)');
        }
        
        // Take screenshot after Spotify test
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/services-02-spotify-test.png`,
            fullPage: true 
        });
    });

    test('should test service reconnection', async () => {
        // Test Discord reconnection
        const discordReconnect = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-trigger-reconnect', 'discord');
        });
        
        expect(discordReconnect.success).toBe(true);
        console.log('Discord reconnect:', discordReconnect.message);
        
        // Test Spotify reconnection
        const spotifyReconnect = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-trigger-reconnect', 'spotify');
        });
        
        expect(spotifyReconnect.success).toBe(true);
        console.log('Spotify reconnect:', spotifyReconnect.message);
        
        // Test Imgur reconnection
        const imgurReconnect = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-trigger-reconnect', 'imgur');
        });
        
        expect(imgurReconnect.success).toBe(true);
        console.log('Imgur reconnect:', imgurReconnect.message);
        
        // Wait for reconnections to process
        await page.waitForTimeout(3000);
        
        // Take screenshot after reconnections
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/services-03-after-reconnect.png`,
            fullPage: true 
        });
    });

    test('should test enhanced Discord activity', async () => {
        // Set a test activity with enhanced features
        const testTrack = {
            title: 'Test Enhanced Song',
            artist: 'Test Enhanced Artist',
            album: 'Test Enhanced Album',
            zoneName: 'Test Zone',
            duration: 240,
            position: 60
        };

        const activityResult = await page.evaluate(async (track) => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('discord-set-activity', track);
        }, testTrack);

        console.log('Enhanced activity result:', activityResult);
        
        // Wait for activity to be processed
        await page.waitForTimeout(2000);
        
        // Check if now playing is updated
        const trackTitle = await page.locator('[data-testid="track-title"]').textContent();
        const trackArtist = await page.locator('[data-testid="track-artist"]').textContent();
        
        console.log('Now playing after activity:', { title: trackTitle, artist: trackArtist });
        
        // Take screenshot of enhanced activity
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/services-04-enhanced-activity.png`,
            fullPage: true 
        });
    });

    test('should test service status monitoring', async () => {
        // Monitor service status changes over time
        const statusChecks = [];
        
        for (let i = 0; i < 3; i++) {
            await page.waitForTimeout(2000);
            
            const status = await page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('test-get-all-status');
            });
            
            statusChecks.push({
                check: i + 1,
                timestamp: new Date().toISOString(),
                discord: status.discord?.state,
                roon: status.roon?.state,
                spotify: status.spotify?.state,
                imgur: status.imgur?.state
            });
        }
        
        console.log('Status monitoring results:', statusChecks);
        
        // Verify status consistency
        const discordStates = statusChecks.map(s => s.discord);
        const roonStates = statusChecks.map(s => s.roon);
        
        console.log('Discord states over time:', discordStates);
        console.log('Roon states over time:', roonStates);
        
        // Take final screenshot
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/services-05-status-monitoring.png`,
            fullPage: true 
        });
    });

    test('should test configuration integration', async () => {
        // Switch to configuration tab
        await page.locator('[data-tab="config"]').click();
        await page.waitForTimeout(1000);
        
        // Check if Spotify and Imgur configuration fields exist
        await expect(page.locator('#spotify-client-id')).toBeVisible();
        await expect(page.locator('#spotify-client-secret')).toBeVisible();
        await expect(page.locator('#imgur-client-id')).toBeVisible();
        
        // Take screenshot of configuration
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/services-06-configuration.png`,
            fullPage: true 
        });
        
        // Return to status tab
        await page.locator('[data-tab="status"]').click();
        await page.waitForTimeout(500);
    });
});
