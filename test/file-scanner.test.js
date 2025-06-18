import { expect } from 'chai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { FileScanner } from '../src/utils/file-scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataDir = join(__dirname, 'test-data');

describe('FileScanner', () => {
  let fileScanner;

  before(async () => {
    // Create test directory structure
    await mkdir(join(testDataDir, 'Artist1', 'Album1'), { recursive: true });
    await mkdir(join(testDataDir, 'Artist1', 'Album2'), { recursive: true });
    await mkdir(join(testDataDir, 'Artist2', 'Album1'), { recursive: true });

    // Create test audio files
    await writeFile(join(testDataDir, 'Artist1', 'Album1', '01-track1.wav'), 'fake audio data');
    await writeFile(join(testDataDir, 'Artist1', 'Album1', '02-track2.wav'), 'fake audio data');
    await writeFile(join(testDataDir, 'Artist1', 'Album2', '01-song1.wav'), 'fake audio data');
    await writeFile(join(testDataDir, 'Artist2', 'Album1', '01-test.wav'), 'fake audio data');

    // Create non-audio files (should be ignored)
    await writeFile(join(testDataDir, 'Artist1', 'Album1', 'cover.jpg'), 'fake image data');
    await writeFile(join(testDataDir, 'Artist1', 'Album1', 'metadata.json'), '{}');

    fileScanner = new FileScanner(testDataDir);
  });

  after(async () => {
    // Clean up test directory
    await rm(testDataDir, { recursive: true, force: true });
  });

  describe('scanMusicDirectory', () => {
    it('should discover all artists and albums', async () => {
      const result = await fileScanner.scanMusicDirectory();

      expect(result).to.be.an('array');
      expect(result).to.have.length(3);

      const artistNames = result.map(album => album.artist);
      expect(artistNames).to.include('Artist1');
      expect(artistNames).to.include('Artist2');
    });

    it('should extract correct metadata from directory structure', async () => {
      const result = await fileScanner.scanMusicDirectory();
      const album1 = result.find(album => album.artist === 'Artist1' && album.album === 'Album1');

      expect(album1).to.exist;
      expect(album1.artist).to.equal('Artist1');
      expect(album1.album).to.equal('Album1');
      expect(album1.tracks).to.have.length(2);
    });

    it('should extract track information correctly', async () => {
      const result = await fileScanner.scanMusicDirectory();
      const album1 = result.find(album => album.artist === 'Artist1' && album.album === 'Album1');

      const track1 = album1.tracks.find(track => track.filename === '01-track1.wav');
      expect(track1).to.exist;
      expect(track1.trackNumber).to.equal(1);
      expect(track1.title).to.equal('track1');
      expect(track1.format).to.equal('wav');
    });

    it('should only include supported audio formats', async () => {
      const result = await fileScanner.scanMusicDirectory();
      const album1 = result.find(album => album.artist === 'Artist1' && album.album === 'Album1');

      const allFiles = album1.tracks.map(track => track.filename);
      expect(allFiles).to.not.include('cover.jpg');
      expect(allFiles).to.not.include('metadata.json');
    });
  });

  describe('scanSpecificAlbum', () => {
    it('should scan a specific artist and album', async () => {
      const result = await fileScanner.scanSpecificAlbum('Artist1', 'Album1');

      expect(result).to.exist;
      expect(result.artist).to.equal('Artist1');
      expect(result.album).to.equal('Album1');
      expect(result.tracks).to.have.length(2);
    });

    it('should return null for non-existent album', async () => {
      const result = await fileScanner.scanSpecificAlbum('NonExistent', 'Album');
      expect(result).to.be.null;
    });
  });

  describe('validateAlbumStructure', () => {
    it('should validate correct album structure', async () => {
      const album = await fileScanner.scanSpecificAlbum('Artist1', 'Album1');
      const isValid = fileScanner.validateAlbumStructure(album);

      expect(isValid.valid).to.be.true;
      expect(isValid.errors).to.be.empty;
    });

    it('should detect missing required fields', () => {
      const invalidAlbum = {
        artist: '',
        album: 'Test Album',
        tracks: []
      };

      const isValid = fileScanner.validateAlbumStructure(invalidAlbum);
      expect(isValid.valid).to.be.false;
      expect(isValid.errors).to.include('Artist name is required');
      expect(isValid.errors).to.include('Album must contain at least one track');
    });
  });
});