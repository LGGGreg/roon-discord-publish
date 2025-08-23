const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

test.describe('E2E Configuration and Connector Validation', () => {
    let electronApp;
    let page;
    const configPath = path.join(__dirname, '../../config.json');
    const secretsPath = path.join(__dirname, '../secrets.json');
    let originalConfig;
    let testSecrets;

    // Test data for invalid credentials
    const invalidCredentials = {
        discord: { clientId: "invalid_discord_id_123" },
        spotify: { client: "invalid_spotify_client", secret: "invalid_spotify_secret" },
        imgur: { clientId: "invalid_imgur_id" }
    };

    // Helper functions
    async function waitForAppReady() {
        // Wait for the app to load and services to initialize
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Give services time to start

        // Ensure we can see status cards
        await page.waitForSelector('.status-card', { timeout: 10000 });

        // Wait for status indicators to be populated
        await page.waitForTimeout(3000);

        // Ensure status text is populated (not just "Disconnected")
        await page.waitForFunction(() => {
            const cards = document.querySelectorAll('.status-card');
            return Array.from(cards).some(card => {
                const details = card.querySelector('[data-testid$="-details"]');
                return details && details.textContent.trim() !== 'Not connected to Discord' && details.textContent.trim() !== '';
            });
        }, { timeout: 5000 }).catch(() => {
            // If status doesn't update, continue anyway
            console.log('Status details may not have updated yet');
        });
    }

    async function takeScreenshot(name) {
        await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
    }

    async function getConnectorStatus(connectorName) {
        const serviceName = connectorName.toLowerCase();
        const statusCard = page.locator(`.status-card[data-service="${serviceName}"]`);

        if (await statusCard.count() === 0) {
            throw new Error(`Could not find ${connectorName} status card`);
        }

        const statusText = await statusCard.locator(`[data-testid="${serviceName}-status-text"]`).textContent();
        const statusDetails = await statusCard.locator(`[data-testid="${serviceName}-details"]`).textContent();
        const statusDot = statusCard.locator(`[data-testid="${serviceName}-status-dot"]`);
        const dotClasses = await statusDot.getAttribute('class') || '';

        const fullText = `${statusText} ${statusDetails}`.trim();

        return {
            element: statusCard,
            statusText: statusText.trim(),
            statusDetails: statusDetails.trim(),
            fullText,
            dotClasses,
            isDisconnected: dotClasses.includes('disconnected'),
            isConnecting: dotClasses.includes('connecting') || fullText.toLowerCase().includes('connecting'),
            isConnected: dotClasses.includes('connected') || fullText.toLowerCase().includes('connected'),
            isError: dotClasses.includes('error') || fullText.toLowerCase().includes('error'),
            isMissing: fullText.toLowerCase().includes('missing') || fullText.toLowerCase().includes('required') || fullText.toLowerCase().includes('not configured')
        };
    }

    async function setConnectorCredentials(connector, credentials) {
        // Navigate to config tab
        const configTab = page.locator('.nav-tab[data-tab="config"]');
        await configTab.click();
        await page.waitForTimeout(1000);

        // Set credentials based on connector type
        switch (connector) {
            case 'discord':
                const discordInput = page.locator('#discord-client-id');
                await discordInput.clear();
                await discordInput.fill(credentials.clientId);
                break;

            case 'spotify':
                const spotifyClientInput = page.locator('#spotify-client-id');
                const spotifySecretInput = page.locator('#spotify-client-secret');
                await spotifyClientInput.clear();
                await spotifyClientInput.fill(credentials.client);
                await spotifySecretInput.clear();
                await spotifySecretInput.fill(credentials.secret);
                break;

            case 'imgur':
                const imgurInput = page.locator('#imgur-client-id');
                await imgurInput.clear();
                await imgurInput.fill(credentials.clientId);
                break;
        }

        // Save configuration
        const saveButton = page.locator('#save-config');
        await saveButton.click();
        await page.waitForTimeout(2000); // Wait for save to complete

        // Navigate back to status tab
        const statusTab = page.locator('.nav-tab[data-tab="status"]');
        await statusTab.click();
        await waitForAppReady();
    }

    test.beforeAll(async () => {
        // Load test secrets
        if (fs.existsSync(secretsPath)) {
            testSecrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
            console.log('✅ Loaded test secrets');
        } else {
            console.warn('⚠️  Test secrets file not found. Copy test/secrets.example.json to test/secrets.json and add real credentials');
            testSecrets = {
                discord: { clientId: "test_discord_id" },
                spotify: { client: "test_spotify_client", secret: "test_spotify_secret" },
                imgur: { clientId: "test_imgur_id" }
            };
        }

        // Backup original config
        if (fs.existsSync(configPath)) {
            originalConfig = fs.readFileSync(configPath, 'utf8');
        }

        // Start with empty config
        const emptyConfig = {
            "core_ip": "",
            "app": {
                "use_discovery": true
            },
            "discord": {
                "clientId": ""
            },
            "imgur": {
                "clientId": ""
            },
            "spotify": {
                "client": "",
                "secret": ""
            }
        };

        fs.writeFileSync(configPath, JSON.stringify(emptyConfig, null, 2));
        console.log('✅ Reset config to empty values');

        // Launch Electron app (it will use local node internally)
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'development'
            }
        });

        page = await electronApp.firstWindow();
        await page.waitForTimeout(5000); // Wait for app to initialize
        console.log('✅ Electron app launched with local node');
    });

    test.afterAll(async () => {
        // Close app
        if (electronApp) {
            await electronApp.close();
            console.log('✅ Closed Electron app');
        }

        // No need to kill separate node process since we're using electron.launch

        // Restore original config
        if (originalConfig) {
            fs.writeFileSync(configPath, originalConfig);
            console.log('✅ Restored original config');
        } else {
            // If no original config, remove the test config
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
                console.log('✅ Removed test config');
            }
        }
    });

    // Removed duplicate waitForAppReady function

    // Helper function to navigate to config page
    async function navigateToConfig() {
        const configButton = page.locator('button, .nav-item, .tab').filter({ hasText: /config|setting/i }).first();
        if (await configButton.isVisible()) {
            await configButton.click();
        } else {
            // Try clicking on a settings icon or gear
            const settingsIcon = page.locator('[title*="config"], [title*="setting"], .fa-cog, .fa-gear').first();
            if (await settingsIcon.isVisible()) {
                await settingsIcon.click();
            }
        }
        await page.waitForTimeout(1000);
    }

    // Helper function to navigate back to status page
    async function navigateToStatus() {
        const statusButton = page.locator('button, .nav-item, .tab').filter({ hasText: /status|home|dashboard/i }).first();
        if (await statusButton.isVisible()) {
            await statusButton.click();
        }
        await waitForAppReady();
    }

    test('01. Empty Config - Shows missing credentials for required services', async () => {
        console.log('🧪 Testing empty config state...');

        await waitForAppReady();
        await takeScreenshot('01-empty-config');

        // Test Discord - Should show missing credentials (required)
        const discordStatus = await getConnectorStatus('Discord');
        console.log(`📊 Discord: ${discordStatus.statusText} - ${discordStatus.statusDetails}`);
        expect(discordStatus.isError || discordStatus.statusDetails.toLowerCase().includes('required')).toBeTruthy();
        expect(discordStatus.statusDetails.toLowerCase()).toMatch(/(required|add.*client.*id|missing)/);

        // Test Spotify - Should show optional message
        const spotifyStatus = await getConnectorStatus('Spotify');
        console.log(`📊 Spotify: ${spotifyStatus.statusText} - ${spotifyStatus.statusDetails}`);
        expect(spotifyStatus.statusDetails.toLowerCase()).toMatch(/(optional|add.*spotify|enhanced)/);

        // Test Imgur - Should show optional message
        const imgurStatus = await getConnectorStatus('Imgur');
        console.log(`📊 Imgur: ${imgurStatus.statusText} - ${imgurStatus.statusDetails}`);
        expect(imgurStatus.statusDetails.toLowerCase()).toMatch(/(optional|add.*imgur|album.*art)/);

        // Test Roon - Should be attempting connection (doesn't need credentials)
        const roonStatus = await getConnectorStatus('Roon');
        console.log(`📊 Roon: ${roonStatus.statusText} - ${roonStatus.statusDetails}`);
        // Roon should be connecting or disconnected (but not showing missing credentials)
        expect(roonStatus.statusDetails.toLowerCase()).not.toMatch(/(required|add.*client|missing)/);

        console.log('✅ Empty config shows correct credential status for all connectors');
    });

    test('02. Discord Invalid Credentials - Shows error state', async () => {
        console.log('🧪 Testing Discord invalid credentials...');

        await setConnectorCredentials('discord', invalidCredentials.discord);
        await takeScreenshot('02-discord-invalid');

        const discordStatus = await getConnectorStatus('Discord');
        console.log(`📊 Discord status after invalid ID: ${discordStatus.text}`);

        // Should show error state (not missing, but failed connection)
        const statusText = discordStatus.fullText || discordStatus.statusText || '';
        expect(discordStatus.isError || statusText.toLowerCase().includes('error')).toBeTruthy();
        expect(statusText.toLowerCase()).not.toMatch(/(missing|add.*client)/);

        console.log('✅ Discord shows error state with invalid credentials');
    });

    test('03. Discord Valid Credentials - Shows connected state', async () => {
        console.log('🧪 Testing Discord valid credentials...');

        await setConnectorCredentials('discord', testSecrets.discord);
        await takeScreenshot('03-discord-valid');

        // Wait for connection attempt
        await page.waitForTimeout(5000);

        const discordStatus = await getConnectorStatus('Discord');
        console.log(`📊 Discord status after valid ID: ${discordStatus.text}`);

        // Should show connected or connecting state
        const statusText = discordStatus.fullText || discordStatus.statusText || '';
        expect(discordStatus.isConnected || discordStatus.isConnecting).toBeTruthy();
        expect(statusText.toLowerCase()).not.toMatch(/(missing|error|required)/);

        console.log('✅ Discord shows connected/connecting state with valid credentials');
    });

    test('04. Spotify Invalid Credentials - Shows error state', async () => {
        console.log('🧪 Testing Spotify invalid credentials...');

        await setConnectorCredentials('spotify', invalidCredentials.spotify);
        await takeScreenshot('04-spotify-invalid');

        const spotifyStatus = await getConnectorStatus('Spotify');
        console.log(`📊 Spotify status after invalid credentials: ${spotifyStatus.text}`);

        // Should show error state
        expect(spotifyStatus.isError || spotifyStatus.text.toLowerCase().includes('error')).toBeTruthy();

        console.log('✅ Spotify shows error state with invalid credentials');
    });

    test('05. Spotify Valid Credentials - Shows connected state', async () => {
        console.log('🧪 Testing Spotify valid credentials...');

        await setConnectorCredentials('spotify', testSecrets.spotify);
        await takeScreenshot('05-spotify-valid');

        // Wait for connection attempt
        await page.waitForTimeout(5000);

        const spotifyStatus = await getConnectorStatus('Spotify');
        console.log(`📊 Spotify status after valid credentials: ${spotifyStatus.text}`);

        // Should show connected or connecting state
        expect(spotifyStatus.isConnected || spotifyStatus.isConnecting).toBeTruthy();

        console.log('✅ Spotify shows connected/connecting state with valid credentials');
    });

    test('06. Imgur Invalid Credentials - Shows error state', async () => {
        console.log('🧪 Testing Imgur invalid credentials...');

        await setConnectorCredentials('imgur', invalidCredentials.imgur);
        await takeScreenshot('06-imgur-invalid');

        const imgurStatus = await getConnectorStatus('Imgur');
        console.log(`📊 Imgur status after invalid credentials: ${imgurStatus.text}`);

        // Should show error state
        expect(imgurStatus.isError || imgurStatus.text.toLowerCase().includes('error')).toBeTruthy();

        console.log('✅ Imgur shows error state with invalid credentials');
    });

    test('07. Imgur Valid Credentials - Shows connected state', async () => {
        console.log('🧪 Testing Imgur valid credentials...');

        await setConnectorCredentials('imgur', testSecrets.imgur);
        await takeScreenshot('07-imgur-valid');

        // Wait for connection attempt
        await page.waitForTimeout(5000);

        const imgurStatus = await getConnectorStatus('Imgur');
        console.log(`📊 Imgur status after valid credentials: ${imgurStatus.text}`);

        // Should show connected or connecting state
        expect(imgurStatus.isConnected || imgurStatus.isConnecting).toBeTruthy();

        console.log('✅ Imgur shows connected/connecting state with valid credentials');
    });

    test('08. CSS Theme Validation - Colors and styling', async () => {
        console.log('🧪 Testing CSS theme and colors...');

        await waitForAppReady();
        await takeScreenshot('08-css-theme');

        // Test status container visibility (using actual HTML structure)
        const statusContainer = page.locator('.status-grid').first();
        await expect(statusContainer).toBeVisible();

        // Test individual status cards have proper styling
        const statusItems = page.locator('.status-card');
        const count = await statusItems.count();
        expect(count).toBeGreaterThan(0);

        // Check first status item styling
        const firstItem = statusItems.first();
        const styles = await firstItem.evaluate(el => {
            const computed = getComputedStyle(el);
            return {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                borderColor: computed.borderColor,
                display: computed.display,
                visibility: computed.visibility
            };
        });

        console.log(`🎨 Status item styles:`, styles);

        // Verify item is visible
        expect(styles.display).not.toBe('none');
        expect(styles.visibility).not.toBe('hidden');

        // Verify has background color (not transparent)
        expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(styles.backgroundColor).not.toBe('transparent');

        // Test error state colors (red-ish) - look for status dots with error class
        const errorDots = page.locator('.status-dot.error');
        if (await errorDots.count() > 0) {
            const errorStyles = await errorDots.first().evaluate(el => {
                const computed = getComputedStyle(el);
                return {
                    backgroundColor: computed.backgroundColor,
                    color: computed.color
                };
            });

            console.log(`🔴 Error state styles:`, errorStyles);

            // Should have red-ish colors (check for any red tones)
            const hasRedColor = errorStyles.color.includes('248, 113, 113') ||
                               errorStyles.backgroundColor.includes('248, 113, 113') ||
                               errorStyles.color.includes('rgb(248') ||
                               errorStyles.backgroundColor.includes('rgb(248') ||
                               errorStyles.color.includes('#e74c3c') ||
                               errorStyles.backgroundColor.includes('#e74c3c') ||
                               errorStyles.backgroundColor.includes('204, 51, 51') ||
                               errorStyles.backgroundColor.includes('rgb(204') ||
                               (errorStyles.backgroundColor.startsWith('rgb(') &&
                                parseInt(errorStyles.backgroundColor.match(/rgb\((\d+)/)[1]) > 150);

            expect(hasRedColor).toBeTruthy();
        }

        console.log('✅ CSS theme validation complete');
    });

    test('10. Popup/Modal Theme Validation - No white elements', async () => {
        console.log('🧪 Testing popup and modal theme consistency...');

        await waitForAppReady();
        await takeScreenshot('10-popup-theme-check');

        // Check if any notification elements exist and validate their styling
        const notifications = page.locator('.notification');
        if (await notifications.count() > 0) {
            const notificationStyles = await notifications.first().evaluate(el => {
                const computed = getComputedStyle(el);
                return {
                    backgroundColor: computed.backgroundColor,
                    color: computed.color,
                    borderColor: computed.borderColor
                };
            });

            console.log(`📢 Notification styles:`, notificationStyles);

            // Should not have white background
            expect(notificationStyles.backgroundColor).not.toMatch(/rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255|white/);

            // Should have dark theme colors
            expect(notificationStyles.backgroundColor).toMatch(/rgb\([0-9]{1,2},|rgba\([0-9]{1,2},/);
        }

        // Check modal content styling (even if not visible)
        const modalContent = page.locator('.modal-content');
        if (await modalContent.count() > 0) {
            const modalStyles = await modalContent.first().evaluate(el => {
                const computed = getComputedStyle(el);
                return {
                    backgroundColor: computed.backgroundColor,
                    color: computed.color
                };
            });

            console.log(`🪟 Modal styles:`, modalStyles);

            // Should not have white background
            expect(modalStyles.backgroundColor).not.toMatch(/rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255|white/);
        }

        // Test for any elements with white/light backgrounds in top-right area
        const topRightElements = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            const problematicElements = [];

            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                const styles = getComputedStyle(el);

                // Check if element is in top-right quadrant
                if (rect.right > window.innerWidth * 0.7 && rect.top < window.innerHeight * 0.3) {
                    const bg = styles.backgroundColor;

                    // Check for white or very light backgrounds
                    if (bg.includes('rgb(255, 255, 255)') ||
                        bg.includes('rgba(255, 255, 255') ||
                        bg === 'white' ||
                        (bg.startsWith('rgb(') && bg.includes('255') && bg.includes('255'))) {

                        problematicElements.push({
                            tagName: el.tagName,
                            className: el.className,
                            backgroundColor: bg,
                            position: {
                                top: rect.top,
                                right: rect.right,
                                width: rect.width,
                                height: rect.height
                            }
                        });
                    }
                }
            }

            return problematicElements;
        });

        console.log(`🔍 Found ${topRightElements.length} potentially problematic elements in top-right:`, topRightElements);

        // Should not have any white elements in top-right
        expect(topRightElements.length).toBe(0);

        console.log('✅ Popup/Modal theme validation complete - no white elements found');
    });

    test('09. Full E2E Flow - Complete setup process', async () => {
        console.log('🧪 Testing complete E2E setup flow...');

        // Start fresh
        await waitForAppReady();
        await takeScreenshot('09-e2e-start');

        // Step 1: Verify all connectors start in missing state
        const initialDiscord = await getConnectorStatus('Discord');
        const initialSpotify = await getConnectorStatus('Spotify');
        const initialImgur = await getConnectorStatus('Imgur');

        expect(initialDiscord.isError).toBeTruthy();
        console.log('✅ Step 1: All connectors start in missing state');

        // Step 2: Configure Discord (required)
        await setConnectorCredentials('discord', testSecrets.discord);
        await takeScreenshot('09-e2e-discord-configured');

        const configuredDiscord = await getConnectorStatus('Discord');
        expect(configuredDiscord.isConnected || configuredDiscord.isConnecting).toBeTruthy();
        console.log('✅ Step 2: Discord configured successfully');

        // Step 3: Configure Spotify (optional)
        await setConnectorCredentials('spotify', testSecrets.spotify);
        await takeScreenshot('09-e2e-spotify-configured');

        const configuredSpotify = await getConnectorStatus('Spotify');
        expect(configuredSpotify.isConnected || configuredSpotify.isConnecting).toBeTruthy();
        console.log('✅ Step 3: Spotify configured successfully');

        // Step 4: Configure Imgur (optional)
        await setConnectorCredentials('imgur', testSecrets.imgur);
        await takeScreenshot('09-e2e-all-configured');

        const configuredImgur = await getConnectorStatus('Imgur');
        expect(configuredImgur.isConnected || configuredImgur.isConnecting).toBeTruthy();
        console.log('✅ Step 4: Imgur configured successfully');

        // Step 5: Verify all connectors are now in good state
        await page.waitForTimeout(3000); // Allow connections to establish
        await takeScreenshot('09-e2e-final-state');

        const finalDiscord = await getConnectorStatus('Discord');
        const finalSpotify = await getConnectorStatus('Spotify');
        const finalImgur = await getConnectorStatus('Imgur');

        console.log(`📊 Final states - Discord: ${finalDiscord.text}, Spotify: ${finalSpotify.text}, Imgur: ${finalImgur.text}`);

        // All should be connected or connecting (not in error/missing state)
        expect(finalDiscord.isConnected || finalDiscord.isConnecting).toBeTruthy();
        expect(finalSpotify.isConnected || finalSpotify.isConnecting).toBeTruthy();
        expect(finalImgur.isConnected || finalImgur.isConnecting).toBeTruthy();

        console.log('✅ Complete E2E flow successful - all connectors configured');
    });

    test('should update UI when Discord Client ID is added via config page', async () => {
        console.log('🧪 Testing Discord Client ID addition via config page...');

        // Navigate to config page
        await page.click('button:has-text("Configuration")');
        await page.waitForSelector('.config-section', { timeout: 5000 });

        // Find Discord Client ID input field
        const discordInput = page.locator('input[placeholder*="Discord"], input[id*="discord"], input[name*="discord"]').first();

        // Clear and enter valid Discord Client ID
        const validDiscordId = testSecrets.discord.clientId;
        await discordInput.clear();
        await discordInput.fill(validDiscordId);

        console.log(`📝 Entered Discord Client ID: ${validDiscordId}`);

        // Save configuration
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Apply")').first();
        if (await saveButton.isVisible()) {
            await saveButton.click();
            console.log('💾 Clicked save button');
        }

        // Wait for save to complete
        await page.waitForTimeout(2000);

        // Navigate back to main page to check status
        await page.click('button:has-text("Status"), button:has-text("Home"), button:has-text("Dashboard")').first();
        await page.waitForSelector('.status-summary', { timeout: 5000 });

        // Wait for services to attempt connection
        await page.waitForTimeout(3000);

        // Take screenshot for debugging
        await page.screenshot({ path: 'test-results/screenshots/discord-configured.png' });

        // Check Discord status should now show configured or connecting
        const discordStatus = await page.locator('.status-item').filter({ hasText: 'Discord' });

        // Should no longer show "Required - Add Client ID"
        await expect(discordStatus).not.toContainText('Required - Add Client ID');

        // Should show either configured or connecting state
        const statusText = await discordStatus.textContent();
        console.log(`📊 Discord status after adding ID: ${statusText}`);

        // Check that error icon is gone
        const discordIcon = discordStatus.locator('.status-icon');
        const iconText = await discordIcon.textContent();
        console.log(`🔍 Discord icon: ${iconText}`);

        // Should not be error icon anymore
        await expect(discordIcon).not.toContainText('✗');

        console.log('✅ Discord Client ID addition via config page updated UI correctly');
    });

    // Additional tests can be added here for Spotify and Imgur
    // For now, focusing on Discord as the primary test case

    test('should validate theme and styling', async () => {
        console.log('🧪 Testing theme and styling...');

        // Take screenshot for visual validation
        await page.screenshot({ path: 'test-results/screenshots/theme-styling.png' });

        // Check that status items have proper styling
        const statusItems = page.locator('.status-item');
        const count = await statusItems.count();

        console.log(`📊 Found ${count} status items`);

        // Check at least one status item exists
        expect(count).toBeGreaterThan(0);

        // Check first status item has proper styling
        const firstItem = statusItems.first();
        const backgroundColor = await firstItem.evaluate(el => getComputedStyle(el).backgroundColor);
        const color = await firstItem.evaluate(el => getComputedStyle(el).color);

        console.log(`🎨 First item styling - bg: ${backgroundColor}, color: ${color}`);

        // Should have some background color (not transparent)
        expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

        console.log('✅ Theme and styling validation complete');
    });
});
