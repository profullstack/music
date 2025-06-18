import { expect } from 'chai';
import { CLI } from '../src/cli.js';

describe('CLI', () => {
  let cli;

  beforeEach(() => {
    cli = new CLI();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(cli.program).to.exist;
      expect(cli.config).to.exist;
      expect(cli.publisher).to.exist;
    });
  });

  describe('validateEnvironment', () => {
    it('should validate when at least one platform is configured', () => {
      const mockEnv = {
        FUGA_API_TOKEN: 'test-token',
        FUGA_CLIENT_ID: 'test-client-id',
        FUGA_CLIENT_SECRET: 'test-secret',
      };

      const result = cli.validateEnvironment(mockEnv);
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should validate when TuneCore is configured', () => {
      const mockEnv = {
        TUNECORE_PARTNER_ID: 'test-partner',
        TUNECORE_API_KEY: 'test-key',
      };

      const result = cli.validateEnvironment(mockEnv);
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should detect when no platforms are configured', () => {
      const mockEnv = {
        // No platform configuration
      };

      const result = cli.validateEnvironment(mockEnv);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('At least one platform must be configured (FUGA or TuneCore)');
    });

    it('should provide helpful error messages', () => {
      const mockEnv = {};

      const result = cli.validateEnvironment(mockEnv);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('FUGA requires: FUGA_API_TOKEN, FUGA_CLIENT_ID, FUGA_CLIENT_SECRET');
      expect(result.errors).to.include('TuneCore requires: TUNECORE_PARTNER_ID, TUNECORE_API_KEY');
    });
  });

  describe('formatProgressText', () => {
    it('should format progress information correctly', () => {
      const progress = {
        step: 'uploading',
        progress: 45,
        currentFile: 'test-track.mp3',
      };

      const output = cli.formatProgressText(progress, 'tunecore');
      expect(output).to.include('45%');
      expect(output).to.include('test-track.mp3');
      expect(output).to.include('Uploading');
    });

    it('should handle different progress steps', () => {
      const progress = {
        step: 'scanning',
        progress: 10,
      };

      const output = cli.formatProgressText(progress, 'fuga');
      expect(output).to.include('Scanning directory');
      expect(output).to.include('10%');
    });

    it('should handle processing step', () => {
      const progress = {
        step: 'processing',
        progress: 75,
      };

      const output = cli.formatProgressText(progress, 'tunecore');
      expect(output).to.include('Processing on TUNECORE');
      expect(output).to.include('75%');
    });

    it('should handle default case', () => {
      const progress = {
        step: 'unknown',
        progress: 50,
      };

      const output = cli.formatProgressText(progress, 'fuga');
      expect(output).to.include('Publishing to FUGA');
      expect(output).to.include('50%');
    });
  });

  describe('displayHelp', () => {
    it('should return help text with unified commands', () => {
      const help = cli.displayHelp();
      
      expect(help).to.include('publish <directory>');
      expect(help).to.include('validate <directory>');
      expect(help).to.include('platforms');
      expect(help).to.include('detect <directory>');
      expect(help).to.include('auto-detect platform');
    });
  });

  describe('displayVersion', () => {
    it('should return version information', () => {
      const version = cli.displayVersion();
      expect(version).to.include('music-publisher-cli');
      expect(version).to.include('1.0.0');
    });
  });
});