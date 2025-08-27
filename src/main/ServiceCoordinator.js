/**
 * ServiceCoordinator - Manages service lifecycle and coordination
 */

const ConfigManager = require('../core/ConfigManager');
const DiscordService = require('../core/DiscordService');
const RoonService = require('../core/RoonService');
const SpotifyService = require('../core/SpotifyService');
const ImgurService = require('../core/ImgurService');
const StatusMonitor = require('../core/StatusMonitor');
const DebugManager = require('../core/DebugManager');

class ServiceCoordinator {
    constructor(logger, windowManager) {
        this.logger = logger;
        this.windowManager = windowManager;
        
        // Service instances
        this.services = {
            discordService: null,
            roonService: null,
            spotifyService: null,
            imgurService: null
        };
        
        // Core managers
        this.configManager = null;
        this.statusMonitor = null;
        this.debugManager = null;
        
        // State
        this.isInitialized = false;
        this.currentTrackInfo = null; // Track current playing track for retry logic
        this.lastDiscordUpdate = 0; // Track last Discord update time for rate limiting
        this.discordUpdateTimeout = null; // Debounce timeout for Discord updates
    }

    /**
     * Initialize all services and managers
     */
    async initialize() {
        try {
            this.logger?.info('ServiceCoordinator', 'Initializing services...');
            
            // Initialize config manager first
            await this.initializeConfigManager();
            
            // Initialize core services
            await this.initializeServices();
            
            // Initialize monitoring and debugging
            await this.initializeMonitoring();
            
            this.isInitialized = true;
            this.logger?.info('ServiceCoordinator', 'All services initialized successfully');
            
            return true;
        } catch (error) {
            this.logger?.error('ServiceCoordinator', `Failed to initialize services: ${error.message}`);
            return false;
        }
    }

    /**
     * Initialize configuration manager
     */
    async initializeConfigManager() {
        this.configManager = new ConfigManager();
        await this.configManager.loadConfig();
        this.logger?.info('ServiceCoordinator', 'Config manager initialized');
    }

    /**
     * Initialize all core services
     */
    async initializeServices() {
        // Initialize Discord service
        this.services.discordService = new DiscordService(this.configManager, this.logger);
        this.logger?.info('ServiceCoordinator', 'Discord service created');

        // Initialize Roon service
        this.services.roonService = new RoonService(this.configManager, this.logger);
        this.logger?.info('ServiceCoordinator', 'Roon service created');

        // Initialize Spotify service
        this.services.spotifyService = new SpotifyService(this.configManager, this.logger);
        this.logger?.info('ServiceCoordinator', 'Spotify service created');

        // Initialize Imgur service
        this.services.imgurService = new ImgurService(this.configManager, this.logger);
        this.logger?.info('ServiceCoordinator', 'Imgur service created');

        // Set up service event listeners
        this.setupServiceEventListeners();
    }

    /**
     * Initialize monitoring and debugging systems
     */
    async initializeMonitoring() {
        // Initialize status monitor (re-enabled after fixing health check logic)
        this.statusMonitor = new StatusMonitor(this.logger);

        // Register services with status monitor
        Object.entries(this.services).forEach(([serviceName, service]) => {
            if (service) {
                const cleanName = serviceName.replace('Service', '');
                this.statusMonitor.registerService(cleanName, service);
            }
        });

        this.statusMonitor.startMonitoring();
        this.logger?.info('ServiceCoordinator', 'Status monitor started');

        // Initialize debug manager
        this.debugManager = new DebugManager(this.logger);
        this.logger?.info('ServiceCoordinator', 'Debug manager initialized');
    }

    /**
     * Set up event listeners for all services
     */
    setupServiceEventListeners() {
        Object.entries(this.services).forEach(([serviceName, service]) => {
            if (!service) return;

            const cleanName = serviceName.replace('Service', '');

            service.on('connected', () => {
                this.logger?.info(cleanName, 'Service connected');
                this.notifyRenderer('service-status-changed', {
                    service: cleanName,
                    status: 'connected'
                });
            });

            service.on('disconnected', () => {
                this.logger?.info(cleanName, 'Service disconnected');
                this.notifyRenderer('service-status-changed', {
                    service: cleanName,
                    status: 'disconnected'
                });
            });

            service.on('error', (error) => {
                this.logger?.error(cleanName, `Service error: ${error.message}`);
                this.notifyRenderer('service-error', {
                    service: cleanName,
                    error: error.message
                });
            });

            service.on('retry', (attempt) => {
                this.logger?.info(cleanName, `Retry attempt ${attempt}`);
                this.notifyRenderer('service-retry', {
                    service: cleanName,
                    attempt
                });
            });
        });

        // Set up Roon-specific event handlers for track changes
        if (this.services.roonService) {
            this.setupRoonEventHandlers();
        }

        // Set up Discord-specific event handlers
        if (this.services.discordService) {
            this.setupDiscordEventHandlers();
        }

        // Set up Imgur-specific event handlers
        if (this.services.imgurService) {
            this.setupImgurEventHandlers();
        }
    }

    /**
     * Start all configured services
     */
    async startServices() {
        if (!this.isInitialized) {
            throw new Error('Services not initialized');
        }

        const startPromises = Object.entries(this.services).map(async ([serviceName, service]) => {
            if (!service) return;

            try {
                const cleanName = serviceName.replace('Service', '');
                this.logger?.info('ServiceCoordinator', `Starting ${cleanName} service...`);
                await service.reconnect(true); // Services use reconnect() to start
                this.logger?.info('ServiceCoordinator', `${cleanName} service started`);
            } catch (error) {
                this.logger?.error('ServiceCoordinator', `Failed to start ${serviceName}: ${error.message}`);
            }
        });

        await Promise.allSettled(startPromises);
        this.logger?.info('ServiceCoordinator', 'All services start attempts completed');
    }

    /**
     * Stop all services
     */
    async stopServices() {
        const stopPromises = Object.entries(this.services).map(async ([serviceName, service]) => {
            if (!service) return;

            try {
                const cleanName = serviceName.replace('Service', '');
                this.logger?.info('ServiceCoordinator', `Stopping ${cleanName} service...`);
                await service.disconnect(); // Services use disconnect() to stop
                this.logger?.info('ServiceCoordinator', `${cleanName} service stopped`);
            } catch (error) {
                this.logger?.error('ServiceCoordinator', `Failed to stop ${serviceName}: ${error.message}`);
            }
        });

        await Promise.allSettled(stopPromises);

        // Stop monitoring
        if (this.statusMonitor) {
            this.statusMonitor.stopMonitoring();
        }

        this.logger?.info('ServiceCoordinator', 'All services stopped');
    }

    /**
     * Reconnect all services
     */
    async reconnectAllServices() {
        this.logger?.info('ServiceCoordinator', 'Reconnecting all services...');
        
        const reconnectPromises = Object.entries(this.services).map(async ([serviceName, service]) => {
            if (!service) return { service: serviceName, success: false, error: 'Service not available' };
            
            try {
                const result = await service.reconnect(true);
                return { service: serviceName, success: result };
            } catch (error) {
                return { service: serviceName, success: false, error: error.message };
            }
        });

        const results = await Promise.allSettled(reconnectPromises);
        this.logger?.info('ServiceCoordinator', 'All services reconnection attempts completed');
        
        return results.map(result => result.status === 'fulfilled' ? result.value : result.reason);
    }

    /**
     * Get all services
     */
    getServices() {
        return this.services;
    }

    /**
     * Get a specific service
     */
    getService(serviceName) {
        return this.services[`${serviceName}Service`] || this.services[serviceName];
    }

    /**
     * Get config manager
     */
    getConfigManager() {
        return this.configManager;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return this.configManager ? this.configManager.getAll() : {};
    }

    /**
     * Get status monitor
     */
    getStatusMonitor() {
        return this.statusMonitor;
    }

    /**
     * Get debug manager
     */
    getDebugManager() {
        return this.debugManager;
    }

    /**
     * Notify renderer process of events
     */
    notifyRenderer(event, data) {
        const mainWindow = this.windowManager.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(event, data);
        }
    }

    /**
     * Check if services are initialized
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Set up Roon-specific event handlers
     */
    setupRoonEventHandlers() {
        const roonService = this.services.roonService;

        roonService.on('track-changed', (trackInfo) => {
            this.logger?.info('Roon', `Track changed: ${trackInfo?.title || 'Unknown'}`, {
                title: trackInfo?.title,
                artist: trackInfo?.artist,
                album: trackInfo?.album,
                zoneName: trackInfo?.zoneName,
                image_key: trackInfo?.image_key
            });

            // Store current track info for retry logic
            this.currentTrackInfo = trackInfo;

            // Send track info to renderer for Now Playing display
            if (trackInfo) {
                this.notifyRenderer('roon-track-changed', trackInfo);
            }

            // Update Discord activity if Discord is connected
            if (this.services.discordService && this.services.discordService.isConnected() && trackInfo) {
                if (trackInfo.state === 'playing') {
                    this.updateDiscordActivity(trackInfo);
                } else if (trackInfo.state === 'paused' || trackInfo.state === 'stopped') {
                    // Check if all zones are paused/stopped and clear Discord if so
                    if (roonService.areAllZonesPaused()) {
                        this.logger?.info('Discord', 'Track paused and all zones paused, clearing Discord status');
                        this.services.discordService.clearActivity().catch(error => {
                            this.logger?.error('Discord', 'Failed to clear Discord status:', error);
                        });
                        // Clear current track info when clearing activity
                        this.currentTrackInfo = null;
                    }
                }
            }
        });

        roonService.on('zone-state-changed', (stateChangeInfo) => {
            const { zone, previousState, newState } = stateChangeInfo;

            this.logger?.info('Roon', `Zone state changed: ${zone.display_name}`, {
                previousState,
                newState,
                zoneName: zone.display_name
            });

            // Handle Discord status based on zone state changes
            if (this.services.discordService && this.services.discordService.isConnected()) {
                if (newState === 'playing' && zone.now_playing) {
                    // Zone started playing - set Discord status
                    const trackInfo = {
                        title: zone.now_playing.three_line?.line1 || zone.now_playing.two_line?.line1 || 'Unknown',
                        artist: zone.now_playing.three_line?.line2 || zone.now_playing.two_line?.line2 || 'Unknown',
                        album: zone.now_playing.three_line?.line3 || 'Unknown',
                        zoneName: zone.display_name,
                        state: zone.state,
                        length: zone.now_playing.length,
                        seek_position: zone.now_playing.seek_position,
                        image_key: zone.now_playing.image_key
                    };

                    this.updateDiscordActivity(trackInfo);

                    // TEMPORARILY DISABLED: Album art processing might be causing Roon disconnections
                    // Send track info to renderer without album art for now
                    this.notifyRenderer('roon-track-changed', trackInfo);
                } else if ((newState === 'paused' || newState === 'stopped') && roonService.areAllZonesPaused()) {
                    // All zones paused/stopped - clear Discord status
                    this.logger?.info('Discord', 'All zones paused/stopped, clearing Discord status');
                    this.services.discordService.clearActivity().catch(error => {
                        this.logger?.error('Discord', 'Failed to clear Discord status:', error);
                    });
                    this.notifyRenderer('roon-track-cleared');
                }
            }

            // Send zone state change to renderer
            this.notifyRenderer('roon-zone-state-changed', stateChangeInfo);
        });
    }

    /**
     * Set up Discord-specific event handlers
     */
    setupDiscordEventHandlers() {
        const discordService = this.services.discordService;

        discordService.on('discord-ready', (user) => {
            this.logger?.info('Discord', `Ready for user: ${user.username}#${user.discriminator}`, user);
            this.notifyRenderer('discord-ready', user);
        });

        discordService.on('activity-set', (activity) => {
            this.logger?.info('Discord', 'Activity set', activity);
            this.notifyRenderer('discord-activity-set', activity);
        });

        discordService.on('activity-error', (error) => {
            this.logger?.error('Discord', 'Activity error', error.message);
            this.notifyRenderer('discord-activity-error', error.message);
        });
    }

    /**
     * Set up Imgur-specific event handlers
     */
    setupImgurEventHandlers() {
        const imgurService = this.services.imgurService;

        imgurService.on('connected', () => {
            // When Imgur connects, retry Discord activity update if we have a current track
            if (this.services.roonService && this.currentTrackInfo) {
                this.logger?.info('ServiceCoordinator', 'Imgur connected - retrying Discord activity update with images');
                setTimeout(() => {
                    this.updateDiscordActivity(this.currentTrackInfo);
                }, 1000); // Small delay to ensure connection is stable
            }
        });
    }

    /**
     * Update Discord activity with track information (with debouncing)
     */
    async updateDiscordActivity(trackInfo, isRetry = false) {
        // Clear any pending timeout
        if (this.discordUpdateTimeout) {
            clearTimeout(this.discordUpdateTimeout);
            this.discordUpdateTimeout = null;
        }

        // Rate limiting: Don't update more than once every 3 seconds unless it's a retry
        const now = Date.now();
        if (!isRetry && (now - this.lastDiscordUpdate) < 3000) {
            this.logger?.debug('ServiceCoordinator', 'Discord update rate limited, debouncing...');
            this.discordUpdateTimeout = setTimeout(() => {
                this.updateDiscordActivity(trackInfo, true);
            }, 3000 - (now - this.lastDiscordUpdate));
            return;
        }

        this.lastDiscordUpdate = now;

        try {
            let spotifyUrl = '';
            let largeImageUrl = '';
            let smallImageUrl = '';

            // Get Spotify URL if Spotify service is connected
            if (this.services.spotifyService && this.services.spotifyService.isConnected() && trackInfo.title && trackInfo.artist) {
                try {
                    spotifyUrl = await this.services.spotifyService.searchTrack(trackInfo.title, trackInfo.artist, trackInfo.album);
                    if (spotifyUrl) {
                        this.logger?.info('Spotify', `Found Spotify URL for ${trackInfo.title}`);
                    }
                } catch (error) {
                    this.logger?.warn('Spotify', `Failed to get Spotify URL: ${error.message}`);
                }
            }

            // Get album art URLs if Imgur service is connected and we have image keys
            this.logger?.debug('ServiceCoordinator', 'Checking Imgur upload conditions', {
                imgurService: !!this.services.imgurService,
                imgurConnected: this.services.imgurService?.isConnected(),
                roonService: !!this.services.roonService,
                roonConnected: this.services.roonService?.isConnected(),
                roonImage: !!this.services.roonService?.image,
                imageKey: trackInfo.image_key
            });

            // TEMPORARILY DISABLED: Image uploads might be causing Roon disconnections
            // Only upload to Imgur if Imgur is connected AND Roon is connected
            if (false && this.services.imgurService && this.services.imgurService.isConnected() &&
                this.services.roonService && this.services.roonService.isConnected() && this.services.roonService.image) {
                try {
                    // Upload album art (large image)
                    if (trackInfo.image_key) {
                        this.logger?.info('Imgur', `Uploading album art for ${trackInfo.title} with image key: ${trackInfo.image_key}`);

                        const largeImageResult = await this.services.imgurService.uploadRoonImage(this.services.roonService.image, trackInfo.image_key, {
                            scale: 'fit',
                            width: 512,
                            height: 512,
                            format: 'image/jpeg'
                        });

                        if (largeImageResult && largeImageResult.url) {
                            largeImageUrl = largeImageResult.url;
                            this.logger?.info('Imgur', `Uploaded album art for ${trackInfo.title}: ${largeImageUrl}`);
                        }
                    }

                    // Upload artist art (small image) if available
                    if (trackInfo.artist_image_key) {
                        this.logger?.info('Imgur', `Uploading artist art for ${trackInfo.artist} with image key: ${trackInfo.artist_image_key}`);

                        const smallImageResult = await this.services.imgurService.uploadRoonImage(this.services.roonService.image, trackInfo.artist_image_key, {
                            scale: 'fit',
                            width: 256,
                            height: 256,
                            format: 'image/jpeg'
                        });

                        if (smallImageResult && smallImageResult.url) {
                            smallImageUrl = smallImageResult.url;
                            this.logger?.info('Imgur', `Uploaded artist art for ${trackInfo.artist}: ${smallImageUrl}`);
                        }
                    } else {
                        // Fallback: use album art for small image if no artist art available
                        smallImageUrl = largeImageUrl;
                    }
                } catch (error) {
                    this.logger?.warn('Imgur', `Failed to upload images: ${error.message}`);
                }
            } else {
                this.logger?.debug('ServiceCoordinator', 'Imgur upload skipped - service not ready', {
                    imgurConnected: this.services.imgurService?.isConnected(),
                    hasImageKey: !!trackInfo.image_key
                });
            }

            // Set Discord activity with enhancements
            const success = await this.services.discordService.setTrackActivity({
                title: trackInfo.title,
                artist: trackInfo.artist,
                album: trackInfo.album,
                zoneName: trackInfo.zoneName,
                duration: trackInfo.duration,
                position: trackInfo.position,
                spotifyUrl: spotifyUrl,
                largeImageUrl: largeImageUrl,
                smallImageUrl: smallImageUrl
            });

            if (success) {
                this.logger?.info('Discord', 'Enhanced activity updated from Roon track change', {
                    hasSpotifyUrl: !!spotifyUrl,
                    hasLargeImage: !!largeImageUrl,
                    hasSmallImage: !!smallImageUrl
                });
            } else {
                this.logger?.warn('Discord', 'Failed to update enhanced activity from Roon track change');
            }

        } catch (error) {
            this.logger?.error('Discord', 'Error updating enhanced activity', error.message);

            // Fallback to basic activity
            try {
                await this.services.discordService.setTrackActivity({
                    title: trackInfo.title,
                    artist: trackInfo.artist,
                    album: trackInfo.album,
                    zoneName: trackInfo.zoneName,
                    duration: trackInfo.duration,
                    position: trackInfo.position
                });
                this.logger?.info('Discord', 'Fallback activity set successfully');
            } catch (fallbackError) {
                this.logger?.error('Discord', 'Fallback activity also failed', fallbackError.message);
            }
        }
    }

    /**
     * Get album art URL for track display in frontend
     */
    async getAlbumArtForTrack(trackInfo) {
        const imageKey = trackInfo?.image_key || trackInfo?.imageKey;

        if (!trackInfo || !imageKey || !this.services.roonService || !this.services.roonService.image) {
            this.logger?.debug('ServiceCoordinator', 'Missing required data for album art', {
                trackInfo: !!trackInfo,
                imageKey: imageKey,
                roonService: !!this.services.roonService,
                roonImage: !!this.services.roonService?.image
            });
            return null;
        }

        try {
            this.logger?.debug('ServiceCoordinator', `Getting album art for frontend display, image key: ${imageKey}`);

            // Get image from Roon as data URL for frontend display
            const imageData = await new Promise((resolve, reject) => {
                this.services.roonService.image.get_image(imageKey, {
                    scale: 'fit',
                    width: 300,
                    height: 300,
                    format: 'image/jpeg'
                }, (error, contentType, image) => {
                    if (error || !image) {
                        reject(new Error('Failed to get image from Roon'));
                        return;
                    }
                    resolve({ contentType, image });
                });
            });

            // Convert to data URL for frontend display
            const base64Image = imageData.image.toString('base64');
            const dataUrl = `data:${imageData.contentType};base64,${base64Image}`;

            this.logger?.debug('ServiceCoordinator', 'Album art data URL created for frontend');
            return dataUrl;

        } catch (error) {
            this.logger?.error('ServiceCoordinator', 'Error getting album art for frontend:', error);
            return null;
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.stopServices();
        this.isInitialized = false;
        this.logger?.info('ServiceCoordinator', 'Cleanup completed');
    }
}

module.exports = ServiceCoordinator;
