import { promises as fs } from 'fs';
import { join, dirname } from 'path';

/**
 * Generator service for creating songs using Suno API
 * Handles the complete workflow from lyrics to final audio file
 */
export class Generator {
  /**
   * Create a new Generator instance
   * @param {SunoClient} sunoClient - Configured Suno API client
   */
  constructor(sunoClient) {
    if (!sunoClient) {
      throw new Error('Suno client is required');
    }
    this.sunoClient = sunoClient;
  }

  /**
   * Read lyrics from a text file
   * @param {string} filePath - Path to the lyrics file
   * @returns {Promise<string>} Lyrics content
   */
  async readLyricsFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const trimmedContent = content.trim();
      
      if (trimmedContent.length === 0) {
        throw new Error('Lyrics file is empty');
      }
      
      return trimmedContent;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Failed to read lyrics file: File not found at ${filePath}`);
      }
      
      if (error.message.includes('Lyrics file is empty')) {
        throw error;
      }
      
      throw new Error(`Failed to read lyrics file: ${error.message}`);
    }
  }

  /**
   * Convert a song title to a filesystem-safe slug
   * @param {string} title - Song title
   * @returns {string} Slugified title
   */
  slugifyTitle(title) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return 'untitled';
    }

    return title
      .trim()
      .toLowerCase()
      // Replace accented characters
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace non-alphanumeric characters with hyphens
      .replace(/[^a-z0-9]+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Collapse multiple hyphens
      .replace(/-+/g, '-')
      || 'untitled';
  }

  /**
   * Ensure output directory exists
   * @param {string} outputDir - Directory path to create
   */
  async ensureOutputDirectory(outputDir) {
    try {
      const stats = await fs.stat(outputDir);
      if (!stats.isDirectory()) {
        throw new Error(`Output path exists but is not a directory: ${outputDir}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist, create it
        await fs.mkdir(outputDir, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate filename for the song
   * @param {string} slugifiedTitle - Slugified song title
   * @param {string} [format='mp3'] - File format
   * @returns {string} Complete filename
   */
  generateFilename(slugifiedTitle, format = 'mp3') {
    const normalizedFormat = format.toLowerCase();
    return `${slugifiedTitle}.${normalizedFormat}`;
  }

  /**
   * Validate generation options
   * @param {Object} options - Options to validate
   * @throws {Error} If options are invalid
   */
  validateOptions(options) {
    if (!options?.title) {
      throw new Error('Title is required');
    }

    if (!options?.lyrics) {
      throw new Error('Lyrics are required');
    }

    if (typeof options.title !== 'string' || typeof options.lyrics !== 'string') {
      throw new Error('Title and lyrics must be strings');
    }

    if (options.format) {
      const validFormats = ['mp3', 'wav'];
      if (!validFormats.includes(options.format.toLowerCase())) {
        throw new Error(`Invalid format: ${options.format}. Supported formats: ${validFormats.join(', ')}`);
      }
    }
  }

  /**
   * Generate a song from the provided options
   * @param {Object} options - Generation options
   * @param {string} options.title - Song title
   * @param {string} options.lyricsPath - Path to lyrics file
   * @param {string} [options.style] - Musical style
   * @param {string} [options.output='./songs'] - Output directory
   * @param {string} [options.format='mp3'] - Output format
   * @param {Function} [progressCallback] - Progress callback function
   * @returns {Promise<Object>} Generation result
   */
  async generate(options, progressCallback) {
    const {
      title,
      lyricsPath,
      style,
      output = './songs',
      format = 'mp3'
    } = options;

    try {
      // Step 1: Read lyrics file
      this.reportProgress(progressCallback, 'reading_lyrics', 10);
      const lyrics = await this.readLyricsFile(lyricsPath);

      // Validate all options including the read lyrics
      this.validateOptions({ title, lyrics, format });

      // Step 2: Prepare output directory and filename
      this.reportProgress(progressCallback, 'preparing', 20);
      await this.ensureOutputDirectory(output);
      
      const slugifiedTitle = this.slugifyTitle(title);
      const filename = this.generateFilename(slugifiedTitle, format);
      const filePath = join(output, filename);

      // Step 3: Submit generation request
      this.reportProgress(progressCallback, 'submitting', 30);
      const generationParams = {
        title,
        lyrics,
        ...(style && { style })
      };

      const generationResponse = await this.sunoClient.generateSong(generationParams);

      // Step 4: Poll until completion
      this.reportProgress(progressCallback, 'waiting', 40);
      const completedGeneration = await this.sunoClient.pollUntilComplete(
        generationResponse.id,
        {
          maxAttempts: 60,
          intervalMs: 5000
        }
      );

      // Step 5: Download the song
      this.reportProgress(progressCallback, 'downloading', 80);
      const songData = await this.sunoClient.downloadSong(completedGeneration.downloadUrl);

      // Step 6: Save to file
      this.reportProgress(progressCallback, 'saving', 90);
      await fs.writeFile(filePath, Buffer.from(songData));

      // Step 7: Complete
      this.reportProgress(progressCallback, 'complete', 100);

      return {
        success: true,
        filePath,
        songId: generationResponse.id,
        title,
        format,
        fileSize: songData.byteLength
      };

    } catch (error) {
      throw new Error(`Failed to generate song: ${error.message}`);
    }
  }

  /**
   * Report progress to callback if provided
   * @param {Function} [callback] - Progress callback
   * @param {string} step - Current step
   * @param {number} progress - Progress percentage (0-100)
   */
  reportProgress(callback, step, progress) {
    if (typeof callback === 'function') {
      callback({ step, progress });
    }
  }

  /**
   * Get supported audio formats
   * @returns {string[]} Array of supported formats
   */
  static getSupportedFormats() {
    return ['mp3', 'wav'];
  }

  /**
   * Validate a lyrics file without reading its full content
   * @param {string} filePath - Path to lyrics file
   * @returns {Promise<Object>} Validation result
   */
  async validateLyricsFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        return {
          valid: false,
          error: 'Path is not a file'
        };
      }

      if (stats.size === 0) {
        return {
          valid: false,
          error: 'File is empty'
        };
      }

      // Check if file is readable by attempting to read first few bytes
      const handle = await fs.open(filePath, 'r');
      await handle.close();

      return {
        valid: true,
        size: stats.size
      };

    } catch (error) {
      return {
        valid: false,
        error: error.code === 'ENOENT' ? 'File not found' : error.message
      };
    }
  }

  /**
   * Get estimated generation time based on lyrics length
   * @param {string} lyrics - Song lyrics
   * @returns {number} Estimated time in seconds
   */
  estimateGenerationTime(lyrics) {
    // Basic estimation: ~30 seconds base + 1 second per 10 words
    const wordCount = lyrics.trim().split(/\s+/).length;
    return Math.max(30, 30 + Math.floor(wordCount / 10));
  }
}