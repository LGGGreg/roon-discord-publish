const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * ConfigManager - Handles configuration loading, validation, and persistence
 * Preserves existing API keys and settings while providing a clean interface
 */
class ConfigManager extends EventEmitter {
    constructor(configPath = null) {
        super();
        
        // Default config path relative to project root
        this.configPath = configPath || path.join(__dirname, '../../config.json');
        this.exampleConfigPath = path.join(__dirname, '../../config.example.json');
        
        // Current configuration
        this.config = {};

        // File watcher for config changes
        this.watcher = null;

        // Default configuration structure
        this.defaultConfig = {
            core_ip: "",
            zone_id: "",
            discord: {
                clientId: ""
            },
            imgur: {
                clientId: "",
                clientSecret: ""
            },
            spotify: {
                client: "",
                secret: ""
            },
            app: {
                use_discovery: true,
                minimize_to_tray: true
            },
            roonstate: {
                tokens: {},
                paired_core_id: ""
            }
        };
        
        // Load configuration on initialization
        this.loadConfig();

        // Start watching for config file changes
        this.startWatching();
    }
    
    /**
     * Load configuration from file
     * @returns {Object} The loaded configuration
     */
    loadConfig(isReload = false) {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const newConfig = JSON.parse(configData);

                // Merge with defaults to ensure all required fields exist
                const mergedConfig = this.mergeWithDefaults(newConfig);

                // If this is a reload, detect changes and emit events
                if (isReload && this.config) {
                    this.detectAndEmitChanges(this.config, mergedConfig);
                }

                this.config = mergedConfig;

                this.emit('config-loaded', this.config);
                console.log('Configuration loaded successfully');
                return this.config;
            } else {
                console.log('Config file not found, creating from defaults');
                this.config = { ...this.defaultConfig };
                this.saveConfig();
                return this.config;
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.emit('config-error', error);
            
            // Fall back to defaults
            this.config = { ...this.defaultConfig };
            return this.config;
        }
    }
    
    /**
     * Save configuration to file
     * @param {Object} newConfig - Optional new configuration to save
     * @returns {boolean} Success status
     */
    saveConfig(newConfig = null) {
        try {
            const oldConfig = { ...this.config };

            if (newConfig) {
                this.config = this.mergeWithDefaults(newConfig);
            }

            const configJson = JSON.stringify(this.config, null, 4);
            fs.writeFileSync(this.configPath, configJson, 'utf8');

            // Emit config-changed events for any changes
            if (newConfig) {
                this.detectAndEmitChanges(oldConfig, this.config);
            }

            this.emit('config-saved', this.config);
            console.log('Configuration saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.emit('config-error', error);
            return false;
        }
    }
    
    /**
     * Merge configuration with defaults, preserving existing values
     * @param {Object} config - Configuration to merge
     * @returns {Object} Merged configuration
     */
    mergeWithDefaults(config) {
        const merged = JSON.parse(JSON.stringify(this.defaultConfig));
        
        // Deep merge function
        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        };
        
        deepMerge(merged, config);
        return merged;
    }
    
    /**
     * Get configuration value by path
     * @param {string} path - Dot notation path (e.g., 'discord.clientId')
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} Configuration value
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }
    
    /**
     * Set configuration value by path
     * @param {string} path - Dot notation path (e.g., 'discord.clientId')
     * @param {*} value - Value to set
     * @param {boolean} save - Whether to save immediately
     * @returns {boolean} Success status
     */
    set(path, value, save = false) {
        try {
            const keys = path.split('.');
            let target = this.config;
            
            // Navigate to parent object
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                target = target[key];
            }
            
            // Set the value
            target[keys[keys.length - 1]] = value;
            
            this.emit('config-changed', path, value);
            
            if (save) {
                return this.saveConfig();
            }
            
            return true;
        } catch (error) {
            console.error('Error setting configuration value:', error);
            this.emit('config-error', error);
            return false;
        }
    }
    
    /**
     * Validate configuration
     * @returns {Object} Validation result with isValid and errors
     */
    validate() {
        const errors = [];
        
        // Check required Discord settings
        if (!this.get('discord.clientId')) {
            errors.push('Discord Client ID is required');
        }
        
        // Check Spotify settings if provided
        const spotifyClient = this.get('spotify.client');
        const spotifySecret = this.get('spotify.secret');
        if ((spotifyClient && !spotifySecret) || (!spotifyClient && spotifySecret)) {
            errors.push('Both Spotify Client ID and Secret are required if using Spotify');
        }
        
        // Check Imgur settings if provided
        // Note: Client Secret is optional for anonymous uploads
        const imgurClientId = this.get('imgur.clientId');
        if (imgurClientId && imgurClientId.trim() === '') {
            errors.push('Imgur Client ID cannot be empty if provided');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Get all configuration
     * @returns {Object} Complete configuration object
     */
    getAll() {
        return { ...this.config };
    }
    
    /**
     * Reset configuration to defaults (preserving Roon pairing)
     * @param {boolean} preserveRoonPairing - Whether to preserve Roon pairing data
     * @returns {boolean} Success status
     */
    reset(preserveRoonPairing = true) {
        try {
            const roonState = preserveRoonPairing ? this.config.roonstate : {};
            
            this.config = { ...this.defaultConfig };
            
            if (preserveRoonPairing && roonState) {
                this.config.roonstate = roonState;
            }
            
            this.emit('config-reset');
            return this.saveConfig();
        } catch (error) {
            console.error('Error resetting configuration:', error);
            this.emit('config-error', error);
            return false;
        }
    }
    
    /**
     * Export configuration to JSON string
     * @param {boolean} includeSecrets - Whether to include sensitive data
     * @returns {string} JSON configuration
     */
    export(includeSecrets = false) {
        const exportConfig = { ...this.config };
        
        if (!includeSecrets) {
            // Remove sensitive data
            if (exportConfig.discord) delete exportConfig.discord.clientId;
            if (exportConfig.spotify) {
                delete exportConfig.spotify.client;
                delete exportConfig.spotify.secret;
            }
            if (exportConfig.imgur) {
                delete exportConfig.imgur.clientId;
                delete exportConfig.imgur.clientSecret;
            }
            if (exportConfig.roonstate) {
                delete exportConfig.roonstate.tokens;
                delete exportConfig.roonstate.paired_core_id;
            }
        }
        
        return JSON.stringify(exportConfig, null, 4);
    }
    
    /**
     * Import configuration from JSON string
     * @param {string} jsonConfig - JSON configuration string
     * @param {boolean} merge - Whether to merge with existing config
     * @returns {boolean} Success status
     */
    import(jsonConfig, merge = true) {
        try {
            const importedConfig = JSON.parse(jsonConfig);
            
            if (merge) {
                this.config = this.mergeWithDefaults({ ...this.config, ...importedConfig });
            } else {
                this.config = this.mergeWithDefaults(importedConfig);
            }
            
            this.emit('config-imported', this.config);
            return this.saveConfig();
        } catch (error) {
            console.error('Error importing configuration:', error);
            this.emit('config-error', error);
            return false;
        }
    }

    /**
     * Detect changes between old and new config and emit change events
     */
    detectAndEmitChanges(oldConfig, newConfig) {
        const changes = this.getConfigChanges(oldConfig, newConfig);

        for (const change of changes) {
            console.log(`Config changed: ${change.path} = ${change.newValue}`);
            this.emit('config-changed', change.path, change.newValue);
        }
    }

    /**
     * Get list of changes between two config objects
     */
    getConfigChanges(oldConfig, newConfig, prefix = '') {
        const changes = [];

        const checkObject = (oldObj, newObj, path) => {
            // Check all keys in new object
            for (const key in newObj) {
                const fullPath = path ? `${path}.${key}` : key;
                const oldValue = oldObj ? oldObj[key] : undefined;
                const newValue = newObj[key];

                if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
                    // Recursively check nested objects
                    checkObject(oldValue, newValue, fullPath);
                } else if (oldValue !== newValue) {
                    // Value changed
                    changes.push({
                        path: fullPath,
                        oldValue: oldValue,
                        newValue: newValue
                    });
                }
            }
        };

        checkObject(oldConfig, newConfig, prefix);
        return changes;
    }

    /**
     * Start watching config file for changes
     */
    startWatching() {
        if (this.watcher) {
            this.watcher.close();
        }

        try {
            this.watcher = fs.watch(this.configPath, (eventType, filename) => {
                if (eventType === 'change') {
                    console.log('Config file changed, reloading...');

                    // Debounce rapid file changes
                    clearTimeout(this.reloadTimeout);
                    this.reloadTimeout = setTimeout(() => {
                        this.loadConfig(true); // Pass true to indicate this is a reload
                        this.emit('config-reloaded', this.config);
                    }, 500);
                }
            });

            console.log('Started watching config file for changes');
        } catch (error) {
            console.warn('Could not watch config file:', error.message);
        }
    }

    /**
     * Stop watching config file
     */
    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            console.log('Stopped watching config file');
        }
    }
}

module.exports = ConfigManager;
