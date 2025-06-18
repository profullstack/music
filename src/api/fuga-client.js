import { readFile } from 'fs/promises';

/**
 * FUGA API Client for music publishing
 * Handles authentication, file uploads, and metadata submission
 */
export class FugaClient {
  constructor(config) {
    if (!config) {
      throw new Error('FUGA API configuration is required');
    }

    // Check for API token first before setting up config
    if (!config.apiToken) {
      throw new Error('API token is required');
    }

    this.config = {
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      timeout: config.timeout || 300000, // 5 minutes
      ...config,
    };

    // Set default baseUrl only if not provided
    if (!this.config.baseUrl) {
      this.config.baseUrl = 'https://api.fuga.com';
    }

    this.retryConfig = {
      maxAttempts: 3,
      delayMs: 5000,
      ...config.retryConfig,
    };

    this.progressTrackers = new Map();
  }

  /**
   * Validate the client configuration
   * @returns {Object} Validation result with valid flag and errors array
   */
  validateConfiguration() {
    const errors = [];

    if (!this.config.baseUrl) {
      errors.push('Base URL is required');
    }

    if (!this.config.apiToken) {
      errors.push('API token is required');
    }

    if (!this.config.clientId) {
      errors.push('Client ID is required');
    }

    if (!this.config.clientSecret) {
      errors.push('Client secret is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build HTTP headers for API requests
   * @param {Object} additionalHeaders - Additional headers to include
   * @returns {Object} Headers object
   */
  buildHeaders(additionalHeaders = {}) {
    return {
      'Authorization': `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'fuga-music-cli/1.0.0',
      ...additionalHeaders,
    };
  }

  /**
   * Format album metadata for FUGA API
   * @param {Object} albumData - Album data from file scanner
   * @returns {Object} Formatted metadata for FUGA API
   */
  formatAlbumMetadata(albumData) {
    return {
      name: albumData.album,
      artist: albumData.artist,
      release_date: albumData.releaseDate || new Date().toISOString().split('T')[0],
      genre: albumData.genre || 'Electronic',
      label: albumData.label || 'Independent',
      tracks: albumData.tracks.map(track => ({
        name: track.title,
        track_number: track.trackNumber,
        duration: track.duration || null,
        isrc: track.isrc || null,
        explicit: track.explicit || false,
      })),
    };
  }

  /**
   * Create album in FUGA system
   * @param {Object} albumData - Album metadata
   * @returns {Promise<Object>} Created album response
   */
  async createAlbum(albumData) {
    const formattedData = this.formatAlbumMetadata(albumData);
    
    return this.makeApiRequest('POST', '/albums', formattedData);
  }

  /**
   * Upload audio file to FUGA
   * @param {string} filePath - Path to audio file
   * @param {string} albumId - FUGA album ID
   * @param {Object} trackMetadata - Track metadata
   * @param {Function} _progressCallback - Progress callback function
   * @returns {Promise<Object>} Upload response
   */
  async uploadAudioFile(filePath, albumId, trackMetadata, _progressCallback) {
    const progressTracker = this.createProgressTracker(`${albumId}-${trackMetadata.trackNumber}`);
    
    try {
      // Read file data
      const fileData = await readFile(filePath);
      
      // Create form data for file upload
      const formData = new FormData();
      formData.append('file', new Blob([fileData]), trackMetadata.filename);
      formData.append('album_id', albumId);
      formData.append('track_number', trackMetadata.trackNumber.toString());
      formData.append('title', trackMetadata.title);

      this.updateProgress(progressTracker, 10, 'uploading');

      const response = await this.makeApiRequest(
        'POST',
        '/uploads/audio',
        formData,
        {
          'Content-Type': 'multipart/form-data',
        },
        _progressCallback
      );

      this.updateProgress(progressTracker, 100, 'completed');
      return response;
    } catch (error) {
      this.updateProgress(progressTracker, 0, 'failed');
      throw error;
    }
  }

  /**
   * Make API request with retry logic
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {Object} additionalHeaders - Additional headers
   * @param {Function} _progressCallback - Progress callback
   * @returns {Promise<Object>} API response
   */
  async makeApiRequest(method, endpoint, data = null, additionalHeaders = {}, _progressCallback = null) {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = this.buildHeaders(additionalHeaders);

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const requestOptions = {
          method,
          headers,
          signal: AbortSignal.timeout(this.config.timeout),
        };

        if (data && method !== 'GET') {
          if (data instanceof FormData) {
            requestOptions.body = data;
            // Remove Content-Type header for FormData (browser will set it with boundary)
            delete requestOptions.headers['Content-Type'];
          } else {
            requestOptions.body = JSON.stringify(data);
          }
        }

        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw this.formatApiError({
            status: response.status,
            statusText: response.statusText,
            data: errorData,
          });
        }

        const responseData = await response.json();
        return responseData;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryConfig.maxAttempts && this.isRetryableError(error)) {
          console.warn(`API request failed (attempt ${attempt}/${this.retryConfig.maxAttempts}): ${error.message}`);
          await this.delay(this.retryConfig.delayMs * attempt);
          continue;
        }
        
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(error) {
    // Retry on network errors and 5xx server errors
    return (
      error.name === 'AbortError' ||
      error.message.includes('Network') ||
      error.message.includes('timeout') ||
      (error.status >= 500 && error.status < 600)
    );
  }

  /**
   * Format API error for consistent error handling
   * @param {Object} apiError - API error response
   * @returns {Error} Formatted error
   */
  formatApiError(apiError) {
    const message = `FUGA API Error (${apiError.status}): ${apiError.statusText}`;
    const details = apiError.data?.message || apiError.data?.error || 'Unknown error';
    
    const error = new Error(`${message} - ${details}`);
    error.status = apiError.status;
    error.statusText = apiError.statusText;
    error.data = apiError.data;
    
    return error;
  }

  /**
   * Format network error for consistent error handling
   * @param {Error} networkError - Network error
   * @returns {Error} Formatted error
   */
  formatNetworkError(networkError) {
    const error = new Error(`Network error: ${networkError.message}`);
    error.originalError = networkError;
    return error;
  }

  /**
   * Create progress tracker for uploads
   * @param {string} id - Unique identifier for the upload
   * @returns {Object} Progress tracker object
   */
  createProgressTracker(id) {
    const tracker = {
      id,
      progress: 0,
      status: 'pending',
      startTime: Date.now(),
      endTime: null,
    };

    this.progressTrackers.set(id, tracker);
    return tracker;
  }

  /**
   * Update progress for an upload
   * @param {Object} tracker - Progress tracker object
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} status - Current status
   */
  updateProgress(tracker, progress, status) {
    tracker.progress = progress;
    tracker.status = status;
    
    if (status === 'completed' || status === 'failed') {
      tracker.endTime = Date.now();
    }
  }

  /**
   * Get progress for an upload
   * @param {string} id - Upload identifier
   * @returns {Object|null} Progress tracker or null if not found
   */
  getProgress(id) {
    return this.progressTrackers.get(id) || null;
  }

  /**
   * Delay execution for retry logic
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Publish complete album to FUGA
   * @param {Object} albumData - Complete album data with tracks
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} Publication result
   */
  async publishAlbum(albumData, progressCallback = null) {
    try {
      // Step 1: Create album
      progressCallback?.({ step: 'creating_album', progress: 10 });
      const album = await this.createAlbum(albumData);
      
      // Step 2: Upload tracks
      const uploadResults = [];
      const totalTracks = albumData.tracks.length;
      
      for (let i = 0; i < totalTracks; i++) {
        const track = albumData.tracks[i];
        const trackProgress = 20 + (i / totalTracks) * 70; // 20-90% for uploads
        
        progressCallback?.({ 
          step: 'uploading_tracks', 
          progress: trackProgress,
          currentTrack: i + 1,
          totalTracks,
          trackName: track.title,
        });
        
        const uploadResult = await this.uploadAudioFile(
          track.path,
          album.id,
          track,
          (fileProgress) => {
            const adjustedProgress = trackProgress + (fileProgress / totalTracks) * 0.7;
            progressCallback?.({ 
              step: 'uploading_tracks', 
              progress: adjustedProgress,
              currentTrack: i + 1,
              totalTracks,
              trackName: track.title,
              fileProgress,
            });
          }
        );
        
        uploadResults.push(uploadResult);
      }
      
      // Step 3: Finalize publication
      progressCallback?.({ step: 'finalizing', progress: 95 });
      
      const publicationResult = {
        album,
        uploads: uploadResults,
        status: 'published',
        publishedAt: new Date().toISOString(),
      };
      
      progressCallback?.({ step: 'completed', progress: 100 });
      
      return publicationResult;
    } catch (error) {
      progressCallback?.({ step: 'failed', progress: 0, error: error.message });
      throw error;
    }
  }
}