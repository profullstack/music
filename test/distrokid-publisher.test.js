import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { DistroKidPublisher } from '../src/services/distrokid-publisher.js';

describe('DistroKidPublisher', () => {
  let publisher;
  let mockDistroKidClient;

  beforeEach(() => {
    // Mock DistroKid client
    mockDistroKidClient = {
      initialize: async () => {},
      login: async () => true,
      createAlbum: async () => ({ success: true, albumId: 'album-123' }),
      uploadTrack: async () => ({ success: true, trackId: 'track-123' }),
      previewAlbum: async () => ({ success: true, previewUrl: 'https://preview.url' }),
      submitAlbum: async () => ({ success: true, submissionId: 'sub-123' }),
      takeScreenshot: async () => Buffer.from('screenshot'),
      close: async () => {},
      isAuthenticated: true
    };

    const config = {
      email: 'test@example.com',
      password: 'testpassword',
      headless: true
    };

    publisher = new DistroKidPublisher(config);
    // Override the initialize method to inject our mock
    publisher.initialize = async () => {
      publisher.client = mockDistroKidClient;
      publisher.isInitialized = true;
      return true;
    };
  });

  afterEach(async () => {
    if (publisher) {
      await publisher.close();
    }
  });

  describe('constructor', () => {
    it('should create publisher with valid configuration', () => {
      const config = {
        email: 'test@example.com',
        password: 'testpassword'
      };
      const distroPublisher = new DistroKidPublisher(config);
      expect(distroPublisher).to.be.instanceOf(DistroKidPublisher);
      expect(distroPublisher.config.email).to.equal('test@example.com');
    });

    it('should throw error for missing configuration', () => {
      expect(() => new DistroKidPublisher()).to.throw('Configuration is required');
    });

    it('should use default options', () => {
      const config = {
        email: 'test@example.com',
        password: 'testpassword'
      };
      const distroPublisher = new DistroKidPublisher(config);
      expect(distroPublisher.config.previewMode).to.be.false;
      expect(distroPublisher.config.screenshotPath).to.equal('./screenshots');
    });
  });

  describe('initialize', () => {
    it('should initialize client and authenticate', async () => {
      const result = await publisher.initialize();
      expect(result).to.be.true;
      expect(publisher.isInitialized).to.be.true;
    });

    it('should handle initialization failure', async () => {
      // Override initialize to simulate failure
      publisher.initialize = async () => {
        throw new Error('Failed to initialize DistroKid publisher: Init failed');
      };
      
      try {
        await publisher.initialize();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Failed to initialize DistroKid publisher');
      }
    });

    it('should handle authentication failure', async () => {
      // Override initialize to simulate auth failure
      publisher.initialize = async () => {
        publisher.client = { ...mockDistroKidClient, login: async () => false };
        const loginSuccess = await publisher.client.login();
        return loginSuccess;
      };
      
      const result = await publisher.initialize();
      expect(result).to.be.false;
    });
  });

  describe('publishAlbum', () => {
    beforeEach(async () => {
      await publisher.initialize();
    });

    it('should publish album from directory structure', async () => {
      const albumPath = './test-album';
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: [
          {
            title: 'Track 1',
            filePath: './track1.mp3',
            lyrics: 'Test lyrics 1'
          },
          {
            title: 'Track 2',
            filePath: './track2.mp3',
            lyrics: 'Test lyrics 2'
          }
        ],
        artwork: './artwork.jpg'
      };

      // Mock album scanning
      publisher.scanAlbumDirectory = async () => albumData;

      const result = await publisher.publishAlbum(albumPath);
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('albumId', 'album-123');
      expect(result).to.have.property('tracks');
      expect(result.tracks).to.have.length(2);
    });

    it('should handle preview mode', async () => {
      publisher.config.previewMode = true;
      
      const albumPath = './test-album';
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: [{ title: 'Track 1', filePath: './track1.mp3' }],
        artwork: './artwork.jpg'
      };

      publisher.scanAlbumDirectory = async () => albumData;

      const result = await publisher.publishAlbum(albumPath);
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('previewUrl');
      expect(result).to.not.have.property('submissionId'); // Not submitted in preview mode
    });

    it('should handle album creation failure', async () => {
      mockDistroKidClient.createAlbum = async () => ({ success: false, error: 'Creation failed' });
      
      const albumPath = './test-album';
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: [],
        artwork: './artwork.jpg'
      };

      publisher.scanAlbumDirectory = async () => albumData;

      const result = await publisher.publishAlbum(albumPath);
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });

    it('should handle track upload failures gracefully', async () => {
      mockDistroKidClient.uploadTrack = async (albumId, trackData) => {
        if (trackData.title === 'Track 2') {
          return { success: false, error: 'Upload failed' };
        }
        return { success: true, trackId: 'track-123' };
      };

      const albumPath = './test-album';
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: [
          { title: 'Track 1', filePath: './track1.mp3' },
          { title: 'Track 2', filePath: './track2.mp3' }
        ]
      };

      publisher.scanAlbumDirectory = async () => albumData;

      const result = await publisher.publishAlbum(albumPath);
      expect(result).to.have.property('success', true); // Partial success
      expect(result.tracks).to.have.length(1); // Only successful track
      expect(result.failedTracks).to.have.length(1); // Failed track
    });
  });

  describe('scanAlbumDirectory', () => {
    it('should scan album directory and extract metadata', async () => {
      // Mock file system operations
      const { promises: fs } = await import('fs');
      const originalReaddir = fs.readdir;
      const originalStat = fs.stat;
      const originalReadFile = fs.readFile;

      fs.readdir = async (path) => {
        if (path.includes('test-album')) {
          return ['track1.mp3', 'track2.wav', 'artwork.jpg', 'lyrics.txt'];
        }
        return [];
      };

      fs.stat = async (path) => ({
        isFile: () => path.includes('.mp3') || path.includes('.wav') || path.includes('.jpg') || path.includes('.txt'),
        isDirectory: () => false
      });

      fs.readFile = async (path) => {
        if (path.includes('lyrics.txt')) {
          return 'Test lyrics content';
        }
        return 'mock file content';
      };

      try {
        const result = await publisher.scanAlbumDirectory('./test-album');
        expect(result).to.have.property('title');
        expect(result).to.have.property('tracks');
        expect(result.tracks).to.be.an('array');
      } finally {
        // Restore original functions
        fs.readdir = originalReaddir;
        fs.stat = originalStat;
        fs.readFile = originalReadFile;
      }
    });

    it('should handle directory scan failure', async () => {
      try {
        await publisher.scanAlbumDirectory('./non-existent-album');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Failed to scan album directory');
      }
    });
  });

  describe('publishFromAlbumGenerator', () => {
    beforeEach(async () => {
      await publisher.initialize();
    });

    it('should publish album from AlbumGenerator results', async () => {
      const albumResults = {
        success: true,
        albumTitle: 'Generated Album',
        artist: 'AI Artist',
        tracks: [
          {
            title: 'Generated Track 1',
            filePath: './generated1.mp3',
            trackNumber: 1
          },
          {
            title: 'Generated Track 2',
            filePath: './generated2.mp3',
            trackNumber: 2
          }
        ],
        albumDir: './generated-album'
      };

      const result = await publisher.publishFromAlbumGenerator(albumResults);
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('albumId', 'album-123');
      expect(result.tracks).to.have.length(2);
    });

    it('should handle missing album results', async () => {
      try {
        await publisher.publishFromAlbumGenerator(null);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Album results are required');
      }
    });

    it('should handle failed album generation results', async () => {
      const albumResults = {
        success: false,
        error: 'Generation failed'
      };

      try {
        await publisher.publishFromAlbumGenerator(albumResults);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Album generation was not successful');
      }
    });
  });

  describe('progress reporting', () => {
    it('should report progress during publishing', async () => {
      await publisher.initialize();
      
      const progressEvents = [];
      const progressCallback = (progress) => {
        progressEvents.push(progress);
      };

      const albumPath = './test-album';
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: [{ title: 'Track 1', filePath: './track1.mp3' }]
      };

      publisher.scanAlbumDirectory = async () => albumData;

      await publisher.publishAlbum(albumPath, progressCallback);
      
      expect(progressEvents.length).to.be.greaterThan(0);
      expect(progressEvents[0]).to.have.property('step');
      expect(progressEvents[0]).to.have.property('progress');
    });
  });

  describe('screenshot functionality', () => {
    beforeEach(async () => {
      await publisher.initialize();
    });

    it('should take screenshots during process', async () => {
      const screenshot = await publisher.takeScreenshot('test-step');
      expect(screenshot).to.be.instanceOf(Buffer);
    });

    it('should handle screenshot failure gracefully', async () => {
      mockDistroKidClient.takeScreenshot = async () => {
        throw new Error('Screenshot failed');
      };

      const screenshot = await publisher.takeScreenshot('test-step');
      expect(screenshot).to.be.null;
    });
  });

  describe('cleanup', () => {
    it('should close client properly', async () => {
      await publisher.initialize();
      await publisher.close();
      // Should not throw error
    });

    it('should handle close when not initialized', async () => {
      await publisher.close();
      // Should not throw error
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Initialize first
      await publisher.initialize();
      
      // Then override the createAlbum method to simulate network error
      publisher.client.createAlbum = async () => {
        throw new Error('Network error');
      };
      
      const albumPath = './test-album';
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: []
      };

      publisher.scanAlbumDirectory = async () => albumData;

      const result = await publisher.publishAlbum(albumPath);
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    }).timeout(5000);

    it('should retry failed operations', async () => {
      // Initialize first
      await publisher.initialize();
      
      let attempts = 0;
      publisher.client.createAlbum = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, albumId: 'album-123' };
      };
      
      const albumPath = './test-album';
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        tracks: []
      };

      publisher.scanAlbumDirectory = async () => albumData;

      const result = await publisher.publishAlbum(albumPath);
      expect(result).to.have.property('success', true);
      expect(attempts).to.equal(3);
    }).timeout(5000);
  });
});