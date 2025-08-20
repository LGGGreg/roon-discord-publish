#!/usr/bin/env node

/**
 * Interactive Test Controller
 * Usage: node test/cli/interactive.js
 */

const TestController = require('../utils/TestController');
const readline = require('readline');

class InteractiveController {
    constructor() {
        this.controller = new TestController();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.log('🚀 Starting Interactive Test Controller...');
        console.log('Type "help" for available commands\n');
        
        try {
            await this.controller.launch();
            console.log('✅ App launched successfully\n');
            
            this.showPrompt();
        } catch (error) {
            console.error('❌ Failed to launch app:', error.message);
            process.exit(1);
        }
    }

    showPrompt() {
        this.rl.question('test> ', async (input) => {
            await this.handleCommand(input.trim());
            this.showPrompt();
        });
    }

    async handleCommand(command) {
        const [cmd, ...args] = command.split(' ');
        
        try {
            switch (cmd.toLowerCase()) {
                case 'help':
                    this.showHelp();
                    break;
                    
                case 'status':
                    await this.showStatus();
                    break;
                    
                case 'screenshot':
                    await this.takeScreenshot(args[0]);
                    break;
                    
                case 'reconnect':
                    await this.reconnectService(args[0]);
                    break;
                    
                case 'click':
                    await this.clickElement(args[0]);
                    break;
                    
                case 'tab':
                    await this.switchTab(args[0]);
                    break;
                    
                case 'wait':
                    await this.waitForConnection();
                    break;
                    
                case 'test':
                    await this.runTest(args[0]);
                    break;
                    
                case 'exit':
                case 'quit':
                    await this.exit();
                    return;
                    
                default:
                    if (command) {
                        console.log(`❌ Unknown command: ${cmd}`);
                        console.log('Type "help" for available commands');
                    }
                    break;
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }

    showHelp() {
        console.log(`
📋 Available Commands:
  help                    - Show this help message
  status                  - Show current service status
  screenshot [filename]   - Take a screenshot
  reconnect <service>     - Reconnect service (discord/roon)
  click <selector>        - Click a GUI element
  tab <name>             - Switch to tab (status/config/logs)
  wait                   - Wait for services to connect
  test <name>            - Run a specific test
  exit/quit              - Exit the interactive controller

📝 Examples:
  screenshot my-test.png
  reconnect discord
  click [data-testid="discord-reconnect"]
  tab config
        `);
    }

    async showStatus() {
        console.log('📊 Checking status...');
        const result = await this.controller.runStatusCheck();
        
        console.log(`\n🖥️  GUI Status:`);
        console.log(`  Discord: ${result.gui.discord}`);
        console.log(`  Roon: ${result.gui.roon}`);
        
        if (result.ipc.discord) {
            console.log(`\n🔧 Discord IPC: ${result.ipc.discord.state}`);
        }
        if (result.ipc.roon) {
            console.log(`🔧 Roon IPC: ${result.ipc.roon.state}`);
        }
    }

    async takeScreenshot(filename) {
        const name = filename || `interactive-${Date.now()}.png`;
        console.log(`📸 Taking screenshot: ${name}`);
        await this.controller.takeScreenshot(name);
        console.log('✅ Screenshot saved');
    }

    async reconnectService(service) {
        if (!service) {
            console.log('❌ Please specify service: discord or roon');
            return;
        }
        
        console.log(`🔄 Reconnecting ${service}...`);
        const result = await this.controller.reconnectService(service);
        console.log(`✅ ${result.message}`);
    }

    async clickElement(selector) {
        if (!selector) {
            console.log('❌ Please specify a selector');
            return;
        }
        
        console.log(`👆 Clicking: ${selector}`);
        await this.controller.clickElement(selector);
        console.log('✅ Clicked');
    }

    async switchTab(tabName) {
        if (!tabName) {
            console.log('❌ Please specify tab: status, config, or logs');
            return;
        }
        
        console.log(`📑 Switching to ${tabName} tab...`);
        await this.controller.switchTab(tabName);
        console.log('✅ Tab switched');
    }

    async waitForConnection() {
        console.log('⏳ Waiting for services to connect...');
        const connected = await this.controller.waitForConnection();
        
        if (connected) {
            console.log('✅ All services connected!');
        } else {
            console.log('⚠️  Timeout - not all services connected');
        }
    }

    async runTest(testName) {
        console.log(`🧪 Running test: ${testName || 'basic'}`);
        
        // Basic connection test
        await this.takeScreenshot('test-start.png');
        await this.waitForConnection();
        await this.takeScreenshot('test-connected.png');
        
        console.log('✅ Test completed');
    }

    async exit() {
        console.log('👋 Closing app...');
        await this.controller.close();
        this.rl.close();
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    const interactive = new InteractiveController();
    interactive.start();
}

module.exports = InteractiveController;
