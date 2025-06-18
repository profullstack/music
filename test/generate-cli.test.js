import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join } from 'path';
import { CLI } from '../src/cli.js';

describe('CLI Generate Command', () => {
  let cli;
  let tempDir;
  let lyricsFile;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = join(process.cwd(), 'test-temp-cli');
    await fs.mkdir(tempDir, { recursive: true });

    // Create test lyrics file
    lyricsFile = join(tempDir, 'test-lyrics.txt');
    await fs.writeFile(lyricsFile, 'Test verse 1\nTest chorus\nTest verse 2', 'utf8');

    // Mock environment variables
    process.env.SUNO_API_TOKEN = 'test-token';
    process.env.SUNO_API_BASE = 'https://api.test.com';

    cli = new CLI();
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up environment
    delete process.env.SUNO_API_TOKEN;
    delete process.env.SUNO_API_BASE;
  });

  describe('generate command setup', () => {
    it('should have generate command configured', () => {
      const commands = cli.program.commands.map(cmd => cmd.name());
      expect(commands).to.include('generate');
    });

    it('should have correct generate command options', () => {
      const generateCommand = cli.program.commands.find(cmd => cmd.name() === 'generate');
      expect(generateCommand).to.exist;
      
      const options = generateCommand.options.map(opt => opt.long);
      expect(options).to.include('--title');
      expect(options).to.include('--lyrics');
      expect(options).to.include('--style');
      expect(options).to.include('--output');
      expect(options).to.include('--format');
    });
  });

  describe('validateGenerateConfig', () => {
    it('should validate complete Suno configuration', () => {
      const config = {
        suno: {
          apiToken: 'test-token',
          baseUrl: 'https://api.test.com'
        }
      };

      expect(() => cli.validateGenerateConfig(config)).to.not.throw();
    });

    it('should throw error for missing API token', () => {
      const config = {
        suno: {
          baseUrl: 'https://api.test.com'
        }
      };

      expect(() => cli.validateGenerateConfig(config)).to.throw('Suno API token is required');
    });

    it('should use default base URL when not provided', () => {
      const config = {
        suno: {
          apiToken: 'test-token'
        }
      };

      expect(() => cli.validateGenerateConfig(config)).to.not.throw();
    });
  });

  describe('handleGenerateCommand', () => {
    it('should validate required arguments', async () => {
      const options = {};

      // Mock process.exit to prevent test termination
      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => { exitCalled = true; };

      try {
        await cli.handleGenerateCommand(options);
        expect(exitCalled).to.be.true;
      } finally {
        process.exit = originalExit;
      }
    });

    it('should validate lyrics file exists', async () => {
      const options = {
        title: 'Test Song',
        lyrics: '/non/existent/file.txt'
      };

      // Mock process.exit to prevent test termination
      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => { exitCalled = true; };

      try {
        await cli.handleGenerateCommand(options);
        expect(exitCalled).to.be.true;
      } finally {
        process.exit = originalExit;
      }
    });

    it('should validate output format', async () => {
      const options = {
        title: 'Test Song',
        lyrics: lyricsFile,
        format: 'invalid'
      };

      // Mock process.exit to prevent test termination
      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => { exitCalled = true; };

      try {
        await cli.handleGenerateCommand(options);
        expect(exitCalled).to.be.true;
      } finally {
        process.exit = originalExit;
      }
    });

    it('should use default values for optional parameters', async () => {
      // Mock the generator to avoid actual API calls
      const mockResult = {
        success: true,
        filePath: join(tempDir, 'test-song.mp3'),
        songId: 'song-123'
      };

      // Initialize config with Suno token
      await cli.initializeConfig(false);
      cli.config.suno = {
        apiToken: 'test-token',
        baseUrl: 'https://api.test.com'
      };

      cli.createGenerator = () => ({
        generate: async (options) => {
          expect(options.output).to.equal('./songs');
          expect(options.format).to.equal('mp3');
          return mockResult;
        }
      });

      const options = {
        title: 'Test Song',
        lyrics: lyricsFile
      };

      const result = await cli.handleGenerateCommand(options);
      expect(result).to.deep.equal(mockResult);
    });
  });

  describe('formatGenerateProgressText', () => {
    it('should format different progress steps correctly', () => {
      const testCases = [
        { step: 'reading_lyrics', progress: 10, expected: 'Reading lyrics... 10%' },
        { step: 'submitting', progress: 30, expected: 'Submitting to Suno API... 30%' },
        { step: 'waiting', progress: 50, expected: 'Waiting for generation... 50%' },
        { step: 'downloading', progress: 80, expected: 'Downloading song... 80%' },
        { step: 'saving', progress: 90, expected: 'Saving file... 90%' },
        { step: 'complete', progress: 100, expected: 'Generation complete! 100%' }
      ];

      testCases.forEach(({ step, progress, expected }) => {
        const result = cli.formatGenerateProgressText({ step, progress });
        expect(result).to.equal(expected);
      });
    });

    it('should handle unknown steps', () => {
      const result = cli.formatGenerateProgressText({ step: 'unknown', progress: 50 });
      expect(result).to.equal('Generating song... 50%');
    });
  });

  describe('createGenerator', () => {
    it('should create generator with Suno client', () => {
      const config = {
        suno: {
          apiToken: 'test-token',
          baseUrl: 'https://api.test.com'
        }
      };

      const generator = cli.createGenerator(config);
      expect(generator).to.exist;
      expect(generator.sunoClient).to.exist;
    });
  });

  describe('integration with existing CLI structure', () => {
    it('should not require API credentials for help command', async () => {
      delete process.env.SUNO_API_TOKEN;
      
      // This should not throw an error
      await cli.initializeConfig(false);
      expect(cli.config).to.exist;
    });

    it('should integrate with existing spinner system', () => {
      const progress = { step: 'waiting', progress: 50 };
      const formatted = cli.formatGenerateProgressText(progress);
      
      expect(formatted).to.be.a('string');
      expect(formatted).to.include('50%');
    });
  });
});