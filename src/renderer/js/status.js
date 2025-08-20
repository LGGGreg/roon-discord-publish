// Status management functionality
// This file will handle real-time status updates and connection monitoring

document.addEventListener('DOMContentLoaded', () => {
    // Status update interval
    let statusUpdateInterval;
    
    function startStatusUpdates() {
        // Update status every 5 seconds
        statusUpdateInterval = setInterval(() => {
            // TODO: Request status updates from main process
            // This will be implemented when we integrate the core services
        }, 5000);
    }
    
    function stopStatusUpdates() {
        if (statusUpdateInterval) {
            clearInterval(statusUpdateInterval);
            statusUpdateInterval = null;
        }
    }
    
    // Start status updates when the status tab is active
    const statusTab = document.querySelector('[data-tab="status"]');
    if (statusTab) {
        statusTab.addEventListener('click', startStatusUpdates);
    }
    
    // Stop updates when switching away from status tab
    document.querySelectorAll('.nav-tab:not([data-tab="status"])').forEach(tab => {
        tab.addEventListener('click', stopStatusUpdates);
    });
    
    // Start updates immediately if status tab is active
    if (statusTab && statusTab.classList.contains('active')) {
        startStatusUpdates();
    }
    
    // Export functions for external use
    window.startStatusUpdates = startStatusUpdates;
    window.stopStatusUpdates = stopStatusUpdates;
});
