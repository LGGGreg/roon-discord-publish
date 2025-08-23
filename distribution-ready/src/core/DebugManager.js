const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * DebugManager - Centralized debug mode and diagnostics system
 */
class DebugManager extends EventEmitter {
    constructor(logger = null) {
        super();
        this.logger = logger;
        this.isDebugMode = false;
        this.diagnostics = {
            system: {},
            services: {},
            performance: {},
            errors: []
        };
        this.debugStartTime = null;
        this.performanceMarkers = new Map();
        
        // Configuration
        this.config = {
            maxErrorHistory: 50,
            maxPerformanceHistory: 100,
            diagnosticReportPath: 'debug-reports',
            enableVerboseLogging: false,
            enablePerformanceTracking: false,
            enableNetworkDiagnostics: false
        };
        
        this.log('info', 'DebugManager', 'Debug manager initialized');
    }
    
    /**
     * Internal logging method
     */
    log(level, category, message, data = null) {
        if (this.logger && this.logger[level]) {
            this.logger[level](category, message, data);
        } else {
            console.log(`[${level.toUpperCase()}] ${category}: ${message}`, data || '');
        }
    }
    
    /**
     * Enable debug mode
     */
    enableDebugMode(options = {}) {
        this.isDebugMode = true;
        this.debugStartTime = Date.now();
        this.config = { ...this.config, ...options };
        
        this.log('info', 'DebugManager', 'Debug mode enabled', this.config);
        
        // Collect initial system diagnostics
        this.collectSystemDiagnostics();
        
        // Start performance tracking if enabled
        if (this.config.enablePerformanceTracking) {
            this.startPerformanceTracking();
        }
        
        this.emit('debug-mode-enabled', this.config);
    }
    
    /**
     * Disable debug mode
     */
    disableDebugMode() {
        if (!this.isDebugMode) return;
        
        const debugDuration = Date.now() - this.debugStartTime;
        this.isDebugMode = false;
        
        this.log('info', 'DebugManager', `Debug mode disabled after ${debugDuration}ms`);
        this.emit('debug-mode-disabled', { duration: debugDuration });
    }
    
    /**
     * Toggle debug mode
     */
    toggleDebugMode(options = {}) {
        if (this.isDebugMode) {
            this.disableDebugMode();
        } else {
            this.enableDebugMode(options);
        }
        return this.isDebugMode;
    }
    
    /**
     * Collect system diagnostics
     */
    collectSystemDiagnostics() {
        this.diagnostics.system = {
            timestamp: new Date().toISOString(),
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            electronVersion: process.versions.electron,
            chromeVersion: process.versions.chrome,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            loadAverage: os.loadavg(),
            networkInterfaces: this.getNetworkInterfaces(),
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                ELECTRON_ENABLE_LOGGING: process.env.ELECTRON_ENABLE_LOGGING
            }
        };
        
        this.log('debug', 'DebugManager', 'System diagnostics collected', this.diagnostics.system);
    }
    
    /**
     * Get network interfaces (simplified)
     */
    getNetworkInterfaces() {
        const interfaces = os.networkInterfaces();
        const result = {};
        
        for (const [name, addresses] of Object.entries(interfaces)) {
            result[name] = addresses
                .filter(addr => !addr.internal)
                .map(addr => ({
                    address: addr.address,
                    family: addr.family,
                    mac: addr.mac
                }));
        }
        
        return result;
    }
    
    /**
     * Add service diagnostics
     */
    addServiceDiagnostics(serviceName, diagnostics) {
        this.diagnostics.services[serviceName] = {
            timestamp: new Date().toISOString(),
            ...diagnostics
        };
        
        this.log('debug', 'DebugManager', `Service diagnostics added: ${serviceName}`, diagnostics);
        this.emit('service-diagnostics-updated', serviceName, diagnostics);
    }
    
    /**
     * Start performance marker
     */
    startPerformanceMarker(name) {
        this.performanceMarkers.set(name, {
            startTime: Date.now(),
            startMemory: process.memoryUsage()
        });
        
        if (this.isDebugMode) {
            this.log('trace', 'DebugManager', `Performance marker started: ${name}`);
        }
    }
    
    /**
     * End performance marker
     */
    endPerformanceMarker(name) {
        const marker = this.performanceMarkers.get(name);
        if (!marker) {
            this.log('warn', 'DebugManager', `Performance marker not found: ${name}`);
            return null;
        }
        
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        const performance = {
            name,
            duration: endTime - marker.startTime,
            memoryDelta: {
                rss: endMemory.rss - marker.startMemory.rss,
                heapUsed: endMemory.heapUsed - marker.startMemory.heapUsed,
                heapTotal: endMemory.heapTotal - marker.startMemory.heapTotal
            },
            timestamp: new Date().toISOString()
        };
        
        // Store performance data
        if (!this.diagnostics.performance[name]) {
            this.diagnostics.performance[name] = [];
        }
        
        this.diagnostics.performance[name].push(performance);
        
        // Limit history
        if (this.diagnostics.performance[name].length > this.config.maxPerformanceHistory) {
            this.diagnostics.performance[name].shift();
        }
        
        this.performanceMarkers.delete(name);
        
        if (this.isDebugMode) {
            this.log('debug', 'DebugManager', `Performance marker completed: ${name}`, performance);
        }
        
        this.emit('performance-marker-completed', performance);
        return performance;
    }
    
    /**
     * Add error diagnostics
     */
    addErrorDiagnostics(error, context = {}) {
        const errorDiagnostic = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            context,
            systemState: {
                memory: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
        
        this.diagnostics.errors.push(errorDiagnostic);
        
        // Limit error history
        if (this.diagnostics.errors.length > this.config.maxErrorHistory) {
            this.diagnostics.errors.shift();
        }
        
        this.log('error', 'DebugManager', 'Error diagnostics added', errorDiagnostic);
        this.emit('error-diagnostics-added', errorDiagnostic);
        
        return errorDiagnostic;
    }
    
    /**
     * Run connection diagnostics
     */
    async runConnectionDiagnostics(serviceName, connectionInfo) {
        this.log('info', 'DebugManager', `Running connection diagnostics for ${serviceName}`);
        
        const diagnostics = {
            serviceName,
            timestamp: new Date().toISOString(),
            connectionInfo,
            tests: {}
        };
        
        try {
            // DNS resolution test
            if (connectionInfo.hostname) {
                diagnostics.tests.dns = await this.testDNSResolution(connectionInfo.hostname);
            }
            
            // Port connectivity test
            if (connectionInfo.port) {
                diagnostics.tests.port = await this.testPortConnectivity(
                    connectionInfo.hostname || 'localhost', 
                    connectionInfo.port
                );
            }
            
            // HTTP/HTTPS test
            if (connectionInfo.url) {
                diagnostics.tests.http = await this.testHTTPConnectivity(connectionInfo.url);
            }
            
            // Network latency test
            if (connectionInfo.hostname) {
                diagnostics.tests.latency = await this.testNetworkLatency(connectionInfo.hostname);
            }
            
        } catch (error) {
            diagnostics.error = {
                message: error.message,
                stack: error.stack
            };
        }
        
        this.addServiceDiagnostics(serviceName, diagnostics);
        return diagnostics;
    }
    
    /**
     * Test DNS resolution
     */
    async testDNSResolution(hostname) {
        const dns = require('dns').promises;
        const startTime = Date.now();
        
        try {
            const addresses = await dns.lookup(hostname, { all: true });
            return {
                success: true,
                duration: Date.now() - startTime,
                addresses: addresses.map(addr => addr.address),
                family: addresses[0]?.family
            };
        } catch (error) {
            return {
                success: false,
                duration: Date.now() - startTime,
                error: error.message
            };
        }
    }
    
    /**
     * Test port connectivity
     */
    async testPortConnectivity(hostname, port) {
        const net = require('net');
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
                socket.destroy();
                resolve({
                    success: false,
                    duration: Date.now() - startTime,
                    error: 'Connection timeout'
                });
            }, 5000);
            
            socket.connect(port, hostname, () => {
                clearTimeout(timeout);
                socket.destroy();
                resolve({
                    success: true,
                    duration: Date.now() - startTime
                });
            });
            
            socket.on('error', (error) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    duration: Date.now() - startTime,
                    error: error.message
                });
            });
        });
    }
    
    /**
     * Test HTTP connectivity
     */
    async testHTTPConnectivity(url) {
        const https = require('https');
        const http = require('http');
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const client = url.startsWith('https:') ? https : http;
            
            const req = client.get(url, (res) => {
                resolve({
                    success: true,
                    duration: Date.now() - startTime,
                    statusCode: res.statusCode,
                    headers: res.headers
                });
                res.resume(); // Consume response
            });
            
            req.on('error', (error) => {
                resolve({
                    success: false,
                    duration: Date.now() - startTime,
                    error: error.message
                });
            });
            
            req.setTimeout(5000, () => {
                req.destroy();
                resolve({
                    success: false,
                    duration: Date.now() - startTime,
                    error: 'Request timeout'
                });
            });
        });
    }
    
    /**
     * Test network latency
     */
    async testNetworkLatency(hostname) {
        const ping = require('ping');
        
        try {
            const result = await ping.promise.probe(hostname, {
                timeout: 5,
                extra: ['-c', '3']
            });
            
            return {
                success: result.alive,
                avgLatency: result.avg,
                minLatency: result.min,
                maxLatency: result.max,
                packetLoss: result.packetLoss
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Generate diagnostic report
     */
    async generateDiagnosticReport(includeSystemInfo = true, includePerformance = true) {
        const report = {
            timestamp: new Date().toISOString(),
            debugMode: this.isDebugMode,
            debugDuration: this.debugStartTime ? Date.now() - this.debugStartTime : 0,
            config: this.config
        };
        
        if (includeSystemInfo) {
            report.system = this.diagnostics.system;
        }
        
        if (includePerformance) {
            report.performance = this.diagnostics.performance;
        }
        
        report.services = this.diagnostics.services;
        report.errors = this.diagnostics.errors;
        
        // Save report to file
        const reportPath = await this.saveDiagnosticReport(report);
        
        this.log('info', 'DebugManager', `Diagnostic report generated: ${reportPath}`);
        this.emit('diagnostic-report-generated', { report, path: reportPath });
        
        return { report, path: reportPath };
    }
    
    /**
     * Save diagnostic report to file
     */
    async saveDiagnosticReport(report) {
        const reportsDir = this.config.diagnosticReportPath;
        
        // Ensure reports directory exists
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `diagnostic-report-${timestamp}.json`;
        const filepath = path.join(reportsDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
        
        return filepath;
    }
    
    /**
     * Get current diagnostics summary
     */
    getDiagnosticsSummary() {
        return {
            isDebugMode: this.isDebugMode,
            debugDuration: this.debugStartTime ? Date.now() - this.debugStartTime : 0,
            systemInfo: this.diagnostics.system,
            serviceCount: Object.keys(this.diagnostics.services).length,
            errorCount: this.diagnostics.errors.length,
            performanceMarkers: Object.keys(this.diagnostics.performance).length,
            activeMarkers: this.performanceMarkers.size
        };
    }
    
    /**
     * Clear diagnostics data
     */
    clearDiagnostics() {
        this.diagnostics = {
            system: {},
            services: {},
            performance: {},
            errors: []
        };
        this.performanceMarkers.clear();
        
        this.log('info', 'DebugManager', 'Diagnostics data cleared');
        this.emit('diagnostics-cleared');
    }
    
    /**
     * Start performance tracking
     */
    startPerformanceTracking() {
        this.log('info', 'DebugManager', 'Performance tracking started');
        
        // Track memory usage periodically
        this.performanceInterval = setInterval(() => {
            if (this.isDebugMode) {
                const memUsage = process.memoryUsage();
                this.emit('performance-update', {
                    timestamp: Date.now(),
                    memory: memUsage,
                    uptime: process.uptime()
                });
            }
        }, 5000); // Every 5 seconds
    }
    
    /**
     * Stop performance tracking
     */
    stopPerformanceTracking() {
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
            this.performanceInterval = null;
            this.log('info', 'DebugManager', 'Performance tracking stopped');
        }
    }
}

module.exports = DebugManager;
