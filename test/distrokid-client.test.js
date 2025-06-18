import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { DistroKidClient } from '../src/api/distrokid-client.js';

describe('DistroKidClient', () => {
  let client;
  let mockBrowser;
  let mockPage;

  beforeEach(() => {
    // Mock Puppeteer objects
    mockPage = {
      goto: async () => ({ status: () => 200 }),
      waitForSelector: async () => ({}),
      click: async () => {},
      type: async () => {},
      screenshot: async () => Buffer.from('mock-screenshot'),
      setRequestInterception: async () => {},
      on: () => {},
      evaluate: async (fn) => fn(),
      $: async () => ({ uploadFile: async () => {} }),
      $$: async () => [{}],
      setViewport: async () => {},
      setUserAgent: async () => {},
      close: async () => {},
      waitForTimeout: async () => {},
      waitForNavigation: async () => ({}),
      keyboard: {
        press: async () => {}
      },
      url: () => 'https://distrokid.com/dashboard'
    };

    mockBrowser = {
      newPage: async () => mockPage,
      close: async () => {},
      pages: async () => [mockPage]
    };

    const config = {
      email: 'test@example.com',
      password: 'testpassword',
      headless: true,
      timeout: 30000
    };

    client = new DistroKidClient(config);
  });

  afterEach(async () => {
    if (client?.browser) {
      await client.close();
    }
    mockBrowser = null;
    mockPage = null;
  });

  describe('constructor', () => {
    it('should create client with valid configuration', () => {
      const config = {
        email: 'test@example.com',
        password: 'testpassword'
      };
      const distroClient = new DistroKidClient(config);
      expect(distroClient).to.be.instanceOf(DistroKidClient);
      expect(distroClient.config.email).to.equal('test@example.com');
      expect(distroClient.config.headless).to.be.true; // default
    });

    it('should throw error for missing email', () => {
      const config = { password: 'testpassword' };
      expect(() => new DistroKidClient(config)).to.throw('Email is required');
    });

    it('should throw error for missing password', () => {
      const config = { email: 'test@example.com' };
      expect(() => new DistroKidClient(config)).to.throw('Password is required');
    });

    it('should use default configuration values', () => {
      const config = {
        email: 'test@example.com',
        password: 'testpassword'
      };
      const distroClient = new DistroKidClient(config);
      expect(distroClient.config.headless).to.be.true;
      expect(distroClient.config.timeout).to.equal(30000);
      expect(distroClient.config.retries).to.equal(3);
    });
  });

  describe('validateConfig', () => {
    it('should validate complete configuration', () => {
      const config = {
        email: 'test@example.com',
        password: 'testpassword',
        headless: true,
        timeout: 30000
      };
      expect(() => DistroKidClient.validateConfig(config)).to.not.throw();
    });

    it('should throw error for invalid email format', () => {
      const config = {
        email: 'invalid-email',
        password: 'testpassword'
      };
      expect(() => DistroKidClient.validateConfig(config)).to.throw('Invalid email format');
    });

    it('should throw error for short password', () => {
      const config = {
        email: 'test@example.com',
        password: '123'
      };
      expect(() => DistroKidClient.validateConfig(config)).to.throw('Password must be at least 6 characters');
    });
  });

  describe('initialize', () => {
    it('should initialize browser and page', async () => {
      // Mock the createBrowser function
      client.createBrowser = async () => mockBrowser;
      
      await client.initialize();
      expect(client.browser).to.equal(mockBrowser);
      expect(client.page).to.equal(mockPage);
    });

    it('should handle initialization failure', async () => {
      client.createBrowser = async () => {
        throw new Error('Browser launch failed');
      };
      
      try {
        await client.initialize();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Failed to initialize DistroKid client');
      }
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
    });

    it('should login successfully', async () => {
      mockPage.url = () => 'https://distrokid.com/dashboard';
      
      const result = await client.login();
      expect(result).to.be.true;
      expect(client.isAuthenticated).to.be.true;
    });

    it('should handle login failure', async () => {
      // Mock login error scenario
      mockPage.url = () => 'https://distrokid.com/signin'; // Stay on login page
      mockPage.waitForSelector = async (selector) => {
        if (selector.includes('error') || selector.includes('login-error')) {
          return {}; // Error element found
        }
        throw new Error('Selector not found');
      };
      
      const result = await client.login();
      expect(result).to.be.false;
      expect(client.isAuthenticated).to.be.false;
    });

    it('should detect already logged in state', async () => {
      mockPage.url = () => 'https://distrokid.com/dashboard';
      mockPage.goto = async () => ({ status: () => 200 });
      
      const result = await client.login();
      expect(result).to.be.true;
      expect(client.isAuthenticated).to.be.true;
    });
  });

  describe('createAlbum', () => {
    beforeEach(async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
      client.isAuthenticated = true;
    });

    it('should create album with valid metadata', async () => {
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        genre: 'Electronic',
        releaseDate: '2024-12-01',
        artwork: '/path/to/artwork.jpg'
      };

      const result = await client.createAlbum(albumData);
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('albumId');
    });

    it('should throw error when not authenticated', async () => {
      client.isAuthenticated = false;
      
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist'
      };

      try {
        await client.createAlbum(albumData);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Must be authenticated');
      }
    });

    it('should validate required album fields', async () => {
      const albumData = {
        artist: 'Test Artist' // missing title
      };

      try {
        await client.createAlbum(albumData);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Album title is required');
      }
    });
  });

  describe('uploadTrack', () => {
    beforeEach(async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
      client.isAuthenticated = true;
    });

    it('should upload track with metadata and lyrics', async () => {
      // Create a temporary test file
      const { promises: fs } = await import('fs');
      const { join } = await import('path');
      const testFilePath = join(process.cwd(), 'test-track.mp3');
      
      try {
        await fs.writeFile(testFilePath, 'mock audio content');
        
        const trackData = {
          filePath: testFilePath,
          title: 'Test Track',
          artist: 'Test Artist',
          lyrics: 'Test lyrics content'
        };

        const result = await client.uploadTrack('album-123', trackData);
        expect(result).to.have.property('success', true);
        expect(result).to.have.property('trackId');
      } finally {
        // Clean up test file
        try {
          await fs.unlink(testFilePath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle track upload failure', async () => {
      // Create a temporary test file
      const { promises: fs } = await import('fs');
      const { join } = await import('path');
      const testFilePath = join(process.cwd(), 'test-track-fail.mp3');
      
      try {
        await fs.writeFile(testFilePath, 'mock audio content');
        
        mockPage.$ = async () => null; // File input not found
        
        const trackData = {
          filePath: testFilePath,
          title: 'Test Track'
        };

        const result = await client.uploadTrack('album-123', trackData);
        expect(result).to.have.property('success', false);
        expect(result).to.have.property('error');
      } finally {
        // Clean up test file
        try {
          await fs.unlink(testFilePath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should validate track file exists', async () => {
      const trackData = {
        filePath: '/non/existent/track.mp3',
        title: 'Test Track'
      };

      try {
        await client.uploadTrack('album-123', trackData);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Track file not found');
      }
    });
  });

  describe('previewAlbum', () => {
    beforeEach(async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
      client.isAuthenticated = true;
    });

    it('should generate preview for album', async () => {
      const result = await client.previewAlbum('album-123');
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('previewUrl');
    });

    it('should handle preview generation failure', async () => {
      mockPage.waitForSelector = async () => {
        throw new Error('Preview not available');
      };
      
      const result = await client.previewAlbum('album-123');
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });
  });

  describe('submitAlbum', () => {
    beforeEach(async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
      client.isAuthenticated = true;
    });

    it('should submit album for distribution', async () => {
      const result = await client.submitAlbum('album-123');
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('submissionId');
    });

    it('should handle submission failure', async () => {
      mockPage.click = async () => {
        throw new Error('Submit button not found');
      };
      
      const result = await client.submitAlbum('album-123');
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });
  });

  describe('takeScreenshot', () => {
    beforeEach(async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
    });

    it('should take screenshot with default options', async () => {
      const result = await client.takeScreenshot();
      expect(result).to.be.instanceOf(Buffer);
    });

    it('should take screenshot with custom path', async () => {
      const options = { path: './test-screenshot.png' };
      const result = await client.takeScreenshot(options);
      expect(result).to.be.instanceOf(Buffer);
    });
  });

  describe('close', () => {
    it('should close browser gracefully', async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
      
      await client.close();
      expect(client.browser).to.be.null;
      expect(client.page).to.be.null;
    });

    it('should handle close when browser not initialized', async () => {
      // Should not throw error
      await client.close();
      expect(client.browser).to.be.null;
    });
  });

  describe('error handling and retries', () => {
    beforeEach(async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      mockPage.click = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return true;
      };

      const result = await client.retryOperation(async () => {
        return await mockPage.click('.test');
      });

      expect(result).to.be.true;
      expect(attempts).to.equal(3);
    });

    it('should fail after max retries', async () => {
      mockPage.click = async () => {
        throw new Error('Persistent failure');
      };

      try {
        await client.retryOperation(async () => {
          await mockPage.click('.test');
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Persistent failure');
      }
    });
  });

  describe('session management', () => {
    beforeEach(async () => {
      client.createBrowser = async () => mockBrowser;
      await client.initialize();
    });

    it('should detect session expiration', async () => {
      mockPage.url = () => 'https://distrokid.com/signin'; // Login page indicates expired session
      mockPage.waitForSelector = async () => {
        throw new Error('Dashboard indicator not found');
      };
      
      const isValid = await client.isSessionValid();
      expect(isValid).to.be.false;
    });

    it('should detect valid session', async () => {
      mockPage.url = () => 'https://distrokid.com/dashboard';
      
      const isValid = await client.isSessionValid();
      expect(isValid).to.be.true;
    });

    it('should refresh session when expired', async () => {
      client.isAuthenticated = false;
      mockPage.url = () => 'https://distrokid.com/dashboard';
      
      const result = await client.ensureAuthenticated();
      expect(result).to.be.true;
      expect(client.isAuthenticated).to.be.true;
    });
  });
});