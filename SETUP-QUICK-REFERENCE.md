# 🚀 Quick Setup Reference

## ✅ Verified Working Instructions (Tested 2025-08-29)

### Prerequisites
- Windows 10/11
- Discord Desktop App installed
- Roon Core running on your network

### Step-by-Step Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/LGGGreg/roon-discord-publish.git
   cd roon-discord-publish
   npm install
   ```

2. **Set up Local Node.js** (Required for Electron compatibility)
   ```bash
   npm run setup-local-node
   ```
   This downloads Node.js 16.20.2 to `local-node/` directory.

3. **Run the Application**
   ```bash
   npm run electron
   ```

### Available Commands (All Tested ✅)

#### GUI Application
```bash
npm run electron          # Run the GUI application
npm run electron-dev      # Run with developer tools
npm run electron-debug    # Run with Node.js inspector
```

#### Testing & Validation
```bash
npm test                  # Run all Playwright tests (uses system Node.js)
npm run test:integration  # Comprehensive integration tests ✅
npm run test:workflow     # Test complete Roon → Discord workflow
npm run test:status       # Quick service status check ✅
```

#### Setup
```bash
npm run setup-local-node  # Download local Node.js 16.x (required first!)
```

### Important Notes

- **Electron commands** use local Node.js 16.x from `local-node/`
- **Test commands** use your system's regular Node.js installation
- **Always run** `npm run setup-local-node` before using Electron commands

### Validate Your Setup

After following the setup steps, verify everything works:

1. **Quick Status Check** (recommended first):
   ```bash
   npm run test:status
   ```
   This launches the app and checks service connections.

2. **Comprehensive Integration Test**:
   ```bash
   npm run test:integration
   ```
   This runs a full system test including service connectivity, workflow testing, and performance checks.

3. **Full Test Suite** (optional):
   ```bash
   npm test
   ```
   Runs all Playwright tests (takes 2-5 minutes).

### Troubleshooting

#### If `npm run electron` fails:
1. Make sure you ran `npm run setup-local-node` first
2. Check that `local-node/node-v16.20.2-win-x64/node.exe` exists
3. Try running `npm install` again

#### If tests fail:
- Tests use regular Node.js (not local-node)
- Make sure Discord is closed before running tests
- Some tests may timeout if the system is slow

### What Works ✅

- ✅ Local Node.js setup downloads correctly
- ✅ Electron app starts and connects to services
- ✅ Roon connection works (connects to WIN_SVR_2019 core)
- ✅ Discord Rich Presence works (when configured)
- ✅ Spotify integration works (when configured)
- ✅ Imgur uploads work (anonymous mode)
- ✅ Track change detection works (~2 seconds)
- ✅ Now Playing display works immediately on connection
- ✅ Playwright tests run successfully
- ✅ GUI interface loads and functions properly
- ✅ Integration tests validate complete setup
- ✅ Status checks verify service connections

### Performance Results

- **Track change detection**: ~2 seconds (down from 30+ seconds!)
- **App startup**: ~3-5 seconds
- **Service connections**: Immediate (Discord, Imgur) to 5 seconds (Roon)
- **Test execution**: ~2-5 minutes for full suite

### File Structure After Setup

```
roon-discord-publish/
├── local-node/
│   └── node-v16.20.2-win-x64/
│       └── node.exe              # Local Node.js for Electron
├── node_modules/                 # Dependencies
├── src/                          # Application source
├── test/                         # Playwright tests
└── package.json                  # Scripts and dependencies
```

---

**Last Updated**: 2025-08-29  
**Tested On**: Windows 11, Node.js 16.20.2  
**Status**: All commands working ✅
