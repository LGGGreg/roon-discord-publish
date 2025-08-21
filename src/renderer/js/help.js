// Help functionality for Roon Discord Rich Presence

const { shell } = require('electron');
const path = require('path');

/**
 * Open the full help guide in a new window
 */
function openHelpWindow() {
    try {
        // Get the path to the help.html file
        const helpPath = path.join(__dirname, '../help.html');
        const helpUrl = `file://${helpPath}`;
        
        // Open in external browser for better experience
        shell.openExternal(helpUrl);
    } catch (error) {
        console.error('Failed to open help window:', error);
        
        // Fallback: show a simple alert with basic help info
        alert(`Help Guide

To set up Roon Discord Rich Presence:

1. Discord Setup:
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Copy the Application ID (Client ID)

2. Roon Setup:
   - Enable "Use Discovery" for automatic connection
   - Or enter your Roon Core IP manually
   - Accept the pairing request in Roon

3. Optional Services:
   - Spotify: Get Client ID and Secret from developer.spotify.com
   - Imgur: Get Client ID from api.imgur.com

Check the Logs tab for detailed error messages if you encounter issues.`);
    }
}

/**
 * Open help guide to a specific section
 * @param {string} section - The section to navigate to (discord, roon, spotify, imgur, troubleshooting)
 */
function openHelpSection(section) {
    try {
        const helpPath = path.join(__dirname, '../help.html');
        const helpUrl = `file://${helpPath}#${section}`;
        
        // Open in external browser with anchor link
        shell.openExternal(helpUrl);
    } catch (error) {
        console.error('Failed to open help section:', error);
        
        // Fallback to opening the full help
        openHelpWindow();
    }
}

/**
 * Show quick help for a specific service
 * @param {string} service - The service to show help for
 */
function showQuickHelp(service) {
    const helpTexts = {
        discord: `Discord Setup:
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Enter a name and click "Create"
4. Copy the "Application ID" from General Information
5. Paste it into the Discord Client ID field`,

        roon: `Roon Setup:
1. Make sure Roon Core is running
2. Enable "Use Discovery" for automatic connection
3. Or disable it and enter your Roon Core IP manually
4. Accept the pairing request that appears in Roon
5. Go to Extensions in Roon and enable "Discord Rich Presence"`,

        spotify: `Spotify Setup (Optional):
1. Go to https://developer.spotify.com/dashboard
2. Create an app and get Client ID and Client Secret
3. Enter Client ID in spotify.client field
4. Enter Client Secret in spotify.secret field`,

        imgur: `Imgur Setup (Optional):
1. Go to https://api.imgur.com/oauth2/addclient
2. Create an application and get your Client ID
3. Enter it in the imgur.clientId field`
    };

    const helpText = helpTexts[service];
    if (helpText) {
        alert(helpText);
    } else {
        openHelpWindow();
    }
}

/**
 * Check if help should be shown based on configuration status
 */
function checkShowHelpHints() {
    // This could be called when the app starts to show helpful hints
    // if certain services aren't configured yet
    
    if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.getConfig().then(config => {
            const hints = [];
            
            if (!config.discord?.clientId) {
                hints.push('💡 Set up Discord to show your music status');
            }
            
            if (!config.core_ip && !config.app?.use_discovery) {
                hints.push('💡 Configure Roon connection in settings');
            }
            
            if (hints.length > 0) {
                // Could show these hints in the UI somewhere
                console.log('Help hints:', hints);
            }
        }).catch(error => {
            console.error('Failed to check config for help hints:', error);
        });
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        openHelpWindow,
        openHelpSection,
        showQuickHelp,
        checkShowHelpHints
    };
}

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.openHelpWindow = openHelpWindow;
    window.openHelpSection = openHelpSection;
    window.showQuickHelp = showQuickHelp;
}
