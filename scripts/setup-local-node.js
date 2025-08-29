#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const NODE_VERSION = '16.20.2';
const PLATFORM = process.platform === 'win32' ? 'win' : process.platform;
const ARCH = process.arch === 'x64' ? 'x64' : process.arch;
const NODE_DIR = path.join(__dirname, '..', 'local-node');
const NODE_FILENAME = PLATFORM === 'win' ? `node-v${NODE_VERSION}-${PLATFORM}-${ARCH}` : `node-v${NODE_VERSION}-${PLATFORM}-${ARCH}`;
const NODE_EXT = PLATFORM === 'win' ? '.zip' : '.tar.xz';
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_FILENAME}${NODE_EXT}`;

console.log('🔧 Setting up local Node.js for this project...');
console.log(`Target version: Node.js ${NODE_VERSION}`);
console.log(`Platform: ${PLATFORM}-${ARCH}`);

// Check if local node already exists
const localNodePath = PLATFORM === 'win'
    ? path.join(NODE_DIR, NODE_FILENAME, 'node.exe')
    : path.join(NODE_DIR, NODE_FILENAME, 'bin', 'node');

if (fs.existsSync(localNodePath)) {
    console.log('✅ Local Node.js already installed!');
    console.log(`📍 Location: ${localNodePath}`);

    // Test the local node version
    try {
        const version = execSync(`"${localNodePath}" --version`, { encoding: 'utf8' }).trim();
        console.log(`🔍 Version: ${version}`);

        if (version === `v${NODE_VERSION}`) {
            console.log('✅ Local Node.js is ready to use!');
            console.log('');
            console.log('🚀 To run the project with local Node.js:');
            console.log('   npm run local');
            console.log('');
            return;
        }
    } catch (error) {
        console.log('❌ Local Node.js installation appears corrupted, re-downloading...');
    }
}

// Create local-node directory
if (!fs.existsSync(NODE_DIR)) {
    fs.mkdirSync(NODE_DIR, { recursive: true });
}

const downloadPath = path.join(NODE_DIR, `${NODE_FILENAME}${NODE_EXT}`);

console.log('📥 Downloading Node.js...');
console.log(`URL: ${NODE_URL}`);

// Download Node.js
const file = fs.createWriteStream(downloadPath);
https.get(NODE_URL, (response) => {
    if (response.statusCode !== 200) {
        console.error(`❌ Download failed: ${response.statusCode}`);
        return;
    }
    
    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloadedSize = 0;
    
    response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r📥 Downloading: ${percent}%`);
    });
    
    response.pipe(file);
    
    file.on('finish', () => {
        file.close();
        console.log('\n✅ Download complete!');
        
        // Extract the archive
        console.log('📦 Extracting Node.js...');
        
        try {
            if (PLATFORM === 'win') {
                // For Windows, try PowerShell extraction
                try {
                    console.log('📦 Extracting with PowerShell...');
                    execSync(`powershell -Command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${NODE_DIR}' -Force"`, { stdio: 'inherit' });
                    console.log('✅ Extraction complete!');

                    // Test the installation
                    const version = execSync(`"${localNodePath}" --version`, { encoding: 'utf8' }).trim();
                    console.log(`🔍 Installed version: ${version}`);

                    console.log('✅ Local Node.js setup complete!');
                    console.log('🚀 To run the project: npm run local');
                } catch (psError) {
                    console.log('⚠️  PowerShell extraction failed. Please extract manually:');
                    console.log(`   1. Extract ${downloadPath}`);
                    console.log(`   2. Place contents in ${NODE_DIR}`);
                    console.log(`   3. Run: npm run local`);
                }
            } else {
                // For Unix-like systems
                execSync(`cd "${NODE_DIR}" && tar -xf "${NODE_FILENAME}${NODE_EXT}"`, { stdio: 'inherit' });
                console.log('✅ Extraction complete!');

                // Test the installation
                const version = execSync(`"${localNodePath}" --version`, { encoding: 'utf8' }).trim();
                console.log(`🔍 Installed version: ${version}`);

                console.log('✅ Local Node.js setup complete!');
                console.log('🚀 To run the project: npm run local');
            }
        } catch (error) {
            console.error('❌ Extraction failed:', error.message);
            console.log('');
            console.log('📝 Manual setup:');
            console.log(`   1. Extract ${downloadPath} to ${NODE_DIR}`);
            console.log(`   2. Run: npm run local`);
        }
    });
    
    file.on('error', (error) => {
        console.error('❌ Download failed:', error.message);
    });
}).on('error', (error) => {
    console.error('❌ Download failed:', error.message);
});
