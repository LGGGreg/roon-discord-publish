const { _electron: electron } = require('playwright');
const screenshot = require('screenshot-desktop');
const path = require('path');
const fs = require('fs');

/**
 * Test Controller for Roon Discord Rich Presence
 * Provides programmatic control and screenshot capabilities
 */
class TestController {
    constructor() {
        this.electronApp = null;
        this.page = null;
        this.screenshotDir = 'test-results/screenshots';
        this.isConnected = false;
        
        // Ensure screenshot directory exists
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    /**
     * Launch the Electron application
     */
    async launch() {
        if (this.electronApp) {
            console.log('App already launched');
            return;
        }

        console.log('Launching Electron app...');
        this.electronApp = await electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'development'
            }
        });
        
        this.page = await this.electronApp.firstWindow();
        this.isConnected = true;
        
        // Wait for app to initialize
        await this.page.waitForTimeout(2000);
        console.log('App launched successfully');
    }

    /**
     * Close the Electron application
     */
    async close() {
        if (this.electronApp) {
            await this.electronApp.close();
            this.electronApp = null;
            this.page = null;
            this.isConnected = false;
            console.log('App closed');
        }
    }

    /**
     * Take a screenshot using Playwright
     */
    async takeScreenshot(filename) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const filepath = path.join(this.screenshotDir, filename);
        await this.page.screenshot({ 
            path: filepath,
            fullPage: true 
        });
        console.log(`Screenshot saved: ${filepath}`);
        return filepath;
    }

    /**
     * Take a native desktop screenshot (alternative method)
     */
    async takeNativeScreenshot(filename) {
        const filepath = path.join(this.screenshotDir, filename);
        await screenshot({ filename: filepath });
        console.log(`Native screenshot saved: ${filepath}`);
        return filepath;
    }

    /**
     * Get service status using IPC
     */
    async getServiceStatus() {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const status = await this.page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-get-all-status');
        });

        return status;
    }

    /**
     * Get service status from GUI elements
     */
    async getGUIStatus() {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const discordStatus = await this.page.locator('[data-testid="discord-status-text"]').textContent();
        const roonStatus = await this.page.locator('[data-testid="roon-status-text"]').textContent();
        
        return {
            discord: discordStatus,
            roon: roonStatus
        };
    }

    /**
     * Trigger service reconnection
     */
    async reconnectService(service) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        const result = await this.page.evaluate(async (serviceName) => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-trigger-reconnect', serviceName);
        }, service);

        console.log(`Reconnect ${service}:`, result);
        return result;
    }

    /**
     * Click a GUI element
     */
    async clickElement(selector) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        await this.page.locator(selector).click();
        console.log(`Clicked element: ${selector}`);
    }

    /**
     * Wait for element to be visible
     */
    async waitForElement(selector, timeout = 5000) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        await this.page.locator(selector).waitFor({ timeout });
        console.log(`Element visible: ${selector}`);
    }

    /**
     * Switch to a specific tab
     */
    async switchTab(tabName) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        await this.page.locator(`[data-tab="${tabName}"]`).click();
        await this.page.waitForTimeout(500);
        console.log(`Switched to tab: ${tabName}`);
    }

    /**
     * Wait for services to connect
     */
    async waitForConnection(timeout = 15000) {
        if (!this.page) {
            throw new Error('App not launched. Call launch() first.');
        }

        console.log('Waiting for services to connect...');
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const status = await this.getGUIStatus();
            
            if (status.discord === 'Connected' && status.roon === 'Connected') {
                console.log('Both services connected!');
                return true;
            }
            
            console.log(`Status: Discord=${status.discord}, Roon=${status.roon}`);
            await this.page.waitForTimeout(1000);
        }
        
        console.log('Timeout waiting for connections');
        return false;
    }

    /**
     * Run a comprehensive status check
     */
    async runStatusCheck() {
        console.log('\n=== Running Status Check ===');
        
        // Take initial screenshot
        await this.takeScreenshot('status-check-start.png');
        
        // Get GUI status
        const guiStatus = await this.getGUIStatus();
        console.log('GUI Status:', guiStatus);
        
        // Get IPC status
        const ipcStatus = await this.getServiceStatus();
        console.log('IPC Status:', ipcStatus);
        
        // Take final screenshot
        await this.takeScreenshot('status-check-end.png');
        
        return {
            gui: guiStatus,
            ipc: ipcStatus,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = TestController;
