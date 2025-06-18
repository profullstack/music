import { expect } from 'chai';
import { TuneCoreClient } from '../src/api/tunecore-client.js';

describe('TuneCoreClient', () => {
  let tuneCoreClient;
  const mockConfig = {
    baseUrl: 'https://api.tunecoredirect.com',
    apiToken: 'test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    partnerId: 'test-partner-id',
  };

  beforeEach(() => {
    tuneCoreClient = new TuneCoreClient(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(tuneCoreClient.config.baseUrl).to.equal(mockConfig.baseUrl);
      expect(tuneCoreClient.config.apiToken).to.equal(mockConfig.apiToken);
      expect(tuneCoreClient.config.partnerId).to.equal(mockConfig.partnerId);
    });

    it('should throw error for missing required configuration', () => {
      expect(() => new TuneCoreClient()).to.throw('TuneCore API configuration is required');
    });

    it('should throw error for missing API token', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.apiToken;
      expect(() => new TuneCoreClient(invalidConfig)).to.throw('API token is required');
    });

    it('should throw error for missing partner ID', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.partnerId;
      expect(() => new TuneCoreClient(invalidConfig)).to.throw('Partner ID is required');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate complete configuration', () => {
      const result = tuneCoreClient.validateConfiguration();
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should detect missing required fields', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.baseUrl;
      delete invalidConfig.clientId;
      const client = new TuneCoreClient(invalidConfig);
      
      // Manually set to undefined for validation test
      client.config.baseUrl = undefined;
      client.config.clientId = undefined;
      
      const result = client.validateConfiguration();
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Base URL is required');
      expect(result.errors).to.include('Client ID is required');
    });
  });

  describe('buildHeaders', () => {
    it('should build correct authorization headers', () => {
      const headers = tuneCoreClient.buildHeaders();
      
      expect(headers).to.have.property('Authorization');
      expect(headers.Authorization).to.equal(`Bearer ${mockConfig.apiToken}`);
      expect(headers['Content-Type']).to.equal('application/json');
      expect(headers['X-Partner-ID']).to.equal(mockConfig.partnerId);
    });

    it('should include additional headers when provided', () => {
      const additionalHeaders = { 'X-Custom-Header': 'test-value' };
      const headers = tuneCoreClient.buildHeaders(additionalHeaders);
      
      expect(headers['X-Custom-Header']).to.equal('test-value');
    });
  });

  describe('formatAlbumMetadata', () => {
    it('should format album metadata correctly', () => {
      const albumData = {
        artist: 'Test Artist',
        album: 'Test Album',
        genre: 'Rock',
        release_date: '2025-06-20',
        upc: '123456789012',
        explicit: false,
        tracks: [
          { title: 'Track 1', isrc: 'USXXX2500001', trackNumber: 1 },
          { title: 'Track 2', isrc: 'USXXX2500002', trackNumber: 2 },
        ],
      };

      const formattedData = tuneCoreClient.formatAlbumMetadata(albumData);
      
      expect(formattedData.title).to.equal('Test Album');
      expect(formattedData.artist_name).to.equal('Test Artist');
      expect(formattedData.genre).to.equal('Rock');
      expect(formattedData.release_date).to.equal('2025-06-20');
      expect(formattedData.upc).to.equal('123456789012');
      expect(formattedData.explicit).to.be.false;
      expect(formattedData.tracks).to.have.length(2);
      expect(formattedData.tracks[0].title).to.equal('Track 1');
      expect(formattedData.tracks[0].isrc).to.equal('USXXX2500001');
    });
  });

  describe('validateMetadata', () => {
    it('should validate correct metadata structure', () => {
      const validMetadata = {
        artist: 'Test Artist',
        album: 'Test Album',
        genre: 'Rock',
        release_date: '2025-06-20',
        upc: '123456789012',
        explicit: false,
        tracks: [
          { title: 'Track 1', isrc: 'USXXX2500001' },
        ],
      };

      const result = tuneCoreClient.validateMetadata(validMetadata);
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should detect missing required fields', () => {
      const invalidMetadata = {
        artist: '',
        album: 'Test Album',
        tracks: [],
      };

      const result = tuneCoreClient.validateMetadata(invalidMetadata);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Artist name is required');
      expect(result.errors).to.include('At least one track is required');
    });

    it('should validate UPC format', () => {
      const invalidMetadata = {
        artist: 'Test Artist',
        album: 'Test Album',
        upc: '12345', // Invalid UPC
        tracks: [{ title: 'Track 1', isrc: 'USXXX2500001' }],
      };

      const result = tuneCoreClient.validateMetadata(invalidMetadata);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('UPC must be 12 digits');
    });

    it('should validate ISRC format', () => {
      const invalidMetadata = {
        artist: 'Test Artist',
        album: 'Test Album',
        tracks: [{ title: 'Track 1', isrc: 'INVALID' }],
      };

      const result = tuneCoreClient.validateMetadata(invalidMetadata);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Track 1: Invalid ISRC format');
    });
  });

  describe('createArtist', () => {
    it('should format artist data correctly', () => {
      const artistData = {
        name: 'Test Artist',
        email: 'artist@example.com',
        country: 'US',
      };

      const formattedData = tuneCoreClient.formatArtistData(artistData);
      expect(formattedData.name).to.equal('Test Artist');
      expect(formattedData.email).to.equal('artist@example.com');
      expect(formattedData.country).to.equal('US');
    });
  });

  describe('error handling', () => {
    it('should format API errors correctly', () => {
      const apiError = {
        status: 400,
        statusText: 'Bad Request',
        data: { message: 'Invalid album data' },
      };

      const formattedError = tuneCoreClient.formatApiError(apiError);
      expect(formattedError.message).to.include('TuneCore API Error (400)');
      expect(formattedError.message).to.include('Invalid album data');
    });

    it('should handle network errors', () => {
      const networkError = new Error('Network timeout');
      const formattedError = tuneCoreClient.formatNetworkError(networkError);
      
      expect(formattedError.message).to.include('Network error');
      expect(formattedError.message).to.include('Network timeout');
    });
  });

  describe('retry mechanism', () => {
    it('should have default retry configuration', () => {
      expect(tuneCoreClient.retryConfig.maxAttempts).to.equal(3);
      expect(tuneCoreClient.retryConfig.delayMs).to.equal(5000);
    });

    it('should allow custom retry configuration', () => {
      const customConfig = {
        ...mockConfig,
        retryConfig: { maxAttempts: 5, delayMs: 2000 },
      };
      const client = new TuneCoreClient(customConfig);
      
      expect(client.retryConfig.maxAttempts).to.equal(5);
      expect(client.retryConfig.delayMs).to.equal(2000);
    });
  });
});