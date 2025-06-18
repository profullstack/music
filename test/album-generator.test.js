import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join } from 'path';
import { AlbumGenerator } from '../src/services/album-generator.js';

describe('AlbumGenerator', () => {
  let albumGenerator;
  let mockSunoClient;
  let tempDir;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = join(process.cwd(), 'test-temp-album');
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

    albumGenerator = new AlbumGenerator(mockSunoClient);
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
    it('should create album generator with suno client', () => {
      expect(albumGenerator).to.be.instanceOf(AlbumGenerator);
      expect(albumGenerator.sunoClient).to.equal(mockSunoClient);
    });

    it('should throw error without suno client', () => {
      expect(() => new AlbumGenerator()).to.throw('Suno client is required');
    });
  });

  describe('validateAlbumConfig', () => {
    it('should validate complete album configuration', () => {
      const config = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: [
          { title: 'Track 1', lyrics: './lyrics1.txt' },
          { title: 'Track 2', lyrics: './lyrics2.txt' }
        ]
      };

      expect(() => albumGenerator.validateAlbumConfig(config)).to.not.throw();
    });

    it('should throw error for missing title', () => {
      const config = {
        artist: 'Test Artist',
        tracks: [{ title: 'Track 1', lyrics: './lyrics1.txt' }]
      };

      expect(() => albumGenerator.validateAlbumConfig(config)).to.throw('Album title is required');
    });

    it('should throw error for missing tracks', () => {
      const config = {
        title: 'Test Album',
        artist: 'Test Artist'
      };

      expect(() => albumGenerator.validateAlbumConfig(config)).to.throw('Album must have at least one track');
    });

    it('should throw error for empty tracks array', () => {
      const config = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: []
      };

      expect(() => albumGenerator.validateAlbumConfig(config)).to.throw('Album must have at least one track');
    });

    it('should validate track structure', () => {
      const config = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: [
          { lyrics: './lyrics1.txt' } // Missing title
        ]
      };

      expect(() => albumGenerator.validateAlbumConfig(config)).to.throw('Track 1: title is required');
    });
  });

  describe('generateMultipleSongs', () => {
    it('should generate multiple songs from same lyrics', async () => {
      const lyricsPath = join(tempDir, 'lyrics.txt');
      await fs.writeFile(lyricsPath, 'Test lyrics content', 'utf8');

      const options = {
        title: 'Test Song',
        lyricsPath,
        count: 3,
        output: tempDir,
        style: 'rock'
      };

      const progressCallback = (progress) => {
        expect(progress).to.have.property('step');
        expect(progress).to.have.property('progress');
        expect(progress).to.have.property('currentTrack');
        expect(progress).to.have.property('totalTracks');
      };

      const results = await albumGenerator.generateMultipleSongs(options, progressCallback);

      expect(results).to.have.length(3);
      results.forEach((result, index) => {
        expect(result).to.have.property('success', true);
        expect(result).to.have.property('filePath');
        expect(result.filePath).to.include(`test-song-${index + 1}`);
        expect(result).to.have.property('songId', 'song-123');
      });
    });

    it('should handle style variations for multiple songs', async () => {
      const lyricsPath = join(tempDir, 'lyrics.txt');
      await fs.writeFile(lyricsPath, 'Test lyrics content', 'utf8');

      let generationCount = 0;
      mockSunoClient.generateSong = async (params) => {
        generationCount++;
        expect(params.style).to.include('rock');
        return { id: `song-${generationCount}`, status: 'pending' };
      };

      const options = {
        title: 'Test Song',
        lyricsPath,
        count: 2,
        output: tempDir,
        style: 'rock'
      };

      const results = await albumGenerator.generateMultipleSongs(options);
      expect(results).to.have.length(2);
      expect(generationCount).to.equal(2);
    });

    it('should handle partial failures gracefully', async () => {
      const lyricsPath = join(tempDir, 'lyrics.txt');
      await fs.writeFile(lyricsPath, 'Test lyrics content', 'utf8');

      let callCount = 0;
      mockSunoClient.generateSong = async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('API Error for second song');
        }
        return { id: 'song-123', status: 'pending' };
      };

      const options = {
        title: 'Test Song',
        lyricsPath,
        count: 3,
        output: tempDir
      };

      const results = await albumGenerator.generateMultipleSongs(options);
      
      expect(results).to.have.length(3);
      expect(results[0]).to.have.property('success', true);
      expect(results[1]).to.have.property('success', false);
      expect(results[1]).to.have.property('error');
      expect(results[2]).to.have.property('success', true);
    });
  });

  describe('generateAlbum', () => {
    it('should generate complete album from configuration', async () => {
      // Create test lyrics files
      const lyrics1Path = join(tempDir, 'lyrics1.txt');
      const lyrics2Path = join(tempDir, 'lyrics2.txt');
      await fs.writeFile(lyrics1Path, 'Track 1 lyrics', 'utf8');
      await fs.writeFile(lyrics2Path, 'Track 2 lyrics', 'utf8');

      const albumConfig = {
        title: 'Test Album',
        artist: 'Test Artist',
        style: 'indie rock',
        tracks: [
          { title: 'Track 1', lyrics: lyrics1Path, style: 'upbeat indie rock' },
          { title: 'Track 2', lyrics: lyrics2Path }
        ]
      };

      const options = {
        albumConfig,
        output: tempDir,
        format: 'mp3'
      };

      const progressCallback = (progress) => {
        expect(progress).to.have.property('step');
        expect(progress).to.have.property('albumProgress');
        expect(progress).to.have.property('currentTrack');
        expect(progress).to.have.property('totalTracks');
      };

      const result = await albumGenerator.generateAlbum(options, progressCallback);

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('albumTitle', 'Test Album');
      expect(result).to.have.property('tracks');
      expect(result.tracks).to.have.length(2);
      expect(result).to.have.property('metadataPath');

      // Check metadata file was created
      const metadataExists = await fs.access(result.metadataPath).then(() => true).catch(() => false);
      expect(metadataExists).to.be.true;
    });

    it('should apply album-wide style with track overrides', async () => {
      const lyricsPath = join(tempDir, 'lyrics.txt');
      await fs.writeFile(lyricsPath, 'Test lyrics', 'utf8');

      const styles = [];
      mockSunoClient.generateSong = async (params) => {
        styles.push(params.style);
        return { id: 'song-123', status: 'pending' };
      };

      const albumConfig = {
        title: 'Test Album',
        artist: 'Test Artist',
        style: 'indie rock',
        tracks: [
          { title: 'Track 1', lyrics: lyricsPath, style: 'heavy metal' },
          { title: 'Track 2', lyrics: lyricsPath } // Should use album style
        ]
      };

      await albumGenerator.generateAlbum({ albumConfig, output: tempDir });

      expect(styles).to.have.length(2);
      expect(styles[0]).to.equal('heavy metal');
      expect(styles[1]).to.equal('indie rock');
    });
  });

  describe('createAlbumMetadata', () => {
    it('should create album metadata file', async () => {
      const albumData = {
        albumTitle: 'Test Album',
        artist: 'Test Artist',
        tracks: [
          { trackNumber: 1, title: 'Track 1', filePath: './track1.mp3', songId: 'song-1', format: 'mp3', fileSize: 1024 },
          { trackNumber: 2, title: 'Track 2', filePath: './track2.mp3', songId: 'song-2', format: 'mp3', fileSize: 2048 }
        ],
        failedTracks: []
      };

      const metadataPath = await albumGenerator.createAlbumMetadata(albumData, tempDir);
      
      expect(metadataPath).to.include('album-metadata.json');
      
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      expect(metadata).to.have.property('title', 'Test Album');
      expect(metadata).to.have.property('artist', 'Test Artist');
      expect(metadata).to.have.property('tracks');
      expect(metadata.tracks).to.have.length(2);
      expect(metadata).to.have.property('generatedAt');
      expect(metadata).to.have.property('totalTracks', 2);
      expect(metadata).to.have.property('failedTracks', 0);
    });
  });

  describe('generateStyleVariations', () => {
    it('should generate style variations for multiple songs', () => {
      const baseStyle = 'rock';
      const variations = albumGenerator.generateStyleVariations(baseStyle, 3);
      
      expect(variations).to.have.length(3);
      variations.forEach(variation => {
        expect(variation).to.include('rock');
      });
    });

    it('should handle empty base style', () => {
      const variations = albumGenerator.generateStyleVariations('', 2);
      
      expect(variations).to.have.length(2);
      variations.forEach(variation => {
        expect(variation).to.be.a('string');
        expect(variation.length).to.be.greaterThan(0);
      });
    });
  });
});