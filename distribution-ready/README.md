# Roon Discord Rich Presence - GUI Edition

A modern GUI application that displays your currently playing music from Roon in Discord as Rich Presence.

## New in GUI Edition

- **Modern Electron-based GUI** - Easy-to-use graphical interface
- **Real-time Status Dashboard** - Visual connection status for all services
- **Configuration Management** - GUI forms for API keys with validation
- **System Tray Support** - Background operation (coming soon)
- **Robust Connection Management** - Automatic retry with exponential backoff
- **Comprehensive Logging** - Built-in log viewer for troubleshooting

## Original Features

Based on implementations by 615283 (James Conway), williamtdr, and jaredallard.

Changes from original:
- Does not crash on songs with no artist set
- Supports album and artist images
- Modern GUI interface for easier configuration and monitoring
## Requirements

- **Node.js 16.x** (Required for compatibility with Roon API)
- Discord account
- Roon Core running on your network

## Quick Setup

### Option 1: Local Node.js (Recommended - No System Changes)

1. **Set up local Node.js 16.x**:
   ```bash
   npm run setup-local-node
   ```

2. **Install dependencies and configure**:
   ```bash
   npm install
   cp config.example.json config.json
   # Edit config.json with your API keys
   ```

3. **Run with local Node.js**:
   ```bash
   npm run local
   ```

### Option 2: System Node.js

1. **Install Node.js 16.x** (if not already installed):
   - Download from [Node.js website](https://nodejs.org/en/download/releases/) (version 16.x)
   - Or use Node Version Manager:
     ```bash
     nvm install 16.20.2 && nvm use 16.20.2
     ```

2. **Install dependencies and configure**:
   ```bash
   npm install
   cp config.example.json config.json
   # Edit config.json with your API keys
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

## Enable in Roon

- Go to "Extensions" in your Roon client
- Enable "Discord Rich Presence"

## Commands

### GUI Application
- `npm run electron` - Run the GUI application
- `npm run electron-dev` - Run in development mode with DevTools
- `npm run build` - Build distributable packages

### Console Application (Legacy)
- `npm run local` - Run console version with local Node.js 16.x
- `npm start` - Run console version with system Node.js (with version checking)
- `npm run direct` - Run console version directly without version checking

### Development
- `npm run setup-local-node` - Download and set up local Node.js 16.x
- `npm run clean` - Clean build artifacts
- `npm run rebuild` - Rebuild native dependencies

## Configuration

You'll need to set up accounts and get API keys for:

1. **Discord Application**:
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Copy the Application ID to `discord.clientId`

2. **Imgur API** (for album art):
   - Go to https://api.imgur.com/oauth2/addclient
   - Create an application
   - Copy the Client ID to `imgur.clientId`

3. **Spotify API** (for music links):
   - Go to https://developer.spotify.com/dashboard
   - Create an app
   - Copy Client ID and Client Secret to `spotify.client` and `spotify.secret`

## Troubleshooting

- **"TypeError: this.ws.on is not a function"**: You're using Node.js 17+ which is incompatible. Use Node.js 16.x
- **"config.json not found"**: Copy `config.example.json` to `config.json` and configure it
- **Extension not appearing in Roon**: Make sure the application is running and check Roon's Extensions settings

Note: You may need to run this in an Administrator Command Prompt or PowerShell on Windows.

## License

GPL-3