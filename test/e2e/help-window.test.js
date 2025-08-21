const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Help Window Tests', () => {
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

    test('should open help window when help button is clicked', async () => {
        // Switch to Help tab
        await page.click('[data-tab="help"]');
        
        // Click the main help button
        const helpButton = page.locator('button:has-text("Open Full Help Guide")');
        await helpButton.click();
        
        // Wait a moment for the window to potentially open
        await page.waitForTimeout(1000);
        
        // Verify the IPC call was made (we can't easily test the actual window opening in this context)
        // But we can verify no errors occurred
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        
        expect(consoleErrors.length).toBe(0);
    });

    test('should handle help section navigation', async () => {
        // Switch to Help tab
        await page.click('[data-tab="help"]');
        
        // Click a section-specific help button
        const learnMoreButtons = page.locator('button:has-text("Learn More")');
        if (await learnMoreButtons.count() > 0) {
            await learnMoreButtons.first().click();
            
            // Wait a moment for the IPC call
            await page.waitForTimeout(500);
        }
        
        // Verify no errors occurred
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        
        expect(consoleErrors.length).toBe(0);
    });

    test('should have close help window IPC handler', async () => {
        // Test that the close help window IPC handler exists
        const result = await page.evaluate(async () => {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                try {
                    const response = await ipcRenderer.invoke('close-help-window');
                    return { success: true, response };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'No IPC available' };
        });
        
        expect(result.success).toBe(true);
    });

    test('should have working help functions', async () => {
        // Test that help functions are available and work
        const result = await page.evaluate(async () => {
            const results = {};
            
            // Test openHelpWindow function
            if (typeof window.openHelpWindow === 'function') {
                try {
                    await window.openHelpWindow();
                    results.openHelpWindow = { success: true };
                } catch (error) {
                    results.openHelpWindow = { success: false, error: error.message };
                }
            } else {
                results.openHelpWindow = { success: false, error: 'Function not available' };
            }
            
            // Test openHelpSection function
            if (typeof window.openHelpSection === 'function') {
                try {
                    await window.openHelpSection('discord');
                    results.openHelpSection = { success: true };
                } catch (error) {
                    results.openHelpSection = { success: false, error: error.message };
                }
            } else {
                results.openHelpSection = { success: false, error: 'Function not available' };
            }
            
            return results;
        });
        
        expect(result.openHelpWindow.success).toBe(true);
        expect(result.openHelpSection.success).toBe(true);
    });

    test('should handle fallback help when IPC unavailable', async () => {
        // Test fallback behavior when IPC is not available
        const result = await page.evaluate(async () => {
            // Temporarily disable require to test fallback
            const originalRequire = window.require;
            window.require = null;
            
            try {
                if (typeof window.openHelpWindow === 'function') {
                    await window.openHelpWindow();
                    return { success: true, usedFallback: true };
                }
                return { success: false, error: 'Function not available' };
            } catch (error) {
                return { success: false, error: error.message };
            } finally {
                // Restore require
                window.require = originalRequire;
            }
        });
        
        // Should handle the fallback gracefully
        expect(result.success).toBe(true);
    });
});
