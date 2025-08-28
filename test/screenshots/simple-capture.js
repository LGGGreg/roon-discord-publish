const TestController = require('../utils/TestController');
const path = require('path');
const fs = require('fs');

/**
 * Simple Screenshot Capture Script
 * Captures basic screenshots without complex interactions
 */
class SimpleScreenshotCapture {
    constructor() {
        this.controller = new TestController();
        this.baseDir = 'docs/screenshots';
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        
        // Override the TestController's screenshot directory
        this.controller.screenshotDir = this.baseDir;
        
        // Ensure all directories exist
        this.ensureDirectories();
    }

    ensureDirectories() {
        const dirs = [
            `${this.baseDir}/features`,
            `${this.baseDir}/setup`,
            `${this.baseDir}/ui`,
            `${this.baseDir}/integrations`,
            `${this.baseDir}/journey`
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async captureScreenshot(filename, category = 'features') {
        try {
            const filepath = `${category}/${filename}`;
            await this.controller.takeScreenshot(filepath);
            console.log(`✅ Captured: ${filepath}`);
            
            // Small delay between screenshots for stability
            await this.controller.page.waitForTimeout(1000);
            return true;
        } catch (error) {
            console.log(`❌ Failed to capture ${filename}:`, error.message);
            return false;
        }
    }

    async captureBasicScreenshots() {
        console.log('\n📸 Capturing Basic Screenshots...');

        // Wait for app to fully load and render
        console.log('⏳ Waiting for app to fully load...');
        await this.controller.page.waitForTimeout(8000);

        // Wait for the main content to be visible
        try {
            await this.controller.page.waitForSelector('.main-content', { timeout: 10000 });
            console.log('✅ Main content loaded');
        } catch (error) {
            console.log('⚠️ Main content selector not found, continuing anyway');
        }

        // Capture main window
        await this.captureScreenshot('01-main-window-overview.png', 'features');
        
        // Try to click on different tabs using CSS selectors
        try {
            // Wait for tabs to be available
            await this.controller.page.waitForSelector('button[data-tab]', { timeout: 5000 });

            // Click on Configuration tab
            await this.controller.page.click('button[data-tab="config"]');
            await this.controller.page.waitForTimeout(2000);
            await this.captureScreenshot('02-configuration-tab.png', 'setup');

            // Click on Logs tab
            await this.controller.page.click('button[data-tab="logs"]');
            await this.controller.page.waitForTimeout(2000);
            await this.captureScreenshot('03-logs-tab.png', 'ui');

            // Click on Help tab
            await this.controller.page.click('button[data-tab="help"]');
            await this.controller.page.waitForTimeout(2000);
            await this.captureScreenshot('04-help-tab.png', 'ui');

            // Return to Status tab
            await this.controller.page.click('button[data-tab="status"]');
            await this.controller.page.waitForTimeout(2000);
            await this.captureScreenshot('05-status-tab-return.png', 'features');

        } catch (tabError) {
            console.log('⚠️ Could not navigate tabs:', tabError.message);
        }
        
        // Wait a bit more for any services to connect
        console.log('⏳ Waiting for potential service connections...');
        await this.controller.page.waitForTimeout(5000);
        
        // Capture final state
        await this.captureScreenshot('06-final-state.png', 'features');
    }

    async captureServiceStatus() {
        console.log('\n📊 Capturing Service Status...');
        
        try {
            // Get service status via IPC
            const status = await this.controller.getServiceStatus();
            console.log('Service Status:', JSON.stringify(status, null, 2));
            
            // Capture current state
            await this.captureScreenshot('service-status-current.png', 'integrations');
            
            return status;
        } catch (error) {
            console.log('⚠️ Could not get service status:', error.message);
            await this.captureScreenshot('service-status-error.png', 'integrations');
            return null;
        }
    }

    async generateReport() {
        console.log('\n📋 Generating Screenshot Report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            captureDate: this.timestamp,
            screenshots: {},
            systemInfo: {
                platform: process.platform,
                nodeVersion: process.version,
                electronVersion: process.versions.electron
            }
        };
        
        // Count screenshots in each directory
        const dirs = ['features', 'setup', 'ui', 'integrations', 'journey'];
        dirs.forEach(dir => {
            const dirPath = `${this.baseDir}/${dir}`;
            if (fs.existsSync(dirPath)) {
                report.screenshots[dir] = fs.readdirSync(dirPath).length;
            } else {
                report.screenshots[dir] = 0;
            }
        });
        
        fs.writeFileSync(
            `${this.baseDir}/capture-report-${this.timestamp}.json`,
            JSON.stringify(report, null, 2)
        );
        
        console.log('📊 Screenshot Report:', report);
        return report;
    }

    async captureAll() {
        console.log('🎬 Starting Simple Screenshot Capture...');
        console.log(`📁 Screenshots will be saved to: ${this.baseDir}`);
        
        try {
            // Launch the application
            await this.controller.launch();
            console.log('🚀 Application launched successfully');
            
            // Capture basic screenshots
            await this.captureBasicScreenshots();
            
            // Capture service status
            await this.captureServiceStatus();
            
            // Generate final report
            const report = await this.generateReport();
            
            console.log('\n🎉 Screenshot capture completed successfully!');
            console.log(`📸 Total screenshots captured: ${Object.values(report.screenshots).reduce((a, b) => a + b, 0)}`);
            console.log(`📁 Screenshots saved in: ${this.baseDir}`);
            
            return report;
            
        } catch (error) {
            console.error('❌ Screenshot capture failed:', error);
            throw error;
        } finally {
            // Clean up
            await this.controller.close();
        }
    }
}

// Run the screenshot capture
if (require.main === module) {
    const capture = new SimpleScreenshotCapture();
    capture.captureAll().catch(console.error);
}

module.exports = SimpleScreenshotCapture;
