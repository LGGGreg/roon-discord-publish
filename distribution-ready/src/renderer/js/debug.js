// Debug controls functionality
// This file handles debug mode controls and diagnostics display

document.addEventListener('DOMContentLoaded', () => {
    const debugControls = document.getElementById('debug-controls');
    const toggleDebugBtn = document.getElementById('toggle-debug-mode');
    const generateReportBtn = document.getElementById('generate-diagnostic-report');
    const clearDiagnosticsBtn = document.getElementById('clear-diagnostics');
    const debugModeIndicator = document.getElementById('debug-mode-indicator');
    const debugInfo = document.getElementById('debug-info');
    
    let isDebugMode = false;
    let debugSummary = null;
    
    // Show debug controls only in development
    if (window.electronAPI && window.electronAPI.isDevelopment) {
        debugControls.style.display = 'block';
        initializeDebugControls();
    }
    
    function initializeDebugControls() {
        // Get initial debug status
        updateDebugStatus();
        
        // Set up event listeners
        toggleDebugBtn.addEventListener('click', toggleDebugMode);
        generateReportBtn.addEventListener('click', generateDiagnosticReport);
        clearDiagnosticsBtn.addEventListener('click', clearDiagnostics);
        
        // Listen for debug events from main process
        if (window.electronAPI) {
            window.electronAPI.onDebugModeChanged((event, data) => {
                isDebugMode = data.enabled;
                updateDebugIndicator();
                
                if (data.enabled) {
                    showNotification('Debug mode enabled', 'info');
                } else {
                    showNotification('Debug mode disabled', 'info');
                }
            });
            
            window.electronAPI.onDebugPerformanceMarker((event, performance) => {
                console.log('Performance marker:', performance);
                updateDebugInfo(`Performance: ${performance.name} - ${performance.duration}ms`);
            });
            
            window.electronAPI.onDebugErrorAdded((event, errorDiagnostic) => {
                console.error('Debug error:', errorDiagnostic);
                showNotification(`Debug error: ${errorDiagnostic.message}`, 'error');
            });
            
            window.electronAPI.onDebugReportGenerated((event, reportInfo) => {
                console.log('Diagnostic report generated:', reportInfo.path);
                showNotification(`Diagnostic report saved: ${reportInfo.path}`, 'success');
            });
        }
    }
    
    async function updateDebugStatus() {
        try {
            if (window.electronAPI) {
                debugSummary = await window.electronAPI.invoke('debug-get-summary');
                
                if (debugSummary) {
                    isDebugMode = debugSummary.isDebugMode;
                    updateDebugIndicator();
                    updateDebugInfo();
                }
            }
        } catch (error) {
            console.error('Failed to get debug status:', error);
        }
    }
    
    function updateDebugIndicator() {
        if (debugModeIndicator) {
            debugModeIndicator.textContent = `Debug: ${isDebugMode ? 'ON' : 'OFF'}`;
            debugModeIndicator.className = `debug-indicator ${isDebugMode ? 'debug-on' : 'debug-off'}`;
        }
    }
    
    function updateDebugInfo(message = null) {
        if (debugInfo) {
            if (message) {
                debugInfo.textContent = message;
                // Clear message after 3 seconds
                setTimeout(() => {
                    updateDebugInfo();
                }, 3000);
            } else if (debugSummary) {
                const info = [];
                
                if (debugSummary.debugDuration > 0) {
                    info.push(`Duration: ${Math.round(debugSummary.debugDuration / 1000)}s`);
                }
                
                if (debugSummary.serviceCount > 0) {
                    info.push(`Services: ${debugSummary.serviceCount}`);
                }
                
                if (debugSummary.errorCount > 0) {
                    info.push(`Errors: ${debugSummary.errorCount}`);
                }
                
                if (debugSummary.performanceMarkers > 0) {
                    info.push(`Perf: ${debugSummary.performanceMarkers}`);
                }
                
                debugInfo.textContent = info.join(' | ');
            } else {
                debugInfo.textContent = '';
            }
        }
    }
    
    async function toggleDebugMode() {
        try {
            if (window.electronAPI) {
                const newState = await window.electronAPI.invoke('debug-toggle-mode', {
                    enableVerboseLogging: true,
                    enablePerformanceTracking: true,
                    enableNetworkDiagnostics: true
                });
                
                isDebugMode = newState;
                updateDebugIndicator();
                
                // Update debug summary
                await updateDebugStatus();
                
                console.log(`Debug mode ${isDebugMode ? 'enabled' : 'disabled'}`);
            }
        } catch (error) {
            console.error('Failed to toggle debug mode:', error);
            showNotification('Failed to toggle debug mode', 'error');
        }
    }
    
    async function generateDiagnosticReport() {
        try {
            if (window.electronAPI) {
                updateDebugInfo('Generating diagnostic report...');
                
                const reportInfo = await window.electronAPI.invoke('debug-generate-report', true, true);
                
                if (reportInfo) {
                    console.log('Diagnostic report generated:', reportInfo);
                    updateDebugInfo(`Report saved: ${reportInfo.path}`);
                    showNotification('Diagnostic report generated successfully', 'success');
                } else {
                    updateDebugInfo('Report generation failed');
                    showNotification('Failed to generate diagnostic report', 'error');
                }
            }
        } catch (error) {
            console.error('Failed to generate diagnostic report:', error);
            updateDebugInfo('Report generation failed');
            showNotification('Failed to generate diagnostic report', 'error');
        }
    }
    
    async function clearDiagnostics() {
        try {
            if (window.electronAPI) {
                const success = await window.electronAPI.invoke('debug-clear-diagnostics');
                
                if (success) {
                    updateDebugInfo('Diagnostics cleared');
                    showNotification('Diagnostics data cleared', 'info');
                    
                    // Update debug summary
                    await updateDebugStatus();
                } else {
                    showNotification('Failed to clear diagnostics', 'error');
                }
            }
        } catch (error) {
            console.error('Failed to clear diagnostics:', error);
            showNotification('Failed to clear diagnostics', 'error');
        }
    }
    
    // Performance monitoring helpers
    function startPerformanceMarker(name) {
        if (window.electronAPI && isDebugMode) {
            window.electronAPI.invoke('debug-start-performance-marker', name);
        }
    }
    
    function endPerformanceMarker(name) {
        if (window.electronAPI && isDebugMode) {
            return window.electronAPI.invoke('debug-end-performance-marker', name);
        }
        return null;
    }
    
    // Connection diagnostics helper
    async function runConnectionDiagnostics(serviceName, connectionInfo) {
        if (window.electronAPI && isDebugMode) {
            try {
                const diagnostics = await window.electronAPI.invoke('debug-run-connection-diagnostics', serviceName, connectionInfo);
                console.log(`Connection diagnostics for ${serviceName}:`, diagnostics);
                return diagnostics;
            } catch (error) {
                console.error(`Connection diagnostics failed for ${serviceName}:`, error);
                return null;
            }
        }
        return null;
    }
    
    // Utility function for notifications
    function showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // Export debug functions for use by other modules
    window.debugControls = {
        isDebugMode: () => isDebugMode,
        toggleDebugMode,
        generateDiagnosticReport,
        clearDiagnostics,
        startPerformanceMarker,
        endPerformanceMarker,
        runConnectionDiagnostics,
        updateDebugStatus
    };
    
    // Auto-update debug status every 30 seconds
    setInterval(updateDebugStatus, 30000);
});
