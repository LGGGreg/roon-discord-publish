#!/usr/bin/env node

/**
 * Command-line test script for ConfigManager
 * Usage: node test-config.js [command] [options]
 */

const ConfigManager = require('./src/core/ConfigManager');
const fs = require('fs');
const path = require('path');

// Create ConfigManager instance
const configManager = new ConfigManager();

// Command handlers
const commands = {
    async load() {
        console.log('Loading configuration...');
        const config = configManager.loadConfig();
        console.log('Configuration loaded:');
        console.log(JSON.stringify(config, null, 2));
        return config;
    },

    async save() {
        console.log('Saving configuration...');
        const success = configManager.saveConfig();
        console.log('Save result:', success ? 'SUCCESS' : 'FAILED');
        return success;
    },

    async get(path, defaultValue) {
        console.log(`Getting config value for path: ${path}`);
        const value = configManager.get(path, defaultValue);
        console.log('Value:', value);
        return value;
    },

    async set(path, value, save = false) {
        console.log(`Setting config value: ${path} = ${value}`);
        const success = configManager.set(path, value, save);
        console.log('Set result:', success ? 'SUCCESS' : 'FAILED');
        if (save) {
            console.log('Configuration saved automatically');
        }
        return success;
    },

    async validate() {
        console.log('Validating configuration...');
        const validation = configManager.validate();
        console.log('Validation result:');
        console.log('- Valid:', validation.isValid);
        if (validation.errors.length > 0) {
            console.log('- Errors:');
            validation.errors.forEach(error => console.log(`  * ${error}`));
        }
        return validation;
    },

    async export(includeSecrets = false, filename = null) {
        console.log(`Exporting configuration (includeSecrets: ${includeSecrets})...`);
        const exportData = configManager.export(includeSecrets);
        
        if (filename) {
            const exportPath = path.resolve(filename);
            fs.writeFileSync(exportPath, exportData, 'utf8');
            console.log(`Configuration exported to: ${exportPath}`);
        } else {
            console.log('Exported configuration:');
            console.log(exportData);
        }
        
        return exportData;
    },

    async import(filename, merge = true) {
        console.log(`Importing configuration from: ${filename} (merge: ${merge})...`);
        
        if (!fs.existsSync(filename)) {
            console.error('File not found:', filename);
            return false;
        }
        
        const importData = fs.readFileSync(filename, 'utf8');
        const success = configManager.import(importData, merge);
        console.log('Import result:', success ? 'SUCCESS' : 'FAILED');
        
        if (success) {
            console.log('Updated configuration:');
            console.log(JSON.stringify(configManager.getAll(), null, 2));
        }
        
        return success;
    },

    async reset(preserveRoonPairing = true) {
        console.log(`Resetting configuration (preserveRoonPairing: ${preserveRoonPairing})...`);
        const success = configManager.reset(preserveRoonPairing);
        console.log('Reset result:', success ? 'SUCCESS' : 'FAILED');
        
        if (success) {
            console.log('Configuration after reset:');
            console.log(JSON.stringify(configManager.getAll(), null, 2));
        }
        
        return success;
    },

    async stats() {
        console.log('Configuration statistics:');
        const config = configManager.getAll();
        
        console.log('- Discord configured:', !!config.discord?.clientId);
        console.log('- Spotify configured:', !!(config.spotify?.client && config.spotify?.secret));
        console.log('- Imgur configured:', !!config.imgur?.clientId);
        console.log('- Roon paired:', !!config.roonstate?.paired_core_id);
        console.log('- Core IP set:', !!config.core_ip);
        console.log('- Zone ID set:', !!config.zone_id);
        
        return config;
    },

    help() {
        console.log(`
ConfigManager Test Script

Usage: node test-config.js <command> [options]

Commands:
  load                          Load and display current configuration
  save                          Save current configuration
  get <path> [defaultValue]     Get configuration value by path
  set <path> <value> [save]     Set configuration value
  validate                      Validate current configuration
  export [secrets] [filename]   Export configuration (secrets: true/false, filename: optional)
  import <filename> [merge]     Import configuration (merge: true/false)
  reset [preserveRoon]          Reset to defaults (preserveRoon: true/false)
  stats                         Show configuration statistics
  help                          Show this help

Examples:
  node test-config.js load
  node test-config.js get discord.clientId
  node test-config.js set discord.clientId "123456789" true
  node test-config.js export true config-backup.json
  node test-config.js import config-backup.json true
  node test-config.js validate
  node test-config.js stats
        `);
    }
};

// Parse command line arguments
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        commands.help();
        return;
    }
    
    const command = args[0];
    const params = args.slice(1);
    
    if (!commands[command]) {
        console.error(`Unknown command: ${command}`);
        commands.help();
        process.exit(1);
    }
    
    try {
        // Set up event listeners for debugging
        configManager.on('config-loaded', () => console.log('Event: config-loaded'));
        configManager.on('config-saved', () => console.log('Event: config-saved'));
        configManager.on('config-changed', (path, value) => console.log(`Event: config-changed - ${path} = ${value}`));
        configManager.on('config-error', (error) => console.log(`Event: config-error - ${error.message}`));
        
        await commands[command](...params);
    } catch (error) {
        console.error('Error executing command:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { commands, configManager };
