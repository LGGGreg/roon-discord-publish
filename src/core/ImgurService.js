const imgur = require('imgur-node-api');
const ImgurAnonymousUploader = require('imgur-anonymous-uploader');
const ConnectionManager = require('./ConnectionManager');
const fs = require('fs');
const path = require('path');

/**
 * ImgurService - Manages Imgur API connection and image uploading
 */
class ImgurService extends ConnectionManager {
    constructor(configManager, options = {}) {
        super('Imgur', {
            maxRetries: 3,
            initialRetryDelay: 2000,
            maxRetryDelay: 15000,
            healthCheckInterval: 600000, // Check every 10 minutes
            connectionTimeout: 30000, // 30 seconds for uploads
            ...options
        });
        
        this.configManager = configManager;
        this.uploader = null;
        this.uploadCache = new Map();
        this.maxCacheSize = 50;
        this.tempDir = path.join(__dirname, '../../temp');
        
        // Ensure temp directory exists
        this.ensureTempDir();
    }
    
    /**
     * Ensure temp directory exists
     */
    ensureTempDir() {
        try {
            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
        } catch (error) {
            console.error('Error creating temp directory:', error);
        }
    }
    
    /**
     * Connect to Imgur API
     */
    async connect() {
        try {
            // Don't reconnect if already connected
            if (this.isConnected() && this.uploader) {
                console.log('Imgur already connected, skipping reconnection');
                return true;
            }
            
            // Get configuration
            const clientId = this.configManager.get('imgur.clientId');
            
            if (!clientId) {
                throw new Error('Imgur client ID is required');
            }
            
            // Initialize Imgur API
            imgur.setClientID(clientId);
            this.uploader = new ImgurAnonymousUploader(clientId);
            
            // Test the connection
            await this.testConnection();
            
            this.setState('connected', 'Connected to Imgur API');
            console.log('Imgur: Connected successfully');
            
            return true;
            
        } catch (error) {
            console.error('Imgur connection error:', error);
            this.setState('disconnected', 'Connection failed', error.message);
            throw error;
        }
    }
    
    /**
     * Disconnect from Imgur API
     */
    async disconnect() {
        try {
            this.uploader = null;
            this.uploadCache.clear();
            
            // Clean up temp files
            this.cleanupTempFiles();
            
            this.setState('disconnected', 'Disconnected from Imgur API');
            console.log('Imgur: Disconnected');
            
        } catch (error) {
            console.error('Imgur disconnect error:', error);
        }
    }
    
    /**
     * Test the Imgur connection
     */
    async testConnection() {
        if (!this.uploader) {
            throw new Error('Imgur uploader not initialized');
        }
        
        try {
            // Create a small test image
            const testImagePath = path.join(this.tempDir, 'test.png');
            const testImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
            
            fs.writeFileSync(testImagePath, testImageData);
            
            // Try to upload the test image
            const result = await this.uploader.upload(testImagePath);
            
            // Clean up test file
            fs.unlinkSync(testImagePath);
            
            if (result && result.url) {
                console.log('Imgur: Test upload successful');
                return true;
            } else {
                throw new Error('Test upload failed - no URL returned');
            }
            
        } catch (error) {
            console.error('Imgur test connection failed:', error);
            throw error;
        }
    }
    
    /**
     * Upload image from buffer or file path
     */
    async uploadImage(imageData, imageKey = null) {
        if (!this.isConnected() || !this.uploader) {
            throw new Error('Not connected to Imgur');
        }
        
        // Check cache first
        if (imageKey && this.uploadCache.has(imageKey)) {
            console.log('Imgur: Using cached upload for', imageKey);
            return this.uploadCache.get(imageKey);
        }
        
        let tempFilePath = null;
        
        try {
            // Handle different input types
            if (typeof imageData === 'string') {
                // Assume it's a file path
                tempFilePath = imageData;
            } else if (Buffer.isBuffer(imageData)) {
                // Create temp file from buffer
                tempFilePath = path.join(this.tempDir, `upload-${Date.now()}.tmp`);
                fs.writeFileSync(tempFilePath, imageData);
            } else {
                throw new Error('Invalid image data type');
            }
            
            if (!fs.existsSync(tempFilePath)) {
                throw new Error('Image file does not exist');
            }
            
            console.log('Imgur: Uploading image...');
            const uploadResult = await this.uploader.upload(tempFilePath);
            
            if (!uploadResult || !uploadResult.url) {
                throw new Error('Upload failed - no URL returned');
            }
            
            console.log('Imgur: Upload successful:', uploadResult.url);
            
            // Cache the result
            if (imageKey) {
                this.cacheUpload(imageKey, uploadResult);
            }
            
            return uploadResult;
            
        } catch (error) {
            console.error('Imgur upload error:', error);
            throw error;
        } finally {
            // Clean up temp file if we created it
            if (tempFilePath && typeof imageData !== 'string') {
                try {
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                } catch (cleanupError) {
                    console.error('Error cleaning up temp file:', cleanupError);
                }
            }
        }
    }
    
    /**
     * Upload Roon album art
     */
    async uploadRoonImage(roonImageService, imageKey, options = {}) {
        if (!imageKey || imageKey === 'undefined') {
            return { url: '', delete_hash: '' };
        }
        
        // Check cache first
        if (this.uploadCache.has(imageKey)) {
            console.log('Imgur: Using cached Roon image for', imageKey);
            return this.uploadCache.get(imageKey);
        }
        
        const tempFilePath = path.join(this.tempDir, `${imageKey}.tmp`);
        
        try {
            // Get image from Roon
            const imageOptions = {
                scale: 'fit',
                width: 200,
                height: 200,
                ...options
            };
            
            console.log('Imgur: Downloading Roon image key=', imageKey);
            
            const imageData = await new Promise((resolve, reject) => {
                roonImageService.get_image(imageKey, imageOptions, (error, contentType, image) => {
                    if (error || !image) {
                        reject(new Error('Failed to get image from Roon'));
                        return;
                    }
                    resolve(image);
                });
            });
            
            // Write to temp file
            fs.writeFileSync(tempFilePath, imageData);
            
            // Upload to Imgur
            const uploadResult = await this.uploadImage(tempFilePath, imageKey);
            
            return uploadResult;
            
        } catch (error) {
            console.error('Imgur Roon image upload error:', error);
            
            // Cache empty result to avoid repeated failures
            const emptyResult = { url: '', delete_hash: '' };
            this.cacheUpload(imageKey, emptyResult);
            
            return emptyResult;
        } finally {
            // Clean up temp file
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            } catch (cleanupError) {
                console.error('Error cleaning up Roon temp file:', cleanupError);
            }
        }
    }
    
    /**
     * Cache upload result
     */
    cacheUpload(key, result) {
        // Implement LRU cache behavior
        if (this.uploadCache.size >= this.maxCacheSize) {
            const firstKey = this.uploadCache.keys().next().value;
            this.uploadCache.delete(firstKey);
        }
        
        this.uploadCache.set(key, result);
    }
    
    /**
     * Clean up temp files
     */
    cleanupTempFiles() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    const filePath = path.join(this.tempDir, file);
                    const stats = fs.statSync(filePath);
                    
                    // Delete files older than 1 hour
                    if (Date.now() - stats.mtime.getTime() > 3600000) {
                        fs.unlinkSync(filePath);
                        console.log('Imgur: Cleaned up old temp file:', file);
                    }
                }
            }
        } catch (error) {
            console.error('Error cleaning up temp files:', error);
        }
    }
    
    /**
     * Get service statistics
     */
    getStats() {
        const baseStats = super.getStats();
        
        return {
            ...baseStats,
            cacheSize: this.uploadCache.size,
            clientId: this.configManager.get('imgur.clientId') ? 'configured' : 'not configured',
            tempDir: this.tempDir
        };
    }
    
    /**
     * Health check
     */
    async performHealthCheck() {
        if (!this.isConnected()) {
            return false;
        }
        
        try {
            // Clean up old temp files during health check
            this.cleanupTempFiles();
            
            // Test connection is too expensive for regular health checks
            // Just verify the uploader is still available
            return this.uploader !== null;
            
        } catch (error) {
            console.error('Imgur health check failed:', error);
            return false;
        }
    }
}

module.exports = ImgurService;
