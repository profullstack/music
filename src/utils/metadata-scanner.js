import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';

/**
 * MetadataScanner class for discovering and processing music files with metadata.json
 * Supports the directory structure: ./music/{Artist}/{Album}/metadata.json + audio files
 */
export class MetadataScanner {
  constructor(rootDir = './music') {
    this.rootDir = rootDir;
    this.supportedFormats = new Set(['wav', 'flac', 'mp3']);
  }

  /**
   * Scan the entire music directory for all artists and albums with metadata
   * @returns {Promise<Array>} Array of album objects with metadata and tracks
   */
  async scanMusicDirectory() {
    try {
      const artists = await this.getDirectories(this.rootDir);
      const albums = [];

      for (const artist of artists) {
        const artistPath = join(this.rootDir, artist);
        const albumDirs = await this.getDirectories(artistPath);

        for (const album of albumDirs) {
          const albumData = await this.scanSpecificAlbum(artist, album);
          if (albumData) {
            albums.push(albumData);
          }
        }
      }

      return albums;
    } catch (error) {
      throw new Error(`Failed to scan music directory: ${error.message}`);
    }
  }

  /**
   * Scan a specific artist and album with metadata
   * @param {string} artist - Artist name
   * @param {string} album - Album name
   * @returns {Promise<Object|null>} Album object with metadata or null if not found
   */
  async scanSpecificAlbum(artist, album) {
    try {
      const albumPath = join(this.rootDir, artist, album);
      
      // Check if album directory exists
      try {
        await stat(albumPath);
      } catch {
        return null;
      }

      // Load metadata.json
      const metadata = await this.loadMetadata(albumPath);
      if (!metadata) {
        console.warn(`No metadata.json found for ${artist}/${album}`);
        return null;
      }

      // Scan audio files
      const audioFiles = await this.scanAudioFiles(albumPath);
      
      // Match audio files with metadata tracks
      const tracks = this.matchTracksWithMetadata(audioFiles, metadata.tracks);

      return {
        artist,
        album,
        path: albumPath,
        metadata,
        tracks,
        totalTracks: tracks.length,
      };
    } catch (error) {
      throw new Error(`Failed to scan album ${artist}/${album}: ${error.message}`);
    }
  }

  /**
   * Load metadata from metadata.json file
   * @param {string} albumPath - Path to album directory
   * @returns {Promise<Object|null>} Parsed metadata or null if not found/invalid
   */
  async loadMetadata(albumPath) {
    try {
      const metadataPath = join(albumPath, 'metadata.json');
      const metadataContent = await readFile(metadataPath, 'utf-8');
      return JSON.parse(metadataContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.warn(`Failed to parse metadata.json in ${albumPath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Scan audio files in album directory
   * @param {string} albumPath - Path to album directory
   * @returns {Promise<Array>} Array of audio file objects
   */
  async scanAudioFiles(albumPath) {
    try {
      const files = await readdir(albumPath);
      const audioFiles = [];

      for (const file of files) {
        const filePath = join(albumPath, file);
        const fileStat = await stat(filePath);

        if (fileStat.isFile() && this.isAudioFile(file)) {
          const trackInfo = this.extractTrackInfo(file, filePath);
          audioFiles.push(trackInfo);
        }
      }

      // Sort by track number
      audioFiles.sort((a, b) => a.trackNumber - b.trackNumber);
      return audioFiles;
    } catch (error) {
      throw new Error(`Failed to scan audio files in ${albumPath}: ${error.message}`);
    }
  }

  /**
   * Match audio files with metadata tracks
   * @param {Array} audioFiles - Array of audio file objects
   * @param {Array} metadataTracks - Array of track metadata
   * @returns {Array} Array of matched track objects
   */
  matchTracksWithMetadata(audioFiles, metadataTracks) {
    const matchedTracks = [];

    for (const audioFile of audioFiles) {
      // Try to find matching metadata track by title
      const metadataTrack = metadataTracks.find(track => 
        this.normalizeTitle(track.title) === this.normalizeTitle(audioFile.title)
      );

      if (metadataTrack) {
        matchedTracks.push({
          ...audioFile,
          ...metadataTrack,
          // Keep the original filename and path from audio file
          filename: audioFile.filename,
          path: audioFile.path,
          format: audioFile.format,
          trackNumber: audioFile.trackNumber,
        });
      } else {
        // Include audio file even without metadata match
        matchedTracks.push({
          ...audioFile,
          isrc: null,
          explicit: false,
        });
      }
    }

    return matchedTracks;
  }

  /**
   * Normalize title for matching (remove extra spaces, convert to lowercase)
   * @param {string} title - Title to normalize
   * @returns {string} Normalized title
   */
  normalizeTitle(title) {
    return title?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
  }

  /**
   * Validate album data structure and consistency
   * @param {Object} albumData - Album data to validate
   * @returns {Object} Validation result with valid flag and errors array
   */
  validateAlbumData(albumData) {
    const errors = [];

    if (!albumData) {
      errors.push('Album data is required');
      return { valid: false, errors };
    }

    if (!albumData.metadata) {
      errors.push('Metadata is required');
      return { valid: false, errors };
    }

    // Validate metadata structure
    const metadata = albumData.metadata;
    if (!metadata.artist || metadata.artist.trim() === '') {
      errors.push('Artist name is required in metadata');
    }

    if (!metadata.album || metadata.album.trim() === '') {
      errors.push('Album title is required in metadata');
    }

    if (!metadata.tracks || metadata.tracks.length === 0) {
      errors.push('At least one track is required in metadata');
    }

    // Validate track count consistency
    if (albumData.tracks && metadata.tracks) {
      const audioFileCount = albumData.tracks.length;
      const metadataTrackCount = metadata.tracks.length;
      
      if (audioFileCount !== metadataTrackCount) {
        errors.push(`Track count mismatch: metadata has ${metadataTrackCount} tracks, found ${audioFileCount} audio files`);
      }
    }

    // Validate UPC format if provided
    if (metadata.upc && !/^\d{12}$/.test(metadata.upc)) {
      errors.push('UPC must be 12 digits');
    }

    // Validate ISRC codes if provided
    if (metadata.tracks) {
      metadata.tracks.forEach((track, index) => {
        if (track.isrc && !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(track.isrc)) {
          errors.push(`Track ${index + 1} (${track.title}): Invalid ISRC format`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get directories in a given path
   * @param {string} dirPath - Directory path
   * @returns {Promise<Array>} Array of directory names
   */
  async getDirectories(dirPath) {
    try {
      const items = await readdir(dirPath);
      const directories = [];

      for (const item of items) {
        const itemPath = join(dirPath, item);
        const itemStat = await stat(itemPath);
        if (itemStat.isDirectory()) {
          directories.push(item);
        }
      }

      return directories;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Check if a file is a supported audio file
   * @param {string} filename - File name
   * @returns {boolean} True if supported audio file
   */
  isAudioFile(filename) {
    const ext = extname(filename).toLowerCase().slice(1);
    return this.supportedFormats.has(ext);
  }

  /**
   * Extract track information from filename
   * @param {string} filename - Audio file name
   * @param {string} filePath - Full file path
   * @returns {Object} Track information object
   */
  extractTrackInfo(filename, filePath) {
    const ext = extname(filename).toLowerCase().slice(1);
    const nameWithoutExt = basename(filename, extname(filename));
    
    // Try to extract track number and title from filename
    // Expected formats: "01 - Title", "1 - Title", "01-Title", etc.
    const trackMatch = nameWithoutExt.match(/^(\d+)\s*[-\s]+(.+)$/);
    
    let trackNumber = 1;
    let title = nameWithoutExt;

    if (trackMatch) {
      trackNumber = parseInt(trackMatch[1], 10);
      title = trackMatch[2].trim();
    }

    return {
      filename,
      path: filePath,
      trackNumber,
      title,
      format: ext,
    };
  }

  /**
   * Create sample metadata.json structure
   * @param {string} artist - Artist name
   * @param {string} album - Album name
   * @param {Array} tracks - Array of track objects
   * @returns {Object} Sample metadata structure
   */
  createSampleMetadata(artist, album, tracks) {
    return {
      artist,
      album,
      genre: 'Other',
      release_date: new Date().toISOString().split('T')[0],
      upc: null,
      explicit: false,
      tracks: tracks.map(track => ({
        title: track.title,
        isrc: null,
        explicit: false,
      })),
    };
  }
}