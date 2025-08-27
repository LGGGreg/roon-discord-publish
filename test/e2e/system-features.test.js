const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('System Features Tests', () => {
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

    test('should have minimize to tray option in config', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Check that minimize to tray checkbox exists
        const minimizeToTrayCheckbox = page.locator('#app-minimize-to-tray');
        await expect(minimizeToTrayCheckbox).toBeVisible();
        
        // Should be checked by default
        expect(await minimizeToTrayCheckbox.isChecked()).toBeTruthy();
    });

    test('should save minimize to tray setting', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Toggle minimize to tray setting
        const minimizeToTrayCheckbox = page.locator('#app-minimize-to-tray');
        const initialState = await minimizeToTrayCheckbox.isChecked();
        
        // Toggle the setting
        await minimizeToTrayCheckbox.click();
        await page.waitForTimeout(500);
        
        // Save configuration
        const saveButton = page.locator('button:has-text("Save Configuration")');
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Check that setting was toggled
        expect(await minimizeToTrayCheckbox.isChecked()).toBe(!initialState);
        
        // Toggle back to original state
        await minimizeToTrayCheckbox.click();
        await saveButton.click();
        await page.waitForTimeout(1000);
        
        // Verify it's back to original state
        expect(await minimizeToTrayCheckbox.isChecked()).toBe(initialState);
    });

    test('should show Roon connection without requiring re-authentication', async () => {
        // Navigate to status tab
        await page.click('[data-tab="status"]');
        await page.waitForTimeout(5000); // Allow more time for services to connect

        // Check Roon status
        const roonStatusCard = page.locator('.status-card[data-service="roon"]');
        await expect(roonStatusCard).toBeVisible();

        const roonStatusText = await roonStatusCard.locator('[data-testid="roon-status-text"]').textContent();
        const roonStatusDetails = await roonStatusCard.locator('[data-testid="roon-details"]').textContent();
        
        console.log(`Roon Status: ${roonStatusText} - ${roonStatusDetails}`);

        // Should be connected (not requiring authentication)
        expect(roonStatusText.toLowerCase()).toContain('connected');
        
        // Should show core information (or at least be connected)
        expect(roonStatusDetails.toLowerCase()).toMatch(/win_svr_2019|core|paired|connection established/);
    });

    test('should have saved Roon pairing state in config', async () => {
        // Check if config.json contains Roon state
        const configPath = path.join(__dirname, '../../config.json');
        
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            console.log('Roon state in config:', {
                hasRoonState: !!config.roonstate,
                hasTokens: !!(config.roonstate && config.roonstate.tokens),
                hasPairedCoreId: !!(config.roonstate && config.roonstate.paired_core_id),
                pairedCoreId: config.roonstate?.paired_core_id
            });

            // Should have roonstate section
            expect(config.roonstate).toBeDefined();
            
            // Should have paired core ID if connected
            if (config.roonstate.paired_core_id) {
                expect(config.roonstate.paired_core_id).toMatch(/^[a-f0-9-]+$/);
            }
        } else {
            console.log('Config file not found - this is expected for fresh installs');
        }
    });

    test('should have working window controls', async () => {
        // Test that window controls exist and are functional
        const mainWindow = electronApp.windows()[0];
        
        // Window should be visible initially
        expect(await mainWindow.isVisible()).toBeTruthy();
        
        // Test minimize (should work without errors)
        await mainWindow.minimize();
        await page.waitForTimeout(500);
        
        // Restore window
        await mainWindow.restore();
        await page.waitForTimeout(500);
        
        expect(await mainWindow.isVisible()).toBeTruthy();
    });

    test('should handle app lifecycle correctly', async () => {
        // Test that the app handles close events properly
        // (This is mainly to ensure no crashes occur during lifecycle events)
        
        const mainWindow = electronApp.windows()[0];
        
        // Hide and show window (simulates tray behavior)
        await mainWindow.hide();
        await page.waitForTimeout(500);
        
        await mainWindow.show();
        await page.waitForTimeout(500);
        
        expect(await mainWindow.isVisible()).toBeTruthy();
    });

    test('should maintain service connections during window operations', async () => {
        // Navigate to status tab
        await page.click('[data-tab="status"]');
        await page.waitForTimeout(1000);

        // Check that services remain connected after window operations
        const services = ['discord', 'roon', 'spotify', 'imgur'];
        
        for (const service of services) {
            const statusCard = page.locator(`.status-card[data-service="${service}"]`);
            const statusText = await statusCard.locator(`[data-testid="${service}-status-text"]`).textContent();
            
            console.log(`${service} status: ${statusText}`);
            
            // Services should be connected or at least not in error state
            expect(statusText.toLowerCase()).not.toContain('error');
        }
        
        // Hide and show window
        const mainWindow = electronApp.windows()[0];
        await mainWindow.hide();
        await page.waitForTimeout(1000);
        await mainWindow.show();
        await page.waitForTimeout(1000);
        
        // Services should still be connected
        for (const service of services) {
            const statusCard = page.locator(`.status-card[data-service="${service}"]`);
            const statusText = await statusCard.locator(`[data-testid="${service}-status-text"]`).textContent();
            
            console.log(`${service} status after window operations: ${statusText}`);
            
            // Services should maintain their connection state
            expect(statusText.toLowerCase()).not.toContain('error');
        }
    });
});
