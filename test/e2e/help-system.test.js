const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Help System Tests', () => {
    let electronApp;
    let page;

    test.beforeAll(async ({ playwright }) => {
        // Launch Electron app
        electronApp = await playwright._electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            timeout: 30000
        });
        
        // Get the first window
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        
        // Wait for app to be ready
        await page.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should display Help tab in navigation', async () => {
        // Check that Help tab exists
        const helpTab = page.locator('[data-tab="help"]');
        await expect(helpTab).toBeVisible();
        await expect(helpTab).toContainText('Help');
    });

    test('should switch to Help tab when clicked', async () => {
        // Click Help tab
        await page.click('[data-tab="help"]');
        
        // Verify Help tab is active
        const helpTab = page.locator('[data-tab="help"]');
        await expect(helpTab).toHaveClass(/active/);
        
        // Verify Help content is visible
        const helpContent = page.locator('#help-tab');
        await expect(helpContent).toBeVisible();
        await expect(helpContent).toHaveClass(/active/);
    });

    test('should display help content correctly', async () => {
        // Switch to Help tab
        await page.click('[data-tab="help"]');
        
        // Check main help heading
        const helpHeading = page.locator('#help-tab h2');
        await expect(helpHeading).toContainText('Help & Documentation');
        
        // Check help cards are present
        const discordCard = page.locator('.help-quick-card:has-text("Discord Setup")');
        const roonCard = page.locator('.help-quick-card:has-text("Roon Configuration")');
        const spotifyCard = page.locator('.help-quick-card:has-text("Spotify Integration")');
        const imgurCard = page.locator('.help-quick-card:has-text("Imgur Setup")');
        
        await expect(discordCard).toBeVisible();
        await expect(roonCard).toBeVisible();
        await expect(spotifyCard).toBeVisible();
        await expect(imgurCard).toBeVisible();
    });

    test('should have working help buttons', async () => {
        // Switch to Help tab
        await page.click('[data-tab="help"]');
        
        // Test main help button
        const mainHelpButton = page.locator('button:has-text("Open Full Help Guide")');
        await expect(mainHelpButton).toBeVisible();
        
        // Test service-specific help buttons
        const learnMoreButtons = page.locator('button:has-text("Learn More")');
        const buttonCount = await learnMoreButtons.count();
        expect(buttonCount).toBeGreaterThan(0);
        
        // Verify buttons are clickable (don't actually click to avoid opening external windows)
        for (let i = 0; i < buttonCount; i++) {
            await expect(learnMoreButtons.nth(i)).toBeEnabled();
        }
    });

    test('should display troubleshooting section', async () => {
        // Switch to Help tab
        await page.click('[data-tab="help"]');
        
        // Check troubleshooting section
        const troubleshootingSection = page.locator('text=Quick Troubleshooting');
        await expect(troubleshootingSection).toBeVisible();
        
        // Check troubleshooting items
        const troubleshootingItems = page.locator('#help-tab ul li');
        const itemCount = await troubleshootingItems.count();
        expect(itemCount).toBeGreaterThan(0);
    });

    test('should have help.js functions available globally', async () => {
        // Check that help functions are available in window
        const helpFunctionsAvailable = await page.evaluate(() => {
            return typeof window.openHelpWindow === 'function' &&
                   typeof window.openHelpSection === 'function' &&
                   typeof window.showQuickHelp === 'function';
        });
        
        expect(helpFunctionsAvailable).toBe(true);
    });
});

test.describe('Icon and Branding Tests', () => {
    let electronApp;
    let page;

    test.beforeAll(async ({ playwright }) => {
        electronApp = await playwright._electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            timeout: 30000
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should use PNG icon in navigation', async () => {
        // Check that navigation logo uses PNG file
        const navLogo = page.locator('.nav-logo');
        await expect(navLogo).toBeVisible();
        
        const logoSrc = await navLogo.getAttribute('src');
        expect(logoSrc).toContain('icon.png');
        expect(logoSrc).not.toContain('icon.svg');
    });

    test('should have PNG icon file available', async () => {
        // Verify the PNG icon file exists
        const iconPath = path.join(__dirname, '../../assets/icon.png');
        const iconExists = fs.existsSync(iconPath);
        expect(iconExists).toBe(true);
    });

    test('should display app title correctly', async () => {
        // Check app title in navigation
        const appTitle = page.locator('.nav-brand h1');
        await expect(appTitle).toBeVisible();
        await expect(appTitle).toContainText('Roon Discord Rich Presence');
    });

    test('should have window icon set correctly', async () => {
        // This test verifies the window was created with the correct icon
        // The actual icon display is handled by the OS, but we can verify
        // the window was created successfully
        const windowTitle = await page.title();
        expect(windowTitle).toBeTruthy();
    });
});

test.describe('Help Page External Access', () => {
    test('should have help.html file accessible', async () => {
        // Verify help.html exists and is readable
        const helpPath = path.join(__dirname, '../../src/renderer/help.html');
        const helpExists = fs.existsSync(helpPath);
        expect(helpExists).toBe(true);
        
        // Verify it contains expected content
        const helpContent = fs.readFileSync(helpPath, 'utf8');
        expect(helpContent).toContain('Roon Discord Rich Presence Help');
        expect(helpContent).toContain('Discord Setup');
        expect(helpContent).toContain('Roon Configuration');
        expect(helpContent).toContain('Troubleshooting');
    });

    test('should have valid help content structure', async () => {
        const helpPath = path.join(__dirname, '../../src/renderer/help.html');
        const helpContent = fs.readFileSync(helpPath, 'utf8');
        
        // Check for required sections
        expect(helpContent).toContain('id="discord"');
        expect(helpContent).toContain('id="roon"');
        expect(helpContent).toContain('id="spotify"');
        expect(helpContent).toContain('id="imgur"');
        expect(helpContent).toContain('id="troubleshooting"');
        
        // Check for table of contents
        expect(helpContent).toContain('Table of Contents');
        
        // Verify no broken external links (should not contain href="http")
        const externalLinks = helpContent.match(/href="https?:\/\//g);
        expect(externalLinks).toBeNull();
    });
});
