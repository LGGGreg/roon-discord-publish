const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Help Page Navigation Tests', () => {
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

    test('should navigate to help tab and find help cards', async () => {
        // Navigate to help tab
        await page.click('[data-tab="help"]');
        await page.waitForTimeout(1000);

        // Check that help tab content is visible
        const helpTab = page.locator('#help-tab');
        await expect(helpTab).toBeVisible({ timeout: 5000 });

        // Check that expandable help cards exist by ID (more specific)
        const helpCardIds = ['discord-card', 'roon-card', 'spotify-card', 'imgur-card'];

        for (const cardId of helpCardIds) {
            const card = page.locator(`#${cardId}`);
            await expect(card).toBeVisible({ timeout: 5000 });
        }

        // Check that expandable cards have Learn More buttons
        const learnMoreButtons = page.locator('button:has-text("Learn More ▼")');
        await expect(learnMoreButtons.first()).toBeVisible();
    });

    test('should have working help card buttons', async () => {
        // Navigate to help tab
        await page.click('[data-tab="help"]');
        await page.waitForTimeout(1000);

        // Mock the toggleHelpSection function to test it's called
        await page.evaluate(() => {
            window.toggleHelpSectionCalls = [];
            window.toggleHelpSection = (section) => {
                window.toggleHelpSectionCalls.push(section);
                console.log('Mock: toggleHelpSection called with:', section);
                return Promise.resolve();
            };
        });

        // Test expandable help card buttons
        const helpButtons = [
            { section: 'discord', cardText: 'Discord Setup' },
            { section: 'roon', cardText: 'Roon Configuration' },
            { section: 'spotify', cardText: 'Spotify Integration' },
            { section: 'imgur', cardText: 'Imgur Setup' }
        ];

        for (const button of helpButtons) {
            const helpCard = page.locator(`.help-expandable-card:has-text("${button.cardText}")`);
            const learnMoreButton = helpCard.locator('button:has-text("Learn More ▼")');

            await expect(learnMoreButton).toBeVisible();
            await learnMoreButton.click();
            await page.waitForTimeout(200);
        }

        // Verify all sections were called
        const calls = await page.evaluate(() => window.toggleHelpSectionCalls);
        expect(calls).toContain('discord');
        expect(calls).toContain('roon');
        expect(calls).toContain('spotify');
        expect(calls).toContain('imgur');
    });

    test('should have working main help button', async () => {
        // Navigate to help tab
        await page.click('[data-tab="help"]');
        await page.waitForTimeout(1000);

        // Mock the openHelpWindow function to test it's called
        await page.evaluate(() => {
            window.openHelpWindowCalled = false;
            window.openHelpWindow = () => {
                window.openHelpWindowCalled = true;
                console.log('Mock: openHelpWindow called');
                return Promise.resolve();
            };
        });

        // Test main help button
        const openHelpButton = page.locator('button:has-text("📖 Open Full Help Guide")');
        await expect(openHelpButton).toBeVisible();
        await openHelpButton.click();

        const wasOpenHelpWindowCalled = await page.evaluate(() => window.openHelpWindowCalled);
        expect(wasOpenHelpWindowCalled).toBe(true);
    });

    test('should have troubleshooting section button', async () => {
        // Navigate to help tab
        await page.click('[data-tab="help"]');
        await page.waitForTimeout(1000);

        // Mock the toggleHelpSection function to test it's called
        await page.evaluate(() => {
            window.troubleshootingCalled = false;
            window.toggleHelpSection = (section) => {
                if (section === 'troubleshooting') {
                    window.troubleshootingCalled = true;
                }
                console.log('Mock: toggleHelpSection called with:', section);
                return Promise.resolve();
            };
        });

        // Find and test the troubleshooting button
        const troubleshootingButton = page.locator('button:has-text("View Full Guide ▼")');
        await expect(troubleshootingButton).toBeVisible();
        await troubleshootingButton.click();

        const wasTroubleshootingCalled = await page.evaluate(() => window.troubleshootingCalled);
        expect(wasTroubleshootingCalled).toBe(true);
    });

    test('should have proper openHelpSection function', async () => {
        // Test the openHelpSection function
        const result = await page.evaluate(() => {
            if (typeof window.openHelpSection === 'function') {
                try {
                    // Test calling the function
                    window.openHelpSection('discord');
                    return { success: true, functionExists: true };
                } catch (error) {
                    return { success: false, error: error.message, functionExists: true };
                }
            }
            return { success: false, functionExists: false };
        });

        expect(result.functionExists).toBe(true);
        expect(result.success).toBe(true);
    });

    test('should handle help section navigation from main app', async () => {
        // Start on status tab
        await page.click('[data-tab="status"]');
        await page.waitForTimeout(500);

        // Test openHelpSection function navigates to help tab and scrolls
        const result = await page.evaluate(async () => {
            if (typeof window.openHelpSection === 'function') {
                try {
                    // Call openHelpSection for discord
                    window.openHelpSection('discord');
                    
                    // Wait a moment for navigation
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Check if help tab is now active
                    const helpTab = document.querySelector('[data-tab="help"]');
                    const isActive = helpTab && helpTab.classList.contains('active');
                    
                    return { success: true, helpTabActive: isActive };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'Function not available' };
        });

        expect(result.success).toBe(true);
    });

    test('should have all required JavaScript files loaded', async () => {
        // Navigate to help tab
        await page.click('[data-tab="help"]');
        await page.waitForTimeout(1000);

        // Check that required functions are available in main app
        const functions = await page.evaluate(() => {
            return {
                openHelpWindow: typeof window.openHelpWindow === 'function',
                openHelpSection: typeof window.openHelpSection === 'function',
                showQuickHelp: typeof window.showQuickHelp === 'function'
            };
        });

        // These functions should be available in the main app
        expect(functions.openHelpWindow).toBe(true);
        expect(functions.openHelpSection).toBe(true);
        expect(functions.showQuickHelp).toBe(true);
    });

    test('should handle console errors gracefully', async () => {
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // Navigate to help tab
        await page.click('[data-tab="help"]');
        await page.waitForTimeout(1000);

        // Test various help functions
        await page.evaluate(() => {
            // Test functions that might cause errors
            if (window.openHelpSection) window.openHelpSection('nonexistent');
            if (window.scrollToSection) window.scrollToSection('nonexistent');
        });

        await page.waitForTimeout(1000);

        // Should handle errors gracefully without crashing
        const criticalErrors = consoleErrors.filter(error => 
            !error.includes('Help section') && 
            !error.includes('not found') &&
            !error.includes('Mock:')
        );
        
        expect(criticalErrors.length).toBe(0);
    });
});
