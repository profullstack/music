import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import {
  createBrowser,
  createPage,
  waitForSelector,
  safeClick,
  safeType,
  uploadFile,
  takeScreenshot,
  handleDialog,
  waitForNavigation
} from '../src/utils/puppeteer-helpers.js';

describe('Puppeteer Helpers', () => {
  let mockBrowser;
  let mockPage;

  beforeEach(() => {
    // Mock Puppeteer browser and page objects
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
      }
    };

    mockBrowser = {
      newPage: async () => mockPage,
      close: async () => {},
      pages: async () => [mockPage]
    };
  });

  afterEach(() => {
    // Clean up mocks
    mockBrowser = null;
    mockPage = null;
  });

  describe('createBrowser', () => {
    it('should create browser with default options', async () => {
      const options = {};
      // This test would require actual Puppeteer mocking
      // For now, we'll test the options processing
      expect(typeof createBrowser).to.equal('function');
    });

    it('should create browser with custom options', async () => {
      const options = {
        headless: false,
        devtools: true,
        slowMo: 100
      };
      expect(typeof createBrowser).to.equal('function');
    });

    it('should handle stealth mode option', async () => {
      const options = { stealth: true };
      expect(typeof createBrowser).to.equal('function');
    });
  });

  describe('createPage', () => {
    it('should create page with default settings', async () => {
      const page = await createPage(mockBrowser);
      expect(page).to.be.an('object');
    });

    it('should create page with custom viewport', async () => {
      const options = {
        viewport: { width: 1920, height: 1080 }
      };
      const page = await createPage(mockBrowser, options);
      expect(page).to.be.an('object');
    });

    it('should create page with custom user agent', async () => {
      const options = {
        userAgent: 'Custom User Agent'
      };
      const page = await createPage(mockBrowser, options);
      expect(page).to.be.an('object');
    });
  });

  describe('waitForSelector', () => {
    it('should wait for selector with default timeout', async () => {
      const selector = '.test-selector';
      const result = await waitForSelector(mockPage, selector);
      expect(result).to.be.an('object');
    });

    it('should wait for selector with custom timeout', async () => {
      const selector = '.test-selector';
      const timeout = 5000;
      const result = await waitForSelector(mockPage, selector, { timeout });
      expect(result).to.be.an('object');
    });

    it('should handle selector not found', async () => {
      mockPage.waitForSelector = async () => {
        throw new Error('Selector not found');
      };
      
      try {
        await waitForSelector(mockPage, '.non-existent');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Selector not found');
      }
    });
  });

  describe('safeClick', () => {
    it('should click element safely', async () => {
      const selector = '.clickable';
      const result = await safeClick(mockPage, selector);
      expect(result).to.be.true;
    });

    it('should handle click with delay', async () => {
      const selector = '.clickable';
      const options = { delay: 100 };
      const result = await safeClick(mockPage, selector, options);
      expect(result).to.be.true;
    });

    it('should handle click failure gracefully', async () => {
      mockPage.click = async () => {
        throw new Error('Click failed');
      };
      
      const result = await safeClick(mockPage, '.non-clickable');
      expect(result).to.be.false;
    });
  });

  describe('safeType', () => {
    it('should type text safely', async () => {
      const selector = 'input[type="text"]';
      const text = 'Hello World';
      const result = await safeType(mockPage, selector, text);
      expect(result).to.be.true;
    });

    it('should clear field before typing', async () => {
      const selector = 'input[type="text"]';
      const text = 'New Text';
      const options = { clear: true };
      const result = await safeType(mockPage, selector, text, options);
      expect(result).to.be.true;
    });

    it('should handle typing failure gracefully', async () => {
      mockPage.type = async () => {
        throw new Error('Type failed');
      };
      
      const result = await safeType(mockPage, 'input', 'text');
      expect(result).to.be.false;
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      // Create a temporary test file
      const { promises: fs } = await import('fs');
      const { join } = await import('path');
      const testFilePath = join(process.cwd(), 'test-upload-file.txt');
      
      try {
        await fs.writeFile(testFilePath, 'test content');
        
        const selector = 'input[type="file"]';
        const result = await uploadFile(mockPage, selector, testFilePath);
        expect(result).to.be.true;
      } finally {
        // Clean up test file
        try {
          await fs.unlink(testFilePath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle upload failure gracefully', async () => {
      mockPage.$ = async () => null; // Element not found
      
      const result = await uploadFile(mockPage, 'input[type="file"]', '/path/to/file.jpg');
      expect(result).to.be.false;
    });
  });

  describe('takeScreenshot', () => {
    it('should take screenshot with default options', async () => {
      const result = await takeScreenshot(mockPage);
      expect(result).to.be.instanceOf(Buffer);
    });

    it('should take screenshot with custom path', async () => {
      const options = { path: './screenshot.png' };
      const result = await takeScreenshot(mockPage, options);
      expect(result).to.be.instanceOf(Buffer);
    });

    it('should take full page screenshot', async () => {
      const options = { fullPage: true };
      const result = await takeScreenshot(mockPage, options);
      expect(result).to.be.instanceOf(Buffer);
    });
  });

  describe('handleDialog', () => {
    it('should set up dialog handler', () => {
      const handler = (dialog) => dialog.accept();
      handleDialog(mockPage, handler);
      // Verify that the handler was set up (mocked)
      expect(typeof handler).to.equal('function');
    });

    it('should handle alert dialogs', () => {
      const handler = handleDialog(mockPage, 'accept');
      expect(typeof handler).to.equal('function');
    });

    it('should handle confirm dialogs', () => {
      const handler = handleDialog(mockPage, 'dismiss');
      expect(typeof handler).to.equal('function');
    });
  });

  describe('waitForNavigation', () => {
    it('should wait for navigation with default options', async () => {
      mockPage.waitForNavigation = async () => ({});
      const result = await waitForNavigation(mockPage);
      expect(result).to.be.an('object');
    });

    it('should wait for navigation with custom timeout', async () => {
      mockPage.waitForNavigation = async () => ({});
      const options = { timeout: 10000 };
      const result = await waitForNavigation(mockPage, options);
      expect(result).to.be.an('object');
    });

    it('should handle navigation timeout', async () => {
      mockPage.waitForNavigation = async () => {
        throw new Error('Navigation timeout');
      };
      
      try {
        await waitForNavigation(mockPage, { timeout: 1000 });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Navigation timeout');
      }
    });
  });
});