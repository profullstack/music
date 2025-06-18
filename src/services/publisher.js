import { FugaClient } from '../api/fuga-client.js';
import { TuneCoreClient } from '../api/tunecore-client.js';
import { FileScanner } from '../utils/file-scanner.js';
import { MetadataScanner } from '../utils/metadata-scanner.js';

/**
 * Unified publisher service that handles both FUGA and TuneCore publishing
 * Automatically detects the appropriate platform based on directory structure
 */
export class Publisher {
  constructor() {
    this.fileScanner = new FileScanner();
    this.metadataScanner = new MetadataScanner();
  }

  /**
   * Detect which platform to use based on directory structure
   * @param {string} directoryPath - Path to scan
   * @returns {Promise<string>} Platform name ('fuga' or 'tunecore')
   */
  async detectPlatform(directoryPath) {
    try {
      // TuneCore uses structured metadata.json files
      const hasMetadataFile = await this.metadataScanner.hasMetadataFile(directoryPath);
      return hasMetadataFile ? 'tunecore' : 'fuga';
    } catch (error) {
      throw new Error(`Failed to detect platform: ${error.message}`);
    }
  }

  /**
   * Publish music to the appropriate platform
   * @param {string} directoryPath - Path containing music files
   * @param {Object} config - Configuration for both platforms
   * @param {Object} options - Additional publishing options
   * @returns {Promise<Object>} Publishing result
   */
  async publish(directoryPath, config, options = {}) {
    try {
      // Detect platform
      const platform = await this.detectPlatform(directoryPath);
      
      // Validate configuration
      this.validateConfig(config, platform);

      // Scan directory based on platform
      const scanResult = await this.scanDirectory(directoryPath, platform);
      
      // Get publishing options
      const publishOptions = await this.getPublishOptions(scanResult, platform);

      // Publish to appropriate platform
      const result = await this.publishToPlatform(
        platform,
        config[platform],
        publishOptions,
        options
      );

      return {
        platform,
        releaseId: result.id,
        status: result.status,
        ...result
      };
    } catch (error) {
      throw new Error(`Publishing failed: ${error.message}`);
    }
  }

  /**
   * Scan directory based on platform requirements
   * @param {string} directoryPath - Path to scan
   * @param {string} platform - Platform name
   * @returns {Promise<Object|Array>} Scan results
   */
  async scanDirectory(directoryPath, platform) {
    if (platform === 'tunecore') {
      return await this.metadataScanner.scanDirectory(directoryPath);
    } else if (platform === 'fuga') {
      return await this.fileScanner.scanDirectory(directoryPath);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Convert scan results to platform-specific publishing options
   * @param {Object|Array} scanResult - Results from directory scan
   * @param {string} platform - Platform name
   * @returns {Promise<Object>} Publishing options
   */
  async getPublishOptions(scanResult, platform) {
    if (platform === 'tunecore') {
      // TuneCore expects structured metadata
      const { metadata, tracks } = scanResult;
      return {
        ...metadata,
        tracks: tracks.map(track => ({
          file: track.file,
          ...track.metadata
        }))
      };
    } else if (platform === 'fuga') {
      // FUGA expects array of tracks with embedded metadata
      return {
        tracks: scanResult.map(track => ({
          file: track.file,
          ...track.metadata
        }))
      };
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Publish to specific platform
   * @param {string} platform - Platform name
   * @param {Object} platformConfig - Platform-specific configuration
   * @param {Object} publishOptions - Publishing options
   * @param {Object} additionalOptions - Additional options
   * @returns {Promise<Object>} Publishing result
   */
  async publishToPlatform(platform, platformConfig, publishOptions, additionalOptions = {}) {
    if (platform === 'tunecore') {
      const client = new TuneCoreClient(platformConfig);
      try {
        return await client.uploadRelease(publishOptions, additionalOptions);
      } catch (error) {
        throw new Error(`TuneCore upload failed: ${error.message}`);
      }
    } else if (platform === 'fuga') {
      const client = new FugaClient(platformConfig);
      try {
        return await client.createRelease(publishOptions, additionalOptions);
      } catch (error) {
        throw new Error(`FUGA upload failed: ${error.message}`);
      }
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Validate configuration for specified platform
   * @param {Object} config - Full configuration object
   * @param {string} platform - Platform to validate
   * @throws {Error} If configuration is invalid
   */
  validateConfig(config, platform) {
    if (platform === 'fuga') {
      if (!config.fuga) {
        throw new Error('FUGA configuration is required when publishing to FUGA');
      }
      
      const { apiKey, baseUrl } = config.fuga;
      if (!apiKey || !baseUrl) {
        throw new Error('FUGA configuration must include apiKey and baseUrl');
      }
    } else if (platform === 'tunecore') {
      if (!config.tunecore) {
        throw new Error('TuneCore configuration is required when publishing to TuneCore');
      }
      
      const { partnerId, apiKey, baseUrl } = config.tunecore;
      if (!partnerId || !apiKey || !baseUrl) {
        throw new Error('TuneCore configuration must include partnerId, apiKey, and baseUrl');
      }
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get supported platforms
   * @returns {Array<string>} List of supported platforms
   */
  getSupportedPlatforms() {
    return ['fuga', 'tunecore'];
  }

  /**
   * Get platform requirements
   * @param {string} platform - Platform name
   * @returns {Object} Platform requirements
   */
  getPlatformRequirements(platform) {
    const requirements = {
      fuga: {
        configFields: ['apiKey', 'baseUrl'],
        metadataSource: 'embedded',
        supportedFormats: ['mp3', 'wav', 'flac'],
        description: 'Uses embedded metadata from audio files'
      },
      tunecore: {
        configFields: ['partnerId', 'apiKey', 'baseUrl'],
        metadataSource: 'structured',
        supportedFormats: ['mp3', 'wav', 'flac'],
        description: 'Requires metadata.json file with structured album/track information'
      }
    };

    if (!requirements[platform]) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return requirements[platform];
  }
}