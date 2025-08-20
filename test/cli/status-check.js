#!/usr/bin/env node

/**
 * CLI Status Check Tool
 * Usage: node test/cli/status-check.js
 */

const TestController = require('../utils/TestController');

async function checkStatus() {
    const controller = new TestController();
    
    try {
        console.log('🚀 Starting status check...');
        
        // Launch app
        await controller.launch();
        
        // Wait for services to initialize
        console.log('⏳ Waiting for services to initialize...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Run comprehensive status check
        const result = await controller.runStatusCheck();
        
        // Display results
        console.log('\n📊 === STATUS REPORT ===');
        console.log(`Timestamp: ${result.timestamp}`);
        console.log('\n🖥️  GUI Status:');
        console.log(`  Discord: ${result.gui.discord}`);
        console.log(`  Roon: ${result.gui.roon}`);
        
        console.log('\n🔧 IPC Status:');
        if (result.ipc.discord) {
            console.log(`  Discord: ${result.ipc.discord.state} (${result.ipc.discord.serviceName})`);
            console.log(`    Uptime: ${Math.round(result.ipc.discord.uptime / 1000)}s`);
            console.log(`    Attempts: ${result.ipc.discord.connectionAttempts}`);
        }
        
        if (result.ipc.roon) {
            console.log(`  Roon: ${result.ipc.roon.state} (${result.ipc.roon.serviceName})`);
            console.log(`    Core: ${result.ipc.roon.coreName || 'Not connected'}`);
            console.log(`    Zones: ${result.ipc.roon.zonesCount}`);
            console.log(`    Attempts: ${result.ipc.roon.connectionAttempts}`);
        }
        
        // Check if everything is working
        const allConnected = result.gui.discord === 'Connected' && result.gui.roon === 'Connected';
        
        if (allConnected) {
            console.log('\n✅ All services are connected!');
        } else {
            console.log('\n⚠️  Some services are not connected');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await controller.close();
    }
}

// Run if called directly
if (require.main === module) {
    checkStatus();
}

module.exports = checkStatus;
