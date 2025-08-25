const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
    screenshotDir: './test-screenshots',
    testTimeout: 30000,
    windowWidth: 1200,
    windowHeight: 800
};

class GUITester {
    constructor() {
        this.mainWindow = null;
        this.testResults = [];
    }

    async initialize() {
        // Create screenshot directory
        if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
            fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
        }

        // Wait for app to be ready
        await app.whenReady();

        // Create main window
        this.mainWindow = new BrowserWindow({
            width: TEST_CONFIG.windowWidth,
            height: TEST_CONFIG.windowHeight,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            },
            show: true
        });

        // Load the app
        await this.mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
        
        // Wait for app to fully load
        await this.wait(3000);
    }

    async takeScreenshot(name, description = '') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${timestamp}_${name}.png`;
            const filepath = path.join(TEST_CONFIG.screenshotDir, filename);
            
            const image = await this.mainWindow.capturePage();
            fs.writeFileSync(filepath, image.toPNG());
            
            console.log(`📸 Screenshot saved: ${filename} - ${description}`);
            
            this.testResults.push({
                type: 'screenshot',
                name,
                description,
                filename,
                filepath,
                timestamp: new Date().toISOString()
            });
            
            return filepath;
        } catch (error) {
            console.error(`❌ Failed to take screenshot ${name}:`, error);
            return null;
        }
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async executeJS(code) {
        try {
            return await this.mainWindow.webContents.executeJavaScript(code);
        } catch (error) {
            console.error('❌ Failed to execute JavaScript:', error);
            return null;
        }
    }

    async testCurrentState() {
        console.log('🧪 Starting GUI tests...');
        
        // Take initial screenshot
        await this.takeScreenshot('01_initial_state', 'Initial app state after loading');
        
        // Test connection status display
        const statusElements = await this.executeJS(`
            const statuses = {};
            ['discord', 'roon', 'spotify', 'imgur'].forEach(service => {
                const statusDot = document.querySelector('#' + service + '-status .status-dot');
                const statusText = document.querySelector('#' + service + '-status .status-text');
                const details = document.querySelector('#' + service + '-details');
                
                statuses[service] = {
                    dotClass: statusDot ? statusDot.className : 'not found',
                    text: statusText ? statusText.textContent : 'not found',
                    details: details ? details.textContent : 'not found',
                    visible: statusDot ? !statusDot.hidden : false
                };
            });
            statuses;
        `);
        
        console.log('📊 Connection Status Elements:', JSON.stringify(statusElements, null, 2));
        
        // Test refresh buttons
        const refreshButtons = await this.executeJS(`
            const buttons = {};
            const refreshActivity = document.querySelector('#refresh-activity');
            const refreshStatus = document.querySelector('#refresh-status');
            
            buttons.refreshActivity = {
                exists: !!refreshActivity,
                visible: refreshActivity ? !refreshActivity.hidden && refreshActivity.style.display !== 'none' : false,
                text: refreshActivity ? refreshActivity.textContent.trim() : 'not found',
                className: refreshActivity ? refreshActivity.className : 'not found'
            };
            
            buttons.refreshStatus = {
                exists: !!refreshStatus,
                visible: refreshStatus ? !refreshStatus.hidden && refreshStatus.style.display !== 'none' : false,
                text: refreshStatus ? refreshStatus.textContent.trim() : 'not found',
                className: refreshStatus ? refreshStatus.className : 'not found'
            };
            
            // Also check for any other buttons with "refresh" in text or id
            const allButtons = Array.from(document.querySelectorAll('button'));
            buttons.allRefreshButtons = allButtons.filter(btn => 
                btn.textContent.toLowerCase().includes('refresh') || 
                btn.id.toLowerCase().includes('refresh')
            ).map(btn => ({
                id: btn.id,
                text: btn.textContent.trim(),
                className: btn.className,
                visible: !btn.hidden && btn.style.display !== 'none'
            }));
            
            buttons;
        `);
        
        console.log('🔄 Refresh Buttons:', JSON.stringify(refreshButtons, null, 2));
        
        return {
            statusElements,
            refreshButtons
        };
    }

    async generateReport() {
        const reportPath = path.join(TEST_CONFIG.screenshotDir, 'test-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            testResults: this.testResults,
            summary: {
                totalScreenshots: this.testResults.filter(r => r.type === 'screenshot').length
            }
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📋 Test report saved: ${reportPath}`);
        
        return report;
    }

    async cleanup() {
        if (this.mainWindow) {
            this.mainWindow.close();
        }
        app.quit();
    }
}

// Main test execution
async function runTests() {
    const tester = new GUITester();
    
    try {
        await tester.initialize();
        
        const currentState = await tester.testCurrentState();
        
        await tester.generateReport();
        
        console.log('✅ GUI tests completed successfully!');
        console.log('📁 Screenshots saved in:', TEST_CONFIG.screenshotDir);
        
        // Keep window open for manual inspection
        console.log('🔍 Window will stay open for 30 seconds for manual inspection...');
        await tester.wait(30000);
        
    } catch (error) {
        console.error('❌ GUI tests failed:', error);
    } finally {
        await tester.cleanup();
    }
}

// Handle app events
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Start tests when app is ready
if (require.main === module) {
    runTests();
}

module.exports = { GUITester, runTests };
