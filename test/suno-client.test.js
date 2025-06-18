import { expect } from 'chai';
import { SunoClient } from '../src/api/suno-client.js';

describe('SunoClient', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    // Mock fetch for testing
    mockFetch = global.fetch;
    client = new SunoClient({
      apiToken: 'test-token',
      baseUrl: 'https://api.test.com'
    });
  });

  afterEach(() => {
    global.fetch = mockFetch;
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(client).to.be.instanceOf(SunoClient);
      expect(client.config.apiToken).to.equal('test-token');
      expect(client.config.baseUrl).to.equal('https://api.test.com');
    });

    it('should throw error with missing apiToken', () => {
      expect(() => new SunoClient({})).to.throw('API token is required');
    });

    it('should use default baseUrl when not provided', () => {
      const defaultClient = new SunoClient({ apiToken: 'test' });
      expect(defaultClient.config.baseUrl).to.equal('https://api.sunoapi.org');
    });
  });

  describe('generateSong', () => {
    it('should submit song generation request successfully', async () => {
      const mockResponse = {
        id: 'song-123',
        status: 'pending',
        title: 'Test Song'
      };

      global.fetch = async () => ({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.generateSong({
        title: 'Test Song',
        lyrics: 'Test lyrics',
        style: 'rock'
      });

      expect(result).to.deep.equal(mockResponse);
    });

    it('should throw error on API failure', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid request' })
      });

      try {
        await client.generateSong({
          title: 'Test Song',
          lyrics: 'Test lyrics'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate song');
      }
    });

    it('should validate required parameters', async () => {
      try {
        await client.generateSong({});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Title and lyrics are required');
      }
    });
  });

  describe('getGenerationStatus', () => {
    it('should fetch generation status successfully', async () => {
      const mockResponse = {
        id: 'song-123',
        status: 'completed',
        downloadUrl: 'https://example.com/song.mp3'
      };

      global.fetch = async () => ({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.getGenerationStatus('song-123');
      expect(result).to.deep.equal(mockResponse);
    });

    it('should throw error for invalid song ID', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      try {
        await client.getGenerationStatus('invalid-id');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to get generation status');
      }
    });
  });

  describe('pollUntilComplete', () => {
    it('should poll until completion', async () => {
      let callCount = 0;
      const responses = [
        { id: 'song-123', status: 'pending' },
        { id: 'song-123', status: 'processing' },
        { id: 'song-123', status: 'completed', downloadUrl: 'https://example.com/song.mp3' }
      ];

      global.fetch = async () => ({
        ok: true,
        json: async () => responses[callCount++]
      });

      const result = await client.pollUntilComplete('song-123', {
        maxAttempts: 5,
        intervalMs: 100
      });

      expect(result.status).to.equal('completed');
      expect(result.downloadUrl).to.exist;
      expect(callCount).to.equal(3);
    });

    it('should timeout after max attempts', async () => {
      global.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'song-123', status: 'pending' })
      });

      try {
        await client.pollUntilComplete('song-123', {
          maxAttempts: 2,
          intervalMs: 100
        });
        expect.fail('Should have thrown timeout error');
      } catch (error) {
        expect(error.message).to.include('Generation timed out');
      }
    });

    it('should handle failed generation', async () => {
      global.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'song-123', status: 'failed', error: 'Generation failed' })
      });

      try {
        await client.pollUntilComplete('song-123');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Generation failed');
      }
    });
  });

  describe('downloadSong', () => {
    it('should download song successfully', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      
      global.fetch = async () => ({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer
      });

      const result = await client.downloadSong('https://example.com/song.mp3');
      expect(result).to.be.instanceOf(ArrayBuffer);
      expect(result.byteLength).to.equal(1024);
    });

    it('should throw error on download failure', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      try {
        await client.downloadSong('https://example.com/invalid.mp3');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to download song');
      }
    });
  });

  describe('validateConfig', () => {
    it('should validate complete config', () => {
      const config = {
        apiToken: 'test-token',
        baseUrl: 'https://api.test.com'
      };
      
      expect(() => SunoClient.validateConfig(config)).to.not.throw();
    });

    it('should throw error for missing apiToken', () => {
      const config = { baseUrl: 'https://api.test.com' };
      
      expect(() => SunoClient.validateConfig(config)).to.throw('API token is required');
    });

    it('should throw error for invalid baseUrl', () => {
      const config = {
        apiToken: 'test-token',
        baseUrl: 'invalid-url'
      };
      
      expect(() => SunoClient.validateConfig(config)).to.throw('Invalid base URL');
    });
  });
});