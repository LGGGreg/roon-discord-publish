const TestController = require('../utils/TestController');
const path = require('path');
const fs = require('fs');

/**
 * Comprehensive Screenshot Capture Script
 * Captures all screenshots needed for README documentation
 */
class ScreenshotCapture {
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
        const filepath = `${category}/${filename}`;
        await this.controller.takeScreenshot(filepath);
        console.log(`✅ Captured: ${filepath}`);
        
        // Small delay between screenshots for stability
        await this.controller.page.waitForTimeout(500);
    }

    async captureApplicationOverview() {
        console.log('\n📸 Capturing Application Overview Screenshots...');

        try {
            // Main window overview
            await this.captureScreenshot('main-window-overview.png', 'features');

            // Try to switch to different tabs to show full interface
            try {
                await this.controller.switchTab('config');
                await this.captureScreenshot('settings-overview.png', 'setup');

                await this.controller.switchTab('status');
                await this.captureScreenshot('connection-status-all.png', 'features');
            } catch (tabError) {
                console.log('⚠️ Could not switch tabs:', tabError.message);
                // Continue with just the main overview
            }
        } catch (error) {
            console.log('⚠️ Error capturing application overview:', error.message);
        }
    }

    async captureNowPlayingFeatures() {
        console.log('\n🎵 Capturing Now Playing Features...');

        try {
            // Get current track info
            const currentTrack = await this.controller.getCurrentTrack();
            if (currentTrack && currentTrack.title) {
                await this.captureScreenshot('now-playing-display.png', 'features');
                console.log(`📀 Current track: ${currentTrack.title} - ${currentTrack.artist}`);
            } else {
                console.log('⚠️ No current track detected, capturing empty state');
                await this.captureScreenshot('now-playing-empty.png', 'features');
            }

            // Capture position tracking (wait for position updates)
            console.log('⏱️ Waiting for position updates...');
            await this.controller.page.waitForTimeout(3000);
            await this.captureScreenshot('position-tracking.png', 'features');
        } catch (error) {
            console.log('⚠️ Error capturing now playing features:', error.message);
            await this.captureScreenshot('now-playing-error.png', 'features');
        }
    }

    async captureServiceIntegrations() {
        console.log('\n🔗 Capturing Service Integrations...');

        try {
            // Test Spotify integration
            console.log('🎧 Testing Spotify integration...');
            const spotifyResult = await this.controller.testSpotifySearch();
            await this.captureScreenshot('spotify-integration.png', 'integrations');

            // Test Discord activity
            console.log('💬 Testing Discord activity...');
            const activityResult = await this.controller.testEnhancedActivity();
            await this.captureScreenshot('discord-rich-presence-enhanced.png', 'integrations');

            // Capture service status
            const status = await this.controller.getServiceStatus();
            console.log('📊 Service Status:', status);
            await this.captureScreenshot('service-status-detailed.png', 'integrations');
        } catch (error) {
            console.log('⚠️ Error capturing service integrations:', error.message);
            await this.captureScreenshot('service-integrations-error.png', 'integrations');
        }
    }

    async captureSetupFlow() {
        console.log('\n⚙️ Capturing Setup Flow...');
        
        // Switch to configuration tab
        await this.controller.switchTab('config');
        
        // Capture Discord setup section
        await this.captureScreenshot('discord-setup.png', 'setup');
        
        // Capture Spotify configuration
        await this.captureScreenshot('spotify-credentials.png', 'setup');
        
        // Capture Imgur configuration
        await this.captureScreenshot('imgur-optional-setup.png', 'setup');
        
        // Capture complete configuration
        await this.captureScreenshot('config-complete.png', 'setup');
        
        // Return to status tab
        await this.controller.switchTab('status');
    }

    async captureUIStates() {
        console.log('\n🎨 Capturing UI States...');
        
        // Capture different connection states
        await this.captureScreenshot('status-connected.png', 'ui');
        
        // Test service reconnection to show connecting state
        console.log('🔄 Testing service reconnection...');
        await this.controller.reconnectService('discord');
        await this.controller.page.waitForTimeout(1000);
        await this.captureScreenshot('status-connecting.png', 'ui');
        
        // Wait for reconnection to complete
        await this.controller.page.waitForTimeout(3000);
        await this.captureScreenshot('status-reconnected.png', 'ui');
    }

    async captureAdvancedFeatures() {
        console.log('\n🚀 Capturing Advanced Features...');
        
        // Capture menu options (if accessible via automation)
        await this.captureScreenshot('menu-overview.png', 'features');
        
        // Test error handling by triggering a controlled error
        console.log('⚠️ Testing error handling...');
        // Note: This would need specific error simulation
        await this.captureScreenshot('error-handling.png', 'features');
        
        // Capture rate limiting protection
        console.log('🛡️ Testing rate limiting...');
        // Trigger multiple rapid updates to show rate limiting
        for (let i = 0; i < 5; i++) {
            await this.controller.setDiscordActivity({
                title: `Test Track ${i}`,
                artist: 'Test Artist',
                album: 'Test Album'
            });
            await this.controller.page.waitForTimeout(100);
        }
        await this.captureScreenshot('rate-limiting.png', 'features');
    }

    async captureUserJourney() {
        console.log('\n🚶 Capturing User Journey...');
        
        // Journey step 1: Initial state
        await this.captureScreenshot('journey-01-initial-launch.png', 'journey');
        
        // Journey step 2: Service discovery
        await this.controller.page.waitForTimeout(2000);
        await this.captureScreenshot('journey-02-service-discovery.png', 'journey');
        
        // Journey step 3: First connection
        const connected = await this.controller.waitForConnection(10000);
        if (connected) {
            await this.captureScreenshot('journey-03-services-connected.png', 'journey');
        }
        
        // Journey step 4: First track detection
        const track = await this.controller.getCurrentTrack();
        if (track && track.title) {
            await this.captureScreenshot('journey-04-first-track.png', 'journey');
        }
        
        // Journey step 5: Enhanced features working
        await this.captureScreenshot('journey-05-enhanced-features.png', 'journey');
    }

    async generateReport() {
        console.log('\n📋 Generating Screenshot Report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            captureDate: this.timestamp,
            screenshots: {
                features: fs.readdirSync(`${this.baseDir}/features`).length,
                setup: fs.readdirSync(`${this.baseDir}/setup`).length,
                ui: fs.readdirSync(`${this.baseDir}/ui`).length,
                integrations: fs.readdirSync(`${this.baseDir}/integrations`).length,
                journey: fs.readdirSync(`${this.baseDir}/journey`).length
            },
            serviceStatus: await this.controller.getServiceStatus(),
            systemInfo: {
                platform: process.platform,
                nodeVersion: process.version,
                electronVersion: process.versions.electron
            }
        };
        
        fs.writeFileSync(
            `${this.baseDir}/capture-report-${this.timestamp}.json`,
            JSON.stringify(report, null, 2)
        );
        
        console.log('📊 Screenshot Report:', report);
        return report;
    }

    async captureAll() {
        console.log('🎬 Starting Comprehensive Screenshot Capture...');
        console.log(`📁 Screenshots will be saved to: ${this.baseDir}`);

        try {
            // Launch the application
            await this.controller.launch();
            console.log('🚀 Application launched successfully');

            // Wait for app to load (don't require full connection)
            console.log('⏳ Waiting for app to initialize...');
            await this.controller.page.waitForTimeout(5000);

            // Capture initial state regardless of connection status
            await this.captureApplicationOverview();

            // Try to wait for connections, but continue even if some fail
            console.log('🔗 Attempting to connect services...');
            try {
                const connected = await this.controller.waitForConnection(10000);
                if (connected) {
                    console.log('✅ Services connected, capturing connected state');
                    await this.captureNowPlayingFeatures();
                    await this.captureServiceIntegrations();
                } else {
                    console.log('⚠️ Not all services connected, capturing partial state');
                }
            } catch (connectionError) {
                console.log('⚠️ Connection timeout, capturing disconnected state');
            }

            // Capture remaining categories
            await this.captureSetupFlow();
            await this.captureUIStates();
            await this.captureAdvancedFeatures();
            await this.captureUserJourney();

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
    const capture = new ScreenshotCapture();
    capture.captureAll().catch(console.error);
}

module.exports = ScreenshotCapture;
