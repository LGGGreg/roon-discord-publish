// Status management functionality
// This file handles real-time status updates and connection monitoring

document.addEventListener('DOMContentLoaded', () => {
    // Service status elements
    const discordStatus = document.querySelector('.service-card[data-service="discord"] .status');
    const discordDetails = document.querySelector('.service-card[data-service="discord"] .details');
    const roonStatus = document.querySelector('.service-card[data-service="roon"] .status');
    const roonDetails = document.querySelector('.service-card[data-service="roon"] .details');
    const spotifyStatus = document.querySelector('.service-card[data-service="spotify"] .status');
    const spotifyDetails = document.querySelector('.service-card[data-service="spotify"] .details');
    const imgurStatus = document.querySelector('.service-card[data-service="imgur"] .status');
    const imgurDetails = document.querySelector('.service-card[data-service="imgur"] .details');

    // Status mapping
    const statusMap = {
        'disconnected': { class: 'disconnected', text: 'Disconnected' },
        'connecting': { class: 'connecting', text: 'Connecting' },
        'connected': { class: 'connected', text: 'Connected' },
        'reconnecting': { class: 'connecting', text: 'Reconnecting' },
        'error': { class: 'error', text: 'Error' }
    };

    // Update service status
    function updateServiceStatus(service, status, details, error) {
        let statusElement, detailsElement;

        switch (service) {
            case 'discord':
                statusElement = discordStatus;
                detailsElement = discordDetails;
                break;
            case 'roon':
                statusElement = roonStatus;
                detailsElement = roonDetails;
                break;
            case 'spotify':
                statusElement = spotifyStatus;
                detailsElement = spotifyDetails;
                break;
            case 'imgur':
                statusElement = imgurStatus;
                detailsElement = imgurDetails;
                break;
            default:
                console.warn('Unknown service:', service);
                return;
        }

        if (statusElement && detailsElement) {
            // Update status indicator
            const statusInfo = statusMap[status] || { class: 'error', text: 'Unknown' };
            statusElement.className = `status ${statusInfo.class}`;
            statusElement.textContent = statusInfo.text;

            // Update details
            if (error) {
                detailsElement.textContent = `Error: ${error}`;
            } else if (details) {
                detailsElement.textContent = details;
            } else {
                detailsElement.textContent = getDefaultDetails(service, status);
            }
        }
    }

    // Get default details for service status
    function getDefaultDetails(service, status) {
        switch (status) {
            case 'disconnected':
                return `Not connected to ${service.charAt(0).toUpperCase() + service.slice(1)}`;
            case 'connecting':
                return service === 'roon' ? 'Searching for Roon Core...' : 'Attempting to connect...';
            case 'connected':
                return 'Connection established';
            case 'reconnecting':
                return 'Reconnecting...';
            case 'error':
                return 'Connection failed';
            default:
                return '';
        }
    }

    // Listen for service status changes from main process
    const { ipcRenderer } = require('electron');

    ipcRenderer.on('service-status-changed', (event, data) => {
        console.log('Service status changed:', data);
        updateServiceStatus(data.service, data.status, data.details, data.error);
    });

    // Request initial status
    function requestInitialStatus() {
        ipcRenderer.invoke('request-service-status').catch(error => {
            console.error('Error requesting initial status:', error);
        });
    }

    // Request initial status when page loads (with delay to allow services to connect)
    setTimeout(() => {
        requestInitialStatus();
    }, 1000);

    // Also request status again after a longer delay to catch any late connections
    setTimeout(() => {
        requestInitialStatus();
    }, 3000);

    // Add refresh button functionality (for debugging)
    const refreshButton = document.createElement('button');
    refreshButton.textContent = 'Refresh Status';
    refreshButton.style.position = 'fixed';
    refreshButton.style.top = '10px';
    refreshButton.style.right = '10px';
    refreshButton.style.zIndex = '9999';
    refreshButton.onclick = () => {
        console.log('Manual status refresh requested');
        requestInitialStatus();
    };
    document.body.appendChild(refreshButton);

    // Export functions for external use
    window.updateServiceStatus = updateServiceStatus;
    window.requestInitialStatus = requestInitialStatus;
});
