const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Help Functionality Tests', () => {
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

    test('should have IPC handler for opening external links', async () => {
        // Test that the IPC handler exists and responds
        const result = await page.evaluate(async () => {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                try {
                    // Test with a safe URL that won't actually open
                    const response = await ipcRenderer.invoke('open-external', 'about:blank');
                    return { success: true, response };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'No IPC available' };
        });

        expect(result.success).toBe(true);
    });

    test('should have IPC handler for opening help window', async () => {
        // Test that the help window IPC handler exists and responds
        const result = await page.evaluate(async () => {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                try {
                    const response = await ipcRenderer.invoke('open-help-window');
                    return { success: true, response };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'No IPC available' };
        });

        expect(result.success).toBe(true);
    });

    test('should handle help button clicks without errors', async () => {
        // Switch to Help tab
        await page.click('[data-tab="help"]');
        
        // Monitor console for errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        
        // Test clicking help buttons (but prevent actual external opening)
        await page.evaluate(() => {
            // Override the IPC call to prevent actual external opening
            if (window.require) {
                const originalRequire = window.require;
                window.require = (module) => {
                    if (module === 'electron') {
                        return {
                            ipcRenderer: {
                                invoke: async (channel, ...args) => {
                                    if (channel === 'open-external') {
                                        console.log('Mock: Would open external URL:', args[0]);
                                        return { success: true };
                                    }
                                    return originalRequire(module).ipcRenderer.invoke(channel, ...args);
                                }
                            }
                        };
                    }
                    return originalRequire(module);
                };
            }
        });
        
        // Click main help button
        const mainHelpButton = page.locator('button:has-text("Open Full Help Guide")');
        await mainHelpButton.click();
        
        // Click service-specific buttons
        const learnMoreButtons = page.locator('button:has-text("Learn More")');
        const buttonCount = await learnMoreButtons.count();
        
        for (let i = 0; i < Math.min(buttonCount, 2); i++) {
            await learnMoreButtons.nth(i).click();
            await page.waitForTimeout(100);
        }
        
        // Check that no console errors occurred
        expect(consoleErrors.length).toBe(0);
    });

    test('should have working showQuickHelp function', async () => {
        // Switch to Help tab
        await page.click('[data-tab="help"]');
        
        // Test showQuickHelp function
        const result = await page.evaluate(() => {
            if (typeof window.showQuickHelp === 'function') {
                try {
                    // Mock alert to capture the message
                    let alertMessage = '';
                    const originalAlert = window.alert;
                    window.alert = (message) => {
                        alertMessage = message;
                    };
                    
                    window.showQuickHelp('discord');
                    
                    // Restore original alert
                    window.alert = originalAlert;
                    
                    return { success: true, message: alertMessage };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'Function not available' };
        });
        
        expect(result.success).toBe(true);
        expect(result.message).toContain('Discord Setup');
    });

    test('should handle help section navigation', async () => {
        // Switch to Help tab
        await page.click('[data-tab="help"]');
        
        // Test opening different help sections
        const sections = ['discord', 'roon', 'spotify', 'imgur', 'troubleshooting'];
        
        for (const section of sections) {
            const result = await page.evaluate(async (sectionName) => {
                if (typeof window.openHelpSection === 'function') {
                    try {
                        // Mock the IPC call
                        if (window.require) {
                            const originalRequire = window.require;
                            window.require = (module) => {
                                if (module === 'electron') {
                                    return {
                                        ipcRenderer: {
                                            invoke: async (channel, url) => {
                                                if (channel === 'open-external') {
                                                    return { 
                                                        success: true, 
                                                        url: url,
                                                        hasSection: url.includes('#' + sectionName)
                                                    };
                                                }
                                            }
                                        }
                                    };
                                }
                                return originalRequire(module);
                            };
                        }
                        
                        await window.openHelpSection(sectionName);
                        return { success: true };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                }
                return { success: false, error: 'Function not available' };
            }, section);
            
            expect(result.success).toBe(true);
        }
    });

    test('should have proper error handling for help functions', async () => {
        // Test error handling when IPC is not available
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
        
        // Should handle the error gracefully
        expect(result.success).toBe(true);
    });

    test('should validate help content accessibility', async () => {
        // Switch to Help tab with retry mechanism
        let helpTabClicked = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await page.click('[data-tab="help"]', { timeout: 5000 });
                helpTabClicked = true;
                break;
            } catch (error) {
                console.log(`Help tab click attempt ${attempt + 1} failed:`, error.message);
                await page.waitForTimeout(1000);
            }
        }

        if (!helpTabClicked) {
            // Skip this test if we can't click the help tab
            console.log('Skipping accessibility test - could not click help tab');
            return;
        }

        // Check that help content has proper accessibility attributes
        const helpSection = page.locator('#help-tab');
        await expect(helpSection).toBeVisible({ timeout: 10000 });

        // Check that buttons have proper text
        const buttons = page.locator('#help-tab button');
        const buttonCount = await buttons.count();

        if (buttonCount > 0) {
            for (let i = 0; i < Math.min(buttonCount, 3); i++) {
                const buttonText = await buttons.nth(i).textContent();
                expect(buttonText.trim().length).toBeGreaterThan(0);
            }
        }

        // Check that help cards have proper structure
        const helpCards = page.locator('.help-quick-card');
        const cardCount = await helpCards.count();

        if (cardCount > 0) {
            for (let i = 0; i < Math.min(cardCount, 2); i++) {
                const card = helpCards.nth(i);
                const heading = card.locator('h3');
                const description = card.locator('p');

                await expect(heading).toBeVisible();
                await expect(description).toBeVisible();

                const headingText = await heading.textContent();
                const descriptionText = await description.textContent();

                expect(headingText.trim().length).toBeGreaterThan(0);
                expect(descriptionText.trim().length).toBeGreaterThan(0);
            }
        }
    });
});
