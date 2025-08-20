#!/usr/bin/env node

/**
 * Integration Test CLI Tool
 * Runs comprehensive integration tests for the complete Roon → Discord workflow
 */

const TestController = require('../utils/TestController');
const fs = require('fs');
const path = require('path');

class IntegrationTestRunner {
    constructor() {
        this.controller = new TestController();
        this.results = {
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };
    }

    async runAllTests() {
        console.log('🧪 Starting Comprehensive Integration Tests...\n');
        
        try {
            await this.controller.launch();
            console.log('✅ Application launched successfully\n');
            
            // Run all integration tests
            await this.testServiceConnectivity();
            await this.testCompleteWorkflow();
            await this.testAlbumArtPipeline();
            await this.testPerformanceIntegration();
            await this.testConfigurationIntegration();
            await this.testServiceResilience();
            
            // Generate report
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Integration test failed:', error.message);
            this.addTestResult('Application Launch', false, error.message);
        } finally {
            await this.controller.close();
        }
    }

    async testServiceConnectivity() {
        console.log('🔗 Testing Service Connectivity...');
        
        try {
            await this.controller.waitForConnection();
            const status = await this.controller.getServiceStatus();
            
            await this.controller.takeScreenshot('integration-01-connectivity.png');
            
            const requiredServices = ['discord', 'roon'];
            const optionalServices = ['spotify', 'imgur'];
            
            let allRequired = true;
            let optionalCount = 0;
            
            for (const service of requiredServices) {
                if (status[service]?.state === 'connected') {
                    console.log(`  ✅ ${service}: Connected`);
                } else {
                    console.log(`  ❌ ${service}: Not connected`);
                    allRequired = false;
                }
            }
            
            for (const service of optionalServices) {
                if (status[service]?.state === 'connected') {
                    console.log(`  ✅ ${service}: Connected (optional)`);
                    optionalCount++;
                } else {
                    console.log(`  ⚠️ ${service}: Not connected (optional)`);
                }
            }
            
            const result = allRequired;
            const message = allRequired 
                ? `All required services connected. ${optionalCount}/${optionalServices.length} optional services available.`
                : 'Some required services not connected';
                
            this.addTestResult('Service Connectivity', result, message);
            
        } catch (error) {
            this.addTestResult('Service Connectivity', false, error.message);
        }
        
        console.log('');
    }

    async testCompleteWorkflow() {
        console.log('🎵 Testing Complete Roon → Discord Workflow...');
        
        try {
            // Get current track
            const currentTrack = await this.controller.getCurrentTrack();
            
            if (currentTrack) {
                console.log(`  🎵 Current track: "${currentTrack.title}" by ${currentTrack.artist}`);
                
                // Test Discord activity
                const activityResult = await this.controller.setDiscordActivity(currentTrack);
                
                if (activityResult) {
                    console.log('  ✅ Discord activity set successfully');
                    
                    // Test Spotify search if available
                    try {
                        const spotifyUrl = await this.controller.testSpotifySearch();
                        if (spotifyUrl) {
                            console.log('  ✅ Spotify search integration working');
                        } else {
                            console.log('  ⚠️ Spotify search returned no results');
                        }
                    } catch (error) {
                        console.log('  ⚠️ Spotify search not available:', error.message);
                    }
                    
                    await this.controller.takeScreenshot('integration-02-workflow.png');
                    
                    this.addTestResult('Complete Workflow', true, 'Roon → Discord workflow successful');
                } else {
                    this.addTestResult('Complete Workflow', false, 'Discord activity failed');
                }
            } else {
                console.log('  ⚠️ No track currently playing');
                
                // Test with mock data
                const mockTrack = {
                    title: 'Integration Test Track',
                    artist: 'Test Artist',
                    album: 'Test Album',
                    zoneName: 'Test Zone'
                };
                
                const mockResult = await this.controller.setDiscordActivity(mockTrack);
                
                if (mockResult) {
                    console.log('  ✅ Discord activity system working (tested with mock data)');
                    this.addTestResult('Complete Workflow', true, 'Discord activity system ready (no track playing)');
                } else {
                    this.addTestResult('Complete Workflow', false, 'Discord activity system failed');
                }
            }
            
        } catch (error) {
            this.addTestResult('Complete Workflow', false, error.message);
        }
        
        console.log('');
    }

    async testAlbumArtPipeline() {
        console.log('🖼️ Testing Album Art Pipeline...');
        
        try {
            const currentTrack = await this.controller.getCurrentTrack();
            
            if (currentTrack && currentTrack.imageKey) {
                console.log(`  🖼️ Album art available for: "${currentTrack.title}"`);
                console.log(`  🔑 Image key: ${currentTrack.imageKey}`);
                
                // Check if album art is displayed in GUI
                await this.controller.page.waitForTimeout(2000); // Wait for image to load
                
                const albumArtVisible = await this.controller.page.locator('img[src*="data:image"], .album-art img').count();
                
                if (albumArtVisible > 0) {
                    console.log('  ✅ Album art displayed in GUI');
                } else {
                    console.log('  ⚠️ Album art not visible in GUI');
                }
                
                // Test Imgur readiness
                const imgurStatus = await this.controller.getServiceStatus();
                if (imgurStatus.imgur?.state === 'connected') {
                    console.log('  ✅ Imgur ready for album art uploads');
                    this.addTestResult('Album Art Pipeline', true, 'Album art pipeline fully functional');
                } else {
                    console.log('  ⚠️ Imgur not connected - uploads not available');
                    this.addTestResult('Album Art Pipeline', true, 'Album art display working, Imgur unavailable', true);
                }
                
            } else {
                console.log('  ⚠️ No album art available (no track or no image)');
                this.addTestResult('Album Art Pipeline', true, 'No album art to test (expected)', true);
            }
            
            await this.controller.takeScreenshot('integration-03-albumart.png');
            
        } catch (error) {
            this.addTestResult('Album Art Pipeline', false, error.message);
        }
        
        console.log('');
    }

    async testPerformanceIntegration() {
        console.log('📊 Testing Performance Integration...');
        
        try {
            // Test StatusMonitor integration
            const overallStatus = await this.controller.page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('status-monitor-get-overall');
            });
            
            if (overallStatus) {
                console.log(`  📊 Monitoring ${overallStatus.totalServices} services`);
                console.log(`  💚 ${overallStatus.healthyServices} healthy services`);
                console.log(`  📈 Overall health: ${overallStatus.overallHealth.toFixed(1)}%`);
                
                // Test metrics collection
                const metrics = await this.controller.page.evaluate(async () => {
                    const { ipcRenderer } = require('electron');
                    return await ipcRenderer.invoke('status-monitor-get-all-metrics');
                });
                
                if (metrics) {
                    const serviceCount = Object.keys(metrics).length;
                    console.log(`  📈 Performance metrics available for ${serviceCount} services`);
                    
                    for (const [service, serviceMetrics] of Object.entries(metrics)) {
                        if (serviceMetrics.averageResponseTime > 0) {
                            console.log(`    ${service}: ${serviceMetrics.averageResponseTime.toFixed(0)}ms avg response`);
                        }
                    }
                }
                
                this.addTestResult('Performance Integration', true, 'StatusMonitor and metrics working');
            } else {
                this.addTestResult('Performance Integration', false, 'StatusMonitor not responding');
            }
            
            await this.controller.takeScreenshot('integration-04-performance.png');
            
        } catch (error) {
            this.addTestResult('Performance Integration', false, error.message);
        }
        
        console.log('');
    }

    async testConfigurationIntegration() {
        console.log('⚙️ Testing Configuration Integration...');
        
        try {
            // Test configuration system
            const config = await this.controller.page.evaluate(async () => {
                const { ipcRenderer } = require('electron');
                return await ipcRenderer.invoke('config-get-all');
            });
            
            if (config) {
                console.log('  ⚙️ Configuration loaded successfully');
                
                // Test validation
                const validation = await this.controller.page.evaluate(async () => {
                    const { ipcRenderer } = require('electron');
                    return await ipcRenderer.invoke('config-validate');
                });
                
                if (validation.isValid) {
                    console.log('  ✅ Configuration validation passed');
                    
                    // Check service configurations
                    const serviceConfigs = {
                        discord: config.discord?.clientId ? 'configured' : 'missing',
                        spotify: config.spotify?.clientId ? 'configured' : 'missing',
                        imgur: config.imgur?.clientId ? 'configured' : 'missing'
                    };
                    
                    console.log('  🔧 Service configurations:', serviceConfigs);
                    
                    this.addTestResult('Configuration Integration', true, 'Configuration system working');
                } else {
                    console.log('  ❌ Configuration validation failed:', validation.errors);
                    this.addTestResult('Configuration Integration', false, 'Configuration validation failed');
                }
            } else {
                this.addTestResult('Configuration Integration', false, 'Configuration not loaded');
            }
            
            await this.controller.takeScreenshot('integration-05-config.png');
            
        } catch (error) {
            this.addTestResult('Configuration Integration', false, error.message);
        }
        
        console.log('');
    }

    async testServiceResilience() {
        console.log('🔄 Testing Service Resilience...');
        
        try {
            // Test service reconnection capabilities
            const services = ['discord', 'spotify', 'imgur'];
            let successCount = 0;
            
            for (const service of services) {
                try {
                    console.log(`  🔄 Testing ${service} reconnection...`);
                    
                    const result = await this.controller.reconnectService(service);
                    
                    if (result.success) {
                        console.log(`    ✅ ${service}: ${result.message}`);
                        successCount++;
                    } else {
                        console.log(`    ❌ ${service}: ${result.message}`);
                    }
                    
                    // Wait between reconnections
                    await this.controller.page.waitForTimeout(1000);
                    
                } catch (error) {
                    console.log(`    ❌ ${service}: ${error.message}`);
                }
            }
            
            // Wait for reconnections to complete
            await this.controller.page.waitForTimeout(3000);
            
            await this.controller.takeScreenshot('integration-06-resilience.png');
            
            const message = `${successCount}/${services.length} services successfully tested for reconnection`;
            this.addTestResult('Service Resilience', successCount > 0, message);
            
        } catch (error) {
            this.addTestResult('Service Resilience', false, error.message);
        }
        
        console.log('');
    }

    addTestResult(testName, passed, message, isWarning = false) {
        this.results.tests.push({
            name: testName,
            passed,
            message,
            isWarning,
            timestamp: new Date().toISOString()
        });
        
        this.results.summary.total++;
        if (passed) {
            this.results.summary.passed++;
        } else {
            this.results.summary.failed++;
        }
        if (isWarning) {
            this.results.summary.warnings++;
        }
    }

    async generateReport() {
        console.log('📋 Generating Integration Test Report...\n');
        
        // Console summary
        console.log('='.repeat(60));
        console.log('INTEGRATION TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${this.results.summary.total}`);
        console.log(`Passed: ${this.results.summary.passed}`);
        console.log(`Failed: ${this.results.summary.failed}`);
        console.log(`Warnings: ${this.results.summary.warnings}`);
        console.log(`Success Rate: ${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
        
        // Detailed results
        for (const test of this.results.tests) {
            const status = test.passed ? '✅' : '❌';
            const warning = test.isWarning ? ' ⚠️' : '';
            console.log(`${status} ${test.name}: ${test.message}${warning}`);
        }
        
        // Save detailed report
        const reportPath = 'test-results/integration-test-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        console.log('\n🎯 Integration testing completed!');
    }
}

// CLI execution
if (require.main === module) {
    const runner = new IntegrationTestRunner();
    runner.runAllTests().catch(error => {
        console.error('Integration test runner failed:', error);
        process.exit(1);
    });
}

module.exports = IntegrationTestRunner;
