const fs = require('fs');
const path = require('path');

async function globalSetup() {
    console.log('🔧 Setting up test environment...');
    
    // Create test results directories
    const dirs = [
        'test-results',
        'test-results/screenshots',
        'test-results/html-report',
        'test-results/videos'
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    });
    
    // Set environment variables for testing
    process.env.NODE_ENV = 'development';
    process.env.ELECTRON_ENABLE_LOGGING = '1';
    
    console.log('✅ Test environment ready');
}

module.exports = globalSetup;
