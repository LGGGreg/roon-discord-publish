const DiscordRPC = require('discord-rpc');
const ConnectionManager = require('./ConnectionManager');

/**
 * DiscordService - Manages Discord RPC connection with robust retry logic
 */
class DiscordService extends ConnectionManager {
    constructor(configManager, options = {}) {
        super('Discord', {
            maxRetries: Infinity, // Infinite retries
            initialRetryDelay: 2000,
            maxRetryDelay: 10000, // Cap at 10 seconds for faster perpetual retries
            healthCheckInterval: 60000, // Check every minute
            connectionTimeout: 15000, // 15 seconds
            perpetualRetry: true, // Enable perpetual retries
            perpetualRetryInterval: 10000, // Retry every 10 seconds when in perpetual mode
            ...options
        });
        
        this.configManager = configManager;
        this.rpc = null;
        this.clientId = null;
        this.lastSentStatus = 0;
        this.rateLimitDelay = 10000; // 10 seconds between status updates
        
        // Listen for config changes
        this.configManager.on('config-changed', (path, value) => {
            if (path === 'discord.clientId') {
                this.clientId = value;
                console.log('Discord Client ID changed, attempting auto-reconnection...');

                // If we have a valid client ID, attempt to connect/reconnect
                if (this.canConnect()) {
                    if (this.isConnected()) {
                        console.log('Discord: Already connected, reconnecting with new client ID...');
                        this.reconnect(true);
                    } else {
                        console.log('Discord: Not connected, attempting connection with new client ID...');
                        // Use a small delay to ensure config is fully saved
                        setTimeout(() => {
                            this.connect().catch(error => {
                                console.log('Discord: Auto-connection failed:', error.message);
                            });
                        }, 500);
                    }
                } else {
                    console.log('Discord: Invalid or empty client ID, disconnecting...');
                    if (this.isConnected()) {
                        this.disconnect();
                    }
                }
            }
        });
        
        // Load initial client ID
        this.clientId = this.configManager.get('discord.clientId');
    }
    
    /**
     * Check if service can connect (has required credentials)
     * @returns {boolean} Can connect
     */
    canConnect() {
        return !!(this.clientId && this.clientId.trim());
    }

    /**
     * Connect to Discord RPC
     * @returns {Promise<boolean>} Connection success
     */
    async connect() {
        if (!this.canConnect()) {
            throw new Error('Discord Client ID not configured');
        }
        
        try {
            // Clean up existing connection
            if (this.rpc) {
                await this.cleanupRPC();
            }
            
            // Create new RPC client
            this.rpc = new DiscordRPC.Client({ transport: 'ipc' });
            
            // Set up event handlers
            this.setupRPCEventHandlers();
            
            // Register the application
            DiscordRPC.register(this.clientId);
            
            // Attempt login with timeout
            console.log('Discord: Attempting RPC login...');
            await Promise.race([
                this.rpc.login({ clientId: this.clientId }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Discord RPC login timeout - is Discord desktop app running?')), 10000)
                )
            ]);

            console.log('Discord: RPC login successful, waiting for ready event...');
            return true;
        } catch (error) {
            await this.cleanupRPC();
            throw error;
        }
    }
    
    /**
     * Disconnect from Discord RPC
     * @returns {Promise<boolean>} Disconnection success
     */
    async disconnect() {
        try {
            await this.cleanupRPC();
            return true;
        } catch (error) {
            console.error('Error during Discord disconnect:', error);
            return false;
        }
    }
    
    /**
     * Setup RPC event handlers
     */
    setupRPCEventHandlers() {
        if (!this.rpc) return;
        
        this.rpc.on('ready', () => {
            console.log(`Discord RPC ready for user: ${this.rpc.user?.username || 'Unknown'}`);
            this.setState(ConnectionManager.ConnectionState.CONNECTED, 'Connection established');
            this.emit('discord-ready', this.rpc.user);
        });
        
        this.rpc.transport.once('close', () => {
            console.log('Discord RPC transport closed');
            if (this.isConnected()) {
                this.setState(ConnectionManager.ConnectionState.DISCONNECTED, 'Transport closed');
                this.reconnect();
            }
        });
        
        this.rpc.transport.on('error', (error) => {
            console.error('Discord RPC transport error:', error);
            this.setState(ConnectionManager.ConnectionState.ERROR, 'Transport error', error);
        });
    }
    
    /**
     * Clean up RPC connection
     */
    async cleanupRPC() {
        if (this.rpc) {
            try {
                if (this.rpc.transport && this.rpc.transport.socket) {
                    await this.rpc.destroy();
                }
            } catch (error) {
                console.error('Error destroying Discord RPC:', error);
            }
            this.rpc = null;
        }
    }
    
    /**
     * Perform health check
     * @returns {Promise<boolean>} Health check result
     */
    async performHealthCheck() {
        if (!this.rpc || !this.rpc.transport || !this.rpc.transport.socket) {
            return false;
        }
        
        try {
            // Try to get current user as a health check
            const user = this.rpc.user;
            return !!user;
        } catch (error) {
            console.error('Discord health check failed:', error);
            return false;
        }
    }
    
    /**
     * Set Discord Rich Presence activity
     * @param {Object} activity - Activity object
     * @returns {Promise<boolean>} Success status
     */
    async setActivity(activity) {
        if (!this.isConnected() || !this.rpc) {
            console.log('Discord not connected, cannot set activity');
            return false;
        }
        
        // Rate limiting
        const now = Date.now();
        if (now - this.lastSentStatus < this.rateLimitDelay) {
            console.log('Discord activity rate limited, skipping update');
            return false;
        }
        
        try {
            await this.rpc.setActivity(activity);
            this.lastSentStatus = now;
            this.emit('activity-set', activity);

            // Update status details to show current activity
            const activityDetails = activity.details && activity.state ?
                `Playing: ${activity.details} - ${activity.state}` :
                'Playing music';
            this.setState(ConnectionManager.ConnectionState.CONNECTED, activityDetails);

            return true;
        } catch (error) {
            console.error('Error setting Discord activity:', error);
            this.emit('activity-error', error);
            
            // If it's a connection error, trigger reconnection
            if (error.message.includes('connection') || error.message.includes('transport')) {
                this.setState(ConnectionManager.ConnectionState.DISCONNECTED, 'Activity set failed');
                this.reconnect();
            }
            
            return false;
        }
    }
    
    /**
     * Clear Discord Rich Presence activity
     * @returns {Promise<boolean>} Success status
     */
    async clearActivity() {
        if (!this.isConnected() || !this.rpc) {
            console.log('Discord not connected, cannot clear activity');
            return false;
        }
        
        try {
            await this.rpc.clearActivity();
            this.emit('activity-cleared');
            return true;
        } catch (error) {
            console.error('Error clearing Discord activity:', error);
            this.emit('activity-error', error);
            return false;
        }
    }
    
    /**
     * Set activity for a playing track
     * @param {Object} trackInfo - Track information
     * @returns {Promise<boolean>} Success status
     */
    async setTrackActivity(trackInfo) {
        const {
            title,
            artist,
            album,
            zoneName,
            duration,
            position,
            largeImageUrl,
            smallImageUrl,
            spotifyUrl
        } = trackInfo;
        
        if (!title || title === '-') {
            return this.clearActivity();
        }
        
        const startTimestamp = Math.round((Date.now() / 1000) - (position || 0));
        const endTimestamp = duration ? Math.round(startTimestamp + duration) : undefined;
        
        const activity = {
            details: title.substring(0, 128),
            state: (artist || '--').substring(0, 128),
            startTimestamp,
            endTimestamp,
            largeImageKey: largeImageUrl || 'roon-main',
            largeImageText: `Zone: ${zoneName || 'Unknown'}`,
            smallImageKey: smallImageUrl || 'roon-small',
            smallImageText: artist || 'Roon',
            type: 2 // Listening activity type
        };
        
        // Add Spotify button if URL is available
        if (spotifyUrl) {
            activity.buttons = [{
                label: `Spotify Link for ${title.substring(0, 15)}`,
                url: spotifyUrl
            }];
        }
        
        return this.setActivity(activity);
    }
    
    /**
     * Set loading activity
     * @param {string} zoneName - Zone name
     * @returns {Promise<boolean>} Success status
     */
    async setLoadingActivity(zoneName) {
        const activity = {
            details: 'Loading...',
            largeImageKey: 'roon-main',
            largeImageText: `Zone: ${zoneName || 'Unknown'}`,
            smallImageKey: 'roon-small',
            smallImageText: 'Roon',
            type: 2
        };
        
        return this.setActivity(activity);
    }
    
    /**
     * Get Discord user info
     * @returns {Object|null} User information
     */
    getUser() {
        return this.rpc?.user || null;
    }
    
    /**
     * Get service-specific stats
     * @returns {Object} Discord service stats
     */
    getStats() {
        const baseStats = super.getStats();
        return {
            ...baseStats,
            clientId: this.clientId,
            user: this.getUser(),
            lastActivityTime: this.lastSentStatus,
            rateLimitDelay: this.rateLimitDelay
        };
    }
    
    /**
     * Clean up on destroy
     */
    async destroy() {
        await this.cleanupRPC();
        await super.destroy();
    }
}

module.exports = DiscordService;
