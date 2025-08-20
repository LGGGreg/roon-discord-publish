const RoonApi = require('node-roon-api');
const RoonApiTransport = require('node-roon-api-transport');
const RoonApiImage = require('node-roon-api-image');
const ConnectionManager = require('./ConnectionManager');

/**
 * RoonService - Manages Roon API connection with robust retry logic
 */
class RoonService extends ConnectionManager {
    constructor(configManager, options = {}) {
        super('Roon', {
            maxRetries: 10,
            initialRetryDelay: 3000,
            maxRetryDelay: 60000,
            healthCheckInterval: 30000,
            connectionTimeout: 20000,
            ...options
        });
        
        this.configManager = configManager;
        this.roon = null;
        this.transport = null;
        this.image = null;
        this.core = null;
        this.zones = new Map();
        this.currentZone = null;
        this.currentTrack = null;
        
        // Listen for config changes
        this.configManager.on('config-changed', (path, value) => {
            if (path === 'core_ip' || path === 'zone_id' || path.startsWith('app.use_discovery')) {
                console.log('Roon configuration changed, reconnecting...');
                if (this.isConnected()) {
                    this.reconnect(true);
                }
            }
        });
    }
    
    /**
     * Connect to Roon API
     * @returns {Promise<boolean>} Connection success
     */
    async connect() {
        try {
            // Clean up existing connection
            if (this.roon) {
                await this.cleanupRoon();
            }
            
            // Get configuration
            const coreIp = this.configManager.get('core_ip');
            const useDiscovery = this.configManager.get('app.use_discovery', true);
            const roonState = this.configManager.get('roonstate', {});
            
            // Create Roon API instance
            this.roon = new RoonApi({
                extension_id: 'com.echofox.roon-discord-publish',
                display_name: 'Roon Discord Rich Presence',
                display_version: '0.7.0',
                publisher: 'Echo Fox',
                email: 'roon@echofox.com',
                website: 'https://github.com/echofox/roon-discord-publish',
                core_paired: this.handleCorePaired.bind(this),
                core_unpaired: this.handleCoreUnpaired.bind(this)
            });

            // Initialize services
            this.roon.init_services({
                required_services: [RoonApiTransport, RoonApiImage]
            });
            
            // Set up event handlers
            this.setupRoonEventHandlers();
            
            // Restore pairing state
            if (roonState.tokens) {
                this.roon.load_config(roonState);
            }
            
            // Start discovery or connect to specific core
            if (useDiscovery || !coreIp) {
                console.log('Starting Roon discovery...');
                this.roon.start_discovery();
            } else {
                console.log(`Connecting to Roon Core at ${coreIp}...`);
                this.roon.connect(coreIp, (core) => {
                    if (core) {
                        this.handleCoreFound(core);
                    } else {
                        throw new Error(`Failed to connect to Roon Core at ${coreIp}`);
                    }
                });
            }
            
            // Wait for connection with timeout
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Roon connection timeout'));
                }, this.options.connectionTimeout);

                // Listen for core paired event
                const onCorePaired = () => {
                    clearTimeout(timeout);
                    this.removeListener('core-paired', onCorePaired);
                    resolve(true);
                };

                this.once('core-paired', onCorePaired);

                // Check if already connected
                if (this.core) {
                    clearTimeout(timeout);
                    this.removeListener('core-paired', onCorePaired);
                    resolve(true);
                }
            });
            
        } catch (error) {
            await this.cleanupRoon();
            throw error;
        }
    }
    
    /**
     * Disconnect from Roon API
     * @returns {Promise<boolean>} Disconnection success
     */
    async disconnect() {
        try {
            await this.cleanupRoon();
            return true;
        } catch (error) {
            console.error('Error during Roon disconnect:', error);
            return false;
        }
    }
    
    /**
     * Setup Roon event handlers
     */
    setupRoonEventHandlers() {
        if (!this.roon) return;

        // Event handlers will be set up after core pairing
        // when transport and image services become available
    }
    
    /**
     * Handle core paired event
     */
    handleCorePaired(core) {
        console.log(`Roon Core paired: ${core.display_name} (${core.core_id})`);
        this.core = core;

        // Get services from core
        this.transport = core.services['RoonApiTransport'];
        this.image = core.services['RoonApiImage'];

        // Save pairing state
        const roonState = this.roon.save_config();
        this.configManager.set('roonstate', roonState, true);

        // Subscribe to services
        this.subscribeToServices();

        this.emit('core-paired', core);
    }
    
    /**
     * Handle core unpaired event
     */
    handleCoreUnpaired(core) {
        console.log(`Roon Core unpaired: ${core?.display_name || 'Unknown'}`);
        this.core = null;
        this.zones.clear();
        this.currentZone = null;
        this.currentTrack = null;
        
        this.setState(ConnectionManager.ConnectionState.DISCONNECTED, 'Core unpaired');
        this.emit('core-unpaired', core);
    }
    
    /**
     * Handle core found during discovery
     */
    handleCoreFound(core) {
        console.log(`Roon Core found: ${core.display_name} (${core.core_id})`);
        this.handleCorePaired(core);
    }
    
    /**
     * Subscribe to Roon services
     */
    subscribeToServices() {
        if (!this.core || !this.transport) return;

        try {
            // Subscribe to zones
            this.transport.subscribe_zones((response, msg) => {
                if (response === 'Subscribed') {
                    console.log('Subscribed to Roon zones');
                    this.handleZonesUpdate(msg);
                } else if (response === 'Changed') {
                    this.handleZonesUpdate(msg);
                }
            });

            // Subscribe to queue for the current zone
            this.updateQueueSubscription();
        } catch (error) {
            console.error('Error subscribing to Roon services:', error);
        }
    }
    
    /**
     * Handle zones update
     */
    handleZonesUpdate(data) {
        if (!data || !data.zones) return;
        
        // Update zones map
        this.zones.clear();
        data.zones.forEach(zone => {
            this.zones.set(zone.zone_id, zone);
        });
        
        // Find current zone or select default
        this.selectCurrentZone();
        
        this.emit('zones-updated', Array.from(this.zones.values()));
    }
    
    /**
     * Select current zone based on configuration
     */
    selectCurrentZone() {
        const configuredZoneId = this.configManager.get('zone_id');
        
        if (configuredZoneId && this.zones.has(configuredZoneId)) {
            // Use configured zone
            this.currentZone = this.zones.get(configuredZoneId);
        } else {
            // Find first playing zone or any zone
            const playingZone = Array.from(this.zones.values()).find(zone => 
                zone.now_playing && zone.state === 'playing'
            );
            
            this.currentZone = playingZone || Array.from(this.zones.values())[0] || null;
        }
        
        if (this.currentZone) {
            console.log(`Selected zone: ${this.currentZone.display_name} (${this.currentZone.zone_id})`);
            this.updateQueueSubscription();
            this.emit('zone-selected', this.currentZone);
        }
    }
    
    /**
     * Update queue subscription for current zone
     */
    updateQueueSubscription() {
        if (!this.currentZone || !this.transport) return;

        try {
            this.transport.subscribe_queue(this.currentZone, (response, msg) => {
                if (response === 'Subscribed') {
                    console.log(`Subscribed to queue for zone: ${this.currentZone.display_name}`);
                } else if (response === 'Changed') {
                    this.handleQueueUpdate(msg);
                }
            });
        } catch (error) {
            console.error('Error subscribing to queue:', error);
        }
    }
    
    /**
     * Handle queue update (now playing info)
     */
    handleQueueUpdate(data) {
        if (!data || !data.changes) return;
        
        data.changes.forEach(change => {
            if (change.operation === 'add' || change.operation === 'change') {
                change.items?.forEach(item => {
                    if (item.zone_id === this.currentZone?.zone_id) {
                        this.currentTrack = item;
                        this.emit('track-changed', item);
                        console.log(`Now playing: ${item.three_line?.line1 || 'Unknown'} - ${item.three_line?.line2 || 'Unknown'}`);
                    }
                });
            }
        });
    }
    
    /**
     * Perform health check
     * @returns {Promise<boolean>} Health check result
     */
    async performHealthCheck() {
        try {
            return !!(this.core && this.roon && this.zones.size > 0);
        } catch (error) {
            console.error('Roon health check failed:', error);
            return false;
        }
    }
    
    /**
     * Get current playing track info
     * @returns {Object|null} Track information
     */
    getCurrentTrack() {
        if (!this.currentTrack || !this.currentZone) return null;
        
        const track = this.currentTrack;
        const zone = this.currentZone;
        
        return {
            title: track.three_line?.line1 || track.title || 'Unknown',
            artist: track.three_line?.line2 || track.artist || 'Unknown',
            album: track.three_line?.line3 || track.album || 'Unknown',
            zoneName: zone.display_name || 'Unknown Zone',
            state: zone.state || 'unknown',
            duration: track.length || 0,
            position: zone.now_playing?.seek_position || 0,
            imageKey: track.image_key || null,
            trackId: track.queue_item_id || null,
            zoneId: zone.zone_id || null
        };
    }
    
    /**
     * Get available zones
     * @returns {Array} List of zones
     */
    getZones() {
        return Array.from(this.zones.values()).map(zone => ({
            zone_id: zone.zone_id,
            display_name: zone.display_name,
            state: zone.state,
            is_current: zone.zone_id === this.currentZone?.zone_id
        }));
    }
    
    /**
     * Set current zone
     * @param {string} zoneId - Zone ID to select
     * @returns {boolean} Success status
     */
    setCurrentZone(zoneId) {
        if (!this.zones.has(zoneId)) return false;
        
        this.currentZone = this.zones.get(zoneId);
        this.configManager.set('zone_id', zoneId, true);
        this.updateQueueSubscription();
        this.emit('zone-selected', this.currentZone);
        
        return true;
    }
    
    /**
     * Clean up Roon connection
     */
    async cleanupRoon() {
        if (this.roon) {
            try {
                if (typeof this.roon.stop_discovery === 'function') {
                    this.roon.stop_discovery();
                }
            } catch (error) {
                console.error('Error stopping Roon discovery:', error);
            }
            this.roon = null;
        }

        this.transport = null;
        this.image = null;
        this.core = null;
        this.zones.clear();
        this.currentZone = null;
        this.currentTrack = null;
    }
    
    /**
     * Get service-specific stats
     * @returns {Object} Roon service stats
     */
    getStats() {
        const baseStats = super.getStats();
        return {
            ...baseStats,
            coreId: this.core?.core_id || null,
            coreName: this.core?.display_name || null,
            zonesCount: this.zones.size,
            currentZone: this.currentZone?.display_name || null,
            currentTrack: this.getCurrentTrack(),
            useDiscovery: this.configManager.get('app.use_discovery', true),
            coreIp: this.configManager.get('core_ip')
        };
    }
    
    /**
     * Clean up on destroy
     */
    async destroy() {
        await this.cleanupRoon();
        await super.destroy();
    }
}

module.exports = RoonService;
