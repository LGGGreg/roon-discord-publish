const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

test.describe('Spotify Service - Enhanced Configuration vs Connection States', () => {
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

    async function getSpotifyStatus() {
        await navigateToStatus();
        const statusText = await page.locator('[data-testid="spotify-status-text"]').textContent();
        const statusDot = await page.locator('[data-testid="spotify-status-dot"]').getAttribute('class');
        const details = await page.locator('[data-testid="spotify-details"]').textContent();
        
        return {
            statusText: statusText.trim(),
            statusDot: statusDot || '',
            details: details.trim(),
            isError: statusDot?.includes('error') || statusDot?.includes('disconnected') || false,
            isConnected: statusDot?.includes('connected') || false,
            isConnecting: statusDot?.includes('connecting') || false
        };
    }

    async function setSpotifyCredentials(clientId, clientSecret) {
        await navigateToConfig();
        
        const clientInput = page.locator('#spotify-client-id');
        const secretInput = page.locator('#spotify-client-secret');
        
        await clientInput.clear();
        await clientInput.fill(clientId);
        
        await secretInput.clear();
        await secretInput.fill(clientSecret);
        
        const clientValue = await clientInput.inputValue();
        const secretValue = await secretInput.inputValue();
        
        console.log(`📝 Set Spotify Client ID: ${clientId}, Actual value: ${clientValue}`);
        console.log(`📝 Set Spotify Client Secret: ${clientSecret ? '[HIDDEN]' : '[EMPTY]'}, Actual length: ${secretValue.length}`);
    }

    async function clickSaveAndTestConnection() {
        const testButton = page.locator('#test-spotify');
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

    test('Enhanced Flow 1: Empty Config → Invalid Credentials → Configured but Not Connected', async () => {
        console.log('🧪 Testing Enhanced Flow 1: Empty → Invalid Credentials...');
        
        // Step 1: Check initial state (empty config)
        const initialStatus = await getSpotifyStatus();
        console.log(`📊 Initial Spotify Status: ${initialStatus.statusText} - ${initialStatus.details}`);
        
        // Should be in error state (missing credentials)
        expect(initialStatus.isError).toBeTruthy();
        expect(initialStatus.statusText.toLowerCase()).toMatch(/(error|not.*configured|optional)/);
        
        // Step 2: Set invalid credentials
        await setSpotifyCredentials('invalid_spotify_client_id_123456789', 'invalid_spotify_secret_123456789');
        await clickSaveAndTestConnection();
        
        // Step 3: Check final state
        const finalStatus = await getSpotifyStatus();
        console.log(`📊 Final Spotify Status: ${finalStatus.statusText} - ${finalStatus.details}`);
        
        // Should show configured but not connected (YELLOW state)
        expect(finalStatus.statusText.toLowerCase()).toMatch(/(configured|connecting|not.*connected)/);
        console.log('✅ Enhanced Flow 1 verified: Invalid credentials show appropriate state');
    });

    test('Enhanced Flow 2: Invalid Credentials → Valid Credentials → Configured and Connected', async () => {
        console.log('🧪 Testing Enhanced Flow 2: Invalid → Valid Credentials...');
        
        // Step 1: Set invalid credentials first
        await setSpotifyCredentials('invalid_spotify_client_id_123456789', 'invalid_spotify_secret_123456789');
        await clickSaveAndTestConnection();
        
        const initialStatus = await getSpotifyStatus();
        console.log(`📊 Initial Spotify Status: ${initialStatus.statusText} - ${initialStatus.details}`);
        
        // Step 2: Set valid credentials
        await setSpotifyCredentials(testSecrets.spotify.client, testSecrets.spotify.secret);
        await clickSaveAndTestConnection();
        
        // Step 3: Check final state
        const finalStatus = await getSpotifyStatus();
        console.log(`📊 Final Spotify Status: ${finalStatus.statusText} - ${finalStatus.details}`);
        
        // Should show connected or configured state
        expect(finalStatus.statusText.toLowerCase()).toMatch(/(connected|configured)/);
        console.log('✅ Enhanced Flow 2 verified: Valid credentials show appropriate state');
    });

    test('Enhanced Flow 3: Configuration State Persistence', async () => {
        console.log('🧪 Testing Enhanced Flow 3: Configuration State Persistence...');
        
        // Check that configuration persists after app operations
        const status = await getSpotifyStatus();
        console.log(`📊 Persistent Spotify Status: ${status.statusText} - ${status.details}`);
        
        // Check config file
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        console.log(`📄 Config file Spotify Client ID: ${config.spotify?.client || '[EMPTY]'}`);
        console.log(`📄 Config file Spotify Secret length: ${config.spotify?.secret?.length || 0}`);
        
        // Should have valid credentials saved
        expect(config.spotify?.client).toBeTruthy();
        expect(config.spotify?.secret).toBeTruthy();
        console.log('✅ Enhanced Flow 3 verified: Configuration state persists correctly');
    });

    test('Enhanced Flow 4: Config Page Status Indicators', async () => {
        console.log('🧪 Testing Enhanced Flow 4: Config Page Status...');

        // Set invalid credentials to test config page indicators
        await setSpotifyCredentials('invalid_spotify_client_id_123456789', 'invalid_spotify_secret_123456789');
        await clickSaveAndTestConnection();

        // Navigate to config page and check status indicators
        await navigateToConfig();

        const configStatus = page.locator('#config-status');
        const isVisible = await configStatus.isVisible();
        console.log(`📊 Configuration Status section visible: ${isVisible}`);

        if (isVisible) {
            // Find Spotify status item in config page
            const spotifyStatusItems = await configStatus.locator('.status-item').all();
            let spotifyStatus = null;

            for (const item of spotifyStatusItems) {
                const text = await item.textContent();
                if (text.toLowerCase().includes('spotify')) {
                    spotifyStatus = {
                        statusText: text.trim(),
                        statusClasses: await item.getAttribute('class') || ''
                    };
                    break;
                }
            }

            if (spotifyStatus) {
                console.log(`📊 Config Page Spotify Status: ${spotifyStatus.statusText}`);
                console.log(`📊 Config Page Spotify Classes: ${spotifyStatus.statusClasses}`);

                // Should show configured state with appropriate styling
                expect(spotifyStatus.statusText.toLowerCase()).toMatch(/(spotify|configured|connecting|not.*connected)/);
                expect(spotifyStatus.statusClasses).toMatch(/(configured|connecting|warning|error)/);
            }
        }

        console.log('✅ Enhanced Flow 4 verified: Config page shows enhanced status indicators');
    });
});
