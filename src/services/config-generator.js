import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import readline from 'readline';

/**
 * Configuration Generator service
 * Creates interactive prompts to generate track and album configuration files
 */
export class ConfigGenerator {
  /**
   * Create a new ConfigGenerator
   * @param {Object} options - Generator options
   * @param {string} [options.outputDir='./configs'] - Output directory for config files
   */
  constructor(options = {}) {
    this.outputDir = options.outputDir || './configs';
  }

  /**
   * Generate a track configuration file with user prompts
   * @param {Object} [trackData] - Pre-filled track data
   * @param {string} [outputDir] - Custom output directory
   * @returns {Promise<Object>} Generation result
   */
  async generateTrackConfig(trackData = null, outputDir = null) {
    const targetDir = outputDir || this.outputDir;
    
    let data;
    if (trackData) {
      // Use provided data (for testing or programmatic use)
      data = trackData;
    } else {
      // Interactive prompts
      console.log('🎵 DistroKid Track Configuration Generator');
      console.log('==========================================\n');
      
      data = await this.promptTrackData();
    }

    // Validate the data
    this.validateTrackData(data);

    // Generate configuration object
    const config = {
      distrokidCredentials: {
        email: data.email,
        password: data.password
      },
      trackData: {
        title: data.title,
        artist: data.artist,
        filePath: data.filePath,
        explicit: data.explicit || false,
        instrumental: data.instrumental || false,
        isRadioEdit: data.isRadioEdit || false,
        isCoverSong: data.isCoverSong || false,
        songwriters: data.songwriters || [
          {
            role: 'Music and lyrics',
            firstName: data.songwriterFirstName || '',
            middleName: data.songwriterMiddleName || '',
            lastName: data.songwriterLastName || ''
          }
        ],
        featuredArtists: data.featuredArtists || [],
        versionInfo: data.versionInfo || null,
        previewStartTime: data.previewStartTime || null,
        price: data.price || 'Track Mid',
        dolbyAtmos: data.dolbyAtmos || false,
        dolbyAtmosFile: data.dolbyAtmosFile || null,
        coverSongInfo: data.coverSongInfo || null
      },
      options: {
        screenshotPath: data.screenshotPath || './screenshots/distrokid',
        timeout: data.timeout || 30000
      }
    };

    // Create output directory
    await this.ensureOutputDirectory(targetDir);

    // Generate filename
    const filename = this.sanitizeFilename(data.title) + '-config.json';
    const configPath = join(targetDir, filename);

    // Write configuration file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      configPath,
      filename,
      config
    };
  }

  /**
   * Generate an album configuration file with user prompts
   * @param {Object} [albumData] - Pre-filled album data
   * @param {string} [outputDir] - Custom output directory
   * @returns {Promise<Object>} Generation result
   */
  async generateAlbumConfig(albumData = null, outputDir = null) {
    const targetDir = outputDir || this.outputDir;
    
    let data;
    if (albumData) {
      // Use provided data (for testing or programmatic use)
      data = albumData;
    } else {
      // Interactive prompts
      console.log('🎵 Album Configuration Generator');
      console.log('================================\n');
      
      data = await this.promptAlbumData();
    }

    // Validate the data
    this.validateAlbumData(data);

    // Generate configuration object
    const config = {
      title: data.title,
      artist: data.artist,
      style: data.style || 'pop',
      output: data.output || './albums',
      format: data.format || 'mp3',
      tracks: data.tracks.map(track => ({
        title: track.title,
        lyricsPath: track.lyricsPath,
        style: track.style || data.style || 'pop'
      }))
    };

    // Create output directory
    await this.ensureOutputDirectory(targetDir);

    // Generate filename
    const filename = this.sanitizeFilename(data.title) + '-config.json';
    const configPath = join(targetDir, filename);

    // Write configuration file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      configPath,
      filename,
      config
    };
  }

  /**
   * Prompt user for track data
   * @returns {Promise<Object>} Track data
   */
  async promptTrackData() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    try {
      console.log('📧 DistroKid Account Information:');
      const email = await question('Email: ');
      const password = await question('Password: ');

      console.log('\n🎵 Track Information:');
      const title = await question('Track title: ');
      const artist = await question('Artist name: ');
      const filePath = await question('Audio file path: ');

      console.log('\n👤 Songwriter Information:');
      const songwriterFirstName = await question('Songwriter first name: ');
      const songwriterLastName = await question('Songwriter last name: ');

      console.log('\n⚙️  Additional Options (press Enter for defaults):');
      const explicitInput = await question('Explicit lyrics? (y/N): ');
      const instrumentalInput = await question('Instrumental track? (y/N): ');
      const radioEditInput = await question('Radio edit? (y/N): ');
      const coverSongInput = await question('Cover song? (y/N): ');

      return {
        email,
        password,
        title,
        artist,
        filePath,
        songwriterFirstName,
        songwriterLastName,
        explicit: explicitInput.toLowerCase() === 'y',
        instrumental: instrumentalInput.toLowerCase() === 'y',
        isRadioEdit: radioEditInput.toLowerCase() === 'y',
        isCoverSong: coverSongInput.toLowerCase() === 'y'
      };
    } finally {
      rl.close();
    }
  }

  /**
   * Prompt user for album data
   * @returns {Promise<Object>} Album data
   */
  async promptAlbumData() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    try {
      console.log('📀 Album Information:');
      const title = await question('Album title: ');
      const artist = await question('Artist name: ');
      const style = await question('Musical style (default: pop): ') || 'pop';

      console.log('\n🎵 Track Information:');
      const trackCountInput = await question('Number of tracks: ');
      const trackCount = parseInt(trackCountInput, 10);

      if (isNaN(trackCount) || trackCount < 1) {
        throw new Error('Invalid track count. Must be a positive number.');
      }

      const tracks = [];
      for (let i = 1; i <= trackCount; i++) {
        console.log(`\n--- Track ${i} ---`);
        const trackTitle = await question(`Track ${i} title: `);
        const lyricsPath = await question(`Track ${i} lyrics file path: `);
        const trackStyle = await question(`Track ${i} style (default: ${style}): `) || style;

        tracks.push({
          title: trackTitle,
          lyricsPath,
          style: trackStyle
        });
      }

      console.log('\n⚙️  Output Options (press Enter for defaults):');
      const output = await question('Output directory (default: ./albums): ') || './albums';
      const format = await question('Audio format (mp3/wav, default: mp3): ') || 'mp3';

      return {
        title,
        artist,
        style,
        output,
        format,
        tracks
      };
    } finally {
      rl.close();
    }
  }

  /**
   * Validate track data
   * @param {Object} data - Track data to validate
   * @throws {Error} If data is invalid
   */
  validateTrackData(data) {
    if (!data.email) {
      throw new Error('Email is required');
    }

    if (!data.password) {
      throw new Error('Password is required');
    }

    if (!data.title) {
      throw new Error('Track title is required');
    }

    if (!data.artist) {
      throw new Error('Artist name is required');
    }

    if (!data.filePath) {
      throw new Error('Audio file path is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Validate album data
   * @param {Object} data - Album data to validate
   * @throws {Error} If data is invalid
   */
  validateAlbumData(data) {
    if (!data.title) {
      throw new Error('Album title is required');
    }

    if (!data.artist) {
      throw new Error('Artist name is required');
    }

    if (!data.tracks || !Array.isArray(data.tracks)) {
      throw new Error('Tracks array is required');
    }

    if (data.tracks.length === 0) {
      throw new Error('At least one track is required');
    }

    // Validate each track
    data.tracks.forEach((track, index) => {
      if (!track.title) {
        throw new Error(`Track ${index + 1} title is required`);
      }

      if (!track.lyricsPath) {
        throw new Error(`Track ${index + 1} lyrics path is required`);
      }
    });

    // Validate format if provided
    if (data.format && !['mp3', 'wav'].includes(data.format.toLowerCase())) {
      throw new Error('Format must be mp3 or wav');
    }
  }

  /**
   * Sanitize filename by removing invalid characters
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'untitled';
    }

    return filename
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove invalid characters
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .trim() || 'untitled';
  }

  /**
   * Ensure output directory exists
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   */
  async ensureOutputDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw new Error(`Failed to create output directory: ${error.message}`);
      }
    }
  }

  /**
   * Create a track configuration interactively
   * @param {string} [outputDir] - Custom output directory
   * @returns {Promise<Object>} Generation result
   */
  async createTrackConfig(outputDir = null) {
    try {
      const result = await this.generateTrackConfig(null, outputDir);
      
      console.log('\n✅ Track configuration created successfully!');
      console.log(`📁 Saved to: ${result.configPath}`);
      console.log('\n💡 Usage:');
      console.log(`node src/cli.js distrokid-fill --config "${result.configPath}"`);
      
      return result;
    } catch (error) {
      console.error('\n❌ Failed to create track configuration:');
      console.error(`💥 ${error.message}`);
      throw error;
    }
  }

  /**
   * Create an album configuration interactively
   * @param {string} [outputDir] - Custom output directory
   * @returns {Promise<Object>} Generation result
   */
  async createAlbumConfig(outputDir = null) {
    try {
      const result = await this.generateAlbumConfig(null, outputDir);
      
      console.log('\n✅ Album configuration created successfully!');
      console.log(`📁 Saved to: ${result.configPath}`);
      console.log('\n💡 Usage:');
      console.log(`node src/cli.js generate --album "${result.configPath}"`);
      
      return result;
    } catch (error) {
      console.error('\n❌ Failed to create album configuration:');
      console.error(`💥 ${error.message}`);
      throw error;
    }
  }
}