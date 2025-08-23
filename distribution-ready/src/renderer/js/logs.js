// Logs management functionality
// This file will handle log display, filtering, and export

document.addEventListener('DOMContentLoaded', () => {
    const logsContent = document.getElementById('logs-content');
    let logHistory = [];
    
    function addLog(message, type = 'info', timestamp = null) {
        const logTimestamp = timestamp || new Date();
        const logEntry = {
            timestamp: logTimestamp,
            message: message,
            type: type
        };
        
        logHistory.push(logEntry);
        
        // Keep only last 1000 log entries
        if (logHistory.length > 1000) {
            logHistory = logHistory.slice(-1000);
        }
        
        displayLog(logEntry);
    }
    
    function displayLog(logEntry) {
        const logElement = document.createElement('p');
        logElement.className = `log-entry ${logEntry.type}`;
        
        const timeString = logEntry.timestamp.toLocaleTimeString();
        logElement.innerHTML = `<span class="timestamp">[${timeString}]</span> ${logEntry.message}`;
        
        logsContent.appendChild(logElement);
        logsContent.scrollTop = logsContent.scrollHeight;
    }
    
    function clearLogs() {
        logHistory = [];
        logsContent.innerHTML = '<p class="log-entry info">Logs cleared</p>';
        
        // Add the clear action to history
        addLog('Logs cleared by user', 'info');
    }
    
    function exportLogs() {
        const logText = logHistory.map(entry => {
            const timeString = entry.timestamp.toLocaleString();
            return `[${timeString}] [${entry.type.toUpperCase()}] ${entry.message}`;
        }).join('\n');
        
        // TODO: Implement actual file export through main process
        // For now, copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(logText).then(() => {
                if (window.showNotification) {
                    window.showNotification('Logs copied to clipboard', 'success');
                }
                addLog('Logs copied to clipboard', 'info');
            }).catch(err => {
                console.error('Failed to copy logs:', err);
                if (window.showNotification) {
                    window.showNotification('Failed to copy logs', 'error');
                }
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = logText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (window.showNotification) {
                window.showNotification('Logs copied to clipboard', 'success');
            }
            addLog('Logs copied to clipboard', 'info');
        }
    }
    
    function filterLogs(type = null) {
        const filteredLogs = type ? logHistory.filter(log => log.type === type) : logHistory;
        
        logsContent.innerHTML = '';
        filteredLogs.forEach(displayLog);
    }
    
    // Event listeners
    document.getElementById('clear-logs')?.addEventListener('click', clearLogs);
    document.getElementById('export-logs')?.addEventListener('click', exportLogs);
    
    // Override the global addLogEntry function to use our enhanced logging
    if (window.addLogEntry) {
        const originalAddLogEntry = window.addLogEntry;
        window.addLogEntry = function(message, type = 'info') {
            addLog(message, type);
        };
    }
    
    // Export functions for external use
    window.addLog = addLog;
    window.clearLogs = clearLogs;
    window.exportLogs = exportLogs;
    window.filterLogs = filterLogs;
});
