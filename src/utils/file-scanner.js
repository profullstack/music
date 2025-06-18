import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

/**
 * FileScanner class for discovering and validating music files
 * Supports the directory structure: ./music/{Artist}/{Album}/tracks.wav
 */
export class FileScanner {
  constructor(rootDir = './music') {
    this.rootDir = rootDir;
    this.supportedFormats = new Set(['wav', 'flac', 'mp3']);
  }

  /**
   * Scan the entire music directory for all artists and albums
   * @returns {Promise<Array>} Array of album objects with metadata
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
   * Scan a specific artist and album
   * @param {string} artist - Artist name
   * @param {string} album - Album name
   * @returns {Promise<Object|null>} Album object or null if not found
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

      const files = await readdir(albumPath);
      const tracks = [];

      for (const file of files) {
        const filePath = join(albumPath, file);
        const fileStat = await stat(filePath);

        if (fileStat.isFile() && this.isAudioFile(file)) {
          const trackInfo = this.extractTrackInfo(file, filePath);
          tracks.push(trackInfo);
        }
      }

      // Sort tracks by track number
      tracks.sort((a, b) => a.trackNumber - b.trackNumber);

      return {
        artist,
        album,
        path: albumPath,
        tracks,
        totalTracks: tracks.length,
      };
    } catch (error) {
      throw new Error(`Failed to scan album ${artist}/${album}: ${error.message}`);
    }
  }

  /**
   * Validate album structure and metadata
   * @param {Object} album - Album object to validate
   * @returns {Object} Validation result with valid flag and errors array
   */
  validateAlbumStructure(album) {
    const errors = [];

    if (!album) {
      errors.push('Album object is required');
      return { valid: false, errors };
    }

    if (!album.artist || album.artist.trim() === '') {
      errors.push('Artist name is required');
    }

    if (!album.album || album.album.trim() === '') {
      errors.push('Album name is required');
    }

    if (!album.tracks || album.tracks.length === 0) {
      errors.push('Album must contain at least one track');
    }

    // Validate track structure
    if (album.tracks) {
      album.tracks.forEach((track, index) => {
        if (!track.filename) {
          errors.push(`Track ${index + 1}: filename is required`);
        }
        if (!track.title) {
          errors.push(`Track ${index + 1}: title is required`);
        }
        if (!track.format || !this.supportedFormats.has(track.format)) {
          errors.push(`Track ${index + 1}: unsupported format ${track.format}`);
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
    // Expected formats: "01-title", "001-title", "1-title", etc.
    const trackMatch = nameWithoutExt.match(/^(\d+)[-\s]*(.+)$/);
    
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
}