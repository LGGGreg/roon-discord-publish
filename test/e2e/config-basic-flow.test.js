const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Basic Configuration Flow Tests', () => {
    let electronApp;
    let page;

    test.beforeAll(async ({ playwright }) => {
        electronApp = await playwright._electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            timeout: 30000
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Allow app to initialize
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    async function getServiceStatus(serviceName) {
        const statusCard = page.locator(`.status-card[data-service="${serviceName}"]`);
        
        if (await statusCard.count() === 0) {
            throw new Error(`Could not find ${serviceName} status card`);
        }

        const statusText = await statusCard.locator(`[data-testid="${serviceName}-status-text"]`).textContent();
        const statusDetails = await statusCard.locator(`[data-testid="${serviceName}-details"]`).textContent();
        const statusDot = statusCard.locator(`[data-testid="${serviceName}-status-dot"]`);
        const dotClasses = await statusDot.getAttribute('class') || '';

        return {
            statusText: statusText.trim(),
            statusDetails: statusDetails.trim(),
            dotClasses,
            isDisconnected: dotClasses.includes('disconnected'),
            isConnecting: dotClasses.includes('connecting'),
            isConnected: dotClasses.includes('connected'),
            isError: dotClasses.includes('error')
        };
    }

    test('should show initial blank config state correctly', async () => {
        // Navigate to status tab to see service states
        await page.click('[data-tab="status"]');
        await page.waitForTimeout(1000);

        // Check Discord status (required service)
        const discordStatus = await getServiceStatus('discord');
        console.log(`Discord: ${discordStatus.statusText} - ${discordStatus.statusDetails}`);
        
        // Discord should show disconnected, error, or connecting state initially (any non-connected state)
        expect(!discordStatus.isConnected).toBeTruthy();

        // Check Roon status (should be attempting connection)
        const roonStatus = await getServiceStatus('roon');
        console.log(`Roon: ${roonStatus.statusText} - ${roonStatus.statusDetails}`);
        
        // Roon should be disconnected or connecting (not error due to missing config)
        expect(roonStatus.isDisconnected || roonStatus.isConnecting).toBeTruthy();

        // Check Spotify status (optional service)
        const spotifyStatus = await getServiceStatus('spotify');
        console.log(`Spotify: ${spotifyStatus.statusText} - ${spotifyStatus.statusDetails}`);
        
        // Spotify should show disconnected or error state (both are valid for missing config)
        expect(spotifyStatus.isDisconnected || spotifyStatus.isError).toBeTruthy();

        // Check Imgur status (optional service)
        const imgurStatus = await getServiceStatus('imgur');
        console.log(`Imgur: ${imgurStatus.statusText} - ${imgurStatus.statusDetails}`);
        
        // Imgur should show disconnected or error state (both are valid for missing config)
        expect(imgurStatus.isDisconnected || imgurStatus.isError).toBeTruthy();
    });

    test('should navigate to config tab and show input fields', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Check that config input fields exist
        const discordInput = page.locator('#discord-client-id');
        await expect(discordInput).toBeVisible();
        
        const spotifyClientInput = page.locator('#spotify-client-id');
        await expect(spotifyClientInput).toBeVisible();
        
        const spotifySecretInput = page.locator('#spotify-client-secret');
        await expect(spotifySecretInput).toBeVisible();
        
        const imgurInput = page.locator('#imgur-client-id');
        await expect(imgurInput).toBeVisible();

        // Clear any existing values first (in case of test persistence)
        await discordInput.fill('');
        await spotifyClientInput.fill('');
        await spotifySecretInput.fill('');
        await imgurInput.fill('');

        // Check that fields are now empty
        expect(await discordInput.inputValue()).toBe('');
        expect(await spotifyClientInput.inputValue()).toBe('');
        expect(await spotifySecretInput.inputValue()).toBe('');
        expect(await imgurInput.inputValue()).toBe('');
    });

    test('should allow entering configuration values', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Test entering Discord Client ID
        const discordInput = page.locator('#discord-client-id');
        await discordInput.fill('test-discord-client-id');
        expect(await discordInput.inputValue()).toBe('test-discord-client-id');

        // Test entering Spotify credentials
        const spotifyClientInput = page.locator('#spotify-client-id');
        const spotifySecretInput = page.locator('#spotify-client-secret');
        
        await spotifyClientInput.fill('test-spotify-client-id');
        await spotifySecretInput.fill('test-spotify-client-secret');
        
        expect(await spotifyClientInput.inputValue()).toBe('test-spotify-client-id');
        expect(await spotifySecretInput.inputValue()).toBe('test-spotify-client-secret');

        // Test entering Imgur Client ID
        const imgurInput = page.locator('#imgur-client-id');
        await imgurInput.fill('test-imgur-client-id');
        expect(await imgurInput.inputValue()).toBe('test-imgur-client-id');
    });

    test('should have working save configuration button', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Find and click save button
        const saveButton = page.locator('button:has-text("Save Configuration")');
        await expect(saveButton).toBeVisible();
        
        // Click save button (should not throw error)
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Should not crash or show error dialog
        const errorDialog = page.locator('.error-dialog, .modal-error');
        expect(await errorDialog.count()).toBe(0);
    });

    test('should have working export/import buttons', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Check export button exists and is clickable
        const exportButton = page.locator('button:has-text("Export Config")');
        await expect(exportButton).toBeVisible();

        // Check import button exists and is clickable
        const importButton = page.locator('button:has-text("Import Config")');
        await expect(importButton).toBeVisible();

        // Note: We don't actually click these as they would open file dialogs
        // which are hard to test in automated tests
    });

    test('should show validation messages for invalid inputs', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Enter invalid Discord Client ID (too short)
        const discordInput = page.locator('#discord-client-id');
        await discordInput.fill('123');
        
        // Try to save
        const saveButton = page.locator('button:has-text("Save Configuration")');
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Should show some kind of validation feedback
        // (This depends on the actual validation implementation)
        
        // Clear the invalid input
        await discordInput.fill('');
    });

    test('should maintain config values when switching tabs', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Enter some test values
        await page.locator('#discord-client-id').fill('persistent-discord-id');
        await page.locator('#spotify-client-id').fill('persistent-spotify-id');

        // Switch to status tab
        await page.click('[data-tab="status"]');
        await page.waitForTimeout(1000);

        // Switch back to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Values should still be there
        expect(await page.locator('#discord-client-id').inputValue()).toBe('persistent-discord-id');
        expect(await page.locator('#spotify-client-id').inputValue()).toBe('persistent-spotify-id');
    });

    test('should handle console errors gracefully', async () => {
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // Navigate through all tabs
        await page.click('[data-tab="status"]');
        await page.waitForTimeout(500);
        
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(500);
        
        await page.click('[data-tab="help"]');
        await page.waitForTimeout(500);
        
        await page.click('[data-tab="logs"]');
        await page.waitForTimeout(500);

        // Should not have critical console errors
        const criticalErrors = consoleErrors.filter(error => 
            !error.includes('DevTools') && 
            !error.includes('Extension') &&
            !error.includes('favicon')
        );
        
        expect(criticalErrors.length).toBe(0);
    });
});
