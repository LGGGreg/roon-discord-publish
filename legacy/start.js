#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if config.json exists
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    console.error('❌ Error: config.json not found!');
    console.log('📝 Please copy config.example.json to config.json and fill in your settings.');
    console.log('   See README.md for setup instructions.');
    process.exit(1);
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

console.log(`🔍 Current Node.js version: ${nodeVersion}`);

if (majorVersion >= 17) {
    console.error('❌ Error: This project requires Node.js 16.x for compatibility with the Roon API.');
    console.log('');
    console.log('🔧 Solutions:');
    console.log('');
    console.log('   Option 1 - Use Local Node.js (Recommended):');
    console.log('   1. Run: npm run setup-local-node');
    console.log('   2. Run: npm run local');
    console.log('');
    console.log('   Option 2 - Use Node Version Manager:');
    console.log('   1. Install nvm (nvm-windows on Windows)');
    console.log('   2. Run: nvm install 16.20.2 && nvm use 16.20.2');
    console.log('   3. Run: npm start');
    console.log('');
    console.log('   Option 3 - Install Node.js 16.x directly:');
    console.log('   1. Download from: https://nodejs.org/dist/v16.20.2/');
    console.log('   2. Install (replaces current Node.js)');
    console.log('   3. Run: npm start');
    console.log('');
    process.exit(1);
}

if (majorVersion < 16) {
    console.error('❌ Error: This project requires Node.js 16.x or higher.');
    console.log('Please upgrade your Node.js version.');
    process.exit(1);
}

console.log('✅ Node.js version is compatible!');
console.log('🚀 Starting Roon Discord Rich Presence...');
console.log('');

// Start the main application
require('./roon-discord-publish.js');
