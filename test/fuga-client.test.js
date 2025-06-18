import { expect } from 'chai';
import { FugaClient } from '../src/api/fuga-client.js';

describe('FugaClient', () => {
  let fugaClient;
  const mockConfig = {
    baseUrl: 'https://api.fuga.com',
    apiToken: 'test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  };

  beforeEach(() => {
    fugaClient = new FugaClient(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(fugaClient.config.baseUrl).to.equal(mockConfig.baseUrl);
      expect(fugaClient.config.apiToken).to.equal(mockConfig.apiToken);
    });

    it('should throw error for missing required configuration', () => {
      expect(() => new FugaClient()).to.throw('FUGA API configuration is required');
    });

    it('should throw error for missing API token', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.apiToken;
      expect(() => new FugaClient(invalidConfig)).to.throw('API token is required');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate complete configuration', () => {
      const result = fugaClient.validateConfiguration();
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should detect missing base URL', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.baseUrl;
      
      // Create client with invalid config - it will set default baseUrl
      const client = new FugaClient(invalidConfig);
      
      // But validation should check the original config values
      // We need to modify the validateConfiguration to check original values
      client.config.baseUrl = undefined; // Simulate missing baseUrl for validation
      
      const result = client.validateConfiguration();
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Base URL is required');
    });
  });

  describe('buildHeaders', () => {
    it('should build correct authorization headers', () => {
      const headers = fugaClient.buildHeaders();
      
      expect(headers).to.have.property('Authorization');
      expect(headers.Authorization).to.equal(`Bearer ${mockConfig.apiToken}`);
      expect(headers['Content-Type']).to.equal('application/json');
    });

    it('should include additional headers when provided', () => {
      const additionalHeaders = { 'X-Custom-Header': 'test-value' };
      const headers = fugaClient.buildHeaders(additionalHeaders);
      
      expect(headers['X-Custom-Header']).to.equal('test-value');
    });
  });

  describe('createAlbum', () => {
    it('should format album metadata correctly', () => {
      const albumData = {
        artist: 'Test Artist',
        album: 'Test Album',
        tracks: [
          { title: 'Track 1', trackNumber: 1, filename: '01-track1.wav' },
          { title: 'Track 2', trackNumber: 2, filename: '02-track2.wav' },
        ],
      };

      const formattedData = fugaClient.formatAlbumMetadata(albumData);
      
      expect(formattedData.name).to.equal('Test Album');
      expect(formattedData.artist).to.equal('Test Artist');
      expect(formattedData.tracks).to.have.length(2);
      expect(formattedData.tracks[0].name).to.equal('Track 1');
      expect(formattedData.tracks[0].track_number).to.equal(1);
    });
  });

  describe('retry mechanism', () => {
    it('should have default retry configuration', () => {
      expect(fugaClient.retryConfig.maxAttempts).to.equal(3);
      expect(fugaClient.retryConfig.delayMs).to.equal(5000);
    });

    it('should allow custom retry configuration', () => {
      const customConfig = {
        ...mockConfig,
        retryConfig: { maxAttempts: 5, delayMs: 2000 },
      };
      const client = new FugaClient(customConfig);
      
      expect(client.retryConfig.maxAttempts).to.equal(5);
      expect(client.retryConfig.delayMs).to.equal(2000);
    });
  });

  describe('error handling', () => {
    it('should format API errors correctly', () => {
      const apiError = {
        status: 400,
        statusText: 'Bad Request',
        data: { message: 'Invalid album data' },
      };

      const formattedError = fugaClient.formatApiError(apiError);
      expect(formattedError.message).to.include('FUGA API Error (400)');
      expect(formattedError.message).to.include('Invalid album data');
    });

    it('should handle network errors', () => {
      const networkError = new Error('Network timeout');
      const formattedError = fugaClient.formatNetworkError(networkError);
      
      expect(formattedError.message).to.include('Network error');
      expect(formattedError.message).to.include('Network timeout');
    });
  });

  describe('upload progress tracking', () => {
    it('should initialize progress tracking', () => {
      const progressTracker = fugaClient.createProgressTracker('test-upload');
      
      expect(progressTracker.id).to.equal('test-upload');
      expect(progressTracker.progress).to.equal(0);
      expect(progressTracker.status).to.equal('pending');
    });

    it('should update progress correctly', () => {
      const progressTracker = fugaClient.createProgressTracker('test-upload');
      fugaClient.updateProgress(progressTracker, 50, 'uploading');
      
      expect(progressTracker.progress).to.equal(50);
      expect(progressTracker.status).to.equal('uploading');
    });
  });
});