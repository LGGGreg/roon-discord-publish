/**
 * ServiceUtils - Utility functions for service management
 * Consolidates duplicate service-related functionality
 */

/**
 * Get status for all services
 * @param {Object} services - Object containing service instances
 * @returns {Object} Status object for all services
 */
function getAllServiceStatus(services = {}) {
    const status = {};
    
    if (services.discordService) {
        status.discord = services.discordService.getStats();
    }
    
    if (services.roonService) {
        status.roon = services.roonService.getStats();
    }
    
    if (services.spotifyService) {
        status.spotify = services.spotifyService.getStats();
    }
    
    if (services.imgurService) {
        status.imgur = services.imgurService.getStats();
    }
    
    return status;
}

/**
 * Reconnect all services
 * @param {Object} services - Object containing service instances
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} Results object with reconnection status for each service
 */
async function reconnectAllServices(services = {}, logger = null) {
    if (logger) {
        logger.info('System', 'Reconnecting all services');
    }
    
    const results = {};
    
    if (services.discordService) {
        results.discord = await services.discordService.reconnect(true);
    }
    
    if (services.roonService) {
        results.roon = await services.roonService.reconnect(true);
    }
    
    if (services.spotifyService) {
        results.spotify = await services.spotifyService.reconnect(true);
    }
    
    if (services.imgurService) {
        results.imgur = await services.imgurService.reconnect(true);
    }
    
    return results;
}

/**
 * Create generic IPC handler for service operations
 * @param {string} serviceName - Name of the service (lowercase)
 * @param {Object} serviceInstance - The service instance
 * @param {Object} logger - Logger instance
 * @returns {Object} Object containing IPC handlers for the service
 */
function createServiceIPCHandlers(serviceName, serviceInstance, logger = null) {
    const capitalizedName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
    
    return {
        [`${serviceName}-connect`]: async () => {
            if (!serviceInstance) return false;
            if (logger) {
                logger.info(capitalizedName, 'Manual connection requested');
            }
            return await serviceInstance.reconnect(true);
        },
        
        [`${serviceName}-disconnect`]: async () => {
            if (!serviceInstance) return false;
            if (logger) {
                logger.info(capitalizedName, 'Manual disconnection requested');
            }
            return await serviceInstance.disconnect();
        },
        
        [`${serviceName}-status`]: () => {
            if (!serviceInstance) return null;
            return serviceInstance.getStats();
        }
    };
}

/**
 * Register multiple IPC handlers at once
 * @param {Object} ipcMain - Electron's ipcMain instance
 * @param {Object} handlers - Object with handler names as keys and functions as values
 */
function registerIPCHandlers(ipcMain, handlers) {
    Object.entries(handlers).forEach(([handlerName, handlerFunction]) => {
        ipcMain.handle(handlerName, handlerFunction);
    });
}

/**
 * Validate service configuration
 * @param {string} serviceName - Name of the service
 * @param {Object} config - Configuration object
 * @returns {Object} Validation result with valid flag and error message
 */
function validateServiceConfig(serviceName, config) {
    switch (serviceName.toLowerCase()) {
        case 'discord':
            if (!config.discord?.clientId) {
                return { valid: false, error: 'Discord Client ID is required' };
            }
            return { valid: true };
            
        case 'spotify':
            if (!config.spotify?.client || !config.spotify?.secret) {
                return { valid: false, error: 'Spotify Client ID and Secret are required' };
            }
            return { valid: true };
            
        case 'imgur':
            if (!config.imgur?.clientId) {
                return { valid: false, error: 'Imgur Client ID is required' };
            }
            return { valid: true };
            
        case 'roon':
            // Roon can work with discovery or manual IP
            return { valid: true };
            
        default:
            return { valid: false, error: `Unknown service: ${serviceName}` };
    }
}

/**
 * Create and register all service IPC handlers at once
 * @param {Object} ipcMain - Electron's ipcMain instance
 * @param {Object} services - Object containing all service instances
 * @param {Object} logger - Logger instance
 */
function registerAllServiceIPCHandlers(ipcMain, services, logger) {
    const serviceNames = ['discord', 'roon', 'spotify', 'imgur'];

    serviceNames.forEach(serviceName => {
        const serviceInstance = services[`${serviceName}Service`];
        if (serviceInstance) {
            const handlers = createServiceIPCHandlers(serviceName, serviceInstance, logger);
            registerIPCHandlers(ipcMain, handlers);
        }
    });
}

module.exports = {
    getAllServiceStatus,
    reconnectAllServices,
    createServiceIPCHandlers,
    registerIPCHandlers,
    registerAllServiceIPCHandlers,
    validateServiceConfig
};
