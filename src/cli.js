#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import ora from 'ora';
import { Publisher } from './services/publisher.js';

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

    if (!fugaConfigured && !tunecoreConfigured) {
      errors.push('At least one platform must be configured (FUGA or TuneCore)');
      errors.push('FUGA requires: FUGA_API_TOKEN, FUGA_CLIENT_ID, FUGA_CLIENT_SECRET');
      errors.push('TuneCore requires: TUNECORE_PARTNER_ID, TUNECORE_API_KEY');
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
Music Publishing CLI - Unified FUGA & TuneCore Publisher

Usage:
  publish publish <directory>        Publish music (auto-detect platform)
  publish validate <directory>       Validate directory structure
  publish platforms                  Show supported platforms
  publish detect <directory>         Detect platform for directory

Options:
  -p, --platform <platform>              Force specific platform (fuga|tunecore)
  -d, --dry-run                          Validate without publishing
  -v, --verbose                          Verbose output
  -h, --help                             Display help information
  --version                              Display version information

Examples:
  publish publish ./my-album
  publish publish ./my-album --platform tunecore
  publish validate ./my-album --dry-run
  publish detect ./my-album

Platform Detection:
  • TuneCore: Directories with metadata.json files
  • FUGA: Directories with embedded metadata in audio files
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