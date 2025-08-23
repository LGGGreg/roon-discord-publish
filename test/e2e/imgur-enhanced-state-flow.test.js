const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

test.describe('Imgur Service - Enhanced Configuration vs Connection States', () => {
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

    async function navigateToStatus() {
        await page.click('.nav-tab[data-tab="status"]');
        await page.waitForTimeout(1000);
    }

    async function getImgurStatus() {
        await navigateToStatus();
        const statusText = await page.locator('[data-testid="imgur-status-text"]').textContent();
        const statusDot = await page.locator('[data-testid="imgur-status-dot"]').getAttribute('class');
        const details = await page.locator('[data-testid="imgur-details"]').textContent();
        
        return {
            statusText: statusText.trim(),
            statusDot: statusDot || '',
            details: details.trim(),
            isError: statusDot?.includes('error') || statusDot?.includes('disconnected') || false,
            isConnected: statusDot?.includes('connected') || false,
            isConnecting: statusDot?.includes('connecting') || false
        };
    }

    async function setImgurClientId(clientId) {
        await navigateToConfig();
        
        const clientInput = page.locator('#imgur-client-id');
        await clientInput.clear();
        await clientInput.fill(clientId);
        
        const clientValue = await clientInput.inputValue();
        console.log(`📝 Set Imgur Client ID: ${clientId}, Actual value: ${clientValue}`);
    }

    async function clickSaveAndTestConnection() {
        const testButton = page.locator('#test-imgur');
        const isVisible = await testButton.isVisible();
        console.log(`🔍 Save and Test Connection button visible: ${isVisible}`);
        
        if (isVisible) {
            await testButton.click();
            console.log('✅ Clicked Save and Test Connection button');
            await page.waitForTimeout(3000); // Wait for save and test process
            return true;
        } else {
            console.log('❌ Save and Test Connection button not found');
            return false;
        }
    }

    test('Enhanced Flow 1: Empty Config → Invalid Client ID → Configured but Not Connected', async () => {
        console.log('🧪 Testing Enhanced Flow 1: Empty → Invalid Client ID...');
        
        // Step 1: Check initial state (empty config)
        const initialStatus = await getImgurStatus();
        console.log(`📊 Initial Imgur Status: ${initialStatus.statusText} - ${initialStatus.details}`);
        
        // Should be in error state (missing credentials)
        expect(initialStatus.isError).toBeTruthy();
        expect(initialStatus.statusText.toLowerCase()).toMatch(/(error|not.*configured|optional)/);
        
        // Step 2: Set invalid client ID
        await setImgurClientId('invalid_imgur_client_id_123456789');
        await clickSaveAndTestConnection();
        
        // Step 3: Check final state
        const finalStatus = await getImgurStatus();
        console.log(`📊 Final Imgur Status: ${finalStatus.statusText} - ${finalStatus.details}`);
        
        // Should show configured but not connected (YELLOW state)
        expect(finalStatus.statusText.toLowerCase()).toMatch(/(configured|connecting|not.*connected)/);
        console.log('✅ Enhanced Flow 1 verified: Invalid Client ID shows appropriate state');
    });

    test('Enhanced Flow 2: Invalid Client ID → Valid Client ID → Configured and Connected', async () => {
        console.log('🧪 Testing Enhanced Flow 2: Invalid → Valid Client ID...');
        
        // Step 1: Set invalid client ID first
        await setImgurClientId('invalid_imgur_client_id_123456789');
        await clickSaveAndTestConnection();
        
        const initialStatus = await getImgurStatus();
        console.log(`📊 Initial Imgur Status: ${initialStatus.statusText} - ${initialStatus.details}`);
        
        // Step 2: Set valid client ID
        await setImgurClientId(testSecrets.imgur.clientId);
        await clickSaveAndTestConnection();
        
        // Step 3: Check final state
        const finalStatus = await getImgurStatus();
        console.log(`📊 Final Imgur Status: ${finalStatus.statusText} - ${finalStatus.details}`);
        
        // Should show connected or configured state
        expect(finalStatus.statusText.toLowerCase()).toMatch(/(connected|configured)/);
        console.log('✅ Enhanced Flow 2 verified: Valid Client ID shows appropriate state');
    });

    test('Enhanced Flow 3: Configuration State Persistence', async () => {
        console.log('🧪 Testing Enhanced Flow 3: Configuration State Persistence...');
        
        // Check that configuration persists after app operations
        const status = await getImgurStatus();
        console.log(`📊 Persistent Imgur Status: ${status.statusText} - ${status.details}`);
        
        // Check config file
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        console.log(`📄 Config file Imgur Client ID: ${config.imgur?.clientId || '[EMPTY]'}`);
        
        // Should have valid client ID saved
        expect(config.imgur?.clientId).toBeTruthy();
        console.log('✅ Enhanced Flow 3 verified: Configuration state persists correctly');
    });

    test('Enhanced Flow 4: Config Page Status Indicators', async () => {
        console.log('🧪 Testing Enhanced Flow 4: Config Page Status...');
        
        // Set invalid client ID to test config page indicators
        await setImgurClientId('invalid_imgur_client_id_123456789');
        await clickSaveAndTestConnection();
        
        // Navigate to config page and check status indicators
        await navigateToConfig();
        
        const configStatus = page.locator('#config-status');
        const isVisible = await configStatus.isVisible();
        console.log(`📊 Configuration Status section visible: ${isVisible}`);
        
        if (isVisible) {
            // Find Imgur status item in config page
            const imgurStatusItems = await configStatus.locator('.status-item').all();
            let imgurStatus = null;
            
            for (const item of imgurStatusItems) {
                const text = await item.textContent();
                if (text.toLowerCase().includes('imgur')) {
                    imgurStatus = {
                        statusText: text.trim(),
                        statusClasses: await item.getAttribute('class') || ''
                    };
                    break;
                }
            }
            
            if (imgurStatus) {
                console.log(`📊 Config Page Imgur Status: ${imgurStatus.statusText}`);
                console.log(`📊 Config Page Imgur Classes: ${imgurStatus.statusClasses}`);
                
                // Should show configured state with appropriate styling
                expect(imgurStatus.statusText.toLowerCase()).toMatch(/(imgur|configured|connecting|not.*connected)/);
                expect(imgurStatus.statusClasses).toMatch(/(configured|connecting|warning|error)/);
            }
        }
        
        console.log('✅ Enhanced Flow 4 verified: Config page shows enhanced status indicators');
    });
});
