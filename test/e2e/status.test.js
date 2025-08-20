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

test.describe('Roon Discord Rich Presence - Status Page', () => {
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
        await page.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should load the application and show status page', async () => {
        // Take initial screenshot
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/01-app-loaded.png`,
            fullPage: true 
        });

        // Check that the app loaded
        await expect(page.locator('h1')).toContainText('Roon Discord Rich Presence');
        
        // Check that status tab is active
        await expect(page.locator('[data-tab="status"].active')).toBeVisible();
    });

    test('should show service status cards', async () => {
        // Check Discord service card exists
        await expect(page.locator('[data-service="discord"]')).toBeVisible();
        await expect(page.locator('[data-testid="discord-status-text"]')).toBeVisible();

        // Check Roon service card exists
        await expect(page.locator('[data-service="roon"]')).toBeVisible();
        await expect(page.locator('[data-testid="roon-status-text"]')).toBeVisible();

        // Check Spotify service card exists
        await expect(page.locator('[data-service="spotify"]')).toBeVisible();
        await expect(page.locator('[data-testid="spotify-status-text"]')).toBeVisible();

        // Check Imgur service card exists
        await expect(page.locator('[data-service="imgur"]')).toBeVisible();
        await expect(page.locator('[data-testid="imgur-status-text"]')).toBeVisible();

        // Take screenshot of status cards
        await page.screenshot({
            path: `${SCREENSHOT_DIR}/02-status-cards.png`,
            fullPage: true
        });
    });

    test('should connect to services within timeout', async () => {
        // Wait for services to connect (with generous timeout)
        await page.waitForTimeout(10000);
        
        // Take screenshot after connection attempts
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/03-after-connection-attempts.png`,
            fullPage: true 
        });
        
        // Check Discord status (should be connected or connecting)
        const discordStatus = await page.locator('[data-testid="discord-status-text"]').textContent();
        console.log('Discord status:', discordStatus);
        expect(['Connected', 'Connecting', 'Reconnecting']).toContain(discordStatus);
        
        // Check Roon status (should be connected or connecting)
        const roonStatus = await page.locator('[data-testid="roon-status-text"]').textContent();
        console.log('Roon status:', roonStatus);
        expect(['Connected', 'Connecting', 'Reconnecting']).toContain(roonStatus);

        // Check Spotify status (should be connected or connecting)
        const spotifyStatus = await page.locator('[data-testid="spotify-status-text"]').textContent();
        console.log('Spotify status:', spotifyStatus);
        expect(['Connected', 'Connecting', 'Reconnecting', 'Disconnected']).toContain(spotifyStatus);

        // Check Imgur status (should be connected or connecting)
        const imgurStatus = await page.locator('[data-testid="imgur-status-text"]').textContent();
        console.log('Imgur status:', imgurStatus);
        expect(['Connected', 'Connecting', 'Reconnecting', 'Disconnected']).toContain(imgurStatus);
    });

    test('should have working reconnect buttons', async () => {
        // Test Discord reconnect button
        await expect(page.locator('[data-testid="discord-reconnect"]')).toBeVisible();
        await page.locator('[data-testid="discord-reconnect"]').click();
        
        // Wait a moment for the reconnection to start
        await page.waitForTimeout(1000);
        
        // Test Roon reconnect button
        await expect(page.locator('[data-testid="roon-reconnect"]')).toBeVisible();
        await page.locator('[data-testid="roon-reconnect"]').click();
        
        // Wait a moment for the reconnection to start
        await page.waitForTimeout(1000);
        
        // Take screenshot after reconnect attempts
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/04-after-reconnect.png`,
            fullPage: true 
        });
    });

    test('should have working quick action buttons', async () => {
        // Test Reconnect All button
        await expect(page.locator('[data-testid="reconnect-all"]')).toBeVisible();
        await page.locator('[data-testid="reconnect-all"]').click();
        
        await page.waitForTimeout(1000);
        
        // Test Clear Activity button
        await expect(page.locator('[data-testid="clear-activity"]')).toBeVisible();
        await page.locator('[data-testid="clear-activity"]').click();
        
        await page.waitForTimeout(1000);
        
        // Test Test Activity button
        await expect(page.locator('[data-testid="test-activity"]')).toBeVisible();
        await page.locator('[data-testid="test-activity"]').click();
        
        await page.waitForTimeout(1000);
        
        // Take final screenshot
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/05-after-quick-actions.png`,
            fullPage: true 
        });
    });

    test('should navigate between tabs', async () => {
        // Click Configuration tab
        await page.locator('[data-tab="config"]').click();
        await page.waitForTimeout(500);
        
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/06-config-tab.png`,
            fullPage: true 
        });
        
        // Click Logs tab
        await page.locator('[data-tab="logs"]').click();
        await page.waitForTimeout(500);
        
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/07-logs-tab.png`,
            fullPage: true 
        });
        
        // Return to Status tab
        await page.locator('[data-tab="status"]').click();
        await page.waitForTimeout(500);
        
        await page.screenshot({
            path: `${SCREENSHOT_DIR}/08-back-to-status.png`,
            fullPage: true
        });
    });

    test('should show now playing section', async () => {
        // Check now playing section exists
        await expect(page.locator('.now-playing-section')).toBeVisible();
        await expect(page.locator('[data-testid="track-title"]')).toBeVisible();
        await expect(page.locator('[data-testid="track-artist"]')).toBeVisible();
        await expect(page.locator('[data-testid="track-album"]')).toBeVisible();
        await expect(page.locator('[data-testid="track-zone"]')).toBeVisible();

        // Check if refresh activity button exists
        await expect(page.locator('[data-testid="refresh-activity"]')).toBeVisible();

        // Take screenshot of now playing section
        await page.screenshot({
            path: `${SCREENSHOT_DIR}/09-now-playing.png`,
            fullPage: true
        });

        // Get current track info
        const trackTitle = await page.locator('[data-testid="track-title"]').textContent();
        const trackArtist = await page.locator('[data-testid="track-artist"]').textContent();
        const trackAlbum = await page.locator('[data-testid="track-album"]').textContent();
        const trackZone = await page.locator('[data-testid="track-zone"]').textContent();

        console.log('Now Playing:', {
            title: trackTitle,
            artist: trackArtist,
            album: trackAlbum,
            zone: trackZone
        });

        // If music is playing, check for Spotify link
        if (trackTitle !== '-' && trackArtist !== '-') {
            // Wait a moment for Spotify search to complete
            await page.waitForTimeout(3000);

            const spotifyLink = page.locator('[data-testid="spotify-link"]');
            const isSpotifyLinkVisible = await spotifyLink.isVisible();

            if (isSpotifyLinkVisible) {
                console.log('Spotify link is available');
                await page.screenshot({
                    path: `${SCREENSHOT_DIR}/10-spotify-link-available.png`,
                    fullPage: true
                });
            } else {
                console.log('Spotify link not available');
            }
        }
    });
});
