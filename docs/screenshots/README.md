# Screenshots Directory Structure

This directory contains organized screenshots for the Roon Discord Rich Presence application documentation.

## Directory Organization

### `/features/`
Screenshots showcasing the main features of the application:
- `main-window-overview.png` - Main application window with all panels visible
- `now-playing-display.png` - Currently playing track information
- `connection-status.png` - Service connection status indicators
- `system-tray.png` - System tray integration
- `settings-overview.png` - Settings/configuration panel
- `track-change-demo.png` - Track change detection in action

### `/setup/`
Screenshots for setup and configuration guidance:
- `initial-launch.png` - First time application launch
- `discord-setup.png` - Discord configuration steps
- `roon-pairing.png` - Roon core pairing process
- `spotify-auth.png` - Spotify authentication flow
- `imgur-config.png` - Imgur configuration (optional)
- `config-complete.png` - Fully configured application

### `/ui/`
User interface screenshots for different states:
- `main-window-light.png` - Main window in light theme
- `main-window-dark.png` - Main window in dark theme (if applicable)
- `menu-services.png` - Services menu options
- `menu-help.png` - Help menu options
- `status-connected.png` - All services connected state
- `status-disconnected.png` - Services disconnected state
- `status-connecting.png` - Services connecting state

### `/integrations/`
Screenshots showing external integrations:
- `discord-rich-presence.png` - Discord Rich Presence display
- `discord-profile.png` - Discord profile showing music activity
- `roon-zones.png` - Roon zones detection
- `spotify-links.png` - Spotify track links in Discord
- `album-art-display.png` - Album art integration
- `artist-art-display.png` - Artist art integration

## Screenshot Standards

- **Resolution**: Minimum 1920x1080 for desktop screenshots
- **Format**: PNG for UI screenshots, JPG for photos of external displays
- **Quality**: High quality, clear text, no compression artifacts
- **Consistency**: Same window size and position when possible
- **Privacy**: No personal information visible (usernames, etc.)

## Naming Convention

- Use kebab-case for filenames
- Include descriptive names that match the feature being shown
- Add version numbers if multiple iterations exist (e.g., `main-window-v2.png`)
- Use consistent prefixes for related screenshots

## Automated Screenshot Capture

Screenshots are captured using our Playwright test framework:
- Run `npm run test:screenshots` to capture all screenshots
- Individual screenshot tests are in `/test/cli/screenshot-test.js`
- Screenshots are automatically saved to appropriate subdirectories
