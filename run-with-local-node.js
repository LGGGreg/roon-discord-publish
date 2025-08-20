#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const NODE_VERSION = '16.20.2';
const PLATFORM = process.platform === 'win32' ? 'win' : process.platform;
const ARCH = process.arch === 'x64' ? 'x64' : process.arch;
const NODE_DIR = path.join(__dirname, 'local-node');
const NODE_FILENAME = PLATFORM === 'win' ? `node-v${NODE_VERSION}-${PLATFORM}-${ARCH}` : `node-v${NODE_VERSION}-${PLATFORM}-${ARCH}`;

// Find local node executable
const localNodePath = PLATFORM === 'win' 
    ? path.join(NODE_DIR, NODE_FILENAME, 'node.exe')
    : path.join(NODE_DIR, NODE_FILENAME, 'bin', 'node');

const localNpmPath = PLATFORM === 'win' 
    ? path.join(NODE_DIR, NODE_FILENAME, 'npm.cmd')
    : path.join(NODE_DIR, NODE_FILENAME, 'bin', 'npm');

console.log('🔍 Checking for local Node.js installation...');

if (!fs.existsSync(localNodePath)) {
    console.error('❌ Local Node.js not found!');
    console.log('');
    console.log('🔧 To set up local Node.js:');
    console.log('   npm run setup-local-node');
    console.log('');
    process.exit(1);
}

// Check if config.json exists
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    console.error('❌ Error: config.json not found!');
    console.log('📝 Please copy config.example.json to config.json and fill in your settings.');
    console.log('   See README.md for setup instructions.');
    process.exit(1);
}

// Check if node_modules exists, if not install dependencies with local npm
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 Installing dependencies with local Node.js...');
    
    const npmInstall = spawn(localNpmPath, ['install'], {
        stdio: 'inherit',
        cwd: __dirname,
        shell: true
    });
    
    npmInstall.on('close', (code) => {
        if (code !== 0) {
            console.error('❌ Failed to install dependencies');
            process.exit(1);
        }
        
        console.log('✅ Dependencies installed!');
        startApplication();
    });
    
    npmInstall.on('error', (error) => {
        console.error('❌ Failed to run npm install:', error.message);
        process.exit(1);
    });
} else {
    startApplication();
}

function startApplication() {
    console.log('🚀 Starting Roon Discord Rich Presence with local Node.js...');
    console.log(`📍 Using Node.js: ${localNodePath}`);
    
    // Start the main application with local Node.js
    const app = spawn(localNodePath, ['roon-discord-publish.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });
    
    app.on('close', (code) => {
        console.log(`\n📋 Application exited with code ${code}`);
    });
    
    app.on('error', (error) => {
        console.error('❌ Failed to start application:', error.message);
        process.exit(1);
    });
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping application...');
        app.kill('SIGINT');
    });
}
