#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import ora from 'ora';
import { Publisher } from './services/publisher.js';
import { SunoClient } from './api/suno-client.js';
import { Generator } from './services/generator.js';
import { AlbumGenerator } from './services/album-generator.js';
import { DistroKidFormFiller } from './services/distrokid-form-filler.js';
import { ConfigGenerator } from './services/config-generator.js';

/**
 * CLI class for the unified Music Publishing tool
 * Supports both FUGA and TuneCore platforms with automatic detection
 */
export class CLI {
  constructor() {
    this.program = new Command();
    this.config = {};
    this.publisher = new Publisher();
    this.setupCommands();
  }

  /**
   * Set up CLI commands and options
   */
  setupCommands() {
    this.program
      .name('publish')
      .description('CLI tool for automated music publishing via FUGA and TuneCore')
      .version('1.0.0');

    // Unified publish command
    this.program
      .command('publish')
      .description('Publish music to appropriate platform (auto-detected)')
      .argument('<directory>', 'Directory containing music files')
      .option('-p, --platform <platform>', 'Force specific platform (fuga|tunecore)')
      .option('-d, --dry-run', 'Validate without publishing')
      .option('-v, --verbose', 'Verbose output')
      .action(async (directory, options) => {
        await this.handlePublishCommand(directory, options);
      });

    // Validate command
    this.program
      .command('validate')
      .description('Validate music directory structure and metadata')
      .argument('<directory>', 'Directory to validate')
      .option('-p, --platform <platform>', 'Validate for specific platform (fuga|tunecore)')
      .action(async (directory, options) => {
        await this.handleValidateCommand(directory, options);
      });

    // Platform info command
    this.program
      .command('platforms')
      .description('Show supported platforms and their requirements')
      .action(() => {
        this.handlePlatformsCommand();
      });

    // Detect platform command
    this.program
      .command('detect')
      .description('Detect which platform a directory is configured for')
      .argument('<directory>', 'Directory to analyze')
      .action(async (directory) => {
        await this.handleDetectCommand(directory);
      });

    // Generate command
    this.program
      .command('generate')
      .description('Generate a song using AI (Suno API)')
      .option('-t, --title <title>', 'Song title (required for single songs)')
      .option('-l, --lyrics <file>', 'Path to lyrics file (required for single songs)')
      .option('-a, --album <file>', 'Path to album configuration file')
      .option('-c, --count <number>', 'Number of song variations to generate', '1')
      .option('-s, --style <style>', 'Musical style/genre')
      .option('-o, --output <directory>', 'Output directory', './songs')
      .option('-f, --format <format>', 'Output format (mp3|wav)', 'mp3')
      .option('-v, --verbose', 'Verbose output')
      .action(async (options) => {
        await this.handleGenerateCommand(options);
      });

    // DistroKid form filler command
    this.program
      .command('distrokid-fill')
      .description('Fill DistroKid upload form with track data (opens browser for manual submission)')
      .option('-c, --config <file>', 'Path to configuration file', './examples/distrokid-form-config.json')
      .option('-e, --email <email>', 'DistroKid account email')
      .option('-p, --password <password>', 'DistroKid account password')
      .option('-t, --title <title>', 'Track title')
      .option('-a, --artist <artist>', 'Artist name')
      .option('-f, --file <path>', 'Path to audio file')
      .option('--explicit', 'Track contains explicit lyrics')
      .option('--instrumental', 'Track is instrumental')
      .option('--radio-edit', 'Track is a radio edit')
      .option('--cover-song', 'Track is a cover song')
      .option('-v, --verbose', 'Verbose output')
      .action(async (options) => {
        await this.handleDistroKidFillCommand(options);
      });

    // Create track config command
    this.program
      .command('create-track-config')
      .description('Create a DistroKid track configuration file interactively')
      .option('-o, --output <directory>', 'Output directory for config file', './configs')
      .option('-v, --verbose', 'Verbose output')
      .action(async (options) => {
        await this.handleCreateTrackConfigCommand(options);
      });

    // Create album config command
    this.program
      .command('create-album-config')
      .description('Create an album configuration file interactively')
      .option('-o, --output <directory>', 'Output directory for config file', './configs')
      .option('-v, --verbose', 'Verbose output')
      .action(async (options) => {
        await this.handleCreateAlbumConfigCommand(options);
      });
  }

  /**
   * Initialize configuration from environment variables
   * @param {boolean} requireApiCredentials - Whether API credentials are required
   */
  async initializeConfig(requireApiCredentials = true) {
    // Load environment variables
    config();

    this.config = {
      // FUGA configuration
      fuga: {
        apiKey: process.env.FUGA_API_TOKEN,
        clientId: process.env.FUGA_CLIENT_ID,
        clientSecret: process.env.FUGA_CLIENT_SECRET,
        baseUrl: process.env.FUGA_API_BASE_URL || 'https://api.fuga.com',
      },
      // TuneCore configuration
      tunecore: {
        partnerId: process.env.TUNECORE_PARTNER_ID,
        apiKey: process.env.TUNECORE_API_KEY,
        baseUrl: process.env.TUNECORE_API_BASE_URL || 'https://api.tunecore.com',
      },
      // Suno configuration
      suno: {
        apiToken: process.env.SUNO_API_TOKEN,
        baseUrl: process.env.SUNO_API_BASE || 'https://api.sunoapi.org',
      },
      // General settings
      maxConcurrentUploads: parseInt(process.env.MAX_CONCURRENT_UPLOADS || '3', 10),
      uploadTimeout: parseInt(process.env.UPLOAD_TIMEOUT_MS || '300000', 10),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
      logLevel: process.env.LOG_LEVEL || 'info',
    };

    // Validate environment only if API credentials are required
    if (requireApiCredentials) {
      const validation = this.validateEnvironment(process.env);
      if (!validation.valid) {
        console.error('❌ Configuration Error:');
        validation.errors.forEach(error => console.error(`  • ${error}`));
        console.error('\n💡 Tip: Run "publish platforms" to see configuration requirements');
        process.exit(1);
      }
    }
  }

  /**
   * Validate environment variables
   * @param {Object} env - Environment variables object
   * @returns {Object} Validation result
   */
  validateEnvironment(env) {
    const errors = [];
    
    // Check if at least one platform is configured
    const fugaConfigured = env.FUGA_API_TOKEN && env.FUGA_CLIENT_ID && env.FUGA_CLIENT_SECRET;
    const tunecoreConfigured = env.TUNECORE_PARTNER_ID && env.TUNECORE_API_KEY;
    const sunoConfigured = env.SUNO_API_TOKEN;

    if (!fugaConfigured && !tunecoreConfigured && !sunoConfigured) {
      errors.push('At least one platform must be configured (FUGA, TuneCore, or Suno)');
      errors.push('FUGA requires: FUGA_API_TOKEN, FUGA_CLIENT_ID, FUGA_CLIENT_SECRET');
      errors.push('TuneCore requires: TUNECORE_PARTNER_ID, TUNECORE_API_KEY');
      errors.push('Suno requires: SUNO_API_TOKEN');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Handle publish command
   * @param {string} directory - Directory containing music files
   * @param {Object} options - Command options
   */
  async handlePublishCommand(directory, options) {
    const spinner = ora('Initializing...').start();

    try {
      // Detect or use specified platform
      let platform;
      if (options.platform) {
        platform = options.platform.toLowerCase();
        if (!this.publisher.getSupportedPlatforms().includes(platform)) {
          throw new Error(`Unsupported platform: ${platform}`);
        }
        spinner.text = `Using specified platform: ${platform}`;
      } else {
        spinner.text = 'Detecting platform...';
        platform = await this.publisher.detectPlatform(directory);
        spinner.succeed(`Detected platform: ${platform}`);
      }

      // Validate configuration for detected platform
      try {
        this.publisher.validateConfig(this.config, platform);
      } catch (error) {
        spinner.fail('Configuration validation failed');
        console.error(`❌ ${error.message}`);
        console.error('\n💡 Tip: Run "publish platforms" to see configuration requirements');
        process.exit(1);
      }

      if (options.dryRun) {
        spinner.start('Validating directory structure...');
        
        // Scan directory to validate structure
        const scanResult = await this.publisher.scanDirectory(directory, platform);
        const publishOptions = await this.publisher.getPublishOptions(scanResult, platform);
        
        spinner.succeed('Validation completed successfully');
        console.log(`✅ Directory is valid for ${platform.toUpperCase()} publishing`);
        
        if (options.verbose) {
          console.log('\nPublish options preview:');
          console.log(JSON.stringify(publishOptions, null, 2));
        }
        return;
      }

      // Publish to platform
      spinner.start(`Publishing to ${platform.toUpperCase()}...`);
      
      const result = await this.publisher.publish(directory, this.config, {
        verbose: options.verbose,
        onProgress: (progress) => {
          spinner.text = this.formatProgressText(progress, platform);
        }
      });

      spinner.succeed(`Published successfully to ${platform.toUpperCase()}!`);
      console.log(`🎵 Release ID: ${result.releaseId}`);
      console.log(`📊 Status: ${result.status}`);

      if (options.verbose) {
        console.log('\nPublication details:');
        console.log(JSON.stringify(result, null, 2));
      }

    } catch (error) {
      spinner.fail('Publication failed');
      console.error(`❌ ${error.message}`);
      
      if (options.verbose) {
        console.error('\nFull error details:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Handle validate command
   * @param {string} directory - Directory to validate
   * @param {Object} options - Command options
   */
  async handleValidateCommand(directory, options) {
    const spinner = ora('Validating directory...').start();

    try {
      // Detect or use specified platform
      let platform;
      if (options.platform) {
        platform = options.platform.toLowerCase();
        if (!this.publisher.getSupportedPlatforms().includes(platform)) {
          throw new Error(`Unsupported platform: ${platform}`);
        }
      } else {
        platform = await this.publisher.detectPlatform(directory);
      }

      spinner.text = `Validating for ${platform.toUpperCase()}...`;

      // Scan and validate directory
      const scanResult = await this.publisher.scanDirectory(directory, platform);
      const publishOptions = await this.publisher.getPublishOptions(scanResult, platform);

      spinner.succeed(`Directory is valid for ${platform.toUpperCase()}`);

      // Display validation results
      console.log(`✅ Platform: ${platform.toUpperCase()}`);
      
      if (platform === 'tunecore') {
        console.log(`📀 Album: ${publishOptions.title || 'Unknown'}`);
        console.log(`🎤 Artist: ${publishOptions.artist || 'Unknown'}`);
        console.log(`🎵 Tracks: ${publishOptions.tracks?.length || 0}`);
        if (publishOptions.upc) {
          console.log(`🏷️  UPC: ${publishOptions.upc}`);
        }
      } else if (platform === 'fuga') {
        console.log(`🎵 Tracks: ${publishOptions.tracks?.length || 0}`);
        if (publishOptions.tracks?.length > 0) {
          const firstTrack = publishOptions.tracks[0];
          console.log(`🎤 Artist: ${firstTrack.artist || 'Unknown'}`);
          console.log(`📀 Album: ${firstTrack.album || 'Unknown'}`);
        }
      }

      if (options.verbose) {
        console.log('\nDetailed scan results:');
        console.log(JSON.stringify(publishOptions, null, 2));
      }

    } catch (error) {
      spinner.fail('Validation failed');
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Handle platforms command
   */
  handlePlatformsCommand() {
    console.log('🎵 Supported Music Publishing Platforms\n');

    const platforms = this.publisher.getSupportedPlatforms();
    
    platforms.forEach(platform => {
      const requirements = this.publisher.getPlatformRequirements(platform);
      
      console.log(`📡 ${platform.toUpperCase()}`);
      console.log(`   ${requirements.description}`);
      console.log(`   Configuration: ${requirements.configFields.join(', ')}`);
      console.log(`   Metadata: ${requirements.metadataSource}`);
      console.log(`   Formats: ${requirements.supportedFormats.join(', ')}`);
      console.log('');
    });

    console.log('🔧 Environment Variables:');
    console.log('');
    console.log('FUGA Configuration:');
    console.log('  FUGA_API_TOKEN=your_api_token');
    console.log('  FUGA_CLIENT_ID=your_client_id');
    console.log('  FUGA_CLIENT_SECRET=your_client_secret');
    console.log('  FUGA_API_BASE_URL=https://api.fuga.com (optional)');
    console.log('');
    console.log('TuneCore Configuration:');
    console.log('  TUNECORE_PARTNER_ID=your_partner_id');
    console.log('  TUNECORE_API_KEY=your_api_key');
    console.log('  TUNECORE_API_BASE_URL=https://api.tunecore.com (optional)');
    console.log('');
    console.log('Suno Configuration:');
    console.log('  SUNO_API_TOKEN=your_suno_token');
    console.log('  SUNO_API_BASE=https://api.sunoapi.org (optional)');
    console.log('');
    console.log('General Settings:');
    console.log('  MAX_CONCURRENT_UPLOADS=3 (optional)');
    console.log('  UPLOAD_TIMEOUT_MS=300000 (optional)');
    console.log('  RETRY_ATTEMPTS=3 (optional)');
    console.log('  RETRY_DELAY_MS=5000 (optional)');
  }

  /**
   * Handle detect command
   * @param {string} directory - Directory to analyze
   */
  async handleDetectCommand(directory) {
    const spinner = ora('Analyzing directory...').start();

    try {
      const platform = await this.publisher.detectPlatform(directory);
      const requirements = this.publisher.getPlatformRequirements(platform);
      
      spinner.succeed(`Platform detected: ${platform.toUpperCase()}`);
      
      console.log(`📡 Platform: ${platform.toUpperCase()}`);
      console.log(`📝 Description: ${requirements.description}`);
      console.log(`⚙️  Required config: ${requirements.configFields.join(', ')}`);
      console.log(`📊 Metadata source: ${requirements.metadataSource}`);

    } catch (error) {
      spinner.fail('Detection failed');
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Handle generate command
   * @param {Object} options - Command options
   */
  async handleGenerateCommand(options) {
    const spinner = ora('Initializing song generation...').start();

    try {
      // Validate required options based on mode
      if (options.album) {
        // Album generation mode
        if (options.title || options.lyrics) {
          throw new Error('Cannot specify --title or --lyrics when using --album mode');
        }
      } else {
        // Single song generation mode
        if (!options.title) {
          throw new Error('Title is required for single song generation');
        }
        if (!options.lyrics) {
          throw new Error('Lyrics file path is required for single song generation');
        }
      }

      // Validate files exist
      if (options.album) {
        try {
          await import('fs').then(fs => fs.promises.access(options.album));
        } catch (error) {
          throw new Error(`Album configuration file not found: ${options.album}`);
        }
      } else {
        try {
          await import('fs').then(fs => fs.promises.access(options.lyrics));
        } catch (error) {
          throw new Error(`Lyrics file not found: ${options.lyrics}`);
        }
      }

      // Validate format
      const validFormats = ['mp3', 'wav'];
      if (options.format && !validFormats.includes(options.format.toLowerCase())) {
        throw new Error(`Invalid format: ${options.format}. Supported formats: ${validFormats.join(', ')}`);
      }

      // Validate count
      if (options.count) {
        const count = parseInt(options.count, 10);
        if (isNaN(count) || count < 1 || count > 20) {
          throw new Error('Count must be a number between 1 and 20');
        }
      }

      // Validate Suno configuration
      this.validateGenerateConfig(this.config);

      spinner.succeed('Configuration validated');

      if (options.album) {
        return await this.handleAlbumGeneration(options, spinner);
      } else {
        return await this.handleSongGeneration(options, spinner);
      }

    } catch (error) {
      spinner.fail('Song generation failed');
      console.error(`❌ ${error.message}`);
      
      if (options.verbose) {
        console.error('\nFull error details:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Handle DistroKid form filler command
   * @param {Object} options - Command options
   */
  async handleDistroKidFillCommand(options) {
    const spinner = ora('Initializing DistroKid Form Filler...').start();

    try {
      let config;
      let trackData;

      // Load configuration from file or command line options
      if (options.config) {
        try {
          const configFile = await import('fs').then(fs => fs.promises.readFile(options.config, 'utf8'));
          const configJson = JSON.parse(configFile);
          
          config = {
            email: options.email || configJson.distrokidCredentials?.email,
            password: options.password || configJson.distrokidCredentials?.password,
            ...configJson.options
          };
          
          trackData = {
            title: options.title || configJson.trackData?.title,
            artist: options.artist || configJson.trackData?.artist,
            filePath: options.file || configJson.trackData?.filePath,
            explicit: options.explicit || configJson.trackData?.explicit || false,
            instrumental: options.instrumental || configJson.trackData?.instrumental || false,
            isRadioEdit: options.radioEdit || configJson.trackData?.isRadioEdit || false,
            isCoverSong: options.coverSong || configJson.trackData?.isCoverSong || false,
            songwriters: configJson.trackData?.songwriters || [],
            featuredArtists: configJson.trackData?.featuredArtists || [],
            versionInfo: configJson.trackData?.versionInfo,
            previewStartTime: configJson.trackData?.previewStartTime,
            price: configJson.trackData?.price || 'Track Mid',
            dolbyAtmos: configJson.trackData?.dolbyAtmos || false,
            dolbyAtmosFile: configJson.trackData?.dolbyAtmosFile,
            coverSongInfo: configJson.trackData?.coverSongInfo
          };
        } catch (error) {
          throw new Error(`Failed to load configuration file: ${error.message}`);
        }
      } else {
        // Use command line options only
        config = {
          email: options.email,
          password: options.password
        };
        
        trackData = {
          title: options.title,
          artist: options.artist,
          filePath: options.file,
          explicit: options.explicit || false,
          instrumental: options.instrumental || false,
          isRadioEdit: options.radioEdit || false,
          isCoverSong: options.coverSong || false,
          songwriters: [],
          featuredArtists: [],
          versionInfo: null,
          previewStartTime: null,
          price: 'Track Mid',
          dolbyAtmos: false
        };
      }

      // Validate required fields
      if (!config.email) {
        throw new Error('DistroKid email is required (use --email or config file)');
      }
      
      if (!config.password) {
        throw new Error('DistroKid password is required (use --password or config file)');
      }
      
      if (!trackData.title) {
        throw new Error('Track title is required (use --title or config file)');
      }
      
      if (!trackData.artist) {
        throw new Error('Artist name is required (use --artist or config file)');
      }
      
      if (!trackData.filePath) {
        throw new Error('Audio file path is required (use --file or config file)');
      }

      spinner.succeed('Configuration loaded successfully');
      console.log(`🎵 Track: "${trackData.title}" by ${trackData.artist}`);
      console.log(`📁 Audio file: ${trackData.filePath}`);
      console.log('🌐 Opening browser for DistroKid form filling...');

      // Create and initialize form filler
      const formFiller = new DistroKidFormFiller(config);
      await formFiller.initialize();

      console.log('📝 Filling form with track data...');
      
      // Fill form and wait for user submission
      const result = await formFiller.fillFormAndWaitForSubmission(trackData);

      if (result.success) {
        console.log('✅ Form filled successfully!');
        console.log('👤 Browser is open for you to review and submit manually');
        
        if (result.submitted) {
          console.log('🎉 Form was submitted successfully!');
          console.log(`📊 Final URL: ${result.finalUrl}`);
        } else {
          console.log('ℹ️  Form was filled but not submitted');
          console.log(`📝 Reason: ${result.reason || 'User interaction required'}`);
        }
      } else {
        console.error('❌ Form filling failed');
        console.error(`💥 Error: ${result.error}`);
      }

      if (options.verbose) {
        console.log('\nDetailed result:');
        console.log(JSON.stringify(result, null, 2));
      }

      // Cleanup
      await formFiller.close();

    } catch (error) {
      spinner.fail('DistroKid form filling failed');
      console.error(`❌ ${error.message}`);
      
      if (options.verbose) {
        console.error('\nFull error details:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Handle create track config command
   * @param {Object} options - Command options
   */
  async handleCreateTrackConfigCommand(options) {
    try {
      console.log('🎵 Creating DistroKid Track Configuration...\n');
      
      const configGenerator = new ConfigGenerator({
        outputDir: options.output
      });
      
      const result = await configGenerator.createTrackConfig(options.output);
      
      if (options.verbose) {
        console.log('\nGenerated configuration:');
        console.log(JSON.stringify(result.config, null, 2));
      }
      
    } catch (error) {
      console.error('❌ Failed to create track configuration:');
      console.error(`💥 ${error.message}`);
      
      if (options.verbose) {
        console.error('\nFull error details:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Handle create album config command
   * @param {Object} options - Command options
   */
  async handleCreateAlbumConfigCommand(options) {
    try {
      console.log('📀 Creating Album Configuration...\n');
      
      const configGenerator = new ConfigGenerator({
        outputDir: options.output
      });
      
      const result = await configGenerator.createAlbumConfig(options.output);
      
      if (options.verbose) {
        console.log('\nGenerated configuration:');
        console.log(JSON.stringify(result.config, null, 2));
      }
      
    } catch (error) {
      console.error('❌ Failed to create album configuration:');
      console.error(`💥 ${error.message}`);
      
      if (options.verbose) {
        console.error('\nFull error details:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Validate Suno configuration
   * @param {Object} config - Configuration object
   * @throws {Error} If Suno configuration is invalid
   */
  validateGenerateConfig(config) {
    if (!config?.suno?.apiToken) {
      throw new Error('Suno API token is required. Set SUNO_API_TOKEN environment variable.');
    }

    // Validate base URL if provided
    if (config.suno.baseUrl) {
      try {
        new URL(config.suno.baseUrl);
      } catch {
        throw new Error(`Invalid Suno base URL: ${config.suno.baseUrl}`);
      }
    }
  }

  /**
   * Handle single song generation
   * @param {Object} options - Command options
   * @param {Object} spinner - Ora spinner instance
   * @returns {Promise<Object>} Generation result
   */
  async handleSongGeneration(options, spinner) {
    const count = parseInt(options.count || '1', 10);
    
    if (count === 1) {
      spinner.start('Starting song generation...');
      
      // Single song generation
      const generator = this.createGenerator(this.config);
      const generateOptions = {
        title: options.title,
        lyricsPath: options.lyrics,
        style: options.style,
        output: options.output || './songs',
        format: options.format?.toLowerCase() || 'mp3'
      };

      const result = await generator.generate(generateOptions, (progress) => {
        spinner.text = this.formatGenerateProgressText(progress);
      });

      spinner.succeed('Song generated successfully!');
      this.displaySongResult(result, options);
      return result;
      
    } else {
      spinner.start(`Starting generation of ${count} song variations...`);
      
      // Multiple song generation
      const albumGenerator = this.createAlbumGenerator(this.config);
      const generateOptions = {
        title: options.title,
        lyricsPath: options.lyrics,
        count,
        style: options.style,
        output: options.output || './songs',
        format: options.format?.toLowerCase() || 'mp3'
      };

      const results = await albumGenerator.generateMultipleSongs(generateOptions, (progress) => {
        spinner.text = this.formatMultipleProgressText(progress);
      });

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      if (failureCount === 0) {
        spinner.succeed(`Generated ${successCount} song variations successfully!`);
      } else {
        spinner.warn(`Generated ${successCount} songs, ${failureCount} failed`);
      }

      this.displayMultipleResults(results, options);
      return results;
    }
  }

  /**
   * Handle album generation
   * @param {Object} options - Command options
   * @param {Object} spinner - Ora spinner instance
   * @returns {Promise<Object>} Album generation result
   */
  async handleAlbumGeneration(options, spinner) {
    spinner.start('Loading album configuration...');
    
    const albumGenerator = this.createAlbumGenerator(this.config);
    const albumConfig = await albumGenerator.loadAlbumConfig(options.album);
    
    spinner.text = `Starting album generation: "${albumConfig.title}" (${albumConfig.tracks.length} tracks)`;

    const albumOptions = {
      albumConfig,
      output: options.output || './albums',
      format: options.format?.toLowerCase() || 'mp3'
    };

    const result = await albumGenerator.generateAlbum(albumOptions, (progress) => {
      spinner.text = this.formatAlbumProgressText(progress);
    });

    if (result.success && result.failedTracks.length === 0) {
      spinner.succeed(`Album "${result.albumTitle}" generated successfully!`);
    } else if (result.tracks.length > 0) {
      spinner.warn(`Album partially generated: ${result.tracks.length} succeeded, ${result.failedTracks.length} failed`);
    } else {
      spinner.fail('Album generation failed');
    }

    this.displayAlbumResult(result, options);
    return result;
  }

  /**
   * Create a Generator instance with Suno client
   * @param {Object} config - Configuration object
   * @returns {Generator} Configured generator instance
   */
  createGenerator(config) {
    const sunoClient = new SunoClient({
      apiToken: config.suno.apiToken,
      baseUrl: config.suno.baseUrl
    });

    return new Generator(sunoClient);
  }

  /**
   * Create an AlbumGenerator instance with Suno client
   * @param {Object} config - Configuration object
   * @returns {AlbumGenerator} Configured album generator instance
   */
  createAlbumGenerator(config) {
    const sunoClient = new SunoClient({
      apiToken: config.suno.apiToken,
      baseUrl: config.suno.baseUrl
    });

    return new AlbumGenerator(sunoClient);
  }

  /**
   * Display single song generation result
   * @param {Object} result - Generation result
   * @param {Object} options - Command options
   */
  displaySongResult(result, options) {
    console.log(`🎵 Title: ${result.title || options.title}`);
    console.log(`📁 Saved to: ${result.filePath}`);
    console.log(`🆔 Song ID: ${result.songId}`);
    console.log(`📊 Format: ${result.format?.toUpperCase() || options.format?.toUpperCase() || 'MP3'}`);
    console.log(`📏 Size: ${Math.round((result.fileSize || 0) / 1024)} KB`);

    if (options.verbose) {
      console.log('\nGeneration details:');
      console.log(JSON.stringify(result, null, 2));
    }
  }

  /**
   * Display multiple song generation results
   * @param {Array} results - Array of generation results
   * @param {Object} options - Command options
   */
  displayMultipleResults(results, options) {
    console.log(`\n🎵 Generated ${results.length} song variations:`);
    
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`  ${index + 1}. ✅ ${result.title || `Song ${index + 1}`}`);
        console.log(`     📁 ${result.filePath}`);
        console.log(`     🆔 ${result.songId}`);
      } else {
        console.log(`  ${index + 1}. ❌ ${result.title || `Song ${index + 1}`}`);
        console.log(`     💥 ${result.error}`);
      }
    });

    if (options.verbose) {
      console.log('\nDetailed results:');
      console.log(JSON.stringify(results, null, 2));
    }
  }

  /**
   * Display album generation result
   * @param {Object} result - Album generation result
   * @param {Object} options - Command options
   */
  displayAlbumResult(result, options) {
    console.log(`\n🎵 Album: "${result.albumTitle}"`);
    if (result.artist) {
      console.log(`🎤 Artist: ${result.artist}`);
    }
    console.log(`📁 Saved to: ${result.albumDir}`);
    console.log(`📊 Tracks: ${result.tracks.length} successful, ${result.failedTracks.length} failed`);
    
    if (result.metadataPath) {
      console.log(`📋 Metadata: ${result.metadataPath}`);
    }

    console.log('\n🎵 Track listing:');
    result.tracks.forEach((track) => {
      console.log(`  ${track.trackNumber}. ✅ ${track.title}`);
      console.log(`     📁 ${track.filePath}`);
      console.log(`     🆔 ${track.songId}`);
    });

    if (result.failedTracks.length > 0) {
      console.log('\n❌ Failed tracks:');
      result.failedTracks.forEach((track) => {
        console.log(`  ${track.trackNumber}. ${track.title}`);
        console.log(`     💥 ${track.error}`);
      });
    }

    if (options.verbose) {
      console.log('\nDetailed album results:');
      console.log(JSON.stringify(result, null, 2));
    }
  }

  /**
   * Format progress text for song generation
   * @param {Object} progress - Progress information
   * @returns {string} Formatted progress text
   */
  formatGenerateProgressText(progress) {
    const percentage = Math.round(progress.progress || 0);
    
    switch (progress.step) {
      case 'reading_lyrics':
        return `Reading lyrics... ${percentage}%`;
      case 'preparing':
        return `Preparing generation... ${percentage}%`;
      case 'submitting':
        return `Submitting to Suno API... ${percentage}%`;
      case 'waiting':
        return `Waiting for generation... ${percentage}%`;
      case 'downloading':
        return `Downloading song... ${percentage}%`;
      case 'saving':
        return `Saving file... ${percentage}%`;
      case 'complete':
        return `Generation complete! ${percentage}%`;
      default:
        return `Generating song... ${percentage}%`;
    }
  }

  /**
   * Format progress text for multiple song generation
   * @param {Object} progress - Progress information
   * @returns {string} Formatted progress text
   */
  formatMultipleProgressText(progress) {
    const { currentTrack, totalTracks, progress: percentage } = progress;
    const overallProgress = Math.round(percentage || 0);
    
    return `Generating song ${currentTrack}/${totalTracks}... ${overallProgress}%`;
  }

  /**
   * Format progress text for album generation
   * @param {Object} progress - Progress information
   * @returns {string} Formatted progress text
   */
  formatAlbumProgressText(progress) {
    const { currentTrack, totalTracks, albumProgress, trackTitle } = progress;
    const percentage = Math.round(albumProgress || 0);
    
    switch (progress.step) {
      case 'generating_track':
        return `Generating "${trackTitle}" (${currentTrack}/${totalTracks})... ${percentage}%`;
      case 'creating_metadata':
        return `Creating album metadata... ${percentage}%`;
      case 'complete':
        return `Album generation complete! ${percentage}%`;
      default:
        return `Processing track ${currentTrack}/${totalTracks}... ${percentage}%`;
    }
  }

  /**
   * Format progress text for spinner
   * @param {Object} progress - Progress information
   * @param {string} platform - Platform name
   * @returns {string} Formatted progress text
   */
  formatProgressText(progress, platform) {
    const percentage = Math.round(progress.progress || 0);
    
    switch (progress.step) {
      case 'scanning':
        return `Scanning directory... ${percentage}%`;
      case 'validating':
        return `Validating metadata... ${percentage}%`;
      case 'uploading':
        if (progress.currentFile) {
          return `Uploading ${progress.currentFile}... ${percentage}%`;
        }
        return `Uploading files... ${percentage}%`;
      case 'processing':
        return `Processing on ${platform.toUpperCase()}... ${percentage}%`;
      case 'finalizing':
        return `Finalizing release... ${percentage}%`;
      default:
        return `Publishing to ${platform.toUpperCase()}... ${percentage}%`;
    }
  }

  /**
   * Display help information
   * @returns {string} Help text
   */
  displayHelp() {
    return `
Music Publishing CLI - Unified FUGA, TuneCore & Suno AI Publisher

Usage:
  publish publish <directory>        Publish music (auto-detect platform)
  publish validate <directory>       Validate directory structure
  publish platforms                  Show supported platforms
  publish detect <directory>         Detect platform for directory
  publish generate                   Generate AI song using Suno API
  publish distrokid-fill             Fill DistroKid upload form (headful browser)
  publish create-track-config        Create DistroKid track configuration interactively
  publish create-album-config        Create album configuration interactively

Options:
  -p, --platform <platform>              Force specific platform (fuga|tunecore)
  -d, --dry-run                          Validate without publishing
  -v, --verbose                          Verbose output
  -h, --help                             Display help information
  --version                              Display version information

Generate Options:
  -t, --title <title>                    Song title (required)
  -l, --lyrics <file>                    Path to lyrics file (required)
  -s, --style <style>                    Musical style/genre (optional)
  -o, --output <directory>               Output directory (default: ./songs)
  -f, --format <format>                  Output format: mp3|wav (default: mp3)

DistroKid Form Filler Options:
  -c, --config <file>                    Configuration file (default: ./examples/distrokid-form-config.json)
  -e, --email <email>                    DistroKid account email
  -p, --password <password>              DistroKid account password
  -t, --title <title>                    Track title
  -a, --artist <artist>                  Artist name
  -f, --file <path>                      Path to audio file
  --explicit                             Track contains explicit lyrics
  --instrumental                         Track is instrumental
  --radio-edit                           Track is a radio edit
  --cover-song                           Track is a cover song

Configuration Creation Options:
  -o, --output <directory>               Output directory for config files (default: ./configs)

Examples:
  publish publish ./my-album
  publish publish ./my-album --platform tunecore
  publish validate ./my-album --dry-run
  publish detect ./my-album
  publish generate --title "My Song" --lyrics ./lyrics.txt --style "rock"
  publish distrokid-fill --config ./examples/distrokid-form-config.json
  publish distrokid-fill --email user@example.com --password pass --title "My Song" --artist "Artist" --file ./song.wav
  publish create-track-config --output ./my-configs
  publish create-album-config --output ./my-configs

Platform Detection:
  • TuneCore: Directories with metadata.json files
  • FUGA: Directories with embedded metadata in audio files
  • Suno: AI song generation via API
  • DistroKid: Interactive form filling with headful browser
`;
  }

  /**
   * Display version information
   * @returns {string} Version information
   */
  displayVersion() {
    return 'publisher-cli v1.0.0';
  }

  /**
   * Run the CLI application
   * @param {Array} argv - Command line arguments
   */
  async run(argv = process.argv) {
    try {
      // Check if this is a command that doesn't need API credentials
      const noCredentialsCommands = ['validate', 'platforms', 'detect', 'help', '--help', '-h'];
      const needsCredentials = !noCredentialsCommands.some(cmd => argv.includes(cmd));
      
      await this.initializeConfig(needsCredentials);
      await this.program.parseAsync(argv);
    } catch (error) {
      console.error('❌ CLI Error:');
      console.error(error.message);
      
      if (error.message.includes('Configuration')) {
        console.error('\n💡 Run "publish platforms" for setup instructions');
      }
      
      process.exit(1);
    }
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new CLI();
  await cli.run();
}