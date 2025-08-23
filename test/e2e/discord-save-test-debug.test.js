const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

test.describe('Discord Save and Test - Debug Issues', () => {
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
    async function navigateToConfig() {
        await page.click('.nav-tab[data-tab="config"]');
        await page.waitForTimeout(1000);
    }

    async function setDiscordClientId(clientId) {
        await navigateToConfig();
        const input = page.locator('#discord-client-id');
        await input.clear();
        await input.fill(clientId);
        
        const inputValue = await input.inputValue();
        console.log(`📝 Set Discord Client ID: ${clientId}, Actual value: ${inputValue}`);
    }

    async function clickSaveAndTestConnection() {
        const testButton = page.locator('#test-discord');
        const isVisible = await testButton.isVisible();
        console.log(`🔍 Save and Test Connection button visible: ${isVisible}`);
        
        if (isVisible) {
            // Listen for console messages and notifications
            const consoleMessages = [];
            const notifications = [];
            
            page.on('console', msg => {
                consoleMessages.push(`${msg.type()}: ${msg.text()}`);
            });
            
            // Listen for notification elements
            page.on('response', response => {
                console.log(`📡 Network response: ${response.url()} - ${response.status()}`);
            });
            
            await testButton.click();
            console.log('✅ Clicked Save and Test Connection button');
            
            // Wait for the save and test process to complete
            await page.waitForTimeout(4000);
            
            // Check for any error notifications
            const errorNotifications = await page.locator('.notification.error, .toast.error').count();
            const successNotifications = await page.locator('.notification.success, .toast.success').count();
            const warningNotifications = await page.locator('.notification.warning, .toast.warning').count();
            
            console.log(`📊 Notifications - Error: ${errorNotifications}, Success: ${successNotifications}, Warning: ${warningNotifications}`);
            
            // Get notification text if any exist
            if (errorNotifications > 0) {
                const errorText = await page.locator('.notification.error, .toast.error').first().textContent();
                console.log(`❌ Error notification: ${errorText}`);
            }
            
            if (successNotifications > 0) {
                const successText = await page.locator('.notification.success, .toast.success').first().textContent();
                console.log(`✅ Success notification: ${successText}`);
            }
            
            if (warningNotifications > 0) {
                const warningText = await page.locator('.notification.warning, .toast.warning').first().textContent();
                console.log(`⚠️ Warning notification: ${warningText}`);
            }
            
            // Log console messages
            console.log(`📝 Console messages during save and test:`);
            consoleMessages.forEach(msg => console.log(`  ${msg}`));
            
            return {
                errorNotifications,
                successNotifications,
                warningNotifications,
                consoleMessages
            };
        } else {
            console.log('❌ Save and Test Connection button not found');
            return null;
        }
    }

    async function getConfigPageDiscordStatus() {
        const configStatus = page.locator('#config-status');
        const isVisible = await configStatus.isVisible();
        
        if (!isVisible) {
            console.log('⚠️ Configuration Status section not visible');
            return null;
        }
        
        // Find Discord status item
        const discordStatusItem = configStatus.locator('.status-item').first();
        const statusText = await discordStatusItem.textContent();
        const statusClasses = await discordStatusItem.getAttribute('class');
        
        return {
            statusText: statusText.trim(),
            statusClasses: statusClasses || '',
            isRed: statusClasses?.includes('missing') || false,
            isYellow: statusClasses?.includes('configured-disconnected') || statusClasses?.includes('configured-unknown') || statusClasses?.includes('warning') || false,
            isBlue: statusClasses?.includes('connecting') || false,
            isGreen: statusClasses?.includes('connected') || statusClasses?.includes('configured ') || false
        };
    }

    test('Debug Issue 1: Valid Client ID Error Notification', async () => {
        console.log('🧪 Testing Valid Client ID - Should NOT show error notification...');
        
        // Use a valid Discord Client ID
        const validClientId = testSecrets.discord.clientId;
        await setDiscordClientId(validClientId);
        await page.screenshot({ path: 'test-results/screenshots/debug-valid-before.png' });
        
        // Click Save and Test Connection and capture all notifications
        const result = await clickSaveAndTestConnection();
        await page.screenshot({ path: 'test-results/screenshots/debug-valid-after.png' });
        
        // Assertions
        expect(result).not.toBeNull();

        // Should NOT have error notifications for valid client ID
        expect(result.errorNotifications).toBe(0);

        // Check if Discord actually connected (from console logs)
        const hasConnectionLogs = result.consoleMessages.some(msg =>
            msg.includes('Discord ready') ||
            msg.includes('status: connected') ||
            msg.includes('Connection established')
        );

        console.log(`📊 Discord connection successful: ${hasConnectionLogs}`);

        // The main requirement is NO ERROR notifications for valid client ID
        // Connection success is a bonus but not required for this test
        expect(result.errorNotifications).toBe(0);
        
        console.log('✅ Valid Client ID test completed');
    });

    test('Debug Issue 2: Invalid Client ID Color on Config Page', async () => {
        console.log('🧪 Testing Invalid Client ID - Config page color should be YELLOW...');
        
        // Use an invalid Discord Client ID (contains letters - should be digits only)
        const invalidClientId = 'invalid_discord_client_id_123456789';
        await setDiscordClientId(invalidClientId);
        await page.screenshot({ path: 'test-results/screenshots/debug-invalid-before.png' });
        
        // Click Save and Test Connection
        const result = await clickSaveAndTestConnection();
        await page.screenshot({ path: 'test-results/screenshots/debug-invalid-after.png' });
        
        // Check config page status
        const configStatus = await getConfigPageDiscordStatus();
        console.log(`📊 Config Page Status: ${configStatus?.statusText}`);
        console.log(`📊 Config Page Classes: ${configStatus?.statusClasses}`);
        console.log(`📊 Color Analysis - Red: ${configStatus?.isRed}, Yellow: ${configStatus?.isYellow}, Blue: ${configStatus?.isBlue}, Green: ${configStatus?.isGreen}`);
        
        // Assertions
        expect(configStatus).not.toBeNull();
        
        // Should show configured state (not missing credentials)
        expect(configStatus.isRed).toBeFalsy();
        
        // Should be YELLOW (configured but not connected) - NOT RED
        expect(configStatus.isYellow).toBeTruthy();
        
        // Should show appropriate text
        expect(configStatus.statusText.toLowerCase()).toMatch(/(configured|connecting|not.*connected)/);
        
        console.log('✅ Invalid Client ID color test completed');
    });

    test('Debug Issue 3: Valid Client ID Format Validation', async () => {
        console.log('🧪 Testing Valid Client ID Format - Should pass validation...');
        
        // Test with properly formatted Discord Client ID
        const validClientId = testSecrets.discord.clientId;
        console.log(`🔍 Testing with Client ID: ${validClientId} (length: ${validClientId.length})`);
        
        // Check if it matches Discord format (17-19 digits)
        const isValidFormat = /^\d{17,19}$/.test(validClientId);
        console.log(`📊 Client ID format validation: ${isValidFormat}`);
        
        await setDiscordClientId(validClientId);
        const result = await clickSaveAndTestConnection();
        
        // Should not have error notifications for properly formatted client ID
        expect(result.errorNotifications).toBe(0);
        
        console.log('✅ Valid Client ID format test completed');
    });
});
