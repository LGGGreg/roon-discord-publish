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
    
    async function exportLogs() {
        const logText = logHistory.map(entry => {
            const timeString = entry.timestamp.toLocaleString();
            return `[${timeString}] [${entry.type.toUpperCase()}] ${entry.message}`;
        }).join('\n');

        try {
            // Use IPC to show save dialog and export to file
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('show-save-dialog', {
                title: 'Export Logs',
                defaultPath: `roon-discord-logs-${new Date().toISOString().split('T')[0]}.txt`,
                filters: [
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (!result.canceled && result.filePath) {
                const success = await ipcRenderer.invoke('write-file', result.filePath, logText);
                if (success) {
                    if (window.showNotification) {
                        window.showNotification('Logs exported successfully', 'success');
                    }
                    addLog(`Logs exported to: ${result.filePath}`, 'success');
                } else {
                    throw new Error('Failed to write log file');
                }
            }
        } catch (error) {
            console.error('Failed to export logs to file:', error);

            // Fallback to clipboard
            if (navigator.clipboard) {
                try {
                    await navigator.clipboard.writeText(logText);
                    if (window.showNotification) {
                        window.showNotification('File export failed, logs copied to clipboard', 'warning');
                    }
                    addLog('File export failed, logs copied to clipboard', 'warning');
                } catch (clipboardError) {
                    console.error('Failed to copy logs:', clipboardError);
                    if (window.showNotification) {
                        window.showNotification('Failed to export logs', 'error');
                    }
                }
            } else {
                // Final fallback for browsers without clipboard API
                const textArea = document.createElement('textarea');
                textArea.value = logText;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    if (window.showNotification) {
                        window.showNotification('File export failed, logs copied to clipboard', 'warning');
                    }
                    addLog('File export failed, logs copied to clipboard', 'warning');
                } catch (err) {
                    console.error('Failed to copy logs:', err);
                    if (window.showNotification) {
                        window.showNotification('Failed to export logs', 'error');
                    }
                }
                document.body.removeChild(textArea);
            }
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
