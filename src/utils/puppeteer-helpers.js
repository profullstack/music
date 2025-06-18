import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { promises as fs } from 'fs';
import { dirname } from 'path';

/**
 * Puppeteer utility functions for web automation
 * Provides safe, robust methods for browser interactions
 */

/**
 * Create a new browser instance with optional stealth mode
 * @param {Object} options - Browser configuration options
 * @param {boolean} [options.headless=true] - Run in headless mode
 * @param {boolean} [options.stealth=false] - Enable stealth mode to avoid detection
 * @param {boolean} [options.devtools=false] - Open devtools
 * @param {number} [options.slowMo=0] - Slow down operations by specified milliseconds
 * @param {Array} [options.args=[]] - Additional Chrome arguments
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
export async function createBrowser(options = {}) {
  const {
    headless = true,
    stealth = false,
    devtools = false,
    slowMo = 0,
    args = []
  } = options;

  const defaultArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ];

  const browserOptions = {
    headless,
    devtools,
    slowMo,
    args: [...defaultArgs, ...args],
    defaultViewport: {
      width: 1366,
      height: 768
    }
  };

  try {
    if (stealth) {
      puppeteerExtra.use(StealthPlugin());
      return await puppeteerExtra.launch(browserOptions);
    }
    
    return await puppeteer.launch(browserOptions);
  } catch (error) {
    throw new Error(`Failed to create browser: ${error.message}`);
  }
}

/**
 * Create a new page with common settings
 * @param {Browser} browser - Puppeteer browser instance
 * @param {Object} options - Page configuration options
 * @param {Object} [options.viewport] - Viewport dimensions
 * @param {string} [options.userAgent] - Custom user agent
 * @param {boolean} [options.interceptRequests=false] - Enable request interception
 * @returns {Promise<Page>} Configured page instance
 */
export async function createPage(browser, options = {}) {
  const {
    viewport = { width: 1366, height: 768 },
    userAgent,
    interceptRequests = false
  } = options;

  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport(viewport);
    
    // Set custom user agent if provided
    if (userAgent) {
      await page.setUserAgent(userAgent);
    }
    
    // Enable request interception if needed
    if (interceptRequests) {
      await page.setRequestInterception(true);
    }
    
    return page;
  } catch (error) {
    throw new Error(`Failed to create page: ${error.message}`);
  }
}

/**
 * Wait for selector with enhanced error handling
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector to wait for
 * @param {Object} options - Wait options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @param {boolean} [options.visible=true] - Wait for element to be visible
 * @returns {Promise<ElementHandle>} Element handle
 */
export async function waitForSelector(page, selector, options = {}) {
  const { timeout = 30000, visible = true } = options;
  
  try {
    return await page.waitForSelector(selector, {
      timeout,
      visible
    });
  } catch (error) {
    throw new Error(`Selector '${selector}' not found within ${timeout}ms: ${error.message}`);
  }
}

/**
 * Safely click an element with retry logic
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector to click
 * @param {Object} options - Click options
 * @param {number} [options.delay=0] - Delay before click in milliseconds
 * @param {number} [options.retries=3] - Number of retry attempts
 * @param {number} [options.timeout=30000] - Timeout for finding element
 * @returns {Promise<boolean>} Success status
 */
export async function safeClick(page, selector, options = {}) {
  const { delay = 0, retries = 3, timeout = 30000 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await waitForSelector(page, selector, { timeout });
      
      if (delay > 0) {
        await page.waitForTimeout(delay);
      }
      
      await page.click(selector);
      return true;
    } catch (error) {
      if (attempt === retries) {
        console.warn(`Failed to click '${selector}' after ${retries} attempts: ${error.message}`);
        return false;
      }
      
      // Wait before retry
      await page.waitForTimeout(1000);
    }
  }
  
  return false;
}

/**
 * Safely type text into an input field
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector for input field
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 * @param {boolean} [options.clear=false] - Clear field before typing
 * @param {number} [options.delay=0] - Delay between keystrokes
 * @param {number} [options.timeout=30000] - Timeout for finding element
 * @returns {Promise<boolean>} Success status
 */
export async function safeType(page, selector, text, options = {}) {
  const { clear = false, delay = 0, timeout = 30000 } = options;
  
  try {
    await waitForSelector(page, selector, { timeout });
    
    if (clear) {
      await page.click(selector, { clickCount: 3 }); // Select all
      await page.keyboard.press('Backspace');
    }
    
    await page.type(selector, text, { delay });
    return true;
  } catch (error) {
    console.warn(`Failed to type into '${selector}': ${error.message}`);
    return false;
  }
}

/**
 * Upload file to input element
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector for file input
 * @param {string} filePath - Path to file to upload
 * @param {Object} options - Upload options
 * @param {number} [options.timeout=30000] - Timeout for finding element
 * @returns {Promise<boolean>} Success status
 */
export async function uploadFile(page, selector, filePath, options = {}) {
  const { timeout = 30000 } = options;
  
  try {
    // Verify file exists
    await fs.access(filePath);
    
    // Wait for file input element
    await waitForSelector(page, selector, { timeout });
    
    // Get the input element
    const inputElement = await page.$(selector);
    if (!inputElement) {
      throw new Error(`File input element '${selector}' not found`);
    }
    
    // Upload the file
    await inputElement.uploadFile(filePath);
    return true;
  } catch (error) {
    console.warn(`Failed to upload file to '${selector}': ${error.message}`);
    return false;
  }
}

/**
 * Take screenshot with automatic directory creation
 * @param {Page} page - Puppeteer page instance
 * @param {Object} options - Screenshot options
 * @param {string} [options.path] - Path to save screenshot
 * @param {boolean} [options.fullPage=false] - Capture full page
 * @param {string} [options.type='png'] - Image format
 * @returns {Promise<Buffer>} Screenshot buffer
 */
export async function takeScreenshot(page, options = {}) {
  const { path, fullPage = false, type = 'png' } = options;
  
  try {
    // Create directory if path is provided
    if (path) {
      const dir = dirname(path);
      await fs.mkdir(dir, { recursive: true });
    }
    
    return await page.screenshot({
      path,
      fullPage,
      type
    });
  } catch (error) {
    throw new Error(`Failed to take screenshot: ${error.message}`);
  }
}

/**
 * Set up dialog handler for alerts, confirms, and prompts
 * @param {Page} page - Puppeteer page instance
 * @param {Function|string} handler - Handler function or action ('accept', 'dismiss')
 * @returns {Function} The actual handler function
 */
export function handleDialog(page, handler) {
  let dialogHandler;
  
  if (typeof handler === 'string') {
    dialogHandler = async (dialog) => {
      if (handler === 'accept') {
        await dialog.accept();
      } else if (handler === 'dismiss') {
        await dialog.dismiss();
      }
    };
  } else if (typeof handler === 'function') {
    dialogHandler = handler;
  } else {
    throw new Error('Handler must be a function or string ("accept", "dismiss")');
  }
  
  page.on('dialog', dialogHandler);
  return dialogHandler;
}

/**
 * Wait for navigation with timeout handling
 * @param {Page} page - Puppeteer page instance
 * @param {Object} options - Navigation options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @param {string} [options.waitUntil='networkidle2'] - When to consider navigation complete
 * @returns {Promise<Response>} Navigation response
 */
export async function waitForNavigation(page, options = {}) {
  const { timeout = 30000, waitUntil = 'networkidle2' } = options;
  
  try {
    return await page.waitForNavigation({
      timeout,
      waitUntil
    });
  } catch (error) {
    throw new Error(`Navigation timeout after ${timeout}ms: ${error.message}`);
  }
}

/**
 * Scroll to element and ensure it's in viewport
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector for element
 * @param {Object} options - Scroll options
 * @param {number} [options.timeout=30000] - Timeout for finding element
 * @returns {Promise<boolean>} Success status
 */
export async function scrollToElement(page, selector, options = {}) {
  const { timeout = 30000 } = options;
  
  try {
    await waitForSelector(page, selector, { timeout });
    
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, selector);
    
    // Wait for scroll to complete
    await page.waitForTimeout(500);
    return true;
  } catch (error) {
    console.warn(`Failed to scroll to '${selector}': ${error.message}`);
    return false;
  }
}

/**
 * Wait for element to be removed from DOM
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector to wait for removal
 * @param {Object} options - Wait options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @returns {Promise<boolean>} Success status
 */
export async function waitForElementRemoval(page, selector, options = {}) {
  const { timeout = 30000 } = options;
  
  try {
    if (page && page.waitForFunction) {
      await page.waitForFunction(
        (sel) => !document.querySelector(sel),
        { timeout },
        selector
      );
    }
    return true;
  } catch (error) {
    console.warn(`Element '${selector}' was not removed within ${timeout}ms`);
    return false;
  }
}