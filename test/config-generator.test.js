import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ConfigGenerator } from '../src/services/config-generator.js';

describe('ConfigGenerator', () => {
  let configGenerator;
  const testOutputDir = './test-temp-configs';

  beforeEach(() => {
    configGenerator = new ConfigGenerator();
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      expect(configGenerator).to.be.instanceOf(ConfigGenerator);
      expect(configGenerator.outputDir).to.equal('./configs');
    });

    it('should accept custom output directory', () => {
      const generator = new ConfigGenerator({ outputDir: './custom-configs' });
      expect(generator.outputDir).to.equal('./custom-configs');
    });
  });

  describe('generateTrackConfig', () => {
    it('should generate track config with provided data', async () => {
      const trackData = {
        email: 'test@example.com',
        password: 'password123',
        title: 'Test Track',
        artist: 'Test Artist',
        filePath: './test.wav',
        explicit: false,
        instrumental: false,
        songwriters: [
          {
            role: 'Music and lyrics',
            firstName: 'John',
            lastName: 'Doe'
          }
        ]
      };

      const result = await configGenerator.generateTrackConfig(trackData, testOutputDir);
      
      expect(result.success).to.be.true;
      expect(result.configPath).to.include('test-track-config.json');
      
      // Verify file was created
      const configExists = await fs.access(result.configPath).then(() => true).catch(() => false);
      expect(configExists).to.be.true;
      
      // Verify file content
      const configContent = JSON.parse(await fs.readFile(result.configPath, 'utf8'));
      expect(configContent.distrokidCredentials.email).to.equal('test@example.com');
      expect(configContent.trackData.title).to.equal('Test Track');
      expect(configContent.trackData.artist).to.equal('Test Artist');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        email: 'test@example.com'
        // Missing required fields
      };

      try {
        await configGenerator.generateTrackConfig(incompleteData, testOutputDir);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).to.include('required');
      }
    });

    it('should sanitize filename from track title', async () => {
      const trackData = {
        email: 'test@example.com',
        password: 'password123',
        title: 'Track with / Special * Characters',
        artist: 'Test Artist',
        filePath: './test.wav'
      };

      const result = await configGenerator.generateTrackConfig(trackData, testOutputDir);
      expect(result.configPath).to.include('track-with-special-characters-config.json');
    });
  });

  describe('generateAlbumConfig', () => {
    it('should generate album config with multiple tracks', async () => {
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        style: 'rock',
        tracks: [
          {
            title: 'Track 1',
            lyricsPath: './lyrics1.txt',
            style: 'heavy metal'
          },
          {
            title: 'Track 2',
            lyricsPath: './lyrics2.txt'
          }
        ]
      };

      const result = await configGenerator.generateAlbumConfig(albumData, testOutputDir);
      
      expect(result.success).to.be.true;
      expect(result.configPath).to.include('test-album-config.json');
      
      // Verify file content
      const configContent = JSON.parse(await fs.readFile(result.configPath, 'utf8'));
      expect(configContent.title).to.equal('Test Album');
      expect(configContent.tracks).to.have.length(2);
      expect(configContent.tracks[0].title).to.equal('Track 1');
      expect(configContent.tracks[0].style).to.equal('heavy metal');
      expect(configContent.tracks[1].style).to.equal('rock'); // Inherited from album
    });

    it('should validate album data', async () => {
      const invalidData = {
        title: 'Test Album'
        // Missing artist and tracks
      };

      try {
        await configGenerator.generateAlbumConfig(invalidData, testOutputDir);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).to.include('Artist name is required');
      }
    });
  });

  describe('validateTrackData', () => {
    it('should validate complete track data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        title: 'Test Track',
        artist: 'Test Artist',
        filePath: './test.wav'
      };

      expect(() => configGenerator.validateTrackData(validData)).to.not.throw();
    });

    it('should throw error for missing email', () => {
      const invalidData = {
        password: 'password123',
        title: 'Test Track',
        artist: 'Test Artist',
        filePath: './test.wav'
      };

      expect(() => configGenerator.validateTrackData(invalidData)).to.throw('Email is required');
    });

    it('should throw error for missing password', () => {
      const invalidData = {
        email: 'test@example.com',
        title: 'Test Track',
        artist: 'Test Artist',
        filePath: './test.wav'
      };

      expect(() => configGenerator.validateTrackData(invalidData)).to.throw('Password is required');
    });
  });

  describe('validateAlbumData', () => {
    it('should validate complete album data', () => {
      const validData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: [
          { title: 'Track 1', lyricsPath: './lyrics1.txt' }
        ]
      };

      expect(() => configGenerator.validateAlbumData(validData)).to.not.throw();
    });

    it('should throw error for missing title', () => {
      const invalidData = {
        artist: 'Test Artist',
        tracks: [{ title: 'Track 1', lyricsPath: './lyrics1.txt' }]
      };

      expect(() => configGenerator.validateAlbumData(invalidData)).to.throw('Album title is required');
    });

    it('should throw error for empty tracks array', () => {
      const invalidData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: []
      };

      expect(() => configGenerator.validateAlbumData(invalidData)).to.throw('At least one track is required');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      const result = configGenerator.sanitizeFilename('Track / with * invalid ? characters');
      expect(result).to.equal('track-with-invalid-characters');
    });

    it('should handle multiple spaces and dashes', () => {
      const result = configGenerator.sanitizeFilename('Track   with    spaces');
      expect(result).to.equal('track-with-spaces');
    });

    it('should handle empty string', () => {
      const result = configGenerator.sanitizeFilename('');
      expect(result).to.equal('untitled');
    });
  });

  describe('ensureOutputDirectory', () => {
    it('should create directory if it does not exist', async () => {
      const testDir = join(testOutputDir, 'new-directory');
      await configGenerator.ensureOutputDirectory(testDir);
      
      const dirExists = await fs.access(testDir).then(() => true).catch(() => false);
      expect(dirExists).to.be.true;
    });

    it('should not throw error if directory already exists', async () => {
      await fs.mkdir(testOutputDir, { recursive: true });
      
      // This should not throw an error
      try {
        await configGenerator.ensureOutputDirectory(testOutputDir);
        // If we get here, the test passes
        expect(true).to.be.true;
      } catch (error) {
        expect.fail(`Should not have thrown error: ${error.message}`);
      }
    });
  });
});