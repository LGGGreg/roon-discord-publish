#!/usr/bin/env node

/**
 * Command-line service testing tool
 * Usage: node test-services.js [service] [command] [options]
 */

const ConfigManager = require('./src/core/ConfigManager');
const DiscordService = require('./src/core/DiscordService');
const RoonService = require('./src/core/RoonService');
const Logger = require('./src/utils/Logger');

// Initialize logger with debug level for testing
const logger = new Logger({
    level: Logger.LogLevel.DEBUG,
    enableConsole: true,
    enableFile: true,
    enableGui: false
});

// Initialize config manager
const configManager = new ConfigManager();

// Service instances
let discordService = null;
let roonService = null;

// Service testers
const serviceTesters = {
    async discord(command, ...args) {
        console.log('\n=== Discord Service Test ===');
        
        if (!discordService) {
            discordService = new DiscordService(configManager);
            
            // Set up event listeners
            discordService.on('state-changed', (event) => {
                logger.info('Discord', `State: ${event.oldState} -> ${event.newState}`, {
                    details: event.details,
                    error: event.error?.message
                });
            });
            
            discordService.on('discord-ready', (user) => {
                logger.info('Discord', `Ready for user: ${user.username}#${user.discriminator}`, user);
            });
            
            discordService.on('activity-set', (activity) => {
                logger.info('Discord', 'Activity set', activity);
            });
            
            discordService.on('activity-error', (error) => {
                logger.error('Discord', 'Activity error', error.message);
            });
        }
        
        switch (command) {
            case 'connect':
                logger.info('Discord', 'Testing connection...');
                const connected = await discordService.reconnect(true);
                logger.info('Discord', `Connection result: ${connected ? 'SUCCESS' : 'FAILED'}`);
                break;
                
            case 'disconnect':
                logger.info('Discord', 'Disconnecting...');
                await discordService.disconnect();
                break;
                
            case 'status':
                const stats = discordService.getStats();
                logger.info('Discord', 'Service status', stats);
                break;
                
            case 'activity':
                const title = args[0] || 'Test Song';
                const artist = args[1] || 'Test Artist';
                const album = args[2] || 'Test Album';

                // Connect first if not connected
                if (!discordService.isConnected()) {
                    logger.info('Discord', 'Not connected, connecting first...');
                    await discordService.reconnect(true);
                    // Wait a moment for connection to stabilize
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                logger.info('Discord', `Setting test activity: ${title} by ${artist}`);
                const success = await discordService.setTrackActivity({
                    title,
                    artist,
                    album,
                    zoneName: 'Test Zone',
                    duration: 180,
                    position: 30
                });
                logger.info('Discord', `Activity set result: ${success ? 'SUCCESS' : 'FAILED'}`);
                break;
                
            case 'clear':
                logger.info('Discord', 'Clearing activity...');
                await discordService.clearActivity();
                break;
                
            case 'health':
                logger.info('Discord', 'Performing health check...');
                const healthy = await discordService.performHealthCheck();
                logger.info('Discord', `Health check result: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
                break;
                
            default:
                console.log(`
Discord Commands:
  connect                    - Test Discord connection
  disconnect                 - Disconnect from Discord
  status                     - Show service status
  activity [title] [artist] [album] - Set test activity
  clear                      - Clear Discord activity
  health                     - Perform health check
                `);
        }
    },
    
    async roon(command, ...args) {
        console.log('\n=== Roon Service Test ===');

        if (!roonService) {
            roonService = new RoonService(configManager);

            // Set up event listeners
            roonService.on('state-changed', (event) => {
                logger.info('Roon', `State: ${event.oldState} -> ${event.newState}`, {
                    details: event.details,
                    error: event.error?.message
                });
            });

            roonService.on('core-paired', (core) => {
                logger.info('Roon', `Core paired: ${core.display_name}`, core);
            });

            roonService.on('zones-updated', (zones) => {
                logger.info('Roon', `Zones updated: ${zones.length} zones available`);
            });

            roonService.on('zone-selected', (zone) => {
                logger.info('Roon', `Zone selected: ${zone.display_name}`);
            });

            roonService.on('track-changed', (track) => {
                const trackInfo = roonService.getCurrentTrack();
                logger.info('Roon', `Track changed: ${trackInfo?.title || 'Unknown'}`, trackInfo);
            });
        }

        switch (command) {
            case 'connect':
                logger.info('Roon', 'Testing connection...');
                const connected = await roonService.reconnect(true);
                logger.info('Roon', `Connection result: ${connected ? 'SUCCESS' : 'FAILED'}`);
                break;

            case 'disconnect':
                logger.info('Roon', 'Disconnecting...');
                await roonService.disconnect();
                break;

            case 'status':
                const stats = roonService.getStats();
                logger.info('Roon', 'Service status', stats);
                break;

            case 'zones':
                logger.info('Roon', 'Getting available zones...');
                const zones = roonService.getZones();
                logger.info('Roon', `Available zones (${zones.length})`, zones);
                break;

            case 'track':
                logger.info('Roon', 'Getting current track...');
                const track = roonService.getCurrentTrack();
                logger.info('Roon', 'Current track', track);
                break;

            case 'zone':
                const zoneId = args[0];
                if (zoneId) {
                    logger.info('Roon', `Setting zone to: ${zoneId}`);
                    const success = roonService.setCurrentZone(zoneId);
                    logger.info('Roon', `Zone set result: ${success ? 'SUCCESS' : 'FAILED'}`);
                } else {
                    logger.info('Roon', 'Current zone info');
                    const currentZone = roonService.currentZone;
                    logger.info('Roon', 'Current zone', currentZone);
                }
                break;

            case 'health':
                logger.info('Roon', 'Performing health check...');
                const healthy = await roonService.performHealthCheck();
                logger.info('Roon', `Health check result: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
                break;

            default:
                console.log(`
Roon Commands:
  connect                    - Test Roon connection
  disconnect                 - Disconnect from Roon
  status                     - Show service status
  zones                      - List available zones
  track                      - Get current track info
  zone [zone_id]             - Set/get current zone
  health                     - Perform health check
                `);
        }
    },
    
    async spotify(command, ...args) {
        console.log('\n=== Spotify Service Test ===');

        const SpotifyService = require('../../src/core/SpotifyService');
        const ConfigManager = require('../../src/core/ConfigManager');

        const configManager = new ConfigManager();
        await configManager.loadConfig();
        const config = configManager.getConfig();

        if (!config.spotify?.client || !config.spotify?.secret) {
            console.log('❌ Spotify not configured. Please set up Spotify credentials in config.json');
            return;
        }

        const spotifyService = new SpotifyService(config.spotify, logger);

        switch (command) {
            case 'auth':
                logger.info('Spotify', 'Testing Spotify authentication...');
                try {
                    await spotifyService.start();
                    if (spotifyService.isConnected()) {
                        console.log('✅ Spotify authentication successful');
                    } else {
                        console.log('❌ Spotify authentication failed');
                    }
                } catch (error) {
                    console.log('❌ Spotify authentication error:', error.message);
                }
                break;

            case 'search':
                logger.info('Spotify', 'Testing Spotify search...');
                const title = args[0] || 'Bohemian Rhapsody';
                const artist = args[1] || 'Queen';
                try {
                    await spotifyService.start();
                    const url = await spotifyService.searchTrack(title, artist);
                    if (url) {
                        console.log(`✅ Found Spotify URL: ${url}`);
                    } else {
                        console.log('❌ No Spotify URL found');
                    }
                } catch (error) {
                    console.log('❌ Spotify search error:', error.message);
                }
                break;

            default:
                console.log(`
Spotify Commands:
  auth                    - Test Spotify authentication
  search [title] [artist] - Test Spotify search functionality
                `);
        }

        if (spotifyService) {
            await spotifyService.stop();
        }
    },
    
    async imgur(command, ...args) {
        console.log('\n=== Imgur Service Test ===');

        const ImgurService = require('../../src/core/ImgurService');
        const ConfigManager = require('../../src/core/ConfigManager');

        const configManager = new ConfigManager();
        await configManager.loadConfig();
        const config = configManager.getConfig();

        if (!config.imgur?.clientId) {
            console.log('❌ Imgur not configured. Please set up Imgur client ID in config.json');
            return;
        }

        const imgurService = new ImgurService(config.imgur, logger);

        switch (command) {
            case 'auth':
                logger.info('Imgur', 'Testing Imgur authentication...');
                try {
                    await imgurService.start();
                    if (imgurService.isConnected()) {
                        console.log('✅ Imgur authentication successful');
                    } else {
                        console.log('❌ Imgur authentication failed');
                    }
                } catch (error) {
                    console.log('❌ Imgur authentication error:', error.message);
                }
                break;

            case 'upload':
                logger.info('Imgur', 'Testing image upload...');
                const imagePath = args[0];
                if (!imagePath) {
                    console.log('❌ Please provide an image path');
                    break;
                }

                try {
                    const fs = require('fs');
                    if (!fs.existsSync(imagePath)) {
                        console.log('❌ Image file not found:', imagePath);
                        break;
                    }

                    await imgurService.start();
                    const imageData = fs.readFileSync(imagePath);
                    const result = await imgurService.uploadImage(imageData, 'test-upload');

                    if (result && result.url) {
                        console.log(`✅ Image uploaded successfully: ${result.url}`);
                    } else {
                        console.log('❌ Image upload failed');
                    }
                } catch (error) {
                    console.log('❌ Image upload error:', error.message);
                }
                break;

            default:
                console.log(`
Imgur Commands:
  auth                    - Test Imgur authentication
  upload <image-path>     - Test image upload
                `);
        }

        if (imgurService) {
            await imgurService.stop();
        }
    },
    
    async all(command) {
        console.log('\n=== All Services Test ===');
        
        switch (command) {
            case 'status':
                logger.info('System', 'Checking all service statuses...');
                await serviceTesters.discord('status');
                await serviceTesters.roon('status');
                await serviceTesters.spotify('auth');
                await serviceTesters.imgur('auth');
                break;
                
            case 'connect':
                logger.info('System', 'Connecting all services...');
                await serviceTesters.discord('connect');
                await serviceTesters.roon('connect');
                await serviceTesters.spotify('auth');
                await serviceTesters.imgur('auth');
                break;

            case 'disconnect':
                logger.info('System', 'Disconnecting all services...');
                await serviceTesters.discord('disconnect');
                await serviceTesters.roon('disconnect');
                console.log('✅ All services disconnected');
                break;
                
            default:
                console.log(`
All Services Commands:
  status                     - Check all service statuses
  connect                    - Connect all services
  disconnect                 - Disconnect all services
                `);
        }
    },
    
    help() {
        console.log(`
Service Testing Tool

Usage: node test-services.js <service> <command> [options]

Services:
  discord                    - Test Discord RPC service
  roon                       - Test Roon API service
  spotify                    - Test Spotify API service
  imgur                      - Test Imgur API service
  all                        - Test all services
  config                     - Configuration testing
  logs                       - Log management

Examples:
  node test-services.js discord connect
  node test-services.js discord activity "My Song" "My Artist"
  node test-services.js all status
  node test-services.js config validate
  node test-services.js logs recent

Use 'node test-services.js <service>' for service-specific help.
        `);
    },
    
    async config(command, ...args) {
        console.log('\n=== Configuration Test ===');
        
        switch (command) {
            case 'validate':
                const validation = configManager.validate();
                logger.info('Config', 'Validation result', validation);
                break;
                
            case 'show':
                const config = configManager.getAll();
                // Hide sensitive data
                const safeConfig = JSON.parse(JSON.stringify(config));
                if (safeConfig.discord?.clientId) safeConfig.discord.clientId = '***';
                if (safeConfig.spotify?.secret) safeConfig.spotify.secret = '***';
                if (safeConfig.imgur?.clientSecret) safeConfig.imgur.clientSecret = '***';
                logger.info('Config', 'Current configuration', safeConfig);
                break;
                
            case 'test':
                logger.info('Config', 'Testing configuration...');
                await serviceTesters.config('validate');
                await serviceTesters.all('status');
                break;
                
            default:
                console.log(`
Configuration Commands:
  validate                   - Validate current configuration
  show                       - Show current configuration (safe)
  test                       - Test configuration and services
                `);
        }
    },
    
    async logs(command, ...args) {
        console.log('\n=== Log Management ===');
        
        switch (command) {
            case 'recent':
                const count = parseInt(args[0]) || 20;
                const recentLogs = logger.getRecentLogs(count);
                console.log(`\nRecent ${count} log entries:`);
                recentLogs.forEach(line => console.log(line));
                break;
                
            case 'stats':
                const stats = logger.getStats();
                logger.info('Logs', 'Logger statistics', stats);
                break;
                
            case 'clear':
                logger.clearLogs();
                logger.info('Logs', 'Log file cleared');
                break;
                
            case 'level':
                const levelName = args[0]?.toUpperCase();
                if (levelName && Logger.LogLevel[levelName] !== undefined) {
                    logger.setLevel(Logger.LogLevel[levelName]);
                } else {
                    console.log('Available log levels: ERROR, WARN, INFO, DEBUG, TRACE');
                    console.log(`Current level: ${Logger.LogLevelNames[logger.options.level]}`);
                }
                break;
                
            default:
                console.log(`
Log Commands:
  recent [count]             - Show recent log entries
  stats                      - Show logger statistics
  clear                      - Clear current log file
  level [LEVEL]              - Set/show log level
                `);
        }
    }
};

// Main function
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        serviceTesters.help();
        return;
    }
    
    const service = args[0];
    const command = args[1] || 'help';
    const params = args.slice(2);
    
    if (!serviceTesters[service]) {
        console.error(`Unknown service: ${service}`);
        serviceTesters.help();
        process.exit(1);
    }
    
    try {
        logger.info('System', `Starting test: ${service} ${command}`, { params });
        await serviceTesters[service](command, ...params);
        logger.info('System', 'Test completed');
        
        // Keep process alive for a moment to see results
        if (service === 'discord' && ['connect', 'activity'].includes(command)) {
            console.log('\nKeeping process alive for 10 seconds to observe results...');
            setTimeout(() => {
                logger.info('System', 'Test session ending');
                process.exit(0);
            }, 10000);
        } else {
            process.exit(0);
        }
    } catch (error) {
        logger.error('System', 'Test failed', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Handle cleanup
process.on('SIGINT', async () => {
    logger.info('System', 'Received SIGINT, cleaning up...');
    if (discordService) {
        await discordService.destroy();
    }
    process.exit(0);
});

// Run the script
if (require.main === module) {
    main();
}

module.exports = { serviceTesters, logger, configManager };
