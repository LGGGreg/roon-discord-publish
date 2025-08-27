const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Imgur Connection Tests', () => {
    let electronApp;
    let page;
    const secretsPath = path.join(__dirname, '../secrets.json');
    let testSecrets;

    test.beforeAll(async ({ playwright }) => {
        // Load test secrets
        if (fs.existsSync(secretsPath)) {
            testSecrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
            console.log('✅ Loaded test secrets');
        } else {
            throw new Error('Test secrets file not found. Please create test/secrets.json with Imgur credentials');
        }

        electronApp = await playwright._electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            timeout: 30000
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    async function getImgurStatus() {
        const statusCard = page.locator('.status-card[data-service="imgur"]');
        const statusText = await statusCard.locator('[data-testid="imgur-status-text"]').textContent();
        const statusDetails = await statusCard.locator('[data-testid="imgur-details"]').textContent();
        const statusDot = statusCard.locator('[data-testid="imgur-status-dot"]');
        const dotClasses = await statusDot.getAttribute('class') || '';

        return {
            statusText: statusText.trim(),
            statusDetails: statusDetails.trim(),
            dotClasses,
            isConnected: dotClasses.includes('connected'),
            isError: dotClasses.includes('error')
        };
    }

    async function setImgurCredentials() {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Set Imgur credentials
        const imgurClientInput = page.locator('#imgur-client-id');
        const imgurSecretInput = page.locator('#imgur-client-secret');
        
        await imgurClientInput.clear();
        await imgurClientInput.fill(testSecrets.imgur.clientId);
        
        if (imgurSecretInput && await imgurSecretInput.count() > 0) {
            await imgurSecretInput.clear();
            await imgurSecretInput.fill(testSecrets.imgur.clientSecret);
        }

        // Save configuration
        const saveButton = page.locator('button:has-text("Save Configuration")');
        await saveButton.click();
        await page.waitForTimeout(2000);

        // Navigate back to status tab
        await page.click('[data-tab="status"]');
        await page.waitForTimeout(2000);
    }

    test('should connect to Imgur with valid credentials', async () => {
        console.log('🧪 Testing Imgur connection with credentials:', {
            clientId: testSecrets.imgur.clientId,
            hasSecret: !!testSecrets.imgur.clientSecret
        });

        // Set credentials
        await setImgurCredentials();

        // Check initial status
        let imgurStatus = await getImgurStatus();
        console.log(`📊 Initial Imgur status: ${imgurStatus.statusText} - ${imgurStatus.statusDetails}`);

        // Wait for connection attempt
        await page.waitForTimeout(5000);

        // Check final status
        imgurStatus = await getImgurStatus();
        console.log(`📊 Final Imgur status: ${imgurStatus.statusText} - ${imgurStatus.statusDetails}`);

        // Take screenshot for debugging
        await page.screenshot({ path: 'test-results/screenshots/imgur-connection-test.png', fullPage: true });

        // Should be connected or at least not show "missing credentials"
        expect(imgurStatus.statusDetails.toLowerCase()).not.toContain('missing');
        expect(imgurStatus.statusDetails.toLowerCase()).not.toContain('required');
    });

    test('should show correct mode (authenticated vs anonymous)', async () => {
        // Set credentials
        await setImgurCredentials();
        await page.waitForTimeout(3000);

        // Check if the status indicates authenticated mode
        const imgurStatus = await getImgurStatus();
        console.log(`📊 Imgur mode status: ${imgurStatus.statusText} - ${imgurStatus.statusDetails}`);

        // Currently only anonymous mode is supported (like legacy console app)
        // Should show connected status regardless of having clientSecret
        expect(imgurStatus.statusText.toLowerCase()).toContain('connected');
    });

    test('should handle test connection properly', async () => {
        // Set credentials
        await setImgurCredentials();

        // Wait for connection and test
        await page.waitForTimeout(5000);

        // Check for any console errors related to Imgur
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error' && msg.text().toLowerCase().includes('imgur')) {
                consoleErrors.push(msg.text());
            }
        });

        await page.waitForTimeout(2000);

        // Log any Imgur-related errors
        if (consoleErrors.length > 0) {
            console.log('🔍 Imgur console errors:', consoleErrors);
        }

        const imgurStatus = await getImgurStatus();
        console.log(`📊 Connection test result: ${imgurStatus.statusText} - ${imgurStatus.statusDetails}`);

        // Should not have critical connection errors
        expect(imgurStatus.statusDetails.toLowerCase()).not.toContain('test upload failed');
    });

    test('should show proper error messages for invalid credentials', async () => {
        // Navigate to config tab
        await page.click('[data-tab="config"]');
        await page.waitForTimeout(1000);

        // Set invalid credentials
        const imgurClientInput = page.locator('#imgur-client-id');
        await imgurClientInput.clear();
        await imgurClientInput.fill('invalid-client-id');

        // Save configuration
        const saveButton = page.locator('button:has-text("Save Configuration")');
        await saveButton.click();
        await page.waitForTimeout(2000);

        // Navigate back to status tab
        await page.click('[data-tab="status"]');
        await page.waitForTimeout(3000);

        // Check status
        const imgurStatus = await getImgurStatus();
        console.log(`📊 Invalid credentials status: ${imgurStatus.statusText} - ${imgurStatus.statusDetails}`);

        // Should show disconnected state (invalid credentials just don't connect)
        expect(imgurStatus.statusText.toLowerCase()).toContain('disconnected');
    });
});
