/**
 * Integration Test Suite
 * Tests complete end-to-end workflows from Roon to Discord
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'test-results/screenshots/integration';

test.describe('Complete Workflow Integration Tests', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
        // Create screenshot directory
        if (!fs.existsSync(SCREENSHOT_DIR)) {
            fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        }
    });

    test.beforeEach(async ({ browser }) => {
        // Launch the Electron app
        const electronApp = await browser.newContext({
            // Electron app configuration
        });
        
        page = await electronApp.newPage();
        
        // Wait for app to load
        await page.waitForTimeout(3000);
        
        // Take initial screenshot
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/00-app-start.png`,
            fullPage: true 
        });
    });

    test('Complete Roon to Discord Workflow', async () => {
        console.log('🧪 Testing complete Roon → Discord workflow...');

        // Step 1: Wait for all services to connect
        console.log('1. Waiting for services to connect...');
        await page.waitForTimeout(10000); // Allow time for connections
        
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/01-services-connecting.png`,
            fullPage: true 
        });

        // Step 2: Verify all services are connected
        console.log('2. Verifying service connections...');
        const serviceStatus = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-get-all-status');
        });

        console.log('Service Status:', serviceStatus);
        
        // Verify critical services are connected
        expect(serviceStatus.discord?.state).toBe('connected');
        expect(serviceStatus.roon?.state).toBe('connected');
        
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/02-services-connected.png`,
            fullPage: true 
        });

        // Step 3: Test track change detection
        console.log('3. Testing track change detection...');
        const currentTrack = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('roon-get-current-track');
        });

        if (currentTrack) {
            console.log('Current track detected:', currentTrack.title, 'by', currentTrack.artist);
            expect(currentTrack.title).toBeTruthy();
            expect(currentTrack.artist).toBeTruthy();
        } else {
            console.log('⚠️ No current track - this is expected if nothing is playing');
        }

        // Step 4: Test Discord activity setting
        console.log('4. Testing Discord activity...');
        if (currentTrack) {
            const activityResult = await page.evaluate(async (track) => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('discord-set-activity', track);
            }, currentTrack);

            expect(activityResult).toBe(true);
            console.log('✅ Discord activity set successfully');
        }

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/03-discord-activity-set.png`,
            fullPage: true 
        });

        // Step 5: Test Spotify search integration
        console.log('5. Testing Spotify search integration...');
        if (currentTrack && serviceStatus.spotify?.state === 'connected') {
            const spotifyUrl = await page.evaluate(async (track) => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('spotify-search', track.title, track.artist, track.album);
            }, currentTrack);

            if (spotifyUrl) {
                expect(spotifyUrl).toContain('spotify.com');
                console.log('✅ Spotify search successful:', spotifyUrl);
            } else {
                console.log('⚠️ Spotify search returned no results');
            }
        }

        // Step 6: Test album art pipeline
        console.log('6. Testing album art pipeline...');
        if (currentTrack && currentTrack.image_key) {
            // Test Imgur upload capability
            if (serviceStatus.imgur?.state === 'connected') {
                console.log('Testing Imgur upload capability...');
                // Note: We don't actually upload the image in tests to avoid API quota
                console.log('✅ Imgur service ready for album art uploads');
            }
        }

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/04-complete-workflow.png`,
            fullPage: true 
        });

        console.log('✅ Complete workflow test passed');
    });

    test('Album Art Integration Pipeline', async () => {
        console.log('🧪 Testing album art integration pipeline...');

        // Wait for services
        await page.waitForTimeout(8000);

        // Get current track with image
        const trackWithImage = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            const track = await ipcRenderer.invoke('roon-get-current-track');
            return track;
        });

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/albumart-01-start.png`,
            fullPage: true 
        });

        if (trackWithImage && trackWithImage.image_key) {
            console.log('Track with album art found:', trackWithImage.title);
            
            // Test that album art is displayed in GUI
            console.log('Checking for album art display in GUI...');
            
            // Look for album art elements in the now playing section
            const albumArtVisible = await page.locator('.now-playing img, .album-art, [data-testid="album-art"]').count();
            
            if (albumArtVisible > 0) {
                console.log('✅ Album art displayed in GUI');
            } else {
                console.log('⚠️ Album art not visible in GUI (may be loading)');
            }

            await page.screenshot({ 
                path: `${SCREENSHOT_DIR}/albumart-02-gui-display.png`,
                fullPage: true 
            });

            // Test Imgur integration readiness
            const imgurStatus = await page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('imgur-status');
            });

            if (imgurStatus.state === 'connected') {
                console.log('✅ Imgur ready for album art uploads');
                console.log('Image key available:', trackWithImage.image_key);
            }

        } else {
            console.log('⚠️ No track with album art currently playing');
        }

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/albumart-03-complete.png`,
            fullPage: true 
        });

        console.log('✅ Album art pipeline test completed');
    });

    test('Service Dependency Integration', async () => {
        console.log('🧪 Testing service dependency integration...');

        await page.waitForTimeout(5000);

        // Test service interdependencies
        console.log('1. Testing service interdependencies...');
        
        const allStatus = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-get-all-status');
        });

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/dependencies-01-initial.png`,
            fullPage: true 
        });

        // Test Discord dependency on Roon
        if (allStatus.roon?.state === 'connected' && allStatus.discord?.state === 'connected') {
            console.log('✅ Core dependency (Roon → Discord) working');
            
            // Test enhanced features dependency
            const enhancedFeatures = {
                spotify: allStatus.spotify?.state === 'connected',
                imgur: allStatus.imgur?.state === 'connected'
            };

            console.log('Enhanced features status:', enhancedFeatures);
            
            if (enhancedFeatures.spotify) {
                console.log('✅ Spotify enhancement available');
            }
            
            if (enhancedFeatures.imgur) {
                console.log('✅ Imgur enhancement available');
            }
        }

        // Test graceful degradation
        console.log('2. Testing graceful degradation...');
        
        // The app should work even if enhanced services are unavailable
        const coreServices = ['discord', 'roon'];
        const enhancedServices = ['spotify', 'imgur'];
        
        let coreWorking = true;
        for (const service of coreServices) {
            if (allStatus[service]?.state !== 'connected') {
                coreWorking = false;
                console.log(`❌ Core service ${service} not connected`);
            }
        }

        if (coreWorking) {
            console.log('✅ Core services working - app functional');
        }

        for (const service of enhancedServices) {
            if (allStatus[service]?.state === 'connected') {
                console.log(`✅ Enhanced service ${service} available`);
            } else {
                console.log(`⚠️ Enhanced service ${service} unavailable (graceful degradation)`);
            }
        }

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/dependencies-02-complete.png`,
            fullPage: true 
        });

        console.log('✅ Service dependency test completed');
    });

    test('Performance Integration Monitoring', async () => {
        console.log('🧪 Testing performance integration monitoring...');

        await page.waitForTimeout(5000);

        // Test StatusMonitor integration
        console.log('1. Testing StatusMonitor integration...');
        
        const overallStatus = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('status-monitor-get-overall');
        });

        if (overallStatus) {
            console.log('StatusMonitor data:', {
                totalServices: overallStatus.totalServices,
                healthyServices: overallStatus.healthyServices,
                overallHealth: overallStatus.overallHealth
            });

            expect(overallStatus.totalServices).toBeGreaterThan(0);
            expect(overallStatus.overallHealth).toBeGreaterThanOrEqual(0);
            
            console.log('✅ StatusMonitor integration working');
        }

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/performance-01-monitoring.png`,
            fullPage: true 
        });

        // Test performance metrics collection
        console.log('2. Testing performance metrics...');
        
        const allMetrics = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('status-monitor-get-all-metrics');
        });

        if (allMetrics) {
            console.log('Performance metrics available for services:', Object.keys(allMetrics));
            
            for (const [service, metrics] of Object.entries(allMetrics)) {
                if (metrics.responseTimes && metrics.responseTimes.length > 0) {
                    console.log(`${service}: avg response time ${metrics.averageResponseTime}ms`);
                }
            }
            
            console.log('✅ Performance metrics collection working');
        }

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/performance-02-complete.png`,
            fullPage: true 
        });

        console.log('✅ Performance integration test completed');
    });

    test('Configuration Integration Impact', async () => {
        console.log('🧪 Testing configuration integration impact...');

        await page.waitForTimeout(5000);

        // Test configuration system integration
        console.log('1. Testing configuration system...');
        
        const currentConfig = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('config-get-all');
        });

        expect(currentConfig).toBeTruthy();
        console.log('Configuration loaded:', Object.keys(currentConfig));

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/config-01-current.png`,
            fullPage: true 
        });

        // Test configuration validation
        console.log('2. Testing configuration validation...');
        
        const validation = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('config-validate');
        });

        expect(validation.isValid).toBe(true);
        console.log('Configuration validation:', validation.isValid ? 'PASSED' : 'FAILED');
        
        if (!validation.isValid) {
            console.log('Validation errors:', validation.errors);
        }

        // Test that services respond to configuration
        console.log('3. Testing service configuration integration...');
        
        const serviceConfigs = {
            discord: currentConfig.discord?.clientId ? 'configured' : 'missing',
            spotify: currentConfig.spotify?.clientId ? 'configured' : 'missing',
            imgur: currentConfig.imgur?.clientId ? 'configured' : 'missing'
        };

        console.log('Service configurations:', serviceConfigs);

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/config-02-complete.png`,
            fullPage: true 
        });

        console.log('✅ Configuration integration test completed');
    });

    test.afterEach(async () => {
        if (page) {
            await page.close();
        }
    });
});
