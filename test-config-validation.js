#!/usr/bin/env node

/**
 * Simple test runner for config validation without HTML report server
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Running config validation test...');

// Use local node installation
const localNodePath = path.join(__dirname, 'local-node', 'node-v16.20.2-win-x64', 'node.exe');
const playwrightCliPath = path.join(__dirname, 'node_modules', '@playwright', 'test', 'cli.js');

// Run playwright test with minimal reporters
const testProcess = spawn(localNodePath, [
    playwrightCliPath,
    'test',
    'test/e2e/config-validation.test.js',
    '--reporter=list',
    '--timeout=60000'
], {
    stdio: 'inherit',
    cwd: __dirname
});

testProcess.on('close', (code) => {
    console.log(`\n🏁 Test completed with exit code: ${code}`);
    process.exit(code);
});

testProcess.on('error', (error) => {
    console.error('❌ Failed to start test:', error);
    process.exit(1);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping test...');
    testProcess.kill('SIGINT');
    setTimeout(() => {
        process.exit(1);
    }, 2000);
});
