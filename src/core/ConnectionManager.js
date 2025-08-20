const { EventEmitter } = require('events');

/**
 * Connection states
 */
const ConnectionState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    ERROR: 'error'
};

/**
 * ConnectionManager - Base class for managing service connections with retry logic
 */
class ConnectionManager extends EventEmitter {
    constructor(serviceName, options = {}) {
        super();
        
        this.serviceName = serviceName;
        this.state = ConnectionState.DISCONNECTED;
        this.lastError = null;
        this.connectionAttempts = 0;
        this.lastConnectionTime = null;
        
        // Configuration options
        this.options = {
            maxRetries: options.maxRetries || 10,
            initialRetryDelay: options.initialRetryDelay || 1000, // 1 second
            maxRetryDelay: options.maxRetryDelay || 60000, // 1 minute
            retryMultiplier: options.retryMultiplier || 2,
            healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
            connectionTimeout: options.connectionTimeout || 10000, // 10 seconds
            enableHealthCheck: options.enableHealthCheck !== false,
            ...options
        };
        
        // Timers
        this.retryTimer = null;
        this.healthCheckTimer = null;
        this.connectionTimeoutTimer = null;
        
        // Bind methods
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.healthCheck = this.healthCheck.bind(this);
    }
    
    /**
     * Get current connection state
     * @returns {string} Current state
     */
    getState() {
        return this.state;
    }
    
    /**
     * Check if connected
     * @returns {boolean} Connection status
     */
    isConnected() {
        return this.state === ConnectionState.CONNECTED;
    }
    
    /**
     * Check if connecting
     * @returns {boolean} Connecting status
     */
    isConnecting() {
        return this.state === ConnectionState.CONNECTING || this.state === ConnectionState.RECONNECTING;
    }
    
    /**
     * Set connection state and emit events
     * @param {string} newState - New connection state
     * @param {string} details - Additional details
     * @param {Error} error - Error object if applicable
     */
    setState(newState, details = '', error = null) {
        const oldState = this.state;
        this.state = newState;
        this.lastError = error;
        
        console.log(`${this.serviceName}: ${oldState} -> ${newState}${details ? ` (${details})` : ''}`);
        
        this.emit('state-changed', {
            service: this.serviceName,
            oldState,
            newState,
            details,
            error,
            timestamp: new Date()
        });
        
        // Service-specific state events
        this.emit(newState, { details, error });
        
        // Handle state-specific logic
        if (newState === ConnectionState.CONNECTED) {
            this.connectionAttempts = 0;
            this.lastConnectionTime = new Date();
            this.startHealthCheck();
        } else if (newState === ConnectionState.DISCONNECTED || newState === ConnectionState.ERROR) {
            this.stopHealthCheck();
        }
    }
    
    /**
     * Connect to the service (to be implemented by subclasses)
     * @returns {Promise<boolean>} Connection success
     */
    async connect() {
        throw new Error('connect() method must be implemented by subclass');
    }
    
    /**
     * Disconnect from the service (to be implemented by subclasses)
     * @returns {Promise<boolean>} Disconnection success
     */
    async disconnect() {
        throw new Error('disconnect() method must be implemented by subclass');
    }
    
    /**
     * Perform health check (to be implemented by subclasses)
     * @returns {Promise<boolean>} Health check result
     */
    async performHealthCheck() {
        // Default implementation - override in subclasses
        return this.isConnected();
    }
    
    /**
     * Reconnect with retry logic
     * @param {boolean} immediate - Whether to reconnect immediately
     * @returns {Promise<boolean>} Reconnection success
     */
    async reconnect(immediate = false) {
        if (this.isConnecting()) {
            console.log(`${this.serviceName}: Already connecting, skipping reconnect`);
            return false;
        }
        
        // Clear any existing retry timer
        this.clearRetryTimer();
        
        if (immediate || this.connectionAttempts === 0) {
            return this.attemptConnection();
        } else {
            this.scheduleRetry();
            return false;
        }
    }
    
    /**
     * Attempt connection with timeout
     * @returns {Promise<boolean>} Connection success
     */
    async attemptConnection() {
        if (this.connectionAttempts >= this.options.maxRetries) {
            this.setState(ConnectionState.ERROR, `Max retries (${this.options.maxRetries}) exceeded`);
            return false;
        }
        
        this.connectionAttempts++;
        this.setState(
            this.connectionAttempts === 1 ? ConnectionState.CONNECTING : ConnectionState.RECONNECTING,
            `Attempt ${this.connectionAttempts}/${this.options.maxRetries}`
        );
        
        try {
            // Set connection timeout
            const timeoutPromise = new Promise((_, reject) => {
                this.connectionTimeoutTimer = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.options.connectionTimeout);
            });
            
            // Race between connection and timeout
            const success = await Promise.race([
                this.connect(),
                timeoutPromise
            ]);
            
            this.clearConnectionTimeout();
            
            if (success) {
                this.setState(ConnectionState.CONNECTED, 'Connection established');
                return true;
            } else {
                throw new Error('Connection failed');
            }
        } catch (error) {
            this.clearConnectionTimeout();
            console.error(`${this.serviceName} connection attempt ${this.connectionAttempts} failed:`, error.message);
            
            if (this.connectionAttempts < this.options.maxRetries) {
                this.scheduleRetry();
            } else {
                this.setState(ConnectionState.ERROR, 'Max retries exceeded', error);
            }
            
            return false;
        }
    }
    
    /**
     * Schedule retry with exponential backoff
     */
    scheduleRetry() {
        const delay = Math.min(
            this.options.initialRetryDelay * Math.pow(this.options.retryMultiplier, this.connectionAttempts - 1),
            this.options.maxRetryDelay
        );
        
        console.log(`${this.serviceName}: Scheduling retry in ${delay}ms`);
        
        this.retryTimer = setTimeout(() => {
            this.attemptConnection();
        }, delay);
    }
    
    /**
     * Start health check timer
     */
    startHealthCheck() {
        if (!this.options.enableHealthCheck) return;
        
        this.stopHealthCheck(); // Clear any existing timer
        
        this.healthCheckTimer = setInterval(async () => {
            await this.healthCheck();
        }, this.options.healthCheckInterval);
    }
    
    /**
     * Stop health check timer
     */
    stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }
    
    /**
     * Perform health check
     */
    async healthCheck() {
        if (!this.isConnected()) return;
        
        try {
            const isHealthy = await this.performHealthCheck();
            
            if (!isHealthy) {
                console.log(`${this.serviceName}: Health check failed, reconnecting`);
                this.setState(ConnectionState.DISCONNECTED, 'Health check failed');
                this.reconnect();
            }
        } catch (error) {
            console.error(`${this.serviceName}: Health check error:`, error.message);
            this.setState(ConnectionState.DISCONNECTED, 'Health check error', error);
            this.reconnect();
        }
    }
    
    /**
     * Clear retry timer
     */
    clearRetryTimer() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }
    
    /**
     * Clear connection timeout timer
     */
    clearConnectionTimeout() {
        if (this.connectionTimeoutTimer) {
            clearTimeout(this.connectionTimeoutTimer);
            this.connectionTimeoutTimer = null;
        }
    }
    
    /**
     * Clean up timers and disconnect
     */
    async destroy() {
        this.clearRetryTimer();
        this.clearConnectionTimeout();
        this.stopHealthCheck();
        
        if (this.isConnected()) {
            await this.disconnect();
        }
        
        this.setState(ConnectionState.DISCONNECTED, 'Service destroyed');
        this.removeAllListeners();
    }
    
    /**
     * Get connection statistics
     * @returns {Object} Connection stats
     */
    getStats() {
        return {
            serviceName: this.serviceName,
            state: this.state,
            connectionAttempts: this.connectionAttempts,
            lastConnectionTime: this.lastConnectionTime,
            lastError: this.lastError ? this.lastError.message : null,
            uptime: this.lastConnectionTime ? Date.now() - this.lastConnectionTime.getTime() : 0
        };
    }
}

// Export both the class and the states
ConnectionManager.ConnectionState = ConnectionState;

module.exports = ConnectionManager;
