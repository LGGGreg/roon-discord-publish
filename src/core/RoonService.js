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
            maxRetries: Infinity, // Infinite retries
            initialRetryDelay: 3000,
            maxRetryDelay: 10000, // Cap at 10 seconds for faster perpetual retries
            healthCheckInterval: 30000,
            connectionTimeout: 20000,
            perpetualRetry: true, // Enable perpetual retries
            perpetualRetryInterval: 10000, // Retry every 10 seconds when in perpetual mode
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
            // Don't reconnect if already connected and working
            if (this.isConnected() && this.roon && this.transport) {
                console.log('Roon already connected and working, skipping reconnection');
                return true;
            }

            // Clean up existing connection
            if (this.roon) {
                await this.cleanupRoon();
            }
            
            // Get configuration
            const coreIp = this.configManager.get('core_ip');
            const useDiscovery = this.configManager.get('app.use_discovery', true);
            const roonState = this.configManager.get('roonstate', {});
            
            // Create Roon API instance (using same extension ID as working console app)
            this.roon = new RoonApi({
                extension_id: 'moe.tdr.roon-discord-rp',
                display_name: 'Discord Rich Presence',
                display_version: '1.1',
                publisher: 'Echo Fox',
                email: 'lgg.greg@gmail.com',
                website: 'https://boxfox.rocks',
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
            if (roonState.tokens && this.roon && typeof this.roon.load_config === 'function') {
                try {
                    this.roon.load_config(roonState);
                    console.log('Roon pairing state restored');
                } catch (error) {
                    console.error('Error loading Roon config:', error);
                }
            }
            
            // Start discovery (always use discovery like the working console app)
            console.log('Starting Roon discovery...');
            this.roon.start_discovery();
            
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

        // Save pairing state after a delay to ensure pairing is complete
        setTimeout(() => {
            try {
                if (this.roon && typeof this.roon.save_config === 'function') {
                    const roonState = this.roon.save_config();
                    console.log('Saving Roon state:', JSON.stringify(roonState, null, 2));

                    if (roonState && Object.keys(roonState).length > 0) {
                        this.configManager.set('roonstate', roonState, true);
                        console.log('Roon pairing state saved successfully');

                        // Verify it was saved
                        const savedState = this.configManager.get('roonstate');
                        console.log('Verified saved state:', JSON.stringify(savedState, null, 2));
                    } else {
                        console.warn('Roon state is empty or undefined, not saving');
                    }
                } else {
                    console.warn('Cannot save Roon config - roon object not available');
                }
            } catch (error) {
                console.error('Error saving Roon config:', error);
            }
        }, 1000); // Wait 1 second for pairing to complete

        // Set connection state to connected
        this.setState(ConnectionManager.ConnectionState.CONNECTED, 'Core paired successfully');

        // Subscribe to services
        this.subscribeToServices();

        // Emit with safe core info (avoid circular references)
        const safeCoreInfo = {
            core_id: core.core_id,
            display_name: core.display_name,
            display_version: core.display_version
        };
        this.emit('core-paired', safeCoreInfo);
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
     * Subscribe to Roon services (simplified to match working console app)
     */
    subscribeToServices() {
        if (!this.core || !this.transport) {
            console.log('Core or transport not available for subscription');
            return;
        }

        try {
            console.log('Subscribing to Roon zones...');

            // Use the exact same pattern as the working console app
            this.transport.subscribe_zones(async (cmd, data) => {
                try {
                    console.log('Zones subscription command:', cmd);

                    if (cmd === 'Subscribed' || cmd === 'Changed') {
                        if (data && data.zones) {
                            this.handleZonesUpdate(data);
                        } else if (cmd === 'Changed' && data) {
                            // Handle zone changes that don't have zones array
                            this.handleZoneChanges(data);
                        }
                    }
                } catch (error) {
                    console.error('Error in zones subscription callback:', error);
                }
            });

        } catch (error) {
            console.error('Error subscribing to Roon services:', error);
            this.setState(ConnectionManager.ConnectionState.ERROR, 'Subscription failed');
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
     * Handle zone changes (for Changed events without zones array)
     */
    handleZoneChanges(data) {
        if (!data) return;

        // Handle zones_changed array
        if (data.zones_changed && Array.isArray(data.zones_changed)) {
            data.zones_changed.forEach(zone => {
                this.zones.set(zone.zone_id, zone);

                // If this is our current zone or we don't have one, update it
                if (!this.currentZone || zone.zone_id === this.currentZone.zone_id) {
                    this.currentZone = zone;

                    // Check if zone has now_playing information and emit track change
                    if (zone.now_playing) {
                        const trackInfo = this.extractTrackInfo(zone);
                        if (trackInfo) {
                            this.currentTrack = trackInfo;
                            this.emit('track-changed', trackInfo);
                            console.log(`Track changed from zone update: ${trackInfo.title} - ${trackInfo.artist}`);
                        }
                    }
                }
            });
        }

        // Handle zones_seek_changed array (position updates)
        if (data.zones_seek_changed && Array.isArray(data.zones_seek_changed)) {
            data.zones_seek_changed.forEach(seekUpdate => {
                // Update the zone with new seek position
                if (this.currentZone && seekUpdate.zone_id === this.currentZone.zone_id) {
                    // Update the current zone's seek position
                    if (this.currentZone.now_playing) {
                        this.currentZone.now_playing.seek_position = seekUpdate.seek_position;

                        // Extract updated track info with new position
                        const trackInfo = this.extractTrackInfo(this.currentZone);
                        if (trackInfo) {
                            this.currentTrack = trackInfo;
                            this.emit('track-position-changed', trackInfo);
                            // Don't log every position update as it's too verbose
                        }
                    }
                }
            });
        }

        // Handle zones_removed array
        if (data.zones_removed && Array.isArray(data.zones_removed)) {
            data.zones_removed.forEach(zoneId => {
                this.zones.delete(zoneId);
                if (this.currentZone && this.currentZone.zone_id === zoneId) {
                    this.currentZone = null;
                    this.selectCurrentZone();
                }
            });
        }
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

            // Check if zone has now_playing information and emit track change
            if (this.currentZone.now_playing) {
                const trackInfo = this.extractTrackInfo(this.currentZone);
                if (trackInfo) {
                    this.currentTrack = trackInfo;
                    this.emit('track-changed', trackInfo);
                    console.log(`Now playing from zone: ${trackInfo.title} - ${trackInfo.artist}`);
                }
            }
        }
    }
    
    /**
     * Update queue subscription for current zone (removed - not used in working console app)
     */
    updateQueueSubscription() {
        // The working console app doesn't use subscribe_queue
        // It gets track info directly from zones data
        console.log('Queue subscription not needed - using zones data for track info');
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
     * Extract track information from zone data
     */
    extractTrackInfo(zone) {
        if (!zone || !zone.now_playing) return null;

        const nowPlaying = zone.now_playing;
        const threeLine = nowPlaying.three_line || {};
        const twoLine = nowPlaying.two_line || {};

        console.log('extractTrackInfo: nowPlaying.image_key =', nowPlaying.image_key);

        // Extract artist image key if available
        let artistImageKey = null;
        if (nowPlaying.artist_image_keys && nowPlaying.artist_image_keys.length > 0) {
            artistImageKey = nowPlaying.artist_image_keys[0];
            console.log('extractTrackInfo: found artist_image_key =', artistImageKey);
        }

        const trackInfo = {
            title: threeLine.line1 || twoLine.line1 || 'Unknown Track',
            artist: threeLine.line2 || twoLine.line2 || 'Unknown Artist',
            album: threeLine.line3 || 'Unknown Album',
            zoneName: zone.display_name || 'Unknown Zone',
            duration: nowPlaying.length || 0,
            position: nowPlaying.seek_position || 0,
            progress: nowPlaying.seek_position || 0,
            state: zone.state || 'unknown',
            image_key: nowPlaying.image_key || null,
            artist_image_key: artistImageKey,
            albumArt: null // Will be set later if needed
        };

        console.log('extractTrackInfo: final trackInfo.image_key =', trackInfo.image_key);
        return trackInfo;
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
