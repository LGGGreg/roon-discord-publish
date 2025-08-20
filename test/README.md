# Automated Testing Framework

This testing framework provides automated GUI testing and remote control capabilities for the Roon Discord Rich Presence application.

## Features

- 📸 **Screenshot Capture** - Take screenshots of the GUI from command line
- 🎮 **Remote Control** - Programmatically control the Electron app
- 🧪 **E2E Testing** - Comprehensive end-to-end tests with Playwright
- 📊 **Status Monitoring** - Check service connection status
- 🔄 **Interactive Mode** - Real-time testing and debugging

## Quick Start

### 1. Run E2E Tests
```bash
# Run all tests (headless)
npm test

# Run tests with visible browser
npm run test:gui

# View test report
npm run test:report
```

### 2. Take Screenshots
```bash
# Take a screenshot with auto-generated filename
npm run test:screenshot

# Take a screenshot with custom filename
node test/cli/screenshot.js my-test.png
```

### 3. Check Status
```bash
# Get current service status
npm run test:status
```

### 4. Interactive Mode
```bash
# Start interactive controller
npm run test:interactive
```

## Test Structure

```
test/
├── e2e/                    # End-to-end tests
│   └── status.test.js      # Main status page tests
├── cli/                    # Command-line tools
│   ├── screenshot.js       # Screenshot utility
│   ├── status-check.js     # Status checker
│   └── interactive.js      # Interactive controller
├── utils/                  # Test utilities
│   └── TestController.js   # Main test controller class
└── setup/                  # Test setup/teardown
    ├── global-setup.js
    └── global-teardown.js
```

## Interactive Commands

When running `npm run test:interactive`, you can use these commands:

- `help` - Show available commands
- `status` - Show current service status
- `screenshot [filename]` - Take a screenshot
- `reconnect <service>` - Reconnect service (discord/roon)
- `click <selector>` - Click a GUI element
- `tab <name>` - Switch to tab (status/config/logs)
- `wait` - Wait for services to connect
- `test <name>` - Run a specific test
- `exit` - Exit interactive mode

## Examples

### Take a Screenshot
```bash
# Auto-generated filename
npm run test:screenshot

# Custom filename
node test/cli/screenshot.js connection-test.png
```

### Check Service Status
```bash
npm run test:status
```

### Interactive Testing Session
```bash
npm run test:interactive

# In interactive mode:
test> status
test> screenshot before-reconnect.png
test> reconnect discord
test> wait
test> screenshot after-reconnect.png
test> exit
```

### Programmatic Usage
```javascript
const TestController = require('./test/utils/TestController');

async function myTest() {
    const controller = new TestController();
    
    await controller.launch();
    await controller.waitForConnection();
    await controller.takeScreenshot('my-test.png');
    
    const status = await controller.getServiceStatus();
    console.log('Status:', status);
    
    await controller.close();
}
```

## Test Results

All test results are saved to:
- `test-results/screenshots/` - Screenshots
- `test-results/html-report/` - Playwright HTML reports
- `test-results/videos/` - Test execution videos (on failure)

## Troubleshooting

### App Won't Launch
- Make sure the app builds successfully first
- Check that Node.js version is compatible
- Verify all dependencies are installed

### Screenshots Are Black
- Try using native screenshot mode
- Check if app window is visible
- Ensure sufficient wait time for app initialization

### Tests Timeout
- Increase timeout values in test configuration
- Check network connectivity for Discord/Roon services
- Verify services are available and configured

## Configuration

Test configuration is in `playwright.config.js`. Key settings:
- Test timeout: 30 seconds
- Screenshot on failure: enabled
- Video recording: on failure only
- Parallel execution: disabled (for stability)

## Development

To add new tests:
1. Create test files in `test/e2e/`
2. Use data-testid attributes for reliable element selection
3. Follow the existing test patterns
4. Add CLI tools in `test/cli/` for specific functionality

## API Reference

### TestController Class

Main methods:
- `launch()` - Launch the Electron app
- `close()` - Close the app
- `takeScreenshot(filename)` - Capture screenshot
- `getServiceStatus()` - Get IPC service status
- `getGUIStatus()` - Get GUI element status
- `reconnectService(service)` - Trigger reconnection
- `waitForConnection(timeout)` - Wait for services to connect
- `runStatusCheck()` - Comprehensive status check
