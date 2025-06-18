import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { DistroKidClient } from '../api/distrokid-client.js';

/**
 * DistroKid Publisher service
 * High-level service for publishing albums to DistroKid
 * Integrates with existing album generation and file scanning
 */
export class DistroKidPublisher {
  /**
   * Create a new DistroKid publisher
   * @param {Object} config - Publisher configuration
   * @param {string} config.email - DistroKid account email
   * @param {string} config.password - DistroKid account password
   * @param {boolean} [config.headless=true] - Run browser in headless mode
   * @param {boolean} [config.previewMode=false] - Only preview, don't submit
   * @param {string} [config.screenshotPath='./screenshots'] - Screenshot directory
   * @param {number} [config.retries=3] - Number of retry attempts
   */
  constructor(config) {
    if (!config) {
      throw new Error('Configuration is required');
    }

    this.config = {
      headless: true,
      previewMode: false,
      screenshotPath: './screenshots',
      retries: 3,
      ...config
    };

    this.client = null;
    this.isInitialized = false;

    // Supported audio formats
    this.audioFormats = ['.mp3', '.wav', '.flac', '.m4a', '.aac'];
    
    // Supported image formats
    this.imageFormats = ['.jpg', '.jpeg', '.png', '.gif'];
  }

  /**
   * Initialize the publisher and authenticate
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      this.client = new DistroKidClient(this.config);
      await this.client.initialize();
      
      const loginSuccess = await this.client.login();
      if (!loginSuccess) {
        return false;
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      throw new Error(`Failed to initialize DistroKid publisher: ${error.message}`);
    }
  }

  /**
   * Publish an album from a directory structure
   * @param {string} albumPath - Path to album directory
   * @param {Function} [progressCallback] - Progress callback function
   * @returns {Promise<Object>} Publishing result
   */
  async publishAlbum(albumPath, progressCallback) {
    if (!this.isInitialized) {
      throw new Error('Publisher must be initialized before publishing');
    }

    try {
      this.reportProgress(progressCallback, 'scanning_directory', { progress: 0 });

      // Scan album directory
      const albumData = await this.scanAlbumDirectory(albumPath);
      
      this.reportProgress(progressCallback, 'creating_album', { 
        progress: 10,
        albumTitle: albumData.title 
      });

      // Create album on DistroKid
      const albumResult = await this.retryOperation(async () => {
        return await this.client.createAlbum({
          title: albumData.title,
          artist: albumData.artist,
          genre: albumData.genre,
          releaseDate: albumData.releaseDate,
          artwork: albumData.artwork
        });
      });

      if (!albumResult.success) {
        return {
          success: false,
          error: albumResult.error || 'Failed to create album'
        };
      }

      const result = {
        success: true,
        albumId: albumResult.albumId,
        albumTitle: albumData.title,
        artist: albumData.artist,
        tracks: [],
        failedTracks: [],
        screenshots: []
      };

      // Upload tracks
      const totalTracks = albumData.tracks.length;
      for (let i = 0; i < totalTracks; i++) {
        const track = albumData.tracks[i];
        
        this.reportProgress(progressCallback, 'uploading_track', {
          progress: 20 + (i / totalTracks) * 60,
          currentTrack: i + 1,
          totalTracks,
          trackTitle: track.title
        });

        try {
          const trackResult = await this.retryOperation(async () => {
            return await this.client.uploadTrack(albumResult.albumId, {
              filePath: track.filePath,
              title: track.title,
              artist: track.artist || albumData.artist,
              lyrics: track.lyrics
            });
          });

          if (trackResult.success) {
            result.tracks.push({
              ...trackResult,
              trackNumber: i + 1,
              title: track.title
            });
          } else {
            result.failedTracks.push({
              trackNumber: i + 1,
              title: track.title,
              error: trackResult.error
            });
          }
        } catch (error) {
          result.failedTracks.push({
            trackNumber: i + 1,
            title: track.title,
            error: error.message
          });
        }

        // Take screenshot after each track
        await this.takeScreenshot(`track-${i + 1}-uploaded`);
      }

      this.reportProgress(progressCallback, 'generating_preview', { progress: 85 });

      // Generate preview
      const previewResult = await this.client.previewAlbum(albumResult.albumId);
      if (previewResult.success) {
        result.previewUrl = previewResult.previewUrl;
        await this.takeScreenshot('album-preview');
      }

      // Submit album if not in preview mode
      if (!this.config.previewMode) {
        this.reportProgress(progressCallback, 'submitting_album', { progress: 95 });

        const submitResult = await this.client.submitAlbum(albumResult.albumId);
        if (submitResult.success) {
          result.submissionId = submitResult.submissionId;
          await this.takeScreenshot('album-submitted');
        } else {
          result.submitError = submitResult.error;
        }
      }

      this.reportProgress(progressCallback, 'complete', { progress: 100 });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Publish album from AlbumGenerator results
   * @param {Object} albumResults - Results from AlbumGenerator
   * @param {Function} [progressCallback] - Progress callback function
   * @returns {Promise<Object>} Publishing result
   */
  async publishFromAlbumGenerator(albumResults, progressCallback) {
    if (!albumResults) {
      throw new Error('Album results are required');
    }

    if (!albumResults.success) {
      throw new Error('Album generation was not successful');
    }

    if (!this.isInitialized) {
      throw new Error('Publisher must be initialized before publishing');
    }

    try {
      this.reportProgress(progressCallback, 'processing_generated_album', { progress: 0 });

      // Convert AlbumGenerator results to DistroKid format
      const albumData = {
        title: albumResults.albumTitle,
        artist: albumResults.artist,
        tracks: albumResults.tracks.map(track => ({
          title: track.title,
          filePath: track.filePath,
          artist: albumResults.artist,
          trackNumber: track.trackNumber
        }))
      };

      // Look for artwork in album directory
      if (albumResults.albumDir) {
        const artworkPath = await this.findArtwork(albumResults.albumDir);
        if (artworkPath) {
          albumData.artwork = artworkPath;
        }
      }

      this.reportProgress(progressCallback, 'creating_album', { 
        progress: 10,
        albumTitle: albumData.title 
      });

      // Create album on DistroKid
      const albumResult = await this.retryOperation(async () => {
        return await this.client.createAlbum(albumData);
      });

      if (!albumResult.success) {
        return {
          success: false,
          error: albumResult.error || 'Failed to create album'
        };
      }

      const result = {
        success: true,
        albumId: albumResult.albumId,
        albumTitle: albumData.title,
        artist: albumData.artist,
        tracks: [],
        failedTracks: []
      };

      // Upload tracks
      const totalTracks = albumData.tracks.length;
      for (let i = 0; i < totalTracks; i++) {
        const track = albumData.tracks[i];
        
        this.reportProgress(progressCallback, 'uploading_track', {
          progress: 20 + (i / totalTracks) * 60,
          currentTrack: i + 1,
          totalTracks,
          trackTitle: track.title
        });

        try {
          const trackResult = await this.retryOperation(async () => {
            return await this.client.uploadTrack(albumResult.albumId, track);
          });

          if (trackResult.success) {
            result.tracks.push({
              ...trackResult,
              trackNumber: track.trackNumber,
              title: track.title
            });
          } else {
            result.failedTracks.push({
              trackNumber: track.trackNumber,
              title: track.title,
              error: trackResult.error
            });
          }
        } catch (error) {
          result.failedTracks.push({
            trackNumber: track.trackNumber,
            title: track.title,
            error: error.message
          });
        }
      }

      // Generate preview and optionally submit
      const previewResult = await this.client.previewAlbum(albumResult.albumId);
      if (previewResult.success) {
        result.previewUrl = previewResult.previewUrl;
      }

      if (!this.config.previewMode) {
        const submitResult = await this.client.submitAlbum(albumResult.albumId);
        if (submitResult.success) {
          result.submissionId = submitResult.submissionId;
        }
      }

      this.reportProgress(progressCallback, 'complete', { progress: 100 });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Scan album directory and extract metadata
   * @param {string} albumPath - Path to album directory
   * @returns {Promise<Object>} Album data
   */
  async scanAlbumDirectory(albumPath) {
    try {
      const files = await fs.readdir(albumPath);
      const albumName = basename(albumPath);
      
      const tracks = [];
      let artwork = null;
      let lyricsContent = null;

      // Process files
      for (const file of files) {
        const filePath = join(albumPath, file);
        const stat = await fs.stat(filePath);
        
        if (!stat.isFile()) continue;

        const ext = extname(file).toLowerCase();
        
        // Audio files
        if (this.audioFormats.includes(ext)) {
          const trackTitle = this.extractTrackTitle(file);
          const trackData = {
            title: trackTitle,
            filePath,
            artist: null // Will use album artist
          };

          // Look for corresponding lyrics file
          const lyricsPath = await this.findLyricsForTrack(albumPath, trackTitle);
          if (lyricsPath) {
            trackData.lyrics = await fs.readFile(lyricsPath, 'utf8');
          }

          tracks.push(trackData);
        }
        
        // Artwork files
        else if (this.imageFormats.includes(ext) && !artwork) {
          if (file.toLowerCase().includes('artwork') || 
              file.toLowerCase().includes('cover') ||
              file.toLowerCase().includes('album')) {
            artwork = filePath;
          }
        }
        
        // Lyrics files
        else if (ext === '.txt' && file.toLowerCase().includes('lyrics')) {
          lyricsContent = await fs.readFile(filePath, 'utf8');
        }
      }

      // Sort tracks by filename/track number
      tracks.sort((a, b) => {
        const aNum = this.extractTrackNumber(basename(a.filePath));
        const bNum = this.extractTrackNumber(basename(b.filePath));
        return aNum - bNum;
      });

      // Apply global lyrics if no track-specific lyrics found
      if (lyricsContent && tracks.some(track => !track.lyrics)) {
        tracks.forEach(track => {
          if (!track.lyrics) {
            track.lyrics = lyricsContent;
          }
        });
      }

      return {
        title: albumName,
        artist: this.extractArtistFromPath(albumPath),
        tracks,
        artwork,
        genre: 'Electronic', // Default genre
        releaseDate: new Date().toISOString().split('T')[0] // Today
      };
    } catch (error) {
      throw new Error(`Failed to scan album directory: ${error.message}`);
    }
  }

  /**
   * Find artwork file in directory
   * @param {string} directory - Directory to search
   * @returns {Promise<string|null>} Artwork file path
   */
  async findArtwork(directory) {
    try {
      const files = await fs.readdir(directory);
      
      for (const file of files) {
        const ext = extname(file).toLowerCase();
        if (this.imageFormats.includes(ext)) {
          const fileName = file.toLowerCase();
          if (fileName.includes('artwork') || 
              fileName.includes('cover') ||
              fileName.includes('album')) {
            return join(directory, file);
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find lyrics file for specific track
   * @param {string} albumPath - Album directory path
   * @param {string} trackTitle - Track title
   * @returns {Promise<string|null>} Lyrics file path
   */
  async findLyricsForTrack(albumPath, trackTitle) {
    try {
      const files = await fs.readdir(albumPath);
      const trackSlug = trackTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      for (const file of files) {
        if (extname(file).toLowerCase() === '.txt') {
          const fileName = file.toLowerCase();
          if (fileName.includes(trackSlug) || fileName.includes(trackTitle.toLowerCase())) {
            return join(albumPath, file);
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract track title from filename
   * @param {string} filename - Audio filename
   * @returns {string} Track title
   */
  extractTrackTitle(filename) {
    const nameWithoutExt = basename(filename, extname(filename));
    
    // Remove track numbers and common prefixes
    return nameWithoutExt
      .replace(/^\d+[-.\s]*/, '') // Remove leading numbers
      .replace(/^track[-.\s]*\d+[-.\s]*/i, '') // Remove "Track 01"
      .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
      .trim();
  }

  /**
   * Extract track number from filename
   * @param {string} filename - Audio filename
   * @returns {number} Track number
   */
  extractTrackNumber(filename) {
    const match = filename.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 999;
  }

  /**
   * Extract artist name from album path
   * @param {string} albumPath - Album directory path
   * @returns {string} Artist name
   */
  extractArtistFromPath(albumPath) {
    const pathParts = albumPath.split('/').filter(part => part.length > 0);
    
    // Look for artist name in path (usually parent directory)
    if (pathParts.length >= 2) {
      return pathParts[pathParts.length - 2];
    }
    
    return 'Unknown Artist';
  }

  /**
   * Take screenshot with timestamp
   * @param {string} step - Current step name
   * @returns {Promise<Buffer|null>} Screenshot buffer
   */
  async takeScreenshot(step) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}-${step}.png`;
      const screenshotPath = join(this.config.screenshotPath, filename);
      
      return await this.client.takeScreenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
    } catch (error) {
      console.warn(`Failed to take screenshot for step '${step}':`, error.message);
      return null;
    }
  }

  /**
   * Retry operation with exponential backoff
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
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Report progress to callback if provided
   * @param {Function} [callback] - Progress callback
   * @param {string} step - Current step
   * @param {Object} progress - Progress information
   */
  reportProgress(callback, step, progress) {
    if (typeof callback === 'function') {
      callback({ step, ...progress });
    }
  }

  /**
   * Close publisher and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      
      this.isInitialized = false;
    } catch (error) {
      console.warn('Error during publisher cleanup:', error.message);
    }
  }
}