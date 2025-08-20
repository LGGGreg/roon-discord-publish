#!/usr/bin/env node

/**
 * CLI Screenshot Tool
 * Usage: node test/cli/screenshot.js [filename]
 */

const TestController = require('../utils/TestController');
const path = require('path');

async function takeScreenshot() {
    const controller = new TestController();
    
    try {
        console.log('🚀 Starting screenshot capture...');
        
        // Launch app
        await controller.launch();
        
        // Wait for services to initialize
        console.log('⏳ Waiting for services to initialize...');
        await controller.waitForConnection(10000);
        
        // Take screenshot
        const filename = process.argv[2] || `screenshot-${Date.now()}.png`;
        const filepath = await controller.takeScreenshot(filename);
        
        console.log(`✅ Screenshot captured: ${filepath}`);
        
        // Also get status for reference
        const status = await controller.runStatusCheck();
        console.log('📊 Current Status:', JSON.stringify(status, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await controller.close();
    }
}

// Run if called directly
if (require.main === module) {
    takeScreenshot();
}

module.exports = takeScreenshot;
