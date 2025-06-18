import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Generator } from '../src/services/generator.js';

describe('Generator', () => {
  let generator;
  let mockSunoClient;
  let tempDir;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = join(process.cwd(), 'test-temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Mock Suno client
    mockSunoClient = {
      generateSong: async () => ({ id: 'song-123', status: 'pending' }),
      pollUntilComplete: async () => ({ 
        id: 'song-123', 
        status: 'completed', 
        downloadUrl: 'https://example.com/song.mp3' 
      }),
      downloadSong: async () => new ArrayBuffer(1024)
    };

    generator = new Generator(mockSunoClient);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create generator with suno client', () => {
      expect(generator).to.be.instanceOf(Generator);
      expect(generator.sunoClient).to.equal(mockSunoClient);
    });

    it('should throw error without suno client', () => {
      expect(() => new Generator()).to.throw('Suno client is required');
    });
  });

  describe('readLyricsFile', () => {
    it('should read lyrics from file successfully', async () => {
      const lyricsPath = join(tempDir, 'test-lyrics.txt');
      const lyricsContent = 'Verse 1\nChorus\nVerse 2';
      await fs.writeFile(lyricsPath, lyricsContent, 'utf8');

      const result = await generator.readLyricsFile(lyricsPath);
      expect(result).to.equal(lyricsContent);
    });

    it('should throw error for non-existent file', async () => {
      const invalidPath = join(tempDir, 'non-existent.txt');

      try {
        await generator.readLyricsFile(invalidPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to read lyrics file');
      }
    });

    it('should throw error for empty file', async () => {
      const emptyPath = join(tempDir, 'empty.txt');
      await fs.writeFile(emptyPath, '', 'utf8');

      try {
        await generator.readLyricsFile(emptyPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Lyrics file is empty');
      }
    });

    it('should handle files with only whitespace', async () => {
      const whitespacePath = join(tempDir, 'whitespace.txt');
      await fs.writeFile(whitespacePath, '   \n\t  \n  ', 'utf8');

      try {
        await generator.readLyricsFile(whitespacePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Lyrics file is empty');
      }
    });
  });

  describe('slugifyTitle', () => {
    it('should create valid filename from title', () => {
      const result = generator.slugifyTitle('Break the Circuit');
      expect(result).to.equal('break-the-circuit');
    });

    it('should handle special characters', () => {
      const result = generator.slugifyTitle('Song #1: "The Best" & More!');
      expect(result).to.equal('song-1-the-best-more');
    });

    it('should handle multiple spaces and dashes', () => {
      const result = generator.slugifyTitle('  Multiple   Spaces  --  And Dashes  ');
      expect(result).to.equal('multiple-spaces-and-dashes');
    });

    it('should handle unicode characters', () => {
      const result = generator.slugifyTitle('Café Müller');
      expect(result).to.equal('cafe-muller');
    });

    it('should handle empty or whitespace-only titles', () => {
      expect(generator.slugifyTitle('')).to.equal('untitled');
      expect(generator.slugifyTitle('   ')).to.equal('untitled');
    });
  });

  describe('ensureOutputDirectory', () => {
    it('should create output directory if it does not exist', async () => {
      const outputDir = join(tempDir, 'new-output');
      
      await generator.ensureOutputDirectory(outputDir);
      
      const stats = await fs.stat(outputDir);
      expect(stats.isDirectory()).to.be.true;
    });

    it('should not throw error if directory already exists', async () => {
      const outputDir = join(tempDir, 'existing-output');
      await fs.mkdir(outputDir);
      
      await generator.ensureOutputDirectory(outputDir);
      
      const stats = await fs.stat(outputDir);
      expect(stats.isDirectory()).to.be.true;
    });

    it('should throw error if path exists but is not a directory', async () => {
      const filePath = join(tempDir, 'not-a-directory.txt');
      await fs.writeFile(filePath, 'content', 'utf8');

      try {
        await generator.ensureOutputDirectory(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Output path exists but is not a directory');
      }
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with default format', () => {
      const result = generator.generateFilename('test-song');
      expect(result).to.equal('test-song.mp3');
    });

    it('should generate filename with specified format', () => {
      const result = generator.generateFilename('test-song', 'wav');
      expect(result).to.equal('test-song.wav');
    });

    it('should handle format case insensitivity', () => {
      const result = generator.generateFilename('test-song', 'WAV');
      expect(result).to.equal('test-song.wav');
    });
  });

  describe('validateOptions', () => {
    it('should validate complete options', () => {
      const options = {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        style: 'rock',
        output: './songs',
        format: 'mp3'
      };

      expect(() => generator.validateOptions(options)).to.not.throw();
    });

    it('should throw error for missing title', () => {
      const options = { lyrics: 'Test lyrics' };
      
      expect(() => generator.validateOptions(options)).to.throw('Title is required');
    });

    it('should throw error for missing lyrics', () => {
      const options = { title: 'Test Song' };
      
      expect(() => generator.validateOptions(options)).to.throw('Lyrics are required');
    });

    it('should throw error for invalid format', () => {
      const options = {
        title: 'Test Song',
        lyrics: 'Test lyrics',
        format: 'invalid'
      };
      
      expect(() => generator.validateOptions(options)).to.throw('Invalid format');
    });

    it('should allow optional parameters to be undefined', () => {
      const options = {
        title: 'Test Song',
        lyrics: 'Test lyrics'
      };

      expect(() => generator.validateOptions(options)).to.not.throw();
    });
  });

  describe('generate', () => {
    it('should generate song successfully', async () => {
      const lyricsPath = join(tempDir, 'lyrics.txt');
      await fs.writeFile(lyricsPath, 'Test lyrics content', 'utf8');

      const options = {
        title: 'Test Song',
        lyricsPath,
        output: tempDir,
        format: 'mp3'
      };

      const progressCallback = (progress) => {
        expect(progress).to.have.property('step');
        expect(progress).to.have.property('progress');
      };

      const result = await generator.generate(options, progressCallback);

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('filePath');
      expect(result).to.have.property('songId', 'song-123');
      
      // Check if file was created
      const stats = await fs.stat(result.filePath);
      expect(stats.isFile()).to.be.true;
    });

    it('should handle generation with style parameter', async () => {
      const lyricsPath = join(tempDir, 'lyrics.txt');
      await fs.writeFile(lyricsPath, 'Test lyrics content', 'utf8');

      mockSunoClient.generateSong = async (params) => {
        expect(params.style).to.equal('rock');
        return { id: 'song-123', status: 'pending' };
      };

      const options = {
        title: 'Test Song',
        lyricsPath,
        style: 'rock',
        output: tempDir
      };

      const result = await generator.generate(options);
      expect(result.success).to.be.true;
    });

    it('should handle API errors gracefully', async () => {
      const lyricsPath = join(tempDir, 'lyrics.txt');
      await fs.writeFile(lyricsPath, 'Test lyrics content', 'utf8');

      mockSunoClient.generateSong = async () => {
        throw new Error('API Error');
      };

      const options = {
        title: 'Test Song',
        lyricsPath,
        output: tempDir
      };

      try {
        await generator.generate(options);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate song');
      }
    });

    it('should call progress callback with correct steps', async () => {
      const lyricsPath = join(tempDir, 'lyrics.txt');
      await fs.writeFile(lyricsPath, 'Test lyrics content', 'utf8');

      const progressSteps = [];
      const progressCallback = (progress) => {
        progressSteps.push(progress.step);
      };

      const options = {
        title: 'Test Song',
        lyricsPath,
        output: tempDir
      };

      await generator.generate(options, progressCallback);

      expect(progressSteps).to.include('reading_lyrics');
      expect(progressSteps).to.include('submitting');
      expect(progressSteps).to.include('waiting');
      expect(progressSteps).to.include('downloading');
      expect(progressSteps).to.include('saving');
    });
  });
});