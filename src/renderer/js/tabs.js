// Tab navigation functionality
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    function switchTab(targetTab) {
        // Remove active class from all tabs and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab
        const clickedTab = document.querySelector(`[data-tab="${targetTab}"]`);
        if (clickedTab) {
            clickedTab.classList.add('active');
        }
        
        // Show corresponding content
        const targetContent = document.getElementById(`${targetTab}-tab`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        // Log tab switch
        if (window.addLogEntry) {
            window.addLogEntry(`Switched to ${targetTab} tab`, 'info');
        }
    }
    
    // Add click event listeners to tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    switchTab('status');
                    break;
                case '2':
                    e.preventDefault();
                    switchTab('config');
                    break;
                case '3':
                    e.preventDefault();
                    switchTab('logs');
                    break;
            }
        }
    });
    
    // Export switchTab function for external use
    window.switchTab = switchTab;
});
