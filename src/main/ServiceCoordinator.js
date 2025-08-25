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
        // Initialize status monitor
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
     * Cleanup resources
     */
    async cleanup() {
        await this.stopServices();
        this.isInitialized = false;
        this.logger?.info('ServiceCoordinator', 'Cleanup completed');
    }
}

module.exports = ServiceCoordinator;
