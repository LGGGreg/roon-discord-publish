const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Log levels
 */
const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

const LogLevelNames = {
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.TRACE]: 'TRACE'
};

/**
 * Centralized logging system with file output and GUI integration
 */
class Logger extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            level: options.level || LogLevel.INFO,
            enableConsole: options.enableConsole !== false,
            enableFile: options.enableFile !== false,
            enableGui: options.enableGui !== false,
            logDir: options.logDir || path.join(__dirname, '../../logs'),
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: options.maxFiles || 5,
            dateFormat: options.dateFormat || 'YYYY-MM-DD HH:mm:ss',
            ...options
        };
        
        this.logFile = null;
        this.currentLogSize = 0;
        
        // Create logs directory
        this.ensureLogDirectory();
        
        // Initialize log file
        this.initializeLogFile();
        
        // Bind methods
        this.log = this.log.bind(this);
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.info = this.info.bind(this);
        this.debug = this.debug.bind(this);
        this.trace = this.trace.bind(this);
    }
    
    /**
     * Ensure log directory exists
     */
    ensureLogDirectory() {
        if (this.options.enableFile && !fs.existsSync(this.options.logDir)) {
            fs.mkdirSync(this.options.logDir, { recursive: true });
        }
    }
    
    /**
     * Initialize log file
     */
    initializeLogFile() {
        if (!this.options.enableFile) return;
        
        const timestamp = new Date().toISOString().split('T')[0];
        this.logFile = path.join(this.options.logDir, `roon-discord-${timestamp}.log`);
        
        // Check current file size
        if (fs.existsSync(this.logFile)) {
            const stats = fs.statSync(this.logFile);
            this.currentLogSize = stats.size;
            
            // Rotate if needed
            if (this.currentLogSize >= this.options.maxFileSize) {
                this.rotateLogFile();
            }
        }
    }
    
    /**
     * Rotate log file when it gets too large
     */
    rotateLogFile() {
        if (!this.logFile) return;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = this.logFile.replace('.log', `-${timestamp}.log`);
        
        try {
            if (fs.existsSync(this.logFile)) {
                fs.renameSync(this.logFile, rotatedFile);
            }
            
            this.currentLogSize = 0;
            this.cleanupOldLogs();
        } catch (error) {
            console.error('Error rotating log file:', error);
        }
    }
    
    /**
     * Clean up old log files
     */
    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.options.logDir)
                .filter(file => file.startsWith('roon-discord-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.options.logDir, file),
                    mtime: fs.statSync(path.join(this.options.logDir, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);
            
            // Remove old files beyond maxFiles limit
            if (files.length > this.options.maxFiles) {
                const filesToDelete = files.slice(this.options.maxFiles);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (error) {
                        console.error('Error deleting old log file:', error);
                    }
                });
            }
        } catch (error) {
            console.error('Error cleaning up old logs:', error);
        }
    }
    
    /**
     * Format timestamp
     */
    formatTimestamp() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 19);
    }
    
    /**
     * Safe JSON stringify that handles circular references
     */
    safeStringify(obj, indent = 2) {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, val) => {
            if (val != null && typeof val === 'object') {
                if (seen.has(val)) {
                    return '[Circular Reference]';
                }
                seen.add(val);
            }
            return val;
        }, indent);
    }

    /**
     * Format log message
     */
    formatMessage(level, category, message, data = null) {
        const timestamp = this.formatTimestamp();
        const levelName = LogLevelNames[level].padEnd(5);
        const categoryStr = category ? `[${category}]` : '';

        let formattedMessage = `${timestamp} ${levelName} ${categoryStr} ${message}`;

        if (data) {
            if (typeof data === 'object') {
                try {
                    formattedMessage += '\n' + this.safeStringify(data, 2);
                } catch (error) {
                    formattedMessage += '\n[Object - could not stringify]';
                }
            } else {
                formattedMessage += ` ${data}`;
            }
        }

        return formattedMessage;
    }
    
    /**
     * Main logging method
     */
    log(level, category, message, data = null) {
        if (level > this.options.level) return;
        
        const formattedMessage = this.formatMessage(level, category, message, data);
        const logEntry = {
            timestamp: new Date(),
            level,
            levelName: LogLevelNames[level],
            category,
            message,
            data,
            formattedMessage
        };
        
        // Console output
        if (this.options.enableConsole) {
            const consoleMethod = level === LogLevel.ERROR ? 'error' :
                                level === LogLevel.WARN ? 'warn' :
                                level === LogLevel.DEBUG ? 'debug' : 'log';
            console[consoleMethod](formattedMessage);
        }
        
        // File output
        if (this.options.enableFile && this.logFile) {
            try {
                const logLine = formattedMessage + '\n';
                fs.appendFileSync(this.logFile, logLine, 'utf8');
                this.currentLogSize += Buffer.byteLength(logLine, 'utf8');
                
                // Check if rotation is needed
                if (this.currentLogSize >= this.options.maxFileSize) {
                    this.rotateLogFile();
                }
            } catch (error) {
                console.error('Error writing to log file:', error);
            }
        }
        
        // GUI output
        if (this.options.enableGui) {
            this.emit('log-entry', logEntry);
        }
        
        return logEntry;
    }
    
    /**
     * Error logging
     */
    error(category, message, data = null) {
        return this.log(LogLevel.ERROR, category, message, data);
    }
    
    /**
     * Warning logging
     */
    warn(category, message, data = null) {
        return this.log(LogLevel.WARN, category, message, data);
    }
    
    /**
     * Info logging
     */
    info(category, message, data = null) {
        return this.log(LogLevel.INFO, category, message, data);
    }
    
    /**
     * Debug logging
     */
    debug(category, message, data = null) {
        return this.log(LogLevel.DEBUG, category, message, data);
    }
    
    /**
     * Trace logging
     */
    trace(category, message, data = null) {
        return this.log(LogLevel.TRACE, category, message, data);
    }
    
    /**
     * Set log level
     */
    setLevel(level) {
        this.options.level = level;
        this.info('Logger', `Log level set to ${LogLevelNames[level]}`);
    }
    
    /**
     * Get recent log entries
     */
    getRecentLogs(count = 100) {
        if (!this.options.enableFile || !this.logFile || !fs.existsSync(this.logFile)) {
            return [];
        }
        
        try {
            const content = fs.readFileSync(this.logFile, 'utf8');
            const lines = content.trim().split('\n');
            return lines.slice(-count);
        } catch (error) {
            console.error('Error reading log file:', error);
            return [];
        }
    }
    
    /**
     * Clear current log file
     */
    clearLogs() {
        if (this.options.enableFile && this.logFile) {
            try {
                fs.writeFileSync(this.logFile, '', 'utf8');
                this.currentLogSize = 0;
                this.info('Logger', 'Log file cleared');
            } catch (error) {
                console.error('Error clearing log file:', error);
            }
        }
    }
    
    /**
     * Get log statistics
     */
    getStats() {
        const stats = {
            logFile: this.logFile,
            currentLogSize: this.currentLogSize,
            maxFileSize: this.options.maxFileSize,
            level: this.options.level,
            levelName: LogLevelNames[this.options.level],
            enableConsole: this.options.enableConsole,
            enableFile: this.options.enableFile,
            enableGui: this.options.enableGui
        };
        
        if (this.logFile && fs.existsSync(this.logFile)) {
            try {
                const fileStats = fs.statSync(this.logFile);
                stats.fileCreated = fileStats.birthtime;
                stats.fileModified = fileStats.mtime;
                stats.actualFileSize = fileStats.size;
            } catch (error) {
                // Ignore errors
            }
        }
        
        return stats;
    }
}

// Export both the class and the log levels
Logger.LogLevel = LogLevel;
Logger.LogLevelNames = LogLevelNames;

module.exports = Logger;
