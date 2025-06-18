import { expect } from 'chai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { MetadataScanner } from '../src/utils/metadata-scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataDir = join(__dirname, 'test-metadata');

describe('MetadataScanner', () => {
  let metadataScanner;

  before(async () => {
    // Create test directory structure
    await mkdir(join(testDataDir, 'Artist1', 'Album1'), { recursive: true });
    await mkdir(join(testDataDir, 'Artist2', 'Album2'), { recursive: true });

    // Create test audio files
    await writeFile(join(testDataDir, 'Artist1', 'Album1', '01 - Track One.wav'), 'fake audio data');
    await writeFile(join(testDataDir, 'Artist1', 'Album1', '02 - Track Two.wav'), 'fake audio data');
    await writeFile(join(testDataDir, 'Artist2', 'Album2', '01 - Song One.wav'), 'fake audio data');

    // Create metadata.json files
    const metadata1 = {
      artist: 'Artist1',
      album: 'Album1',
      genre: 'Rock',
      release_date: '2025-06-20',
      upc: '123456789012',
      explicit: false,
      tracks: [
        { title: 'Track One', isrc: 'USXXX2500001' },
        { title: 'Track Two', isrc: 'USXXX2500002' },
      ],
    };

    const metadata2 = {
      artist: 'Artist2',
      album: 'Album2',
      genre: 'Pop',
      release_date: '2025-07-15',
      upc: '987654321098',
      explicit: true,
      tracks: [
        { title: 'Song One', isrc: 'USYYY2500001' },
      ],
    };

    await writeFile(
      join(testDataDir, 'Artist1', 'Album1', 'metadata.json'),
      JSON.stringify(metadata1, null, 2)
    );

    await writeFile(
      join(testDataDir, 'Artist2', 'Album2', 'metadata.json'),
      JSON.stringify(metadata2, null, 2)
    );

    metadataScanner = new MetadataScanner(testDataDir);
  });

  after(async () => {
    // Clean up test directory
    await rm(testDataDir, { recursive: true, force: true });
  });

  describe('scanMusicDirectory', () => {
    it('should discover all albums with metadata', async () => {
      const result = await metadataScanner.scanMusicDirectory();

      expect(result).to.be.an('array');
      expect(result).to.have.length(2);

      const artistNames = result.map(album => album.metadata.artist);
      expect(artistNames).to.include('Artist1');
      expect(artistNames).to.include('Artist2');
    });

    it('should load metadata from JSON files', async () => {
      const result = await metadataScanner.scanMusicDirectory();
      const album1 = result.find(album => album.metadata.artist === 'Artist1');

      expect(album1.metadata.album).to.equal('Album1');
      expect(album1.metadata.genre).to.equal('Rock');
      expect(album1.metadata.upc).to.equal('123456789012');
      expect(album1.metadata.explicit).to.be.false;
      expect(album1.metadata.tracks).to.have.length(2);
    });

    it('should match audio files with metadata tracks', async () => {
      const result = await metadataScanner.scanMusicDirectory();
      const album1 = result.find(album => album.metadata.artist === 'Artist1');

      expect(album1.tracks).to.have.length(2);
      expect(album1.tracks[0].title).to.equal('Track One');
      expect(album1.tracks[0].isrc).to.equal('USXXX2500001');
      expect(album1.tracks[0].filename).to.equal('01 - Track One.wav');
    });
  });

  describe('scanSpecificAlbum', () => {
    it('should scan a specific artist and album with metadata', async () => {
      const result = await metadataScanner.scanSpecificAlbum('Artist1', 'Album1');

      expect(result).to.exist;
      expect(result.metadata.artist).to.equal('Artist1');
      expect(result.metadata.album).to.equal('Album1');
      expect(result.tracks).to.have.length(2);
    });

    it('should return null for non-existent album', async () => {
      const result = await metadataScanner.scanSpecificAlbum('NonExistent', 'Album');
      expect(result).to.be.null;
    });
  });

  describe('loadMetadata', () => {
    it('should load and parse metadata.json file', async () => {
      const albumPath = join(testDataDir, 'Artist1', 'Album1');
      const metadata = await metadataScanner.loadMetadata(albumPath);

      expect(metadata.artist).to.equal('Artist1');
      expect(metadata.album).to.equal('Album1');
      expect(metadata.tracks).to.have.length(2);
    });

    it('should return null if metadata.json does not exist', async () => {
      const albumPath = join(testDataDir, 'NonExistent');
      const metadata = await metadataScanner.loadMetadata(albumPath);
      expect(metadata).to.be.null;
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidPath = join(testDataDir, 'Invalid');
      await mkdir(invalidPath, { recursive: true });
      await writeFile(join(invalidPath, 'metadata.json'), 'invalid json');

      const metadata = await metadataScanner.loadMetadata(invalidPath);
      expect(metadata).to.be.null;

      await rm(invalidPath, { recursive: true, force: true });
    });
  });

  describe('matchTracksWithMetadata', () => {
    it('should match audio files with metadata tracks by title', async () => {
      const audioFiles = [
        { filename: '01 - Track One.wav', title: 'Track One', trackNumber: 1 },
        { filename: '02 - Track Two.wav', title: 'Track Two', trackNumber: 2 },
      ];

      const metadataTracks = [
        { title: 'Track One', isrc: 'USXXX2500001' },
        { title: 'Track Two', isrc: 'USXXX2500002' },
      ];

      const matched = metadataScanner.matchTracksWithMetadata(audioFiles, metadataTracks);

      expect(matched).to.have.length(2);
      expect(matched[0].title).to.equal('Track One');
      expect(matched[0].isrc).to.equal('USXXX2500001');
      expect(matched[0].filename).to.equal('01 - Track One.wav');
    });

    it('should handle mismatched track counts', async () => {
      const audioFiles = [
        { filename: '01 - Track One.wav', title: 'Track One', trackNumber: 1 },
      ];

      const metadataTracks = [
        { title: 'Track One', isrc: 'USXXX2500001' },
        { title: 'Track Two', isrc: 'USXXX2500002' },
      ];

      const matched = metadataScanner.matchTracksWithMetadata(audioFiles, metadataTracks);

      expect(matched).to.have.length(1);
      expect(matched[0].title).to.equal('Track One');
    });
  });

  describe('validateAlbumData', () => {
    it('should validate complete album data', async () => {
      const result = await metadataScanner.scanSpecificAlbum('Artist1', 'Album1');
      const validation = metadataScanner.validateAlbumData(result);

      expect(validation.valid).to.be.true;
      expect(validation.errors).to.be.empty;
    });

    it('should detect missing metadata', () => {
      const invalidAlbum = {
        metadata: null,
        tracks: [],
      };

      const validation = metadataScanner.validateAlbumData(invalidAlbum);
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.include('Metadata is required');
    });

    it('should detect track count mismatch', () => {
      const invalidAlbum = {
        metadata: {
          artist: 'Test',
          album: 'Test',
          tracks: [{ title: 'Track 1' }, { title: 'Track 2' }],
        },
        tracks: [{ title: 'Track 1' }], // Only one audio file
      };

      const validation = metadataScanner.validateAlbumData(invalidAlbum);
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.include('Track count mismatch: metadata has 2 tracks, found 1 audio files');
    });
  });
});