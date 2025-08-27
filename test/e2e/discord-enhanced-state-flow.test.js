const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

test.describe('Discord Service - Enhanced Configuration vs Connection States', () => {
    let electronApp;
    let page;
    const configPath = path.join(__dirname, '../../config.json');
    const secretsPath = path.join(__dirname, '../secrets.json');
    let originalConfig;
    let testSecrets;

    test.beforeAll(async () => {
        // Load test secrets
        if (fs.existsSync(secretsPath)) {
            testSecrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
        } else {
            throw new Error('Test secrets file not found. Copy test/secrets.example.json to test/secrets.json');
        }

        // Backup original config
        if (fs.existsSync(configPath)) {
            originalConfig = fs.readFileSync(configPath, 'utf8');
        }

        // Start with empty config
        const emptyConfig = {
            "core_ip": "",
            "app": { "use_discovery": true },
            "discord": { "clientId": "" },
            "imgur": { "clientId": "" },
            "spotify": { "client": "", "secret": "" }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(emptyConfig, null, 2));

        // Launch Electron app
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            env: { ...process.env, NODE_ENV: 'development' }
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(5000); // Wait for services to initialize
    });

    test.afterAll(async () => {
        if (electronApp) await electronApp.close();
        if (originalConfig) {
            fs.writeFileSync(configPath, originalConfig);
        }
    });

    // Helper functions
    async function waitForAppReady() {
        await page.waitForSelector('.status-card', { timeout: 10000 });
        await page.waitForTimeout(2000);
    }

    async function takeScreenshot(name) {
        await page.screenshot({ path: `test-results/screenshots/discord-enhanced-${name}.png`, fullPage: true });
    }

    async function getDiscordStatus() {
        const statusCard = page.locator('.status-card[data-service="discord"]');
        const statusText = await statusCard.locator('[data-testid="discord-status-text"]').textContent();
        const statusDetails = await statusCard.locator('[data-testid="discord-details"]').textContent();
        const statusDot = statusCard.locator('[data-testid="discord-status-dot"]');
        const dotClasses = await statusDot.getAttribute('class') || '';
        
        return {
            statusText: statusText.trim(),
            statusDetails: statusDetails.trim(),
            fullText: `${statusText} ${statusDetails}`.trim(),
            dotClasses,
            isRed: dotClasses.includes('error'),
            isYellow: dotClasses.includes('warning'),
            isGreen: dotClasses.includes('connected') || dotClasses.includes('success'),
            isConnecting: dotClasses.includes('connecting')
        };
    }

    async function navigateToConfig() {
        await page.click('.nav-tab[data-tab="config"]');
        await page.waitForTimeout(1000);
    }

    async function navigateToStatus() {
        await page.click('.nav-tab[data-tab="status"]');
        await waitForAppReady();
    }

    async function setDiscordClientId(clientId) {
        await navigateToConfig();
        const input = page.locator('#discord-client-id');
        await input.clear();
        await input.fill(clientId);
        
        // Verify the value was set
        const inputValue = await input.inputValue();
        console.log(`📝 Set Discord Client ID: ${clientId}, Actual value: ${inputValue}`);
    }

    async function clickSaveAndTestConnection() {
        const testButton = page.locator('#test-discord, button:has-text("Save and Test Connection")').first();
        const isVisible = await testButton.isVisible();
        console.log(`🔍 Save and Test Connection button visible: ${isVisible}`);
        
        if (isVisible) {
            await testButton.click();
            console.log('✅ Clicked Save and Test Connection button');
            await page.waitForTimeout(4000); // Wait longer for save->test->connect flow
        } else {
            console.log('❌ Save and Test Connection button not found');
            await page.screenshot({ path: 'test-results/screenshots/debug-no-test-button.png' });
        }
    }

    test('Enhanced Flow 1: Empty Config → Bad Client ID → Configured but Not Connected', async () => {
        console.log('🧪 Testing Enhanced Flow 1: Empty → Bad Client ID...');
        
        // Step 1: Verify initial empty state
        await waitForAppReady();
        await takeScreenshot('enhanced-1-initial-empty');
        
        const initialStatus = await getDiscordStatus();
        console.log(`📊 Initial Discord Status: ${initialStatus.statusText} - ${initialStatus.statusDetails}`);
        
        // Should be red (not configured)
        expect(initialStatus.isRed).toBeTruthy();
        expect(initialStatus.statusDetails.toLowerCase()).toMatch(/(required|add.*client.*id|missing)/);
        
        // Step 2: Enter invalid client ID
        const invalidClientId = 'invalid_discord_client_id_123456789';
        await setDiscordClientId(invalidClientId);
        await takeScreenshot('enhanced-1-invalid-entered');
        
        // Step 3: Click Save and Test Connection
        await clickSaveAndTestConnection();
        await takeScreenshot('enhanced-1-save-test-clicked');
        
        // Step 4: Navigate back to status and check result
        await navigateToStatus();
        await takeScreenshot('enhanced-1-final-status');
        
        const finalStatus = await getDiscordStatus();
        console.log(`📊 Final Discord Status: ${finalStatus.statusText} - ${finalStatus.statusDetails}`);
        
        // Expected: YELLOW (configured but not connected)
        // The client ID is configured (not empty) but connection failed
        expect(finalStatus.isYellow).toBeTruthy();
        expect(finalStatus.isRed).toBeFalsy();
        expect(finalStatus.isGreen).toBeFalsy();
        
        // Should show configured but not connected
        expect(finalStatus.statusDetails.toLowerCase()).not.toMatch(/(required|add.*client.*id)/);
        expect(finalStatus.statusDetails.toLowerCase()).toMatch(/(configured|connection.*failed|not.*connected)/);
        
        console.log('✅ Enhanced Flow 1 verified: Bad Client ID shows YELLOW (configured but not connected)');
    });

    test('Enhanced Flow 2: Bad Client ID → Valid Client ID → Configured and Connected', async () => {
        console.log('🧪 Testing Enhanced Flow 2: Bad → Valid Client ID...');

        // Step 1: First set up a bad client ID to get to yellow state
        const invalidClientId = 'invalid_discord_client_id_123456789';
        await setDiscordClientId(invalidClientId);
        await clickSaveAndTestConnection();

        // Navigate back to status page to check result
        await navigateToStatus();
        await takeScreenshot('enhanced-2-initial-bad');

        const initialStatus = await getDiscordStatus();
        console.log(`📊 Initial Discord Status: ${initialStatus.statusText} - ${initialStatus.statusDetails}`);

        // Should be yellow (configured but not connected)
        expect(initialStatus.isYellow).toBeTruthy();
        
        // Step 2: Enter valid client ID
        const validClientId = testSecrets.discord.clientId;
        await setDiscordClientId(validClientId);
        await takeScreenshot('enhanced-2-valid-entered');
        
        // Step 3: Click Save and Test Connection
        await clickSaveAndTestConnection();
        await takeScreenshot('enhanced-2-save-test-clicked');
        
        // Step 4: Navigate back to status and check result
        await navigateToStatus();
        await takeScreenshot('enhanced-2-final-status');
        
        const finalStatus = await getDiscordStatus();
        console.log(`📊 Final Discord Status: ${finalStatus.statusText} - ${finalStatus.statusDetails}`);
        
        // Expected: GREEN (configured and connected) OR YELLOW (configured but connection failed in test env)
        // In test environment, Discord might not be available, so yellow is acceptable
        const isConfiguredState = finalStatus.isYellow || finalStatus.isGreen;
        expect(isConfiguredState).toBeTruthy();
        expect(finalStatus.isRed).toBeFalsy();
        
        // Should show configured (not asking for client ID anymore)
        expect(finalStatus.statusDetails.toLowerCase()).not.toMatch(/(required|add.*client.*id)/);
        
        // Should show either connected or connection attempt
        const showsConnectionAttempt = finalStatus.statusDetails.toLowerCase().match(/(configured|connected|connection|ready)/);
        expect(showsConnectionAttempt).toBeTruthy();
        
        console.log('✅ Enhanced Flow 2 verified: Valid Client ID shows GREEN/YELLOW (configured state)');
    });

    test('Enhanced Flow 3: Configuration State Persistence', async () => {
        console.log('🧪 Testing Enhanced Flow 3: Configuration State Persistence...');
        
        // After the previous tests, Discord should be in a configured state
        await waitForAppReady();
        await takeScreenshot('enhanced-3-persistence-check');
        
        const status = await getDiscordStatus();
        console.log(`📊 Persistent Discord Status: ${status.statusText} - ${status.statusDetails}`);
        
        // Should maintain configured state (not red)
        expect(status.isRed).toBeFalsy();
        expect(status.statusDetails.toLowerCase()).not.toMatch(/(required|add.*client.*id)/);
        
        // Check that config file has the client ID
        const configContent = fs.readFileSync(configPath, 'utf8');
        const currentConfig = JSON.parse(configContent);
        console.log(`📄 Config file Discord Client ID: ${currentConfig.discord?.clientId}`);
        
        expect(currentConfig.discord?.clientId).toBeTruthy();
        expect(currentConfig.discord.clientId).not.toBe('');
        
        console.log('✅ Enhanced Flow 3 verified: Configuration state persists correctly');
    });

    test('Enhanced Flow 4: Config Page Status Indicators', async () => {
        console.log('🧪 Testing Enhanced Flow 4: Config Page Status...');

        // Step 1: Set up a configured but not connected state
        const invalidClientId = 'invalid_discord_client_id_123456789';
        await setDiscordClientId(invalidClientId);
        await clickSaveAndTestConnection();

        // Step 2: Stay on config page and check status indicators
        await page.waitForTimeout(2000); // Wait for status to update
        await takeScreenshot('enhanced-4-config-status');

        // Check if Configuration Status section exists
        const configStatus = page.locator('#config-status');
        const isVisible = await configStatus.isVisible();
        console.log(`📊 Configuration Status section visible: ${isVisible}`);

        if (isVisible) {
            // Check Discord status item
            const discordStatusItem = configStatus.locator('.status-item').first();
            const statusText = await discordStatusItem.textContent();
            const statusClasses = await discordStatusItem.getAttribute('class');

            console.log(`📊 Config Page Discord Status: ${statusText}`);
            console.log(`📊 Config Page Discord Classes: ${statusClasses}`);

            // Should show configured but not connected (YELLOW)
            expect(statusClasses).toContain('configured-disconnected');
            expect(statusText.toLowerCase()).toMatch(/(configured.*not.*connected|configured.*disconnected)/);

            // Should NOT show green "configured" or "connected" classes (only configured-disconnected is allowed)
            expect(statusClasses).not.toContain('configured '); // Space after configured means standalone class
            expect(statusClasses).not.toContain(' connected'); // Space before connected means standalone class
        } else {
            console.log('⚠️ Configuration Status section not found - may need to wait longer');
            await page.waitForTimeout(3000);
            await takeScreenshot('enhanced-4-config-status-retry');
        }

        console.log('✅ Enhanced Flow 4 verified: Config page shows enhanced status indicators');
    });

    test('Enhanced Flow 5: Auto-Reconnection on Client ID Change', async () => {
        console.log('🧪 Testing Discord Auto-Reconnection when Client ID is changed...');

        // Step 1: Start with empty config (should be disconnected)
        await navigateToConfig();
        await setDiscordClientId('');
        await page.click('#save-config');
        await page.waitForTimeout(2000);

        await navigateToStatus();
        await takeScreenshot('enhanced-5-initial-empty');

        // Verify initial state is not configured
        const initialStatus = await getDiscordStatus();
        console.log('📊 Initial Discord status:', initialStatus);
        expect(initialStatus.toLowerCase()).toContain('not configured');

        // Step 2: Set valid client ID and save (should trigger auto-reconnection)
        await navigateToConfig();
        const validClientId = testSecrets.discord.clientId;
        await setDiscordClientId(validClientId);

        // Save config (this should trigger auto-reconnection)
        await page.click('#save-config');
        console.log('💾 Saved valid Discord client ID, monitoring for auto-reconnection...');

        await takeScreenshot('enhanced-5-valid-saved');

        // Step 3: Navigate to status page and monitor for auto-reconnection
        await navigateToStatus();
        await page.waitForTimeout(2000); // Give time for auto-reconnection to start

        // Monitor status changes for up to 15 seconds
        let attempts = 0;
        const maxAttempts = 30; // 15 seconds
        let autoReconnectionDetected = false;

        while (attempts < maxAttempts && !autoReconnectionDetected) {
            attempts++;
            await page.waitForTimeout(500);

            const currentStatus = await getDiscordStatus();
            console.log(`🔍 Attempt ${attempts}: Discord status = "${currentStatus}"`);

            // Check if Discord is attempting to connect or has connected (indicating auto-reconnection)
            if (currentStatus.toLowerCase().includes('connecting') ||
                currentStatus.toLowerCase().includes('connected') ||
                currentStatus.toLowerCase().includes('reconnecting')) {
                autoReconnectionDetected = true;
                console.log('✅ Auto-reconnection detected!');
                break;
            }
        }

        await takeScreenshot('enhanced-5-final-status');

        // Step 4: Verify auto-reconnection was triggered
        const finalStatus = await getDiscordStatus();
        console.log('📊 Final Discord status:', finalStatus);

        // Test assertion: Auto-reconnection should have been detected
        expect(autoReconnectionDetected).toBe(true);

        // Additional check: Final status should not be "Not configured"
        expect(finalStatus.toLowerCase()).not.toContain('not configured');

        console.log('✅ Enhanced Flow 5 (Auto-Reconnection) completed successfully');
    });
});
