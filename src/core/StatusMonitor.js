const EventEmitter = require('events');

/**
 * StatusMonitor - Enhanced monitoring layer that adds health checks, metrics, and alerts
 * to the existing service status system. Complements rather than duplicates existing functionality.
 */
class StatusMonitor extends EventEmitter {
    constructor(logger = null) {
        super();
        this.logger = logger;
        this.services = new Map();
        this.healthCheckInterval = null;
        this.statusHistory = new Map();
        this.performanceMetrics = new Map();
        this.alerts = [];
        this.isMonitoring = false;

        // Configuration
        this.config = {
            healthCheckIntervalMs: 30000, // 30 seconds
            statusHistoryLimit: 50, // Reduced to avoid memory bloat
            alertHistoryLimit: 20,
            alertThresholds: {
                consecutiveFailures: 3,
                responseTimeMs: 5000,
                uptimePercentage: 90
            }
        };

        this.log('info', 'StatusMonitor', 'Enhanced status monitor initialized');
    }

    /**
     * Internal logging method that handles cases where logger might not be available
     */
    log(level, category, message, data = null) {
        if (this.logger && this.logger[level]) {
            this.logger[level](category, message, data);
        } else {
            // Fallback to console
            console.log(`[${level.toUpperCase()}] ${category}: ${message}`, data || '');
        }
    }
    
    /**
     * Register a service for monitoring
     */
    registerService(serviceName, service) {
        if (!serviceName || !service) {
            throw new Error('Service name and service instance are required');
        }
        
        const serviceInfo = {
            name: serviceName,
            service: service,
            lastHealthCheck: null,
            healthCheckCount: 0,
            consecutiveFailures: 0,
            lastFailure: null,
            startTime: Date.now(),
            lastResponseTime: 0
        };

        this.services.set(serviceName, serviceInfo);
        this.statusHistory.set(serviceName, []);
        this.performanceMetrics.set(serviceName, {
            responseTimes: [],
            averageResponseTime: 0,
            uptimeEvents: [],
            currentUptimeStreak: 0,
            longestUptimeStreak: 0
        });
        
        // Listen to service events
        if (service.on) {
            service.on('state-changed', (state, details) => {
                this.handleServiceStateChange(serviceName, state, details);
            });
            
            service.on('error', (error) => {
                this.handleServiceError(serviceName, error);
            });
            
            service.on('connected', () => {
                this.handleServiceConnected(serviceName);
            });
            
            service.on('disconnected', () => {
                this.handleServiceDisconnected(serviceName);
            });
        }
        
        this.log('info', 'StatusMonitor', `Registered service: ${serviceName}`);
        this.emit('service-registered', serviceName, serviceInfo);
    }
    
    /**
     * Unregister a service from monitoring
     */
    unregisterService(serviceName) {
        if (this.services.has(serviceName)) {
            this.services.delete(serviceName);
            this.statusHistory.delete(serviceName);
            this.performanceMetrics.delete(serviceName);
            
            this.log('info', 'StatusMonitor', `Unregistered service: ${serviceName}`);
            this.emit('service-unregistered', serviceName);
        }
    }
    
    /**
     * Start monitoring all registered services
     */
    startMonitoring() {
        if (this.isMonitoring) {
            this.log('warn', 'StatusMonitor', 'Monitoring already started');
            return;
        }
        
        this.isMonitoring = true;
        
        // Start health check interval
        this.healthCheckInterval = setInterval(() => {
            this.performHealthChecks();
        }, this.config.healthCheckIntervalMs);
        
        // Perform initial health check
        this.performHealthChecks();
        
        this.log('info', 'StatusMonitor', 'Started monitoring services', {
            serviceCount: this.services.size,
            interval: this.config.healthCheckIntervalMs
        });
        
        this.emit('monitoring-started');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        this.log('info', 'StatusMonitor', 'Stopped monitoring services');
        this.emit('monitoring-stopped');
    }
    
    /**
     * Perform health checks on all registered services
     */
    async performHealthChecks() {
        const healthCheckPromises = [];
        
        for (const [serviceName, serviceInfo] of this.services) {
            healthCheckPromises.push(this.performServiceHealthCheck(serviceName, serviceInfo));
        }
        
        try {
            await Promise.allSettled(healthCheckPromises);
            this.emit('health-check-completed', this.getOverallStatus());
        } catch (error) {
            this.log('error', 'StatusMonitor', 'Error during health checks', error.message);
        }
    }
    
    /**
     * Perform performance check on a specific service (leverages existing getStats)
     */
    async performServiceHealthCheck(serviceName, serviceInfo) {
        const startTime = Date.now();

        try {
            serviceInfo.healthCheckCount++;

            // Use existing getStats method to avoid duplication
            let stats = null;
            let isHealthy = false;

            if (serviceInfo.service.getStats) {
                stats = serviceInfo.service.getStats();
                isHealthy = stats.state === 'connected';
            } else {
                // Fallback for services without getStats
                isHealthy = true;
                stats = { state: 'unknown' };
            }

            const responseTime = Date.now() - startTime;

            // Update service info
            serviceInfo.lastHealthCheck = new Date();
            serviceInfo.lastResponseTime = responseTime;

            // Update performance metrics
            const metrics = this.performanceMetrics.get(serviceName);
            metrics.responseTimes.push(responseTime);
            if (metrics.responseTimes.length > 50) {
                metrics.responseTimes.shift(); // Keep only last 50 response times
            }
            metrics.averageResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;

            // Track uptime streaks
            if (isHealthy) {
                serviceInfo.consecutiveFailures = 0;
                metrics.currentUptimeStreak++;
                if (metrics.currentUptimeStreak > metrics.longestUptimeStreak) {
                    metrics.longestUptimeStreak = metrics.currentUptimeStreak;
                }
            } else {
                serviceInfo.consecutiveFailures++;
                metrics.currentUptimeStreak = 0;
            }

            // Add to status history (lightweight)
            this.addStatusHistory(serviceName, {
                timestamp: new Date(),
                isHealthy,
                responseTime,
                consecutiveFailures: serviceInfo.consecutiveFailures
            });

            // Check for performance alerts
            this.checkPerformanceAlerts(serviceName, serviceInfo, metrics);

            this.log('debug', 'StatusMonitor', `Performance check completed for ${serviceName}`, {
                isHealthy,
                responseTime,
                consecutiveFailures: serviceInfo.consecutiveFailures
            });

            this.emit('service-performance-checked', serviceName, {
                isHealthy,
                responseTime,
                consecutiveFailures: serviceInfo.consecutiveFailures,
                averageResponseTime: metrics.averageResponseTime
            });

        } catch (error) {
            serviceInfo.consecutiveFailures++;
            serviceInfo.lastFailure = new Date();

            this.log('error', 'StatusMonitor', `Performance check failed for ${serviceName}`, error.message);

            this.emit('service-performance-check-failed', serviceName, error);
        }
    }
    
    /**
     * Handle service state changes
     */
    handleServiceStateChange(serviceName, state, details) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) return;
        
        this.log('info', 'StatusMonitor', `Service state changed: ${serviceName}`, {
            state,
            details
        });
        
        // Update performance metrics (simplified for StatusMonitor)
        const metrics = this.performanceMetrics.get(serviceName);
        if (metrics && state === 'connected') {
            metrics.currentUptimeStreak++;
        } else if (metrics && state === 'disconnected') {
            metrics.currentUptimeStreak = 0;
        }
        
        this.addStatusHistory(serviceName, {
            timestamp: new Date(),
            status: state,
            isHealthy: state === 'connected',
            details,
            event: 'state-change'
        });
        
        this.emit('service-status-changed', serviceName, state, details);
    }
    
    /**
     * Handle service errors
     */
    handleServiceError(serviceName, error) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) return;
        
        serviceInfo.failureCount++;
        serviceInfo.lastFailure = new Date();
        
        this.log('error', 'StatusMonitor', `Service error: ${serviceName}`, error.message);
        
        this.addStatusHistory(serviceName, {
            timestamp: new Date(),
            status: 'error',
            isHealthy: false,
            error: error.message,
            event: 'error'
        });
        
        this.emit('service-error', serviceName, error);
    }
    
    /**
     * Handle service connected
     */
    handleServiceConnected(serviceName) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) return;
        
        const metrics = this.performanceMetrics.get(serviceName);
        if (metrics) {
            metrics.currentUptimeStreak++;
            if (metrics.currentUptimeStreak > metrics.longestUptimeStreak) {
                metrics.longestUptimeStreak = metrics.currentUptimeStreak;
            }
        }
        
        this.log('info', 'StatusMonitor', `Service connected: ${serviceName}`);
        
        this.addStatusHistory(serviceName, {
            timestamp: new Date(),
            status: 'connected',
            isHealthy: true,
            event: 'connected'
        });
        
        this.emit('service-connected', serviceName);
    }
    
    /**
     * Handle service disconnected
     */
    handleServiceDisconnected(serviceName) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) return;
        
        this.log('info', 'StatusMonitor', `Service disconnected: ${serviceName}`);
        
        this.addStatusHistory(serviceName, {
            timestamp: new Date(),
            status: 'disconnected',
            isHealthy: false,
            event: 'disconnected'
        });
        
        this.emit('service-disconnected', serviceName);
    }
    
    /**
     * Add entry to status history
     */
    addStatusHistory(serviceName, entry) {
        const history = this.statusHistory.get(serviceName);
        if (!history) return;
        
        history.push(entry);
        
        // Limit history size
        if (history.length > this.config.statusHistoryLimit) {
            history.shift();
        }
    }
    
    /**
     * Check for performance-based alerts
     */
    checkPerformanceAlerts(serviceName, serviceInfo, metrics) {
        const alerts = [];

        // Check consecutive failures
        if (serviceInfo.consecutiveFailures >= this.config.alertThresholds.consecutiveFailures) {
            alerts.push({
                type: 'consecutive-failures',
                severity: 'critical',
                message: `Service ${serviceName} has ${serviceInfo.consecutiveFailures} consecutive failures`,
                timestamp: new Date()
            });
        }

        // Check response time
        if (serviceInfo.lastResponseTime > this.config.alertThresholds.responseTimeMs) {
            alerts.push({
                type: 'slow-response',
                severity: 'warning',
                message: `Service ${serviceName} response time is ${serviceInfo.lastResponseTime}ms (threshold: ${this.config.alertThresholds.responseTimeMs}ms)`,
                timestamp: new Date()
            });
        }

        // Check average response time trend
        if (metrics.averageResponseTime > this.config.alertThresholds.responseTimeMs * 0.8) {
            alerts.push({
                type: 'degraded-performance',
                severity: 'warning',
                message: `Service ${serviceName} average response time is ${metrics.averageResponseTime.toFixed(0)}ms`,
                timestamp: new Date()
            });
        }

        // Add alerts to history and emit
        alerts.forEach(alert => {
            this.alerts.unshift(alert); // Add to beginning
            if (this.alerts.length > this.config.alertHistoryLimit) {
                this.alerts.pop(); // Remove oldest
            }

            this.log('warn', 'StatusMonitor', `Performance Alert: ${alert.message}`, alert);
            this.emit('performance-alert', serviceName, alert);
        });
    }
    
    /**
     * Calculate uptime percentage for a service
     */
    calculateUptimePercentage(serviceName) {
        const history = this.statusHistory.get(serviceName);
        if (!history || history.length === 0) return 100;
        
        const healthyEntries = history.filter(entry => entry.isHealthy).length;
        return (healthyEntries / history.length) * 100;
    }
    
    /**
     * Get overall system status
     */
    getOverallStatus() {
        const services = Array.from(this.services.entries()).map(([name, info]) => ({
            name,
            isHealthy: info.isHealthy,
            lastHealthCheck: info.lastHealthCheck,
            responseTime: info.responseTime,
            failureCount: info.failureCount,
            uptime: Date.now() - info.startTime
        }));
        
        const healthyServices = services.filter(s => s.isHealthy).length;
        const totalServices = services.length;
        
        return {
            timestamp: new Date(),
            totalServices,
            healthyServices,
            unhealthyServices: totalServices - healthyServices,
            overallHealth: totalServices > 0 ? (healthyServices / totalServices) * 100 : 0,
            services
        };
    }
    
    /**
     * Get detailed status for a specific service
     */
    getServiceStatus(serviceName) {
        const serviceInfo = this.services.get(serviceName);
        const metrics = this.performanceMetrics.get(serviceName);
        const history = this.statusHistory.get(serviceName);
        
        if (!serviceInfo) {
            return null;
        }
        
        return {
            name: serviceName,
            isHealthy: serviceInfo.isHealthy,
            lastHealthCheck: serviceInfo.lastHealthCheck,
            healthCheckCount: serviceInfo.healthCheckCount,
            failureCount: serviceInfo.failureCount,
            lastFailure: serviceInfo.lastFailure,
            responseTime: serviceInfo.responseTime,
            uptime: Date.now() - serviceInfo.startTime,
            uptimePercentage: this.calculateUptimePercentage(serviceName),
            metrics,
            recentHistory: history ? history.slice(-10) : []
        };
    }
    
    /**
     * Get metrics for all services
     */
    getAllMetrics() {
        const result = {};
        
        for (const [serviceName, metrics] of this.performanceMetrics) {
            result[serviceName] = {
                ...metrics,
                uptimePercentage: this.calculateUptimePercentage(serviceName)
            };
        }
        
        return result;
    }
    
    /**
     * Reset metrics for a service
     */
    resetServiceMetrics(serviceName) {
        if (this.performanceMetrics.has(serviceName)) {
            this.performanceMetrics.set(serviceName, {
                responseTimes: [],
                averageResponseTime: 0,
                uptimeEvents: [],
                currentUptimeStreak: 0,
                longestUptimeStreak: 0
            });
            
            this.log('info', 'StatusMonitor', `Reset metrics for service: ${serviceName}`);
        }
    }
    
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Restart monitoring with new interval if changed
        if (this.isMonitoring && newConfig.healthCheckIntervalMs) {
            this.stopMonitoring();
            this.startMonitoring();
        }
        
        this.log('info', 'StatusMonitor', 'Configuration updated', this.config);
    }
}

module.exports = StatusMonitor;
