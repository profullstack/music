/**
 * Suno API Client for song generation
 * Handles authentication, song generation requests, polling, and downloads
 */
export class SunoClient {
  /**
   * Create a new Suno API client
   * @param {Object} config - Configuration object
   * @param {string} config.apiToken - Suno API token
   * @param {string} [config.baseUrl] - Base URL for Suno API
   */
  constructor(config) {
    this.config = this.validateAndNormalizeConfig(config);
  }

  /**
   * Validate and normalize configuration
   * @param {Object} config - Raw configuration
   * @returns {Object} Validated configuration
   */
  validateAndNormalizeConfig(config) {
    SunoClient.validateConfig(config);
    
    return {
      apiToken: config.apiToken,
      baseUrl: config.baseUrl || 'https://api.sunoapi.org',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3
    };
  }

  /**
   * Static method to validate configuration
   * @param {Object} config - Configuration to validate
   * @throws {Error} If configuration is invalid
   */
  static validateConfig(config) {
    if (!config?.apiToken) {
      throw new Error('API token is required');
    }

    if (config.baseUrl && !this.isValidUrl(config.baseUrl)) {
      throw new Error('Invalid base URL');
    }
  }

  /**
   * Check if a string is a valid URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a song using the Suno API
   * @param {Object} params - Generation parameters
   * @param {string} params.title - Song title
   * @param {string} params.lyrics - Song lyrics
   * @param {string} [params.style] - Musical style/genre
   * @returns {Promise<Object>} Generation response with ID and status
   */
  async generateSong(params) {
    this.validateGenerationParams(params);

    const requestBody = {
      title: params.title,
      lyrics: params.lyrics,
      ...(params.style && { style: params.style })
    };

    try {
      const response = await this.makeRequest('/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to generate song: ${error.message}`);
    }
  }

  /**
   * Validate generation parameters
   * @param {Object} params - Parameters to validate
   * @throws {Error} If parameters are invalid
   */
  validateGenerationParams(params) {
    if (!params?.title || !params?.lyrics) {
      throw new Error('Title and lyrics are required');
    }

    if (typeof params.title !== 'string' || typeof params.lyrics !== 'string') {
      throw new Error('Title and lyrics must be strings');
    }

    if (params.title.trim().length === 0 || params.lyrics.trim().length === 0) {
      throw new Error('Title and lyrics cannot be empty');
    }
  }

  /**
   * Get the status of a song generation
   * @param {string} songId - ID of the song generation
   * @returns {Promise<Object>} Status response
   */
  async getGenerationStatus(songId) {
    if (!songId) {
      throw new Error('Song ID is required');
    }

    try {
      const response = await this.makeRequest(`/generate/${songId}`);
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get generation status: ${error.message}`);
    }
  }

  /**
   * Poll until song generation is complete
   * @param {string} songId - ID of the song generation
   * @param {Object} [options] - Polling options
   * @param {number} [options.maxAttempts=60] - Maximum polling attempts
   * @param {number} [options.intervalMs=5000] - Polling interval in milliseconds
   * @returns {Promise<Object>} Final generation result
   */
  async pollUntilComplete(songId, options = {}) {
    const { maxAttempts = 60, intervalMs = 5000 } = options;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getGenerationStatus(songId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Generation failed: ${status.error || 'Unknown error'}`);
      }

      attempts++;
      
      if (attempts < maxAttempts) {
        await this.sleep(intervalMs);
      }
    }

    throw new Error(`Generation timed out after ${maxAttempts} attempts`);
  }

  /**
   * Download a song from the given URL
   * @param {string} downloadUrl - URL to download the song from
   * @returns {Promise<ArrayBuffer>} Song data as ArrayBuffer
   */
  async downloadSong(downloadUrl) {
    if (!downloadUrl) {
      throw new Error('Download URL is required');
    }

    try {
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      throw new Error(`Failed to download song: ${error.message}`);
    }
  }

  /**
   * Make an authenticated request to the Suno API
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {Object} [options] - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const requestOptions = {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'User-Agent': 'music-generator-cli/1.0.0',
        ...options.headers
      }
    };

    let lastError;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
        }

        return response;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.maxRetries && this.isRetryableError(error)) {
          await this.sleep(1000 * Math.pow(2, attempt)); // Exponential backoff
          continue;
        }
        
        break;
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    const statusMatch = error.message.match(/HTTP (\d+):/);
    
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return retryableStatuses.includes(status);
    }

    // Network errors are generally retryable
    return error.code === 'ECONNRESET' || 
           error.code === 'ENOTFOUND' || 
           error.code === 'ECONNREFUSED';
  }

  /**
   * Sleep for the specified number of milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}