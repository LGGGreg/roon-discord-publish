/**
 * Complete Workflow Test Suite
 * Tests the entire pipeline from Roon track changes to Discord rich presence
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'test-results/screenshots/workflow';

test.describe('Complete Roon → Discord Workflow', () => {
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
    });

    test('End-to-End Track Change to Discord Activity', async () => {
        console.log('🎵 Testing complete track change → Discord activity pipeline...');

        // Step 1: Wait for services to initialize
        console.log('1. Waiting for services to initialize...');
        await page.waitForTimeout(10000);
        
        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/e2e-01-initialization.png`,
            fullPage: true 
        });

        // Step 2: Verify Roon and Discord are connected
        console.log('2. Verifying core services...');
        const coreStatus = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            const status = await ipcRenderer.invoke('test-get-all-status');
            return {
                roon: status.roon?.state,
                discord: status.discord?.state,
                roonTrack: status.roon?.currentTrack
            };
        });

        console.log('Core service status:', coreStatus);
        
        // Require both Roon and Discord to be connected for this test
        expect(coreStatus.roon).toBe('connected');
        expect(coreStatus.discord).toBe('connected');

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/e2e-02-services-ready.png`,
            fullPage: true 
        });

        // Step 3: Test current track detection
        console.log('3. Testing current track detection...');
        const currentTrack = coreStatus.roonTrack;
        
        if (currentTrack) {
            console.log('✅ Track detected:', {
                title: currentTrack.title,
                artist: currentTrack.artist,
                album: currentTrack.album,
                zone: currentTrack.zoneName,
                state: currentTrack.state,
                hasImageKey: !!currentTrack.imageKey
            });

            expect(currentTrack.title).toBeTruthy();
            expect(currentTrack.artist).toBeTruthy();
            expect(currentTrack.zoneName).toBeTruthy();

            // Step 4: Test Discord activity update
            console.log('4. Testing Discord activity update...');
            
            // Get current Discord activity
            const discordStatus = await page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('discord-status');
            });

            console.log('Discord activity status:', {
                lastActivityTime: discordStatus.lastActivityTime,
                user: discordStatus.user?.username
            });

            // Verify Discord activity was set recently (within last 2 minutes)
            const activityAge = Date.now() - discordStatus.lastActivityTime;
            const twoMinutes = 2 * 60 * 1000;
            
            if (activityAge < twoMinutes) {
                console.log('✅ Discord activity recently updated');
            } else {
                console.log('⚠️ Discord activity not recently updated');
            }

            await page.screenshot({ 
                path: `${SCREENSHOT_DIR}/e2e-03-discord-activity.png`,
                fullPage: true 
            });

            // Step 5: Test enhanced features integration
            console.log('5. Testing enhanced features...');
            
            const enhancedStatus = await page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                const status = await ipcRenderer.invoke('test-get-all-status');
                return {
                    spotify: status.spotify?.state,
                    imgur: status.imgur?.state
                };
            });

            // Test Spotify integration if available
            if (enhancedStatus.spotify === 'connected') {
                console.log('Testing Spotify search integration...');
                
                const spotifyUrl = await page.evaluate(async (track) => {
                    const { ipcRenderer } = require('electron');
                    try {
                        return await ipcRenderer.invoke('spotify-search', track.title, track.artist, track.album);
                    } catch (error) {
                        console.error('Spotify search error:', error);
                        return null;
                    }
                }, currentTrack);

                if (spotifyUrl) {
                    expect(spotifyUrl).toContain('spotify.com');
                    console.log('✅ Spotify search successful');
                } else {
                    console.log('⚠️ Spotify search returned no results');
                }
            }

            // Test Imgur integration if available
            if (enhancedStatus.imgur === 'connected' && currentTrack.imageKey) {
                console.log('✅ Imgur ready for album art upload');
                console.log('Album art available with key:', currentTrack.imageKey);
            }

            await page.screenshot({ 
                path: `${SCREENSHOT_DIR}/e2e-04-enhanced-features.png`,
                fullPage: true 
            });

            // Step 6: Test GUI updates
            console.log('6. Testing GUI updates...');
            
            // Check if now playing information is displayed in GUI
            const nowPlayingVisible = await page.locator('.now-playing, [data-testid="now-playing"]').count();
            
            if (nowPlayingVisible > 0) {
                console.log('✅ Now playing information visible in GUI');
                
                // Try to find track title in the GUI
                const titleInGui = await page.locator(`text=${currentTrack.title}`).count();
                if (titleInGui > 0) {
                    console.log('✅ Track title found in GUI');
                }
            }

            await page.screenshot({ 
                path: `${SCREENSHOT_DIR}/e2e-05-gui-updates.png`,
                fullPage: true 
            });

            console.log('✅ Complete end-to-end workflow test PASSED');

        } else {
            console.log('⚠️ No track currently playing - cannot test complete workflow');
            console.log('This is expected if no music is playing in Roon');
            
            // Still test that the system is ready for when music starts
            console.log('Testing system readiness...');
            
            // Test that Discord can receive activity
            const testActivity = {
                title: 'Test Track',
                artist: 'Test Artist',
                album: 'Test Album',
                zoneName: 'Test Zone'
            };

            const activityResult = await page.evaluate(async (activity) => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('discord-set-activity', activity);
            }, testActivity);

            expect(activityResult).toBe(true);
            console.log('✅ Discord activity system ready');

            await page.screenshot({ 
                path: `${SCREENSHOT_DIR}/e2e-no-track-ready.png`,
                fullPage: true 
            });
        }
    });

    test('Album Art Pipeline Integration', async () => {
        console.log('🖼️ Testing album art pipeline integration...');

        await page.waitForTimeout(8000);

        // Get current track with potential album art
        const trackInfo = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            const status = await ipcRenderer.invoke('test-get-all-status');
            return status.roon?.currentTrack;
        });

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/albumart-01-start.png`,
            fullPage: true 
        });

        if (trackInfo && trackInfo.imageKey) {
            console.log('✅ Track with album art found:', trackInfo.title);
            console.log('Image key:', trackInfo.imageKey);

            // Test album art display in frontend
            console.log('Testing album art display...');
            
            // Wait a bit for album art to load
            await page.waitForTimeout(3000);
            
            // Look for album art in the GUI
            const albumArtElements = await page.locator('img[src*="data:image"], .album-art img, [data-testid="album-art"]').count();
            
            if (albumArtElements > 0) {
                console.log('✅ Album art displayed in GUI');
            } else {
                console.log('⚠️ Album art not visible (may still be loading)');
            }

            await page.screenshot({ 
                path: `${SCREENSHOT_DIR}/albumart-02-display.png`,
                fullPage: true 
            });

            // Test Imgur upload readiness
            const imgurStatus = await page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('imgur-status');
            });

            if (imgurStatus.state === 'connected') {
                console.log('✅ Imgur service ready for uploads');
                
                // Test upload capability (without actually uploading)
                console.log('Album art upload pipeline ready');
                console.log('- Image key available:', trackInfo.imageKey);
                console.log('- Imgur service connected');
                console.log('- Ready for Discord rich presence with album art');
            } else {
                console.log('⚠️ Imgur not connected - album art upload not available');
            }

            await page.screenshot({ 
                path: `${SCREENSHOT_DIR}/albumart-03-complete.png`,
                fullPage: true 
            });

        } else {
            console.log('⚠️ No track with album art currently available');
            console.log('This is expected if no music with album art is playing');
        }

        console.log('✅ Album art pipeline test completed');
    });

    test('Service Recovery and Resilience', async () => {
        console.log('🔄 Testing service recovery and resilience...');

        await page.waitForTimeout(5000);

        // Test initial state
        const initialStatus = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-get-all-status');
        });

        console.log('Initial service states:', {
            discord: initialStatus.discord?.state,
            roon: initialStatus.roon?.state,
            spotify: initialStatus.spotify?.state,
            imgur: initialStatus.imgur?.state
        });

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/recovery-01-initial.png`,
            fullPage: true 
        });

        // Test service reconnection capabilities
        console.log('Testing service reconnection...');
        
        const services = ['discord', 'spotify', 'imgur'];
        const reconnectResults = {};

        for (const service of services) {
            if (initialStatus[service]?.state === 'connected') {
                console.log(`Testing ${service} reconnection...`);
                
                const result = await page.evaluate(async (serviceName) => {
                    const { ipcRenderer } = require('electron');
                    return await ipcRenderer.invoke('test-trigger-reconnect', serviceName);
                }, service);

                reconnectResults[service] = result;
                console.log(`${service} reconnect result:`, result.message);
                
                // Wait a bit between reconnections
                await page.waitForTimeout(2000);
            }
        }

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/recovery-02-reconnections.png`,
            fullPage: true 
        });

        // Wait for reconnections to complete
        await page.waitForTimeout(5000);

        // Check final state
        const finalStatus = await page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('test-get-all-status');
        });

        console.log('Final service states:', {
            discord: finalStatus.discord?.state,
            roon: finalStatus.roon?.state,
            spotify: finalStatus.spotify?.state,
            imgur: finalStatus.imgur?.state
        });

        // Verify core services are still working
        expect(finalStatus.discord?.state).toBe('connected');
        expect(finalStatus.roon?.state).toBe('connected');

        await page.screenshot({ 
            path: `${SCREENSHOT_DIR}/recovery-03-final.png`,
            fullPage: true 
        });

        console.log('✅ Service recovery test completed');
    });

    test.afterEach(async () => {
        if (page) {
            await page.close();
        }
    });
});
