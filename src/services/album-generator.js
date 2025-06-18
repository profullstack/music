import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { Generator } from './generator.js';

/**
 * AlbumGenerator service for creating multiple songs and albums
 * Handles batch processing, style variations, and album metadata generation
 */
export class AlbumGenerator {
  /**
   * Create a new AlbumGenerator instance
   * @param {SunoClient} sunoClient - Configured Suno API client
   */
  constructor(sunoClient) {
    if (!sunoClient) {
      throw new Error('Suno client is required');
    }
    this.sunoClient = sunoClient;
    this.generator = new Generator(sunoClient);
  }

  /**
   * Validate album configuration
   * @param {Object} config - Album configuration object
   * @throws {Error} If configuration is invalid
   */
  validateAlbumConfig(config) {
    if (!config?.title) {
      throw new Error('Album title is required');
    }

    if (!config?.tracks || !Array.isArray(config.tracks) || config.tracks.length === 0) {
      throw new Error('Album must have at least one track');
    }

    config.tracks.forEach((track, index) => {
      if (!track?.title) {
        throw new Error(`Track ${index + 1}: title is required`);
      }
      if (!track?.lyrics) {
        throw new Error(`Track ${index + 1}: lyrics path is required`);
      }
    });
  }

  /**
   * Generate multiple songs from the same lyrics with style variations
   * @param {Object} options - Generation options
   * @param {string} options.title - Base song title
   * @param {string} options.lyricsPath - Path to lyrics file
   * @param {number} options.count - Number of songs to generate
   * @param {string} [options.style] - Base musical style
   * @param {string} [options.output='./songs'] - Output directory
   * @param {string} [options.format='mp3'] - Output format
   * @param {Function} [progressCallback] - Progress callback function
   * @returns {Promise<Array>} Array of generation results
   */
  async generateMultipleSongs(options, progressCallback) {
    const {
      title,
      lyricsPath,
      count,
      style,
      output = './songs',
      format = 'mp3'
    } = options;

    if (!title || !lyricsPath || !count) {
      throw new Error('Title, lyrics path, and count are required');
    }

    if (count < 1 || count > 20) {
      throw new Error('Count must be between 1 and 20');
    }

    const results = [];
    const styleVariations = this.generateStyleVariations(style || '', count);

    for (let i = 0; i < count; i++) {
      this.reportProgress(progressCallback, 'generating', {
        currentTrack: i + 1,
        totalTracks: count,
        progress: Math.round((i / count) * 100)
      });

      try {
        const songTitle = count > 1 ? `${title} ${i + 1}` : title;
        const songStyle = styleVariations[i];

        const generateOptions = {
          title: songTitle,
          lyricsPath,
          style: songStyle,
          output,
          format
        };

        const result = await this.generator.generate(generateOptions, (progress) => {
          this.reportProgress(progressCallback, progress.step, {
            currentTrack: i + 1,
            totalTracks: count,
            progress: Math.round((i / count) * 100 + (progress.progress / count))
          });
        });

        results.push(result);

      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          title: count > 1 ? `${title} ${i + 1}` : title,
          trackNumber: i + 1
        });
      }
    }

    this.reportProgress(progressCallback, 'complete', {
      currentTrack: count,
      totalTracks: count,
      progress: 100
    });

    return results;
  }

  /**
   * Generate a complete album from configuration
   * @param {Object} options - Album generation options
   * @param {Object} options.albumConfig - Album configuration
   * @param {string} [options.output='./albums'] - Output directory
   * @param {string} [options.format='mp3'] - Output format
   * @param {Function} [progressCallback] - Progress callback function
   * @returns {Promise<Object>} Album generation result
   */
  async generateAlbum(options, progressCallback) {
    const {
      albumConfig,
      output = './albums',
      format = 'mp3'
    } = options;

    this.validateAlbumConfig(albumConfig);

    const albumDir = join(output, this.generator.slugifyTitle(albumConfig.title));
    await this.generator.ensureOutputDirectory(albumDir);

    const albumResults = {
      success: true,
      albumTitle: albumConfig.title,
      artist: albumConfig.artist,
      tracks: [],
      failedTracks: [],
      albumDir,
      metadataPath: null
    };

    const totalTracks = albumConfig.tracks.length;

    for (let i = 0; i < totalTracks; i++) {
      const track = albumConfig.tracks[i];
      
      this.reportProgress(progressCallback, 'generating_track', {
        currentTrack: i + 1,
        totalTracks,
        albumProgress: Math.round((i / totalTracks) * 100),
        trackTitle: track.title
      });

      try {
        // Use track-specific style or fall back to album style
        const trackStyle = track.style || albumConfig.style;

        const generateOptions = {
          title: track.title,
          lyricsPath: track.lyrics,
          style: trackStyle,
          output: albumDir,
          format
        };

        const result = await this.generator.generate(generateOptions, (progress) => {
          this.reportProgress(progressCallback, progress.step, {
            currentTrack: i + 1,
            totalTracks,
            albumProgress: Math.round((i / totalTracks) * 100 + (progress.progress / totalTracks)),
            trackTitle: track.title
          });
        });

        albumResults.tracks.push({
          ...result,
          trackNumber: i + 1,
          title: track.title
        });

      } catch (error) {
        const failedTrack = {
          success: false,
          error: error.message,
          title: track.title,
          trackNumber: i + 1
        };
        
        albumResults.failedTracks.push(failedTrack);
        albumResults.success = false;
      }
    }

    // Create album metadata
    this.reportProgress(progressCallback, 'creating_metadata', {
      currentTrack: totalTracks,
      totalTracks,
      albumProgress: 95
    });

    try {
      albumResults.metadataPath = await this.createAlbumMetadata(albumResults, albumDir);
    } catch (error) {
      console.warn('Failed to create album metadata:', error.message);
    }

    this.reportProgress(progressCallback, 'complete', {
      currentTrack: totalTracks,
      totalTracks,
      albumProgress: 100
    });

    return albumResults;
  }

  /**
   * Create album metadata file
   * @param {Object} albumData - Album generation results
   * @param {string} outputDir - Output directory
   * @returns {Promise<string>} Path to metadata file
   */
  async createAlbumMetadata(albumData, outputDir) {
    const metadata = {
      title: albumData.albumTitle,
      artist: albumData.artist,
      generatedAt: new Date().toISOString(),
      totalTracks: albumData.tracks.length,
      failedTracks: albumData.failedTracks.length,
      tracks: albumData.tracks.map(track => ({
        trackNumber: track.trackNumber,
        title: track.title,
        filename: track.filePath ? track.filePath.split('/').pop() : null,
        songId: track.songId,
        format: track.format,
        fileSize: track.fileSize
      })),
      ...(albumData.failedTracks.length > 0 && {
        failures: albumData.failedTracks.map(track => ({
          trackNumber: track.trackNumber,
          title: track.title,
          error: track.error
        }))
      })
    };

    const metadataPath = join(outputDir, 'album-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    
    return metadataPath;
  }

  /**
   * Generate style variations for multiple songs
   * @param {string} baseStyle - Base musical style
   * @param {number} count - Number of variations to generate
   * @returns {string[]} Array of style variations
   */
  generateStyleVariations(baseStyle, count) {
    if (!baseStyle || baseStyle.trim().length === 0) {
      // Default style variations when no base style provided
      const defaultStyles = [
        'indie rock',
        'electronic',
        'folk acoustic',
        'jazz fusion',
        'ambient',
        'pop rock',
        'blues',
        'classical crossover'
      ];
      
      return Array.from({ length: count }, (_, i) => 
        defaultStyles[i % defaultStyles.length]
      );
    }

    const variations = [
      '', // Original style
      'upbeat',
      'mellow',
      'intense',
      'acoustic',
      'electronic',
      'orchestral',
      'minimalist'
    ];

    return Array.from({ length: count }, (_, i) => {
      if (i === 0) return baseStyle;
      
      const variation = variations[(i % (variations.length - 1)) + 1];
      return `${variation} ${baseStyle}`;
    });
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
   * Load album configuration from file
   * @param {string} configPath - Path to album configuration file
   * @returns {Promise<Object>} Album configuration
   */
  async loadAlbumConfig(configPath) {
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // Resolve relative paths for lyrics files
      const configDir = dirname(configPath);
      config.tracks = config.tracks.map(track => ({
        ...track,
        lyrics: track.lyrics.startsWith('./') 
          ? join(configDir, track.lyrics)
          : track.lyrics
      }));

      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Album configuration file not found: ${configPath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in album configuration: ${error.message}`);
      }
      throw new Error(`Failed to load album configuration: ${error.message}`);
    }
  }

  /**
   * Get estimated generation time for album
   * @param {Object} albumConfig - Album configuration
   * @returns {number} Estimated time in seconds
   */
  estimateAlbumGenerationTime(albumConfig) {
    // Base time per track + overhead for album processing
    const baseTimePerTrack = 45; // seconds
    const albumOverhead = 30; // seconds
    
    return (albumConfig.tracks.length * baseTimePerTrack) + albumOverhead;
  }
}