import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import {
  createBrowser,
  createPage,
  waitForSelector,
  safeClick,
  safeType,
  uploadFile,
  takeScreenshot,
  handleDialog,
  waitForNavigation,
  scrollToElement
} from '../utils/puppeteer-helpers.js';

/**
 * DistroKid automation client using Puppeteer
 * Handles album creation, track uploads, and submission workflow
 */
export class DistroKidClient {
  /**
   * Create a new DistroKid client
   * @param {Object} config - Client configuration
   * @param {string} config.email - DistroKid account email
   * @param {string} config.password - DistroKid account password
   * @param {boolean} [config.headless=true] - Run browser in headless mode
   * @param {number} [config.timeout=30000] - Default timeout in milliseconds
   * @param {number} [config.retries=3] - Number of retry attempts
   * @param {string} [config.screenshotPath='./screenshots'] - Screenshot directory
   */
  constructor(config) {
    this.validateConfig(config);
    
    this.config = {
      headless: true,
      timeout: 30000,
      retries: 3,
      screenshotPath: './screenshots',
      ...config
    };
    
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
    
    // DistroKid URLs
    this.urls = {
      login: 'https://distrokid.com/signin',
      dashboard: 'https://distrokid.com/dashboard',
      upload: 'https://distrokid.com/upload',
      albums: 'https://distrokid.com/albums'
    };
    
    // CSS selectors for DistroKid interface
    this.selectors = {
      // Login page
      emailInput: 'input[name="email"], input[type="email"]',
      passwordInput: 'input[name="password"], input[type="password"]',
      loginButton: 'button[type="submit"], .login-button, .signin-button',
      loginError: '.error, .alert-danger, .login-error',
      
      // Dashboard
      dashboardIndicator: '.dashboard, .user-menu, .upload-button',
      uploadButton: '.upload-button, [href*="upload"]',
      
      // Album creation
      albumTitleInput: 'input[name="album_title"], #album-title',
      artistNameInput: 'input[name="artist_name"], #artist-name',
      genreSelect: 'select[name="genre"], #genre',
      releaseDateInput: 'input[name="release_date"], #release-date',
      artworkUpload: 'input[type="file"][accept*="image"]',
      
      // Track upload
      trackUpload: 'input[type="file"][accept*="audio"]',
      trackTitleInput: 'input[name="track_title"], .track-title',
      trackArtistInput: 'input[name="track_artist"], .track-artist',
      lyricsTextarea: 'textarea[name="lyrics"], .lyrics-input',
      
      // Preview and submission
      previewButton: '.preview-button, [data-action="preview"]',
      submitButton: '.submit-button, [data-action="submit"]',
      confirmSubmit: '.confirm-submit, .final-submit',
      
      // Progress indicators
      uploadProgress: '.upload-progress, .progress-bar',
      processingIndicator: '.processing, .spinner, .loading'
    };
  }

  /**
   * Validate client configuration
   * @param {Object} config - Configuration to validate
   * @throws {Error} If configuration is invalid
   */
  static validateConfig(config) {
    if (!config?.email) {
      throw new Error('Email is required');
    }
    
    if (!config?.password) {
      throw new Error('Password is required');
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.email)) {
      throw new Error('Invalid email format');
    }
    
    if (config.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
  }

  /**
   * Validate configuration (instance method)
   * @param {Object} config - Configuration to validate
   */
  validateConfig(config) {
    DistroKidClient.validateConfig(config);
  }

  /**
   * Initialize browser and page
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.browser = await this.createBrowser();
      this.page = await createPage(this.browser, {
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      // Set up dialog handlers
      handleDialog(this.page, 'accept');
      
      // Enable request interception for debugging if needed
      if (!this.config.headless) {
        await this.page.setRequestInterception(false);
      }
      
    } catch (error) {
      throw new Error(`Failed to initialize DistroKid client: ${error.message}`);
    }
  }

  /**
   * Create browser instance with stealth mode
   * @returns {Promise<Browser>} Browser instance
   */
  async createBrowser() {
    return await createBrowser({
      headless: this.config.headless,
      stealth: true,
      slowMo: this.config.headless ? 0 : 100,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }

  /**
   * Login to DistroKid account
   * @returns {Promise<boolean>} Success status
   */
  async login() {
    try {
      // Check if already logged in
      await this.page.goto(this.urls.dashboard, { waitUntil: 'networkidle2' });
      
      if (await this.isSessionValid()) {
        this.isAuthenticated = true;
        return true;
      }
      
      // Navigate to login page
      await this.page.goto(this.urls.login, { waitUntil: 'networkidle2' });
      
      // Fill login form
      await this.retryOperation(async () => {
        await safeType(this.page, this.selectors.emailInput, this.config.email, { clear: true });
        await safeType(this.page, this.selectors.passwordInput, this.config.password, { clear: true });
      });
      
      // Submit login form
      await Promise.all([
        waitForNavigation(this.page, { timeout: this.config.timeout }),
        safeClick(this.page, this.selectors.loginButton)
      ]);
      
      // Check for login errors
      try {
        await waitForSelector(this.page, this.selectors.loginError, { timeout: 3000 });
        console.warn('Login error detected');
        return false;
      } catch (error) {
        // No error element found, continue
      }
      
      // Verify successful login
      if (await this.isSessionValid()) {
        this.isAuthenticated = true;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login failed:', error.message);
      return false;
    }
  }

  /**
   * Check if current session is valid
   * @returns {Promise<boolean>} Session validity
   */
  async isSessionValid() {
    try {
      const currentUrl = this.page.url();
      
      // Check if we're on dashboard or other authenticated pages
      if (currentUrl.includes('/dashboard') || 
          currentUrl.includes('/upload') || 
          currentUrl.includes('/albums')) {
        return true;
      }
      
      // Try to find dashboard indicators
      try {
        await waitForSelector(this.page, this.selectors.dashboardIndicator, { timeout: 5000 });
        return true;
      } catch (error) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure user is authenticated, login if necessary
   * @returns {Promise<boolean>} Authentication status
   */
  async ensureAuthenticated() {
    if (this.isAuthenticated && await this.isSessionValid()) {
      return true;
    }
    
    return await this.login();
  }

  /**
   * Create a new album
   * @param {Object} albumData - Album metadata
   * @param {string} albumData.title - Album title
   * @param {string} albumData.artist - Artist name
   * @param {string} [albumData.genre] - Music genre
   * @param {string} [albumData.releaseDate] - Release date (YYYY-MM-DD)
   * @param {string} [albumData.artwork] - Path to artwork file
   * @param {string} [albumData.banner] - Path to banner file
   * @returns {Promise<Object>} Creation result
   */
  async createAlbum(albumData) {
    if (!this.isAuthenticated) {
      throw new Error('Must be authenticated to create album');
    }
    
    this.validateAlbumData(albumData);
    
    try {
      // Navigate to upload page
      await this.page.goto(this.urls.upload, { waitUntil: 'networkidle2' });
      
      // Fill album metadata
      await this.retryOperation(async () => {
        if (albumData.title) {
          await safeType(this.page, this.selectors.albumTitleInput, albumData.title, { clear: true });
        }
        
        if (albumData.artist) {
          await safeType(this.page, this.selectors.artistNameInput, albumData.artist, { clear: true });
        }
        
        if (albumData.genre) {
          await this.selectGenre(albumData.genre);
        }
        
        if (albumData.releaseDate) {
          await safeType(this.page, this.selectors.releaseDateInput, albumData.releaseDate, { clear: true });
        }
      });
      
      // Upload artwork if provided
      if (albumData.artwork) {
        await this.uploadArtwork(albumData.artwork);
      }
      
      // Generate album ID (mock for now)
      const albumId = `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        albumId,
        title: albumData.title,
        artist: albumData.artist
      };
    } catch (error) {
      throw new Error(`Failed to create album: ${error.message}`);
    }
  }

  /**
   * Validate album data
   * @param {Object} albumData - Album data to validate
   * @throws {Error} If data is invalid
   */
  validateAlbumData(albumData) {
    if (!albumData?.title) {
      throw new Error('Album title is required');
    }
    
    if (!albumData?.artist) {
      throw new Error('Artist name is required');
    }
  }

  /**
   * Select genre from dropdown
   * @param {string} genre - Genre to select
   * @returns {Promise<boolean>} Success status
   */
  async selectGenre(genre) {
    try {
      await safeClick(this.page, this.selectors.genreSelect);
      
      if (this.page && this.page.waitForTimeout) {
        await this.page.waitForTimeout(500);
      }
      
      // Try to select the genre option
      const genreOption = `option[value="${genre}"], option:contains("${genre}")`;
      return await safeClick(this.page, genreOption);
    } catch (error) {
      console.warn(`Failed to select genre '${genre}':`, error.message);
      return false;
    }
  }

  /**
   * Upload artwork file
   * @param {string} artworkPath - Path to artwork file
   * @returns {Promise<boolean>} Success status
   */
  async uploadArtwork(artworkPath) {
    try {
      // Verify file exists
      await fs.access(artworkPath);
      
      return await uploadFile(this.page, this.selectors.artworkUpload, artworkPath);
    } catch (error) {
      console.warn(`Failed to upload artwork:`, error.message);
      return false;
    }
  }

  /**
   * Upload a track to an album
   * @param {string} albumId - Album identifier
   * @param {Object} trackData - Track metadata and file
   * @param {string} trackData.filePath - Path to audio file
   * @param {string} trackData.title - Track title
   * @param {string} [trackData.artist] - Track artist (if different from album)
   * @param {string} [trackData.lyrics] - Track lyrics
   * @returns {Promise<Object>} Upload result
   */
  async uploadTrack(albumId, trackData) {
    if (!this.isAuthenticated) {
      throw new Error('Must be authenticated to upload track');
    }
    
    try {
      // Verify track file exists
      await fs.access(trackData.filePath);
      
      // Upload the audio file
      const uploadSuccess = await uploadFile(this.page, this.selectors.trackUpload, trackData.filePath);
      
      if (!uploadSuccess) {
        return {
          success: false,
          error: 'Failed to upload audio file'
        };
      }
      
      // Wait for upload to complete
      await this.waitForUploadComplete();
      
      // Fill track metadata
      await this.retryOperation(async () => {
        if (trackData.title) {
          await safeType(this.page, this.selectors.trackTitleInput, trackData.title, { clear: true });
        }
        
        if (trackData.artist) {
          await safeType(this.page, this.selectors.trackArtistInput, trackData.artist, { clear: true });
        }
        
        if (trackData.lyrics) {
          await safeType(this.page, this.selectors.lyricsTextarea, trackData.lyrics, { clear: true });
        }
      });
      
      const trackId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        trackId,
        title: trackData.title,
        albumId
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Track file not found: ${trackData.filePath}`);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Wait for file upload to complete
   * @returns {Promise<void>}
   */
  async waitForUploadComplete() {
    try {
      // Wait for upload progress to appear
      await waitForSelector(this.page, this.selectors.uploadProgress, { timeout: 10000 });
      
      // Wait for upload progress to disappear (upload complete)
      if (this.page && this.page.waitForFunction) {
        await this.page.waitForFunction(
          (selector) => !document.querySelector(selector),
          { timeout: 300000 }, // 5 minutes max
          this.selectors.uploadProgress
        );
      }
      
      // Additional wait for processing
      if (this.page && this.page.waitForTimeout) {
        await this.page.waitForTimeout(2000);
      }
    } catch (error) {
      console.warn('Upload progress tracking failed:', error.message);
    }
  }

  /**
   * Generate preview for album
   * @param {string} albumId - Album identifier
   * @returns {Promise<Object>} Preview result
   */
  async previewAlbum(albumId) {
    try {
      // Click preview button
      const previewClicked = await safeClick(this.page, this.selectors.previewButton);
      
      if (!previewClicked) {
        return {
          success: false,
          error: 'Preview button not found'
        };
      }
      
      // Wait for preview to load
      await this.page.waitForTimeout(3000);
      
      const previewUrl = this.page.url();
      
      return {
        success: true,
        albumId,
        previewUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Submit album for distribution
   * @param {string} albumId - Album identifier
   * @returns {Promise<Object>} Submission result
   */
  async submitAlbum(albumId) {
    try {
      // Click submit button
      const submitClicked = await safeClick(this.page, this.selectors.submitButton);
      
      if (!submitClicked) {
        return {
          success: false,
          error: 'Submit button not found'
        };
      }
      
      // Handle confirmation dialog if present
      await this.page.waitForTimeout(1000);
      await safeClick(this.page, this.selectors.confirmSubmit);
      
      // Wait for submission to process
      await this.page.waitForTimeout(5000);
      
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        albumId,
        submissionId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Take screenshot of current page
   * @param {Object} [options] - Screenshot options
   * @returns {Promise<Buffer>} Screenshot buffer
   */
  async takeScreenshot(options = {}) {
    const screenshotOptions = {
      path: options.path,
      fullPage: options.fullPage || false,
      type: options.type || 'png'
    };
    
    return await takeScreenshot(this.page, screenshotOptions);
  }

  /**
   * Retry an operation with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {number} [maxRetries] - Maximum retry attempts
   * @returns {Promise<any>} Operation result
   */
  async retryOperation(operation, maxRetries = this.config.retries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.page.waitForTimeout(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Close browser and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.isAuthenticated = false;
    } catch (error) {
      console.warn('Error during cleanup:', error.message);
    }
  }
}