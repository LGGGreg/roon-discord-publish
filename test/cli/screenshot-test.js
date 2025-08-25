const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function takeScreenshots() {
    console.log('🧪 Starting screenshot test...');
    
    // Create screenshots directory
    const screenshotDir = './test-screenshots';
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    let browser;
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1200, height: 800 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Navigate to the app (assuming it's running on localhost)
        const appUrl = `file://${path.resolve(__dirname, 'src/renderer/index.html')}`;
        console.log('📱 Loading app from:', appUrl);
        
        await page.goto(appUrl, { waitUntil: 'networkidle0' });
        
        // Wait for app to load
        await page.waitForTimeout(3000);
        
        // Take initial screenshot
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({ 
            path: path.join(screenshotDir, `${timestamp}_01_initial_state.png`),
            fullPage: true 
        });
        console.log('📸 Initial screenshot taken');
        
        // Analyze refresh buttons
        const refreshButtons = await page.evaluate(() => {
            const buttons = {};
            
            // Look for refresh activity button
            const refreshActivity = document.querySelector('#refresh-activity');
            buttons.refreshActivity = {
                exists: !!refreshActivity,
                visible: refreshActivity ? window.getComputedStyle(refreshActivity).display !== 'none' : false,
                text: refreshActivity ? refreshActivity.textContent.trim() : 'not found',
                className: refreshActivity ? refreshActivity.className : 'not found'
            };
            
            // Look for refresh status button
            const refreshStatus = document.querySelector('#refresh-status');
            buttons.refreshStatus = {
                exists: !!refreshStatus,
                visible: refreshStatus ? window.getComputedStyle(refreshStatus).display !== 'none' : false,
                text: refreshStatus ? refreshStatus.textContent.trim() : 'not found',
                className: refreshStatus ? refreshStatus.className : 'not found'
            };
            
            // Find all buttons with "refresh" in text or id
            const allButtons = Array.from(document.querySelectorAll('button'));
            buttons.allRefreshButtons = allButtons.filter(btn => 
                btn.textContent.toLowerCase().includes('refresh') || 
                btn.id.toLowerCase().includes('refresh')
            ).map(btn => ({
                id: btn.id,
                text: btn.textContent.trim(),
                className: btn.className,
                visible: window.getComputedStyle(btn).display !== 'none'
            }));
            
            return buttons;
        });
        
        console.log('🔄 Refresh Buttons Analysis:', JSON.stringify(refreshButtons, null, 2));
        
        // Analyze connection status
        const statusElements = await page.evaluate(() => {
            const statuses = {};
            ['discord', 'roon', 'spotify', 'imgur'].forEach(service => {
                const statusDot = document.querySelector(`#${service}-status .status-dot`);
                const statusText = document.querySelector(`#${service}-status .status-text`);
                const details = document.querySelector(`#${service}-details`);
                
                statuses[service] = {
                    dotClass: statusDot ? statusDot.className : 'not found',
                    text: statusText ? statusText.textContent.trim() : 'not found',
                    details: details ? details.textContent.trim() : 'not found',
                    visible: statusDot ? window.getComputedStyle(statusDot).display !== 'none' : false
                };
            });
            return statuses;
        });
        
        console.log('📊 Connection Status Analysis:', JSON.stringify(statusElements, null, 2));
        
        // Analyze currently playing section
        const currentlyPlaying = await page.evaluate(() => {
            const currentTrack = document.querySelector('#current-track');
            const albumArt = document.querySelector('#album-art');
            const trackTitle = document.querySelector('#track-title');
            const trackArtist = document.querySelector('#track-artist');
            const trackAlbum = document.querySelector('#track-album');
            
            return {
                currentTrack: {
                    exists: !!currentTrack,
                    visible: currentTrack ? window.getComputedStyle(currentTrack).display !== 'none' : false,
                    className: currentTrack ? currentTrack.className : 'not found'
                },
                albumArt: {
                    exists: !!albumArt,
                    visible: albumArt ? window.getComputedStyle(albumArt).display !== 'none' : false,
                    src: albumArt ? albumArt.src : 'not found'
                },
                trackInfo: {
                    title: trackTitle ? trackTitle.textContent.trim() : 'not found',
                    artist: trackArtist ? trackArtist.textContent.trim() : 'not found',
                    album: trackAlbum ? trackAlbum.textContent.trim() : 'not found'
                }
            };
        });
        
        console.log('🎵 Currently Playing Analysis:', JSON.stringify(currentlyPlaying, null, 2));
        
        // Take final screenshot
        await page.screenshot({ 
            path: path.join(screenshotDir, `${timestamp}_02_analyzed_state.png`),
            fullPage: true 
        });
        console.log('📸 Final screenshot taken');
        
        // Save analysis report
        const report = {
            timestamp: new Date().toISOString(),
            refreshButtons,
            statusElements,
            currentlyPlaying
        };
        
        fs.writeFileSync(
            path.join(screenshotDir, `${timestamp}_analysis_report.json`),
            JSON.stringify(report, null, 2)
        );
        
        console.log('✅ Screenshot test completed successfully!');
        console.log('📁 Results saved in:', screenshotDir);
        
        return report;
        
    } catch (error) {
        console.error('❌ Screenshot test failed:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the test
if (require.main === module) {
    takeScreenshots().catch(console.error);
}

module.exports = { takeScreenshots };
