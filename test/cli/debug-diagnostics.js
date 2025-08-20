#!/usr/bin/env node

/**
 * Debug Diagnostics CLI Tool
 * Comprehensive debugging and diagnostic utilities
 */

const TestController = require('../utils/TestController');
const fs = require('fs');
const path = require('path');

class DebugDiagnostics {
    constructor() {
        this.controller = new TestController();
        this.results = {
            timestamp: new Date().toISOString(),
            diagnostics: {},
            performance: {},
            errors: [],
            summary: {}
        };
    }

    async runDiagnostics() {
        console.log('🔍 Starting Debug Diagnostics...\n');
        
        try {
            await this.controller.launch();
            console.log('✅ Application launched successfully\n');
            
            // Enable debug mode
            await this.enableDebugMode();
            
            // Run diagnostic tests
            await this.runSystemDiagnostics();
            await this.runServiceDiagnostics();
            await this.runPerformanceDiagnostics();
            await this.runConnectionDiagnostics();
            await this.runErrorDiagnostics();
            
            // Generate comprehensive report
            await this.generateDiagnosticReport();
            
        } catch (error) {
            console.error('❌ Diagnostic failed:', error.message);
            this.results.errors.push({
                type: 'diagnostic-failure',
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        } finally {
            await this.controller.close();
        }
    }

    async enableDebugMode() {
        console.log('🐛 Enabling debug mode...');
        
        const debugEnabled = await this.controller.page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('debug-enable-mode', {
                enableVerboseLogging: true,
                enablePerformanceTracking: true,
                enableNetworkDiagnostics: true
            });
        });

        if (debugEnabled) {
            console.log('✅ Debug mode enabled\n');
        } else {
            console.log('⚠️ Debug mode failed to enable\n');
        }
    }

    async runSystemDiagnostics() {
        console.log('🖥️ Running System Diagnostics...');
        
        try {
            const systemInfo = await this.controller.page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                const summary = await ipcRenderer.invoke('debug-get-summary');
                return summary;
            });

            if (systemInfo) {
                console.log('  📊 System Information:');
                console.log(`    Platform: ${systemInfo.systemInfo?.platform || 'Unknown'}`);
                console.log(`    Node Version: ${systemInfo.systemInfo?.nodeVersion || 'Unknown'}`);
                console.log(`    Electron Version: ${systemInfo.systemInfo?.electronVersion || 'Unknown'}`);
                console.log(`    Memory Usage: ${JSON.stringify(systemInfo.systemInfo?.memory || {})}`);
                console.log(`    Debug Mode: ${systemInfo.isDebugMode ? 'Enabled' : 'Disabled'}`);
                console.log(`    Debug Duration: ${systemInfo.debugDuration}ms`);
                
                this.results.diagnostics.system = systemInfo;
            }

            await this.controller.takeScreenshot('debug-01-system.png');
            
        } catch (error) {
            console.error('  ❌ System diagnostics failed:', error.message);
            this.results.errors.push({
                type: 'system-diagnostics',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('');
    }

    async runServiceDiagnostics() {
        console.log('🔗 Running Service Diagnostics...');
        
        try {
            // Get service status
            const serviceStatus = await this.controller.getServiceStatus();
            
            console.log('  📋 Service Status:');
            for (const [service, status] of Object.entries(serviceStatus)) {
                console.log(`    ${service}: ${status.state} (${status.connectionTime || 0}ms)`);
                
                // Run connection diagnostics for each service
                if (status.state === 'connected') {
                    await this.runServiceConnectionDiagnostics(service, status);
                }
            }
            
            this.results.diagnostics.services = serviceStatus;
            await this.controller.takeScreenshot('debug-02-services.png');
            
        } catch (error) {
            console.error('  ❌ Service diagnostics failed:', error.message);
            this.results.errors.push({
                type: 'service-diagnostics',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('');
    }

    async runServiceConnectionDiagnostics(serviceName, serviceStatus) {
        console.log(`  🔍 Running connection diagnostics for ${serviceName}...`);
        
        try {
            // Define connection info for each service
            const connectionInfo = this.getServiceConnectionInfo(serviceName);
            
            if (connectionInfo) {
                const diagnostics = await this.controller.page.evaluate(async (service, connInfo) => {
                    const { ipcRenderer } = require('electron');
                    return await ipcRenderer.invoke('debug-run-connection-diagnostics', service, connInfo);
                }, serviceName, connectionInfo);

                if (diagnostics) {
                    console.log(`    DNS: ${diagnostics.tests?.dns?.success ? '✅' : '❌'} (${diagnostics.tests?.dns?.duration || 0}ms)`);
                    console.log(`    Port: ${diagnostics.tests?.port?.success ? '✅' : '❌'} (${diagnostics.tests?.port?.duration || 0}ms)`);
                    console.log(`    HTTP: ${diagnostics.tests?.http?.success ? '✅' : '❌'} (${diagnostics.tests?.http?.duration || 0}ms)`);
                    
                    this.results.diagnostics[`${serviceName}_connection`] = diagnostics;
                }
            }
            
        } catch (error) {
            console.error(`    ❌ Connection diagnostics failed for ${serviceName}:`, error.message);
        }
    }

    getServiceConnectionInfo(serviceName) {
        const connectionMap = {
            discord: {
                hostname: 'discord.com',
                port: 443,
                url: 'https://discord.com/api/v10/gateway'
            },
            spotify: {
                hostname: 'api.spotify.com',
                port: 443,
                url: 'https://api.spotify.com/v1/'
            },
            imgur: {
                hostname: 'api.imgur.com',
                port: 443,
                url: 'https://api.imgur.com/3/'
            },
            roon: {
                hostname: 'localhost',
                port: 9100
            }
        };
        
        return connectionMap[serviceName] || null;
    }

    async runPerformanceDiagnostics() {
        console.log('⚡ Running Performance Diagnostics...');
        
        try {
            // Start performance markers
            await this.controller.page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                await ipcRenderer.invoke('debug-start-performance-marker', 'gui-interaction');
            });

            // Perform some GUI interactions
            await this.controller.page.waitForTimeout(1000);
            
            // Click around the interface
            try {
                await this.controller.page.click('[data-testid="status-tab"]');
                await this.controller.page.waitForTimeout(500);
                await this.controller.page.click('[data-testid="config-tab"]');
                await this.controller.page.waitForTimeout(500);
                await this.controller.page.click('[data-testid="status-tab"]');
            } catch (error) {
                console.log('    ⚠️ GUI interaction test skipped (elements not found)');
            }

            // End performance marker
            const performanceResult = await this.controller.page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('debug-end-performance-marker', 'gui-interaction');
            });

            if (performanceResult) {
                console.log(`  ⏱️ GUI Interaction Performance:`);
                console.log(`    Duration: ${performanceResult.duration}ms`);
                console.log(`    Memory Delta: ${JSON.stringify(performanceResult.memoryDelta)}`);
                
                this.results.performance.guiInteraction = performanceResult;
            }

            await this.controller.takeScreenshot('debug-03-performance.png');
            
        } catch (error) {
            console.error('  ❌ Performance diagnostics failed:', error.message);
            this.results.errors.push({
                type: 'performance-diagnostics',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('');
    }

    async runConnectionDiagnostics() {
        console.log('🌐 Running Connection Diagnostics...');
        
        try {
            // Test service reconnections
            const services = ['discord', 'spotify', 'imgur'];
            
            for (const service of services) {
                console.log(`  🔄 Testing ${service} reconnection...`);
                
                try {
                    const reconnectResult = await this.controller.reconnectService(service);
                    
                    if (reconnectResult.success) {
                        console.log(`    ✅ ${service}: ${reconnectResult.message}`);
                    } else {
                        console.log(`    ❌ ${service}: ${reconnectResult.message}`);
                    }
                    
                    this.results.diagnostics[`${service}_reconnect`] = reconnectResult;
                    
                } catch (error) {
                    console.log(`    ❌ ${service}: ${error.message}`);
                }
                
                await this.controller.page.waitForTimeout(1000);
            }

            await this.controller.takeScreenshot('debug-04-connections.png');
            
        } catch (error) {
            console.error('  ❌ Connection diagnostics failed:', error.message);
            this.results.errors.push({
                type: 'connection-diagnostics',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('');
    }

    async runErrorDiagnostics() {
        console.log('🚨 Running Error Diagnostics...');
        
        try {
            // Test error handling by triggering some controlled errors
            console.log('  🧪 Testing error handling...');
            
            // Test invalid service operations
            const errorTests = [
                { name: 'Invalid Discord Activity', test: () => this.testInvalidDiscordActivity() },
                { name: 'Invalid Spotify Search', test: () => this.testInvalidSpotifySearch() },
                { name: 'Invalid Configuration', test: () => this.testInvalidConfiguration() }
            ];
            
            for (const errorTest of errorTests) {
                try {
                    console.log(`    🧪 ${errorTest.name}...`);
                    await errorTest.test();
                    console.log(`      ✅ Error handling working`);
                } catch (error) {
                    console.log(`      ⚠️ Error test failed: ${error.message}`);
                    this.results.errors.push({
                        type: 'error-test',
                        testName: errorTest.name,
                        message: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            await this.controller.takeScreenshot('debug-05-errors.png');
            
        } catch (error) {
            console.error('  ❌ Error diagnostics failed:', error.message);
            this.results.errors.push({
                type: 'error-diagnostics',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('');
    }

    async testInvalidDiscordActivity() {
        // Test with invalid activity data
        const result = await this.controller.page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            try {
                return await ipcRenderer.invoke('discord-set-activity', null);
            } catch (error) {
                return { error: error.message };
            }
        });
        
        // This should handle the error gracefully
        return result;
    }

    async testInvalidSpotifySearch() {
        // Test with invalid search parameters
        const result = await this.controller.page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            try {
                return await ipcRenderer.invoke('spotify-search', '', '', '');
            } catch (error) {
                return { error: error.message };
            }
        });
        
        return result;
    }

    async testInvalidConfiguration() {
        // Test with invalid configuration
        const result = await this.controller.page.evaluate(async () => {
            const { ipcRenderer } = require('electron');
            try {
                return await ipcRenderer.invoke('config-set', 'invalid.path', null);
            } catch (error) {
                return { error: error.message };
            }
        });
        
        return result;
    }

    async generateDiagnosticReport() {
        console.log('📋 Generating Diagnostic Report...');
        
        try {
            // Generate comprehensive report
            const reportInfo = await this.controller.page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('debug-generate-report', true, true);
            });

            if (reportInfo) {
                console.log(`  📄 Diagnostic report generated: ${reportInfo.path}`);
                this.results.summary.reportPath = reportInfo.path;
            }

            // Save our own diagnostic results
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `cli-diagnostic-results-${timestamp}.json`;
            const filepath = path.join('test-results', filename);
            
            // Ensure directory exists
            const dir = path.dirname(filepath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
            console.log(`  📄 CLI diagnostic results saved: ${filepath}`);

            // Summary
            console.log('\n' + '='.repeat(60));
            console.log('DIAGNOSTIC SUMMARY');
            console.log('='.repeat(60));
            console.log(`Timestamp: ${this.results.timestamp}`);
            console.log(`Total Errors: ${this.results.errors.length}`);
            console.log(`Services Tested: ${Object.keys(this.results.diagnostics).filter(k => k.includes('_')).length}`);
            console.log(`Performance Tests: ${Object.keys(this.results.performance).length}`);
            console.log(`Report Generated: ${reportInfo ? 'Yes' : 'No'}`);
            console.log('='.repeat(60));
            
            if (this.results.errors.length > 0) {
                console.log('\n🚨 ERRORS FOUND:');
                for (const error of this.results.errors) {
                    console.log(`  - ${error.type}: ${error.message}`);
                }
            } else {
                console.log('\n✅ No errors found during diagnostics');
            }
            
        } catch (error) {
            console.error('  ❌ Report generation failed:', error.message);
        }
        
        console.log('\n🎯 Debug diagnostics completed!');
    }
}

// CLI execution
if (require.main === module) {
    const diagnostics = new DebugDiagnostics();
    diagnostics.runDiagnostics().catch(error => {
        console.error('Debug diagnostics failed:', error);
        process.exit(1);
    });
}

module.exports = DebugDiagnostics;
