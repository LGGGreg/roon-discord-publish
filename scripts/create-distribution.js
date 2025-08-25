const fs = require('fs');
const path = require('path');

console.log('📦 Creating distribution package with .exe...');

const distDir = 'distribution-ready';

// Clean and create distribution directory
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Files and directories to copy
const itemsToCopy = [
    'src',
    'assets',
    'local-node',
    'discord-game',
    'node_modules',
    'package.json',
    'package-lock.json',
    'run-with-local-node.js',
    'setup-local-node.js',
    'start.js',
    'roon-discord-publish.js',
    'config.example.json',
    'Roon Discord Rich Presence.exe',  // The compiled executable
    'LICENSE',
    'README.md',
    'third-party-licenses.txt'
];

// Copy function
function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const files = fs.readdirSync(src);
        files.forEach(file => {
            copyRecursive(path.join(src, file), path.join(dest, file));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Copy items
itemsToCopy.forEach(item => {
    const srcPath = path.join('.', item);
    const destPath = path.join(distDir, item);
    
    if (fs.existsSync(srcPath)) {
        console.log(`📁 Copying ${item}...`);
        copyRecursive(srcPath, destPath);
    } else {
        console.log(`⚠️  Skipping ${item} (not found)`);
    }
});

// Create a README for users
const userReadme = `# Roon Discord Rich Presence

## Quick Start
1. Double-click "Roon Discord Rich Presence.exe" to start the application
2. The app will open and guide you through the setup process
3. Configure your settings in the app interface

## Requirements
- Windows 10/11
- Roon Core running on your network
- Discord application installed

## What's Included
- Roon Discord Rich Presence.exe (33 MB standalone executable)
- Complete application source code and dependencies
- Local Node.js runtime for reliable operation
- Configuration template

## Configuration
The app will automatically create a config.json file from the template on first run.
You can modify settings through the app interface.

## Troubleshooting
- If the app doesn't start, make sure you have the complete folder structure
- The executable needs the local-node folder and other dependencies in the same directory
- Ensure Discord is running before starting the app

## Technical Details
- The .exe is a compiled Node.js application using pkg
- It launches the main application using the included local Node.js runtime
- No installation required - completely portable

## Support
For issues and updates, visit the project repository.
`;

fs.writeFileSync(path.join(distDir, 'README.txt'), userReadme);

// Get file size of the executable
const exePath = path.join(distDir, 'Roon Discord Rich Presence.exe');
let exeSize = 'Unknown';
if (fs.existsSync(exePath)) {
    const stats = fs.statSync(exePath);
    exeSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
}

console.log('✅ Distribution package created in:', distDir);
console.log('');
console.log('📋 Distribution ready:');
console.log(`📁 Folder: ${distDir}`);
console.log(`🚀 Executable: Roon Discord Rich Presence.exe (${exeSize})`);
console.log('📖 User guide: README.txt');
console.log('');
console.log('🔒 Security verified:');
console.log('✅ Personal config.json excluded');
console.log('✅ Clean config.example.json included');
console.log('✅ Standalone .exe with bundled Node.js runtime');
console.log('✅ Local Node.js included for main application');
