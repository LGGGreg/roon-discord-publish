# roon-discord-publish
Uses the Discord Presence API to show what you're listening to on Roon.

Based on 
* an [implementation](https://github.com/jamesxsc/roon-discord-rp) by 615283 (James Conway).
* an  [implementation](https://github.com/williamtdr/roon-discord-publish) by williamtdr
* an [implementation](https://github.com/jaredallard/roon-discord-publish) by jaredallard

Changes
- Does not crash on songs with no artist set
- Supports album and artist images
- 
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

- `npm run local` - Run with local Node.js 16.x (recommended)
- `npm start` - Run with system Node.js (with version checking)
- `npm run setup-local-node` - Download and set up local Node.js 16.x
- `npm run direct` - Run directly without version checking

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