#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('🚀 Roon Discord Rich Presence');
console.log('Starting application...');
console.log('');

// Get the directory where the executable is located
const exeDir = path.dirname(process.execPath);
const appDir = __dirname;

// Check if we're running from the compiled executable
const isCompiled = process.pkg !== undefined;

let workingDir;
if (isCompiled) {
    // When compiled, use the directory where the .exe is located
    workingDir = exeDir;
} else {
    // When running as script, use current directory
    workingDir = appDir;
}

console.log(`📍 Working directory: ${workingDir}`);

// Check for local Node.js installation
const localNodePath = path.join(workingDir, 'local-node', 'node-v16.20.2-win-x64', 'node.exe');

if (!fs.existsSync(localNodePath)) {
    console.error('❌ Local Node.js not found!');
    console.error(`Expected location: ${localNodePath}`);
    console.error('');
    console.error('Please ensure the complete application folder structure is present.');
    console.error('The local-node directory should be in the same folder as this executable.');
    console.error('');
    console.error('Press any key to exit...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(1));
    return;
}

// Check for Electron CLI
const electronCli = path.join(workingDir, 'node_modules', 'electron', 'cli.js');
if (!fs.existsSync(electronCli)) {
    console.error('❌ Electron CLI not found!');
    console.error(`Expected location: ${electronCli}`);
    console.error('');
    console.error('Please ensure the complete application folder structure is present.');
    console.error('');
    console.error('Press any key to exit...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(1));
    return;
}

console.log('✅ Local Node.js found');
console.log('✅ Electron CLI found');
console.log('');
console.log('🎵 Starting Roon Discord Rich Presence Electron App...');
console.log('');

// Start the Electron app with local Node.js
const child = spawn(localNodePath, [electronCli, '.'], {
    cwd: workingDir,
    stdio: ['ignore', 'ignore', 'ignore'], // Don't inherit stdio to allow detaching
    shell: false,
    detached: true // Allow the process to continue after launcher exits
});

let appStarted = false;

child.on('error', (error) => {
    console.error('❌ Failed to start application:', error.message);
    console.error('');
    waitForKeyPress('Press any key to exit...');
});

child.on('spawn', () => {
    appStarted = true;
    console.log('✅ Application started successfully');
    console.log('');
    console.log('🎵 Roon Discord Rich Presence Electron App is now running!');
    console.log('');
    console.log('📋 What happens next:');
    console.log('   • The Electron app window will open');
    console.log('   • The app will automatically set up configuration files');
    console.log('   • You can configure settings through the GUI');
    console.log('');
    console.log('💡 The app is now running independently.');
    console.log('   This console window will close automatically in 3 seconds...');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Unref the child process so launcher can exit
    child.unref();

    // Auto-close the console window after the app starts successfully
    setTimeout(() => {
        console.log('🚀 App running successfully. Closing launcher...');
        process.exit(0);
    }, 3000);
});

child.on('exit', (code, signal) => {
    if (signal) {
        console.log('');
        console.log(`🛑 Application stopped by signal: ${signal}`);
    } else if (code !== 0) {
        console.error('');
        console.error(`❌ Application exited with code ${code}`);
        console.error('');
        if (!appStarted) {
            console.error('The application failed to start properly.');
            console.error('Please check that all required files are present.');
        }
        waitForKeyPress('Press any key to exit...');
    } else {
        console.log('');
        console.log('✅ Application closed normally');
        // Don't wait for key press on normal exit
        setTimeout(() => process.exit(0), 1000);
    }
});

// Helper function to wait for key press
function waitForKeyPress(message) {
    console.log(message);
    try {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', () => {
            process.stdin.setRawMode(false);
            process.exit(1);
        });
    } catch (error) {
        // If we can't set raw mode, just exit after a delay
        setTimeout(() => process.exit(1), 3000);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('');
    console.log('🛑 Shutting down...');
    child.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('');
    console.log('🛑 Shutting down...');
    child.kill('SIGTERM');
});
