const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Basic Screenshot Capture
 * Just captures the app window without waiting for services
 */
class BasicScreenshotCapture {
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
            `${this.baseDir}/integrations`
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async launch() {
        console.log('🚀 Launching Electron app...');
        this.electronApp = await electron.launch({
            args: [path.join(__dirname, '../../src/main/main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'production'  // Disable dev console
            }
        });

        this.page = await this.electronApp.firstWindow();
        console.log('✅ App launched successfully');

        // Wait for basic app initialization
        await this.page.waitForTimeout(8000);  // Longer wait for full loading

        // Check if the page has loaded content
        try {
            await this.page.waitForSelector('body', { timeout: 5000 });
            console.log('✅ Page body loaded');
        } catch (error) {
            console.log('⚠️ Could not find body element');
        }
    }

    async captureScreenshot(filename, category = 'features') {
        try {
            const filepath = path.join(this.baseDir, category, filename);

            // Get page info for debugging
            const title = await this.page.title();
            const url = this.page.url();
            console.log(`📄 Page title: "${title}", URL: ${url}`);

            await this.page.screenshot({
                path: filepath,
                fullPage: true,
                type: 'png'
            });

            // Check file size to see if screenshot worked
            const stats = fs.statSync(filepath);
            console.log(`✅ Captured: ${category}/${filename} (${Math.round(stats.size / 1024)}KB)`);
            return true;
        } catch (error) {
            console.log(`❌ Failed to capture ${filename}:`, error.message);
            return false;
        }
    }

    async captureAll() {
        try {
            await this.launch();
            
            console.log('\n📸 Capturing screenshots...');

            // Wait for the window to be fully rendered
            await this.page.waitForTimeout(3000);

            // Debug: Check what's on the page
            const bodyContent = await this.page.evaluate(() => {
                return {
                    hasBody: !!document.body,
                    bodyHTML: document.body ? document.body.innerHTML.substring(0, 200) : 'No body',
                    title: document.title,
                    readyState: document.readyState
                };
            });
            console.log('🔍 Page content:', bodyContent);

            // Capture main window
            await this.captureScreenshot('01-main-window-overview.png', 'features');
            
            // Try to navigate tabs if they exist
            try {
                // Check if tabs exist
                const tabs = await this.page.$$('button[data-tab]');
                if (tabs.length > 0) {
                    console.log(`Found ${tabs.length} tabs`);
                    
                    // Click Configuration tab
                    await this.page.click('button[data-tab="config"]');
                    await this.page.waitForTimeout(1500);
                    await this.captureScreenshot('02-configuration-tab.png', 'setup');
                    
                    // Click Logs tab
                    await this.page.click('button[data-tab="logs"]');
                    await this.page.waitForTimeout(1500);
                    await this.captureScreenshot('03-logs-tab.png', 'ui');
                    
                    // Click Help tab
                    await this.page.click('button[data-tab="help"]');
                    await this.page.waitForTimeout(1500);
                    await this.captureScreenshot('04-help-tab.png', 'ui');
                    
                    // Return to Status tab
                    await this.page.click('button[data-tab="status"]');
                    await this.page.waitForTimeout(1500);
                    await this.captureScreenshot('05-status-tab.png', 'features');
                } else {
                    console.log('No tabs found, capturing current state');
                    await this.captureScreenshot('02-current-state.png', 'features');
                }
            } catch (tabError) {
                console.log('⚠️ Could not navigate tabs:', tabError.message);
                await this.captureScreenshot('02-error-state.png', 'features');
            }
            
            // Wait a bit more and capture final state
            await this.page.waitForTimeout(2000);
            await this.captureScreenshot('06-final-state.png', 'features');
            
            console.log('\n🎉 Screenshot capture completed!');
            
        } catch (error) {
            console.error('❌ Screenshot capture failed:', error);
        } finally {
            if (this.electronApp) {
                await this.electronApp.close();
                console.log('App closed');
            }
        }
    }
}

// Run the screenshot capture
if (require.main === module) {
    const capture = new BasicScreenshotCapture();
    capture.captureAll().catch(console.error);
}

module.exports = BasicScreenshotCapture;
