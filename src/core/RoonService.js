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
            enableHealthCheck: true, // Re-enabled with fixed logic
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
        this.lastPositionUpdate = 0; // Throttle position updates
        this.isSubscribedToZones = false; // Prevent duplicate subscriptions

        // Debounce track-changed events to prevent overwhelming the connection
        this.trackChangeDebounceTimer = null;
        this.pendingTrackInfo = null;
        
        // DISABLED: Listen for config changes (was causing disconnections)
        // this.configManager.on('config-changed', (path, value) => {
        //     if (path === 'core_ip' || path === 'zone_id' || path.startsWith('app.use_discovery')) {
        //         console.log('Roon configuration changed, reconnecting...');
        //         if (this.isConnected()) {
        //             this.reconnect(true);
        //         }
        //     }
        // });
    }

    /**
     * Emit track-changed event with debouncing to prevent overwhelming the connection
     * @param {Object|null} trackInfo - Track information or null to clear
     */
    emitTrackChanged(trackInfo) {
        // Store the latest track info
        this.pendingTrackInfo = trackInfo;

        // Clear existing timer
        if (this.trackChangeDebounceTimer) {
            clearTimeout(this.trackChangeDebounceTimer);
        }

        // Set new timer to emit after a short delay
        this.trackChangeDebounceTimer = setTimeout(() => {
            console.log('Emitting debounced track-changed event:', this.pendingTrackInfo?.title || 'null');
            this.emit('track-changed', this.pendingTrackInfo);
            this.trackChangeDebounceTimer = null;
            this.pendingTrackInfo = null;
        }, 100); // 100ms debounce delay
    }

    /**
     * Check if service can connect (Roon doesn't require credentials)
     * @returns {boolean} Can connect
     */
    canConnect() {
        return true; // Roon can always attempt to connect (uses discovery or IP)
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
            
            // Create Roon API instance (EXACT SAME as working console app)
            this.roon = new RoonApi({
                extension_id: 'moe.tdr.roon-discord-rp',
                display_name: 'Discord Rich Presence',
                display_version: '1.1',
                publisher: 'Echo Fox',
                email: 'lgg.greg@gmail.com',
                website: 'https://boxfox.rocks',
                core_paired: this.handleCorePaired.bind(this),
                core_unpaired: this.handleCoreUnpaired.bind(this)
                // REMOVED: log_level and error handler - console version doesn't have them!
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

        // Save pairing state to config for future use
        this.savePairingState(core);

        // Set connection state to connected
        this.setState(ConnectionManager.ConnectionState.CONNECTED, 'Core paired successfully');

        // CRITICAL: Subscribe to zones IMMEDIATELY like console version
        // Don't go through subscribeToServices() - too much indirection
        this.subscribeToZonesDirectly();

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

        // Check if this is a temporary network issue vs intentional unpair
        const wasConnected = this.isConnected();

        this.core = null;
        this.zones.clear();
        this.currentZone = null;
        this.currentTrack = null;
        this.isSubscribedToZones = false; // Reset subscription flag

        // Clean up debounce timer
        if (this.trackChangeDebounceTimer) {
            clearTimeout(this.trackChangeDebounceTimer);
            this.trackChangeDebounceTimer = null;
        }
        this.pendingTrackInfo = null;

        this.setState(ConnectionManager.ConnectionState.DISCONNECTED, 'Core unpaired');
        this.emit('core-unpaired', core);

        // If we were connected and this seems like a network issue, attempt reconnection
        if (wasConnected && this.options.perpetualRetry) {
            console.log('Roon: Core unpaired unexpectedly, will attempt reconnection...');
            setTimeout(() => {
                if (!this.isConnected()) {
                    console.log('Roon: Attempting automatic reconnection after unpair...');
                    this.reconnect(false); // Don't force, just try to reconnect
                }
            }, 2000); // Wait 2 seconds before attempting reconnection
        }
    }

    /**
     * Save pairing state to configuration
     * @param {Object} core - Roon core object
     */
    savePairingState(core) {
        try {
            if (!this.roon || !core) {
                console.log('Cannot save pairing state - missing roon or core');
                return;
            }

            // Get the current config from Roon API
            const roonConfig = this.roon.save_config();

            if (roonConfig) {
                // Save to our config manager
                this.configManager.set('roonstate.tokens', roonConfig, false);
                this.configManager.set('roonstate.paired_core_id', core.core_id, true);

                console.log(`Roon pairing state saved for core: ${core.display_name}`);
            } else {
                console.log('No Roon config to save');
            }
        } catch (error) {
            console.error('Error saving Roon pairing state:', error);
        }
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


    /**
     * Subscribe to zones directly (EXACT console pattern)
     */
    subscribeToZonesDirectly() {
        if (!this.core || !this.transport) {
            console.log('Core or transport not available for subscription');
            return;
        }

        try {
            console.log('Subscribing to Roon zones...');

            // EXACT SAME PATTERN as console version - NO complex state management

            // EXACT SAME PATTERN as working console app - MINIMAL PROCESSING
            let activeZone = null;
            let activeZoneId = null;
            let nextZoneId = null;

            this.transport.subscribe_zones((cmd, data) => {
                try {
                    // CRITICAL: Console version IGNORES zones_seek_changed events completely
                    // Processing them causes Roon Core to disconnect us!
                    if (data && data.zones_seek_changed) {
                        // Completely ignore seek position updates - console version doesn't handle them
                        return;
                    }

                    console.log('🎵 Zone subscription event:', cmd, data ? Object.keys(data) : 'no data');

                    // Process both Subscribed (for initial track) and Changed events
                    // But keep processing MINIMAL to avoid disconnections
                    if (cmd === 'Subscribed') {
                        console.log('Processing initial zone data for track detection');
                        // SAFE: Process initial zones data directly from the event (not from transport._zones)
                        if (data && data.zones) {
                            for (const zone of data.zones) {
                                if (zone && zone.state === 'playing' && zone.now_playing) {
                                    const trackInfo = this.extractTrackInfo(zone);
                                    if (trackInfo) {
                                        this.currentTrack = trackInfo;
                                        console.log('Initial track detected:', trackInfo.title, '-', trackInfo.artist);
                                        this.emitTrackChanged(trackInfo);
                                        break; // Only process first playing zone
                                    }
                                }
                            }
                        }
                    } else if (cmd === 'Changed') {
                        console.log('Processing zone changes');
                        // MINIMAL track detection - only when zones actually change
                        if (data && data.zones_changed && this.transport && this.transport._zones) {
                            // Find first playing zone and extract track info
                            for (const zoneID of Object.keys(this.transport._zones)) {
                                const zone = this.transport._zones[zoneID];
                                if (zone && zone.state === 'playing' && zone.now_playing) {
                                    const trackInfo = this.extractTrackInfo(zone);
                                    if (trackInfo) {
                                        this.currentTrack = trackInfo;
                                        console.log('Track detected:', trackInfo.title, '-', trackInfo.artist);
                                        this.emitTrackChanged(trackInfo);
                                        break; // Only process first playing zone
                                    }
                                }
                            }
                        }
                    } else {
                        console.log('Ignoring unknown event:', cmd);
                        return;
                    }

                    if (cmd === 'Changed') {
                        if (data['zones_removed']) {
                            // Zone removed - clear current track
                            this.currentTrack = null;
                            console.log('Zone removed - clearing track');
                            this.emitTrackChanged(null);
                        } else if (data['zones_changed']) {
                            if (!this.configManager.get('zone_id')) {
                                // Follow zone changes if not locked to specific zone
                                data['zones_changed'].forEach((element) => {
                                    if (element.zone_id && element.zone_id !== activeZoneId) {
                                        nextZoneId = element.zone_id;
                                        activeZoneId = element.zone_id;
                                        if (this.transport && this.transport._zones) {
                                            activeZone = this.transport._zones[activeZoneId];
                                        }
                                    }
                                });
                            }

                            // Extract track info when zones actually change (new track)
                            if (activeZone && activeZone.now_playing) {
                                const trackInfo = this.extractTrackInfo(activeZone);
                                if (trackInfo) {
                                    this.currentTrack = trackInfo;
                                    console.log('Track changed:', trackInfo.title, '-', trackInfo.artist);
                                    this.emitTrackChanged(trackInfo);
                                }
                            }
                        } else {
                            // CRITICAL: Console version calls setStatusForZone here for track updates
                            // Only update when we have an active zone with now_playing
                            if (activeZone && activeZone.now_playing) {
                                const trackInfo = this.extractTrackInfo(activeZone);
                                if (trackInfo) {
                                    this.currentTrack = trackInfo;
                                    console.log('Track updated:', trackInfo.title, '-', trackInfo.artist);
                                    this.emitTrackChanged(trackInfo);
                                }
                            }
                        }
                    }

                    // Handle zone state changes
                    if (activeZone && activeZone.state && activeZone.state !== 'playing') {
                        console.log("Active zone stopped, resetting");
                        activeZone = null;
                        activeZoneId = null;
                        this.currentTrack = null;
                        console.log('Zone stopped - clearing track');
                        this.emitTrackChanged(null);
                    }
                } catch (error) {
                    console.error('Error in zones subscription:', error);
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

        // Store previous zones for state change detection
        const previousZones = new Map(this.zones);

        // Update zones map
        this.zones.clear();
        data.zones.forEach(zone => {
            this.zones.set(zone.zone_id, zone);
        });

        // Check for zone state changes in ALL zones (unless configured for specific zone)
        const configuredZoneId = this.configManager.get('zone_id');

        data.zones.forEach(zone => {
            const previousZone = previousZones.get(zone.zone_id);

            // Check if we should monitor this zone
            const shouldMonitorZone = !configuredZoneId || zone.zone_id === configuredZoneId;

            if (shouldMonitorZone && previousZone && previousZone.state !== zone.state) {
                console.log(`Zone ${zone.display_name} state changed: ${previousZone.state} -> ${zone.state}`);
                this.emit('zone-state-changed', {
                    zone: zone,
                    previousState: previousZone.state,
                    newState: zone.state
                });
            }

            // Update current zone if this is our current zone
            if (this.currentZone && zone.zone_id === this.currentZone.zone_id) {
                this.currentZone = zone;

                // Emit track-changed if zone is playing
                if (zone.now_playing && zone.state === 'playing') {
                    const trackInfo = this.extractTrackInfo(zone);
                    if (trackInfo) {
                        this.currentTrack = trackInfo;
                        this.emitTrackChanged(trackInfo);
                        console.log(`Track changed from zones update: ${trackInfo.title} - ${trackInfo.artist}`);
                    }
                } else if (zone.state === 'paused' || zone.state === 'stopped') {
                    // Clear current track when paused/stopped
                    this.currentTrack = null;
                    console.log(`Zone ${zone.display_name} ${zone.state}, clearing current track`);
                }
            }
        });

        // DISABLED: Old zone selection logic (conflicts with console pattern)
        // this.selectCurrentZone();
        // this.emit('zones-updated', Array.from(this.zones.values()));
    }

    /**
     * Handle zone changes (DISABLED - conflicts with console pattern)
     */
    handleZoneChanges(data) {
        // DISABLED: This conflicts with the console pattern subscription
        return;
        if (!data) return;

        // Handle zones_changed array
        if (data.zones_changed && Array.isArray(data.zones_changed)) {
            const configuredZoneId = this.configManager.get('zone_id');

            data.zones_changed.forEach(zone => {
                const previousZone = this.zones.get(zone.zone_id);
                this.zones.set(zone.zone_id, zone);

                // Check if we should monitor this zone for state changes
                const shouldMonitorZone = !configuredZoneId || zone.zone_id === configuredZoneId;

                if (shouldMonitorZone && previousZone && previousZone.state !== zone.state) {
                    console.log(`Zone ${zone.display_name} state changed: ${previousZone.state} -> ${zone.state}`);
                    this.emit('zone-state-changed', {
                        zone: zone,
                        previousState: previousZone.state,
                        newState: zone.state
                    });
                }

                // If this is our current zone or we don't have one, update it
                if (!this.currentZone || zone.zone_id === this.currentZone.zone_id) {
                    this.currentZone = zone;

                    // Check if zone has now_playing information and emit track change
                    if (zone.now_playing && zone.state === 'playing') {
                        const trackInfo = this.extractTrackInfo(zone);
                        if (trackInfo) {
                            this.currentTrack = trackInfo;
                            this.emitTrackChanged(trackInfo);
                            console.log(`Track changed from zone update: ${trackInfo.title} - ${trackInfo.artist}`);
                        }
                    } else if (zone.state === 'paused' || zone.state === 'stopped') {
                        // Clear current track when paused/stopped
                        this.currentTrack = null;
                        console.log(`Zone ${zone.display_name} ${zone.state}, clearing current track`);
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

                        // THROTTLE position updates to prevent overwhelming the system
                        // Only emit position updates every 5 seconds to reduce event spam
                        const now = Date.now();
                        if (!this.lastPositionUpdate || (now - this.lastPositionUpdate) > 5000) {
                            this.lastPositionUpdate = now;

                            const trackInfo = this.extractTrackInfo(this.currentZone);
                            if (trackInfo) {
                                this.currentTrack = trackInfo;
                                this.emit('track-position-changed', trackInfo);
                                // Don't log every position update as it's too verbose
                            }
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
     * Select current zone (DISABLED - conflicts with console pattern)
     */
    selectCurrentZone() {
        // DISABLED: This conflicts with the console pattern subscription
        return;
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

            // Check if zone has now_playing information and is playing
            if (this.currentZone.now_playing && this.currentZone.state === 'playing') {
                const trackInfo = this.extractTrackInfo(this.currentZone);
                if (trackInfo) {
                    this.currentTrack = trackInfo;
                    this.emitTrackChanged(trackInfo);
                    console.log(`Now playing from zone: ${trackInfo.title} - ${trackInfo.artist}`);
                }
            } else if (this.currentZone.state === 'paused' || this.currentZone.state === 'stopped') {
                // Clear current track when paused/stopped
                this.currentTrack = null;
                console.log(`Zone ${this.currentZone.display_name} ${this.currentZone.state}, clearing current track`);
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
                        // Only emit track-changed if the zone is actually playing
                        if (this.currentZone.state === 'playing') {
                            this.currentTrack = item;
                            this.emitTrackChanged(item);
                            console.log(`Now playing: ${item.three_line?.line1 || 'Unknown'} - ${item.three_line?.line2 || 'Unknown'}`);
                        } else {
                            console.log(`Queue updated but zone ${this.currentZone.display_name} is ${this.currentZone.state}, not emitting track-changed`);
                        }
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
            // FIXED: Don't rely on zones.size since we ignore Subscribed events
            // Just check if we have core and roon connections like console version
            return !!(this.core && this.roon && this.transport);
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
     * Check if all zones are paused or stopped
     * @returns {boolean} True if all zones are paused/stopped/loading
     */
    areAllZonesPaused() {
        if (this.zones.size === 0) return true;

        return Array.from(this.zones.values()).every(zone =>
            zone.state === 'paused' ||
            zone.state === 'stopped' ||
            zone.state === 'loading' ||
            !zone.state
        );
    }
    
    /**
     * Set current zone
     * @param {string} zoneId - Zone ID to select
     * @param {boolean} saveConfig - Whether to save config immediately
     * @returns {boolean} Success status
     */
    setCurrentZone(zoneId, saveConfig = false) {
        if (!this.zones.has(zoneId)) return false;

        this.currentZone = this.zones.get(zoneId);

        // Only save config when explicitly requested (e.g., from UI)
        if (saveConfig) {
            this.configManager.set('zone_id', zoneId, true);
        } else {
            // Just update in memory, don't save to file
            this.configManager.set('zone_id', zoneId, false);
        }

        this.updateQueueSubscription();
        this.emit('zone-selected', this.currentZone);

        return true;
    }
    
    /**
     * Clean up Roon connection
     */
    async cleanupRoon() {
        console.log('Cleaning up Roon connection...');

        if (this.roon) {
            try {
                // Stop discovery
                if (typeof this.roon.stop_discovery === 'function') {
                    console.log('Stopping Roon discovery...');
                    this.roon.stop_discovery();
                }

                // Close any open connections
                if (typeof this.roon.close === 'function') {
                    console.log('Closing Roon connection...');
                    this.roon.close();
                }

                // Remove all event listeners
                if (typeof this.roon.removeAllListeners === 'function') {
                    this.roon.removeAllListeners();
                }

            } catch (error) {
                console.error('Error stopping Roon:', error);
            }
            this.roon = null;
        }

        // Clear all references
        this.transport = null;
        this.image = null;
        this.core = null;
        this.zones.clear();
        this.currentZone = null;
        this.currentTrack = null;
        this.isSubscribedToZones = false;

        this.setState(ConnectionManager.ConnectionState.DISCONNECTED, 'Disconnected');
        console.log('Roon cleanup completed');
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
