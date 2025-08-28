const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Improved Screenshot Capture
 * Captures high-quality screenshots with better timing and states
 */
class ImprovedScreenshotCapture {
    constructor() {
        this.electronApp = null;
        this.page = null;
        this.baseDir = 'docs/screenshots';
        
        // Ensure all directories exist
        this.ensureDirectories();
    }

    ensureDirectories() {
        const dirs = [
            `${this.baseDir}/features`,
            `${this.baseDir}/setup`,
            `${this.baseDir}/ui`,
            `${this.baseDir}/integrations`,
            `${this.baseDir}/states`
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async launch() {
        console.log('🚀 Launching Electron app for improved screenshots...');
        this.electronApp = await electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'production'  // Disable dev console
            }
        });
        
        this.page = await this.electronApp.firstWindow();
        console.log('✅ App launched successfully');
        
        // Wait for app to fully load
        await this.page.waitForTimeout(10000);
        
        // Wait for main content
        try {
            await this.page.waitForSelector('body', { timeout: 5000 });
            await this.page.waitForSelector('.nav-bar', { timeout: 5000 });
            console.log('✅ Main UI elements loaded');
        } catch (error) {
            console.log('⚠️ Some UI elements may not be loaded yet');
        }
    }

    async captureScreenshot(filename, category = 'features', description = '') {
        try {
            const filepath = path.join(this.baseDir, category, filename);
            
            // Wait a moment for any animations to settle
            await this.page.waitForTimeout(1000);
            
            await this.page.screenshot({ 
                path: filepath,
                fullPage: true,
                type: 'png'
            });
            
            const stats = fs.statSync(filepath);
            const sizeKB = Math.round(stats.size / 1024);
            console.log(`✅ Captured: ${category}/${filename} (${sizeKB}KB) - ${description}`);
            return true;
        } catch (error) {
            console.log(`❌ Failed to capture ${filename}:`, error.message);
            return false;
        }
    }

    async captureMainWindow() {
        console.log('\n📸 Capturing Main Window Screenshots...');
        
        // Ensure we're on the status tab
        try {
            await this.page.click('button[data-tab="status"]');
            await this.page.waitForTimeout(2000);
        } catch (error) {
            console.log('⚠️ Could not click status tab, continuing...');
        }
        
        // Main overview (this one is already good)
        await this.captureScreenshot('main-window-overview.png', 'features', 'Main application interface');
        
        // Wait for any services to potentially connect
        await this.page.waitForTimeout(3000);
        
        // Capture with potential service connections
        await this.captureScreenshot('app-with-services.png', 'features', 'Application with service status');
    }

    async captureAllTabs() {
        console.log('\n📋 Capturing All Tab Screenshots...');
        
        const tabs = [
            { id: 'status', name: 'Status Tab', category: 'features', description: 'Service connection status and now playing' },
            { id: 'config', name: 'Configuration Tab', category: 'setup', description: 'API configuration interface' },
            { id: 'logs', name: 'Logs Tab', category: 'ui', description: 'Application logs and debugging' },
            { id: 'help', name: 'Help Tab', category: 'ui', description: 'Help and documentation' }
        ];
        
        for (const tab of tabs) {
            try {
                console.log(`📑 Capturing ${tab.name}...`);
                
                // Click the tab
                await this.page.click(`button[data-tab="${tab.id}"]`);
                await this.page.waitForTimeout(2500); // Longer wait for tab content to load
                
                // Capture the tab
                const filename = `${tab.id}-tab.png`;
                await this.captureScreenshot(filename, tab.category, tab.description);
                
            } catch (error) {
                console.log(`⚠️ Could not capture ${tab.name}:`, error.message);
            }
        }
    }

    async captureConnectionStates() {
        console.log('\n🔗 Capturing Connection State Screenshots...');
        
        // Go to status tab
        try {
            await this.page.click('button[data-tab="status"]');
            await this.page.waitForTimeout(2000);
            
            // Capture initial connection state
            await this.captureScreenshot('connection-states.png', 'integrations', 'Service connection indicators');
            
            // Wait a bit more to see if services connect
            await this.page.waitForTimeout(5000);
            
            // Capture after waiting for connections
            await this.captureScreenshot('services-connecting.png', 'integrations', 'Services attempting to connect');
            
        } catch (error) {
            console.log('⚠️ Could not capture connection states:', error.message);
        }
    }

    async captureConfigurationDetails() {
        console.log('\n⚙️ Capturing Configuration Screenshots...');
        
        try {
            // Go to config tab
            await this.page.click('button[data-tab="config"]');
            await this.page.waitForTimeout(3000);
            
            // Capture main config view
            await this.captureScreenshot('configuration-overview.png', 'setup', 'Complete configuration interface');
            
            // Try to scroll down to see more config options if they exist
            await this.page.evaluate(() => {
                const configContent = document.querySelector('.tab-content');
                if (configContent) {
                    configContent.scrollTop = configContent.scrollHeight / 2;
                }
            });
            await this.page.waitForTimeout(1000);
            
            await this.captureScreenshot('configuration-details.png', 'setup', 'Configuration form details');
            
        } catch (error) {
            console.log('⚠️ Could not capture configuration details:', error.message);
        }
    }

    async captureApplicationStates() {
        console.log('\n🎯 Capturing Different Application States...');
        
        // Capture fresh startup state
        await this.captureScreenshot('app-startup.png', 'states', 'Application at startup');
        
        // Go through tabs to show different states
        const states = [
            { tab: 'status', name: 'status-active.png', desc: 'Status tab active' },
            { tab: 'config', name: 'config-active.png', desc: 'Configuration tab active' },
            { tab: 'logs', name: 'logs-active.png', desc: 'Logs tab active' },
            { tab: 'help', name: 'help-active.png', desc: 'Help tab active' }
        ];
        
        for (const state of states) {
            try {
                await this.page.click(`button[data-tab="${state.tab}"]`);
                await this.page.waitForTimeout(2000);
                await this.captureScreenshot(state.name, 'states', state.desc);
            } catch (error) {
                console.log(`⚠️ Could not capture state ${state.name}`);
            }
        }
    }

    async captureAll() {
        try {
            await this.launch();
            
            // Capture different categories of screenshots
            await this.captureMainWindow();
            await this.captureAllTabs();
            await this.captureConnectionStates();
            await this.captureConfigurationDetails();
            await this.captureApplicationStates();
            
            console.log('\n🎉 Improved screenshot capture completed!');
            
            // Run verification
            const ScreenshotVerifier = require('./verify-screenshots');
            const verifier = new ScreenshotVerifier();
            const report = verifier.generateReport();
            
            console.log(`\n📊 Final Results: ${report.verification.good}/${report.verification.total} screenshots (${report.verification.successRate}% success)`);
            
        } catch (error) {
            console.error('❌ Improved screenshot capture failed:', error);
        } finally {
            if (this.electronApp) {
                await this.electronApp.close();
                console.log('App closed');
            }
        }
    }
}

// Run the improved screenshot capture
if (require.main === module) {
    const capture = new ImprovedScreenshotCapture();
    capture.captureAll().catch(console.error);
}

module.exports = ImprovedScreenshotCapture;
