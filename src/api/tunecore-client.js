import { readFile } from 'fs/promises';

/**
 * TuneCore API Client for music distribution
 * Handles authentication, file uploads, and metadata submission via TuneCoreDirect API
 */
export class TuneCoreClient {
  constructor(config) {
    if (!config) {
      throw new Error('TuneCore API configuration is required');
    }

    // Check for required fields first
    if (!config.apiToken) {
      throw new Error('API token is required');
    }

    if (!config.partnerId) {
      throw new Error('Partner ID is required');
    }

    this.config = {
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      partnerId: config.partnerId,
      timeout: config.timeout || 300000, // 5 minutes
      ...config,
    };

    // Set default baseUrl if not provided
    if (!this.config.baseUrl) {
      this.config.baseUrl = 'https://api.tunecoredirect.com';
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

    if (!this.config.partnerId) {
      errors.push('Partner ID is required');
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
      'X-Partner-ID': this.config.partnerId,
      'User-Agent': 'tunecore-music-cli/1.0.0',
      ...additionalHeaders,
    };
  }

  /**
   * Validate metadata structure and content
   * @param {Object} metadata - Metadata object to validate
   * @returns {Object} Validation result
   */
  validateMetadata(metadata) {
    const errors = [];

    if (!metadata) {
      errors.push('Metadata object is required');
      return { valid: false, errors };
    }

    // Required fields
    if (!metadata.artist || metadata.artist.trim() === '') {
      errors.push('Artist name is required');
    }

    if (!metadata.album || metadata.album.trim() === '') {
      errors.push('Album title is required');
    }

    if (!metadata.tracks || metadata.tracks.length === 0) {
      errors.push('At least one track is required');
    }

    // UPC validation (optional but if provided, must be valid)
    if (metadata.upc && !/^\d{12}$/.test(metadata.upc)) {
      errors.push('UPC must be 12 digits');
    }

    // Track validation
    if (metadata.tracks) {
      metadata.tracks.forEach((track, index) => {
        if (!track.title || track.title.trim() === '') {
          errors.push(`Track ${index + 1}: Title is required`);
        }

        // ISRC validation (optional but if provided, must be valid)
        if (track.isrc && !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(track.isrc)) {
          errors.push(`${track.title || `Track ${index + 1}`}: Invalid ISRC format`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format album metadata for TuneCore API
   * @param {Object} albumData - Album data with metadata
   * @returns {Object} Formatted metadata for TuneCore API
   */
  formatAlbumMetadata(albumData) {
    return {
      title: albumData.album,
      artist_name: albumData.artist,
      genre: albumData.genre || 'Other',
      release_date: albumData.release_date || new Date().toISOString().split('T')[0],
      upc: albumData.upc || null,
      explicit: albumData.explicit || false,
      tracks: albumData.tracks.map((track, index) => ({
        title: track.title,
        track_number: track.trackNumber || index + 1,
        isrc: track.isrc || null,
        explicit: track.explicit || false,
      })),
    };
  }

  /**
   * Format artist data for TuneCore API
   * @param {Object} artistData - Artist information
   * @returns {Object} Formatted artist data
   */
  formatArtistData(artistData) {
    return {
      name: artistData.name,
      email: artistData.email,
      country: artistData.country || 'US',
      phone: artistData.phone || null,
      address: artistData.address || null,
    };
  }

  /**
   * Create artist account in TuneCore
   * @param {Object} artistData - Artist information
   * @returns {Promise<Object>} Created artist response
   */
  async createArtist(artistData) {
    const formattedData = this.formatArtistData(artistData);
    return this.makeApiRequest('POST', '/artists', formattedData);
  }

  /**
   * Create album in TuneCore system
   * @param {Object} albumData - Album metadata
   * @returns {Promise<Object>} Created album response
   */
  async createAlbum(albumData) {
    const formattedData = this.formatAlbumMetadata(albumData);
    return this.makeApiRequest('POST', '/albums', formattedData);
  }

  /**
   * Upload audio file to TuneCore
   * @param {string} filePath - Path to audio file
   * @param {string} albumId - TuneCore album ID
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

      if (trackMetadata.isrc) {
        formData.append('isrc', trackMetadata.isrc);
      }

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
    const message = `TuneCore API Error (${apiError.status}): ${apiError.statusText}`;
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
   * Distribute complete album to TuneCore
   * @param {Object} albumData - Complete album data with tracks and metadata
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} Distribution result
   */
  async distributeAlbum(albumData, progressCallback = null) {
    try {
      // Step 1: Validate metadata
      progressCallback?.({ step: 'validating_metadata', progress: 5 });
      const validation = this.validateMetadata(albumData.metadata);
      if (!validation.valid) {
        throw new Error(`Metadata validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 2: Create artist if needed
      progressCallback?.({ step: 'creating_artist', progress: 10 });
      let artist = null;
      if (albumData.artistData) {
        artist = await this.createArtist(albumData.artistData);
      }

      // Step 3: Create album
      progressCallback?.({ step: 'creating_album', progress: 20 });
      const album = await this.createAlbum(albumData.metadata);
      
      // Step 4: Upload tracks
      const uploadResults = [];
      const totalTracks = albumData.tracks.length;
      
      for (let i = 0; i < totalTracks; i++) {
        const track = albumData.tracks[i];
        const trackProgress = 30 + (i / totalTracks) * 60; // 30-90% for uploads
        
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
            const adjustedProgress = trackProgress + (fileProgress / totalTracks) * 0.6;
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
      
      // Step 5: Finalize distribution
      progressCallback?.({ step: 'finalizing', progress: 95 });
      
      const distributionResult = {
        artist,
        album,
        uploads: uploadResults,
        status: 'distributed',
        distributedAt: new Date().toISOString(),
      };
      
      progressCallback?.({ step: 'completed', progress: 100 });
      
      return distributionResult;
    } catch (error) {
      progressCallback?.({ step: 'failed', progress: 0, error: error.message });
      throw error;
    }
  }
}