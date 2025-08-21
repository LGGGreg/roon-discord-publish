// Status management functionality
// This file handles real-time status updates and connection monitoring

document.addEventListener('DOMContentLoaded', () => {
    // Service status elements - using correct selectors that match the HTML
    const discordStatus = document.querySelector('#discord-status .status-dot');
    const discordText = document.querySelector('#discord-status .status-text');
    const discordDetails = document.querySelector('#discord-details');
    const roonStatus = document.querySelector('#roon-status .status-dot');
    const roonText = document.querySelector('#roon-status .status-text');
    const roonDetails = document.querySelector('#roon-details');
    const spotifyStatus = document.querySelector('#spotify-status .status-dot');
    const spotifyText = document.querySelector('#spotify-status .status-text');
    const spotifyDetails = document.querySelector('#spotify-details');
    const imgurStatus = document.querySelector('#imgur-status .status-dot');
    const imgurText = document.querySelector('#imgur-status .status-text');
    const imgurDetails = document.querySelector('#imgur-details');

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
        let statusDot, statusText, detailsElement;

        switch (service) {
            case 'discord':
                statusDot = discordStatus;
                statusText = discordText;
                detailsElement = discordDetails;
                break;
            case 'roon':
                statusDot = roonStatus;
                statusText = roonText;
                detailsElement = roonDetails;
                break;
            case 'spotify':
                statusDot = spotifyStatus;
                statusText = spotifyText;
                detailsElement = spotifyDetails;
                break;
            case 'imgur':
                statusDot = imgurStatus;
                statusText = imgurText;
                detailsElement = imgurDetails;
                break;
            default:
                console.warn('Unknown service:', service);
                return;
        }

        if (statusDot && statusText && detailsElement) {
            // Update status indicator
            const statusInfo = statusMap[status] || { class: 'error', text: 'Unknown' };
            statusDot.className = `status-dot ${statusInfo.class}`;
            statusText.textContent = statusInfo.text;

            // Update details
            if (error) {
                detailsElement.textContent = `Error: ${error}`;
                detailsElement.style.color = '#e74c3c';
            } else if (details) {
                detailsElement.textContent = details;
                detailsElement.style.color = '#666';
            } else {
                detailsElement.textContent = getDefaultDetails(service, status);
                detailsElement.style.color = '#666';
            }
        } else {
            console.warn(`Status elements not found for service: ${service}`, {
                statusDot: !!statusDot,
                statusText: !!statusText,
                detailsElement: !!detailsElement
            });
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

    // Export functions for external use
    window.updateServiceStatus = updateServiceStatus;
    window.requestInitialStatus = requestInitialStatus;
});
