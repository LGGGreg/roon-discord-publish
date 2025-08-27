// Help functionality for Roon Discord Rich Presence

/**
 * Open the full help guide in a new window
 */
async function openHelpWindow() {
    try {
        // Use IPC to open help window
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-help-window');
        } else {
            // Fallback: show inline help
            showInlineHelp();
        }
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
 * Open the full help guide window and navigate to a specific section
 * @param {string} section - The section ID to scroll to (discord, roon, spotify, imgur, troubleshooting)
 */
async function openHelpSection(section) {
    try {
        // Open the full help guide window first
        await openHelpWindow();

        // Store the section to navigate to for when the help window loads
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            // Send the section to navigate to
            await ipcRenderer.invoke('navigate-help-to-section', section);
        }
    } catch (error) {
        console.error('Failed to open help section:', error);

        // Fallback: just open the help window
        openHelpWindow();
    }
}

/**
 * Smooth scroll to a specific section
 * @param {string} sectionId - The section ID to scroll to
 */
function scrollToSection(sectionId) {
    const targetElement = document.getElementById(sectionId);
    if (targetElement) {
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        });

        // Optional: Add a subtle highlight effect
        targetElement.style.transition = 'background-color 0.3s ease';
        targetElement.style.backgroundColor = 'rgba(var(--accent-primary-rgb), 0.1)';
        setTimeout(() => {
            targetElement.style.backgroundColor = '';
        }, 2000);
    } else {
        console.warn(`Help section '${sectionId}' not found`);
    }
}

/**
 * Show inline help as a fallback when IPC is not available
 * @param {string} section - Optional section to focus on
 */
function showInlineHelp(section) {
    const helpContent = `
        <div style="max-width: 800px; margin: 2rem auto; padding: 2rem; background: var(--bg-card); border-radius: 12px; color: var(--text-primary);">
            <h1 style="color: var(--accent-primary); text-align: center; margin-bottom: 2rem;">🎵 Roon Discord Rich Presence Help</h1>

            <div style="margin-bottom: 2rem;">
                <h2 style="color: var(--accent-primary);">🎮 Discord Setup</h2>
                <ol style="color: var(--text-secondary); line-height: 1.6;">
                    <li>Go to <strong>https://discord.com/developers/applications</strong></li>
                    <li>Click "New Application" and enter a name</li>
                    <li>Copy the "Application ID" from General Information</li>
                    <li>Paste it into the Discord Client ID field in this app</li>
                </ol>
            </div>

            <div style="margin-bottom: 2rem;">
                <h2 style="color: var(--accent-primary);">🎵 Roon Configuration</h2>
                <ol style="color: var(--text-secondary); line-height: 1.6;">
                    <li>Ensure "Use Discovery" is enabled for automatic connection</li>
                    <li>Make sure your Roon Core is running on the same network</li>
                    <li>Accept the pairing request that appears in Roon</li>
                    <li>Go to Extensions in Roon and enable "Discord Rich Presence"</li>
                </ol>
            </div>

            <div style="margin-bottom: 2rem;">
                <h2 style="color: var(--accent-primary);">🔧 Troubleshooting</h2>
                <ul style="color: var(--text-secondary); line-height: 1.6;">
                    <li><strong>Discord not showing status:</strong> Check Client ID and Discord privacy settings</li>
                    <li><strong>Can't connect to Roon:</strong> Ensure Roon Core is running and accept pairing request</li>
                    <li><strong>No album artwork:</strong> Verify Imgur Client ID or check internet connection</li>
                </ul>
            </div>

            <div style="text-align: center; margin-top: 2rem;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: var(--accent-primary); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">Close Help</button>
            </div>
        </div>
    `;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        overflow-y: auto;
        padding: 2rem;
    `;
    overlay.innerHTML = helpContent;

    // Add click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
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

/**
 * Toggle expandable help section
 * @param {string} section - The section to toggle (discord, roon, spotify, imgur, troubleshooting)
 */
function toggleHelpSection(section) {
    try {
        const card = document.getElementById(`${section}-card`);
        const details = document.getElementById(`${section}-help-details`);
        const button = card?.querySelector('button');

        if (!card || !details) {
            console.warn(`Help section '${section}' not found`);
            console.log(`Looking for card: ${section}-card, details: ${section}-help-details`);
            return;
        }

        const isExpanded = details.style.display !== 'none';

        if (isExpanded) {
            // Collapse
            details.style.display = 'none';
            card.classList.remove('expanded');
            if (button) button.textContent = button.textContent.replace('▲', '▼');
        } else {
            // Expand
            details.style.display = 'block';
            card.classList.add('expanded');
            if (button) button.textContent = button.textContent.replace('▼', '▲');

            // Scroll to the section smoothly
            setTimeout(() => {
                card.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });
            }, 100);
        }
    } catch (error) {
        console.error('Error toggling help section:', error);
    }
}

/**
 * Function to open external URLs
 * @param {string} url - The URL to open
 */
function openExternal(url) {
    try {
        if (window.require) {
            const { shell } = window.require('electron');
            shell.openExternal(url);
        } else {
            // Fallback for non-Electron environments
            window.open(url, '_blank');
        }
    } catch (error) {
        console.error('Failed to open external URL:', error);
        // Last resort fallback
        window.open(url, '_blank');
    }
}

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.openHelpWindow = openHelpWindow;
    window.openHelpSection = openHelpSection;
    window.scrollToSection = scrollToSection;
    window.showQuickHelp = showQuickHelp;
    window.toggleHelpSection = toggleHelpSection;
    window.openExternal = openExternal;
}
