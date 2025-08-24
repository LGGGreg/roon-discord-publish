const SpotifyWebApi = require('spotify-web-api-node');
const ConnectionManager = require('./ConnectionManager');

/**
 * SpotifyService - Manages Spotify Web API connection with robust retry logic
 */
class SpotifyService extends ConnectionManager {
    constructor(configManager, options = {}) {
        super('Spotify', {
            maxRetries: Infinity, // Infinite retries
            initialRetryDelay: 2000,
            maxRetryDelay: 10000, // Cap at 10 seconds for faster perpetual retries
            healthCheckInterval: 300000, // Check every 5 minutes
            connectionTimeout: 10000,
            perpetualRetry: true, // Enable perpetual retries
            perpetualRetryInterval: 10000, // Retry every 10 seconds when in perpetual mode
            ...options
        });
        
        this.configManager = configManager;
        this.spotifyApi = null;
        this.tokenExpiration = Date.now();
        this.searchCache = new Map();
        this.maxCacheSize = 100;
        
        // Bind methods
        this.refreshToken = this.refreshToken.bind(this);
    }
    
    /**
     * Check if service can connect (has required credentials)
     * @returns {boolean} Can connect
     */
    canConnect() {
        const clientId = this.configManager.get('spotify.client');
        const clientSecret = this.configManager.get('spotify.secret');
        return !!(clientId && clientId.trim() && clientSecret && clientSecret.trim());
    }

    /**
     * Connect to Spotify API
     */
    async connect() {
        try {
            // Don't reconnect if already connected and working
            if (this.isConnected() && this.spotifyApi && this.tokenExpiration > Date.now()) {
                console.log('Spotify already connected and token valid, skipping reconnection');
                return true;
            }

            console.log('Spotify: Starting connection process...');

            // Get configuration
            const clientId = this.configManager.get('spotify.client');
            const clientSecret = this.configManager.get('spotify.secret');

            if (!this.canConnect()) {
                throw new Error('Spotify client ID and secret are required');
            }

            // Create Spotify API instance
            this.spotifyApi = new SpotifyWebApi({
                clientId: clientId,
                clientSecret: clientSecret
            });

            // Get access token using client credentials flow
            console.log('Spotify: About to refresh token...');
            await this.refreshToken();
            console.log('Spotify: Token obtained successfully');

            // Test the connection
            console.log('Spotify: About to test connection...');
            await this.testConnection();
            console.log('Spotify: Connection test passed');

            this.setState('connected', 'Connected to Spotify API');
            console.log('Spotify: Connected successfully - returning true');

            return true;

        } catch (error) {
            console.error('Spotify connection error:', error);

            // Provide more specific error messages
            let errorMessage = 'Connection failed';
            if (error.statusCode === 400) {
                errorMessage = 'Invalid client credentials';
            } else if (error.statusCode === 401) {
                errorMessage = 'Unauthorized - check credentials';
            } else if (error.statusCode === 403) {
                errorMessage = 'Forbidden - check app permissions';
            } else if (error.message) {
                errorMessage = error.message;
            }

            this.setState('disconnected', errorMessage);
            throw error;
        }
    }
    
    /**
     * Disconnect from Spotify API
     */
    async disconnect() {
        try {
            this.spotifyApi = null;
            this.tokenExpiration = Date.now();
            this.searchCache.clear();
            
            this.setState('disconnected', 'Disconnected from Spotify API');
            console.log('Spotify: Disconnected');
            
        } catch (error) {
            console.error('Spotify disconnect error:', error);
        }
    }
    
    /**
     * Refresh Spotify access token
     */
    async refreshToken() {
        if (!this.spotifyApi) {
            throw new Error('Spotify API not initialized');
        }

        try {
            console.log('Spotify: Refreshing access token...');
            const data = await this.spotifyApi.clientCredentialsGrant();

            this.tokenExpiration = Date.now() + (data.body['expires_in'] * 1000);
            this.spotifyApi.setAccessToken(data.body['access_token']);

            console.log('Spotify: Access token refreshed, expires in', data.body['expires_in'], 'seconds');

        } catch (error) {
            console.error('Spotify token refresh error:', error);
            throw error;
        }
    }
    
    /**
     * Test the Spotify connection
     */
    async testConnection() {
        if (!this.spotifyApi) {
            throw new Error('Spotify API not initialized');
        }

        try {
            console.log('Spotify: Testing connection with search...');
            // Simple search to test the connection
            const result = await this.spotifyApi.searchTracks('test', { limit: 1 });
            console.log('Spotify: Search test successful, found', result.body.tracks.total, 'tracks');
            return true;
        } catch (error) {
            console.log('Spotify: Search test failed:', error.message, 'Status:', error.statusCode);
            if (error.statusCode === 401) {
                console.log('Spotify: Token expired, trying to refresh...');
                // Token expired, try to refresh
                await this.refreshToken();
                console.log('Spotify: Token refreshed, retrying search...');
                const result = await this.spotifyApi.searchTracks('test', { limit: 1 });
                console.log('Spotify: Retry search successful, found', result.body.tracks.total, 'tracks');
                return true;
            }
            throw error;
        }
    }
    
    /**
     * Search for a track and return Spotify URL
     */
    async searchTrack(title, artist, album = '') {
        if (!this.isConnected() || !this.spotifyApi) {
            throw new Error('Not connected to Spotify');
        }
        
        // Create cache key
        const cacheKey = `${title}|${artist}|${album}`.toLowerCase();
        
        // Check cache first
        if (this.searchCache.has(cacheKey)) {
            console.log('Spotify: Using cached result for', title);
            return this.searchCache.get(cacheKey);
        }
        
        try {
            // Check if token needs refresh
            if (this.tokenExpiration < Date.now()) {
                await this.refreshToken();
            }
            
            // Build search query
            let query = `track:"${title}"`;
            if (artist) {
                query += ` artist:"${artist}"`;
            }
            if (album) {
                query += ` album:"${album}"`;
            }
            
            console.log('Spotify: Searching for:', query);
            
            const data = await this.spotifyApi.searchTracks(query, { limit: 5 });
            
            let spotifyUrl = '';
            
            if (data?.body?.tracks?.items?.length > 0) {
                const track = data.body.tracks.items[0];
                spotifyUrl = track.external_urls?.spotify || '';
                console.log('Spotify: Found track:', track.name, 'by', track.artists[0]?.name);
            } else {
                // Try fallback searches
                spotifyUrl = await this.fallbackSearch(title, artist, album);
            }
            
            // Cache the result
            this.cacheResult(cacheKey, spotifyUrl);
            
            return spotifyUrl;
            
        } catch (error) {
            console.error('Spotify search error:', error);
            
            if (error.statusCode === 401) {
                // Token expired, try to refresh and retry
                try {
                    await this.refreshToken();
                    return await this.searchTrack(title, artist, album);
                } catch (refreshError) {
                    console.error('Spotify token refresh failed:', refreshError);
                }
            }
            
            // Cache empty result to avoid repeated failures
            this.cacheResult(cacheKey, '');
            return '';
        }
    }
    
    /**
     * Fallback search strategies
     */
    async fallbackSearch(title, artist, album) {
        const fallbackQueries = [
            // Try with just title and first artist (in case of multiple artists)
            artist.includes('/') ? `track:"${title}" artist:"${artist.split('/')[0].trim()}"` : null,
            // Try with just title and artist (no album)
            artist ? `track:"${title}" artist:"${artist}"` : null,
            // Try with just title
            `track:"${title}"`,
            // Try with just artist and title (no quotes)
            artist ? `${title} ${artist}` : null
        ].filter(Boolean);
        
        for (const query of fallbackQueries) {
            try {
                console.log('Spotify: Trying fallback search:', query);
                const data = await this.spotifyApi.searchTracks(query, { limit: 3 });
                
                if (data?.body?.tracks?.items?.length > 0) {
                    const track = data.body.tracks.items[0];
                    const url = track.external_urls?.spotify || '';
                    if (url) {
                        console.log('Spotify: Fallback found:', track.name);
                        return url;
                    }
                }
            } catch (error) {
                console.log('Spotify: Fallback search failed:', error.message);
                continue;
            }
        }
        
        return '';
    }
    
    /**
     * Cache search result
     */
    cacheResult(key, value) {
        // Implement LRU cache behavior
        if (this.searchCache.size >= this.maxCacheSize) {
            const firstKey = this.searchCache.keys().next().value;
            this.searchCache.delete(firstKey);
        }
        
        this.searchCache.set(key, value);
    }
    
    /**
     * Get service statistics
     */
    getStats() {
        const baseStats = super.getStats();
        
        return {
            ...baseStats,
            tokenExpiration: this.tokenExpiration,
            tokenValid: this.tokenExpiration > Date.now(),
            cacheSize: this.searchCache.size,
            clientId: this.configManager.get('spotify.client') ? 'configured' : 'not configured',
            clientSecret: this.configManager.get('spotify.secret') ? 'configured' : 'not configured'
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
            // Check if token is still valid
            if (this.tokenExpiration < Date.now() + 60000) { // Refresh if expires in 1 minute
                await this.refreshToken();
            }
            
            // Test with a simple search
            await this.testConnection();
            return true;
            
        } catch (error) {
            console.error('Spotify health check failed:', error);
            return false;
        }
    }
}

module.exports = SpotifyService;
