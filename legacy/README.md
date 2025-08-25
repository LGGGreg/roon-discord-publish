# Legacy Console Application

This directory contains the original console-based version of the Roon Discord Rich Presence application.

## Files

- **`roon-discord-publish.js`** - Main console application
- **`start.js`** - Console application launcher
- **`run-with-local-node.js`** - Console launcher with local Node.js
- **`launcher.js`** - Alternative console launcher

## Usage

To run the legacy console version:

```bash
npm run console
```

Or directly:

```bash
node legacy/roon-discord-publish.js
```

## Important Notes

⚠️ **This is legacy code** - The console version is no longer actively maintained. The main GUI application in `src/` is the current version.

### Key Differences from GUI Version

1. **Spotify Integration**: The console version has a working Spotify integration that was used as reference for fixing the GUI version
2. **Simpler Architecture**: Direct service instantiation without the modular architecture
3. **No GUI**: Command-line interface only
4. **Different Configuration**: Uses direct config file loading

### Why Keep This?

- **Reference Implementation**: Contains working Spotify search logic that was ported to the GUI version
- **Backup**: Fallback option if GUI version has issues
- **Learning**: Shows the evolution from console to GUI application
- **Testing**: Can be used to test core functionality without GUI overhead

## Migration Notes

The following features from the console version were successfully migrated to the GUI version:

- ✅ Spotify search functionality (fixed query format)
- ✅ Service connection management
- ✅ Discord Rich Presence updates
- ✅ Configuration management
- ✅ Error handling and retry logic

## Deprecation Timeline

This legacy code will be maintained for reference but is not actively developed. New features are only added to the GUI version in `src/`.
