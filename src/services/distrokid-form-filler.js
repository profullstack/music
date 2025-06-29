import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import {
  createBrowser,
  createPage,
  waitForSelector,
  safeClick,
  safeType,
  uploadFile,
  takeScreenshot,
  handleDialog,
  waitForNavigation,
  scrollToElement
} from '../utils/puppeteer-helpers.js';

/**
 * DistroKid Form Filler service
 * Opens a headful browser, prefills DistroKid upload form, and waits for user submission
 */
export class DistroKidFormFiller {
  /**
   * Create a new DistroKid form filler
   * @param {Object} config - Configuration object
   * @param {string} config.email - DistroKid account email
   * @param {string} config.password - DistroKid account password
   * @param {number} [config.timeout=30000] - Default timeout in milliseconds
   * @param {string} [config.screenshotPath='./screenshots'] - Screenshot directory
   */
  constructor(config) {
    if (!config) {
      throw new Error('Configuration is required');
    }

    if (!config.email) {
      throw new Error('Email is required');
    }

    if (!config.password) {
      throw new Error('Password is required');
    }

    // Force headless to false for this functionality
    this.config = {
      headless: false, // Always headful for user interaction
      timeout: 30000,
      screenshotPath: './screenshots',
      ...config,
      headless: false // Override any headless setting
    };

    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;

    // DistroKid URLs
    this.urls = {
      login: 'https://distrokid.com/signin',
      dashboard: 'https://distrokid.com/dashboard',
      upload: 'https://distrokid.com/upload'
    };

    // Base selectors for login
    this.loginSelectors = {
      emailInput: 'input[name="email"], input[type="email"]',
      passwordInput: 'input[name="password"], input[type="password"]',
      loginButton: 'button[type="submit"], .login-button, .signin-button',
      dashboardIndicator: '.dashboard, .user-menu, .upload-button'
    };
  }

  /**
   * Initialize browser and authenticate
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      console.log('🚀 Initializing DistroKid Form Filler...');
      
      this.browser = await createBrowser({
        headless: false,
        stealth: true,
        slowMo: 100,
        devtools: false
      });

      this.page = await createPage(this.browser, {
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Set up dialog handlers
      handleDialog(this.page, 'accept');

      // Login to DistroKid
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Failed to authenticate with DistroKid');
      }

      console.log('✅ Successfully initialized and authenticated');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Login to DistroKid account
   * @returns {Promise<boolean>} Success status
   */
  async login() {
    try {
      console.log('🔐 Logging into DistroKid...');
      
      // Navigate to login page
      await this.page.goto(this.urls.login, { waitUntil: 'networkidle2' });
      
      // Fill login form
      await safeType(this.page, this.loginSelectors.emailInput, this.config.email, { clear: true });
      await safeType(this.page, this.loginSelectors.passwordInput, this.config.password, { clear: true });
      
      // Submit login form
      await Promise.all([
        waitForNavigation(this.page, { timeout: this.config.timeout }),
        safeClick(this.page, this.loginSelectors.loginButton)
      ]);

      // Verify successful login
      try {
        await waitForSelector(this.page, this.loginSelectors.dashboardIndicator, { timeout: 10000 });
        this.isAuthenticated = true;
        console.log('✅ Successfully logged in');
        return true;
      } catch (error) {
        console.error('❌ Login verification failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
  }

  /**
   * Fill DistroKid upload form with track data and wait for user submission
   * @param {Object} trackData - Track information
   * @param {string} trackData.title - Track title
   * @param {string} trackData.artist - Artist name
   * @param {string} trackData.filePath - Path to audio file
   * @param {boolean} [trackData.explicit=false] - Contains explicit lyrics
   * @param {boolean} [trackData.instrumental=false] - Is instrumental
   * @param {boolean} [trackData.isRadioEdit=false] - Is radio edit
   * @param {boolean} [trackData.isCoverSong=false] - Is cover song
   * @param {Array} [trackData.songwriters=[]] - Songwriter information
   * @param {Array} [trackData.featuredArtists=[]] - Featured artists
   * @param {string} [trackData.versionInfo=null] - Version information
   * @param {Object} [trackData.previewStartTime=null] - Preview start time
   * @param {string} [trackData.price='Track Mid'] - Track price
   * @param {boolean} [trackData.dolbyAtmos=false] - Has Dolby Atmos version
   * @returns {Promise<Object>} Result object
   */
  async fillFormAndWaitForSubmission(trackData) {
    if (!this.isAuthenticated) {
      throw new Error('Must be authenticated before filling form');
    }

    this.validateTrackData(trackData);

    try {
      console.log('📝 Navigating to upload page...');
      
      // Navigate to upload page
      await this.page.goto(this.urls.upload, { waitUntil: 'networkidle2' });
      
      // Wait for form to load and extract track ID
      await this.page.waitForTimeout(2000);
      const pageContent = await this.page.content();
      const trackId = this.extractTrackIdFromPage(pageContent);
      
      if (!trackId) {
        throw new Error('Could not extract track ID from page');
      }

      console.log(`🎵 Found track ID: ${trackId}`);
      
      // Generate selectors for this specific track
      const selectors = this.generateFormSelectors(trackId);
      
      console.log('📝 Filling form fields...');
      
      // Fill track title
      await this.fillTrackTitle(selectors, trackData.title);
      
      // Handle featured artists
      await this.fillFeaturedArtists(selectors, trackData.featuredArtists || []);
      
      // Handle version info
      await this.fillVersionInfo(selectors, trackData.versionInfo);
      
      // Upload audio file
      await this.uploadAudioFile(selectors, trackData.filePath);
      
      // Fill songwriter information
      await this.fillSongwriterInfo(trackId, trackData.songwriters || []);
      
      // Set explicit lyrics
      await this.setExplicitLyrics(selectors, trackData.explicit || false);
      
      // Set radio edit
      await this.setRadioEdit(selectors, trackData.isRadioEdit || false);
      
      // Set instrumental
      await this.setInstrumental(selectors, trackData.instrumental || false);
      
      // Set preview start time
      await this.setPreviewStartTime(trackId, trackData.previewStartTime);
      
      // Set track price
      await this.setTrackPrice(selectors, trackData.price || 'Track Mid');
      
      // Handle cover song
      if (trackData.isCoverSong) {
        await this.fillCoverSongInfo(selectors, trackData.coverSongInfo);
      }
      
      // Handle Dolby Atmos
      if (trackData.dolbyAtmos) {
        await this.enableDolbyAtmos(trackId, trackData.dolbyAtmosFile);
      }

      console.log('✅ Form filled successfully!');
      console.log('👤 Waiting for user to review and submit...');
      
      // Take screenshot of filled form
      await this.takeScreenshot('form-filled');
      
      // Wait for user submission
      const result = await this.waitForUserSubmission();
      
      return {
        success: true,
        trackId,
        message: 'Form filled and user interaction completed',
        ...result
      };
    } catch (error) {
      console.error('❌ Error filling form:', error.message);
      await this.takeScreenshot('error-state');
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate track data
   * @param {Object} trackData - Track data to validate
   * @throws {Error} If data is invalid
   */
  validateTrackData(trackData) {
    if (!trackData?.title) {
      throw new Error('Track title is required');
    }
    
    if (!trackData?.artist) {
      throw new Error('Artist name is required');
    }
    
    if (!trackData?.filePath) {
      throw new Error('Audio file path is required');
    }
  }

  /**
   * Extract track ID from page HTML
   * @param {string} html - Page HTML content
   * @returns {string|null} Track ID or null if not found
   */
  extractTrackIdFromPage(html) {
    const trackIdMatch = html.match(/tracknum_([a-f0-9-]+)/);
    return trackIdMatch ? trackIdMatch[1] : null;
  }

  /**
   * Generate form selectors for specific track ID
   * @param {string} trackId - Track identifier
   * @returns {Object} Selector object
   */
  generateFormSelectors(trackId) {
    return {
      titleInput: `#title_${trackId}`,
      featuredArtistNo: `#js-no-feat-1`,
      featuredArtistYes: `#js-add-feat-1`,
      versionNo: `#track-1-version-no`,
      versionRadioEdit: `#track-1-version-radio-edit`,
      versionOther: `input[name="version_${trackId}"][value="Other..."]`,
      audioFileInput: 'input[type="file"][accept*="audio"]',
      explicitNo: `input[name="explicit_${trackId}"][value="0"]`,
      explicitYes: `input[name="explicit_${trackId}"][value="1"]`,
      cleanedNo: `input[name="cleaned_${trackId}"][value="0"]`,
      cleanedYes: `input[name="cleaned_${trackId}"][value="1"]`,
      instrumentalNo: `input[name="instrumental_${trackId}"][value="0"]`,
      instrumentalYes: `input[name="instrumental_${trackId}"][value="1"]`,
      coverSongNo: `input[name="coversong_${trackId}"][value="0"]`,
      coverSongYes: `input[name="coversong_${trackId}"][value="1"]`,
      priceSelect: `#price_${trackId}`
    };
  }

  /**
   * Fill track title
   * @param {Object} selectors - Form selectors
   * @param {string} title - Track title
   */
  async fillTrackTitle(selectors, title) {
    console.log(`📝 Setting track title: ${title}`);
    await safeType(this.page, selectors.titleInput, title, { clear: true });
    await this.page.waitForTimeout(500);
  }

  /**
   * Fill featured artists information
   * @param {Object} selectors - Form selectors
   * @param {Array} featuredArtists - Featured artists array
   */
  async fillFeaturedArtists(selectors, featuredArtists) {
    if (featuredArtists.length === 0) {
      console.log('📝 No featured artists');
      await safeClick(this.page, selectors.featuredArtistNo);
    } else {
      console.log(`📝 Adding ${featuredArtists.length} featured artist(s)`);
      await safeClick(this.page, selectors.featuredArtistYes);
      
      // TODO: Implement featured artist form filling
      // This would require additional form interaction for each featured artist
    }
  }

  /**
   * Fill version information
   * @param {Object} selectors - Form selectors
   * @param {string|null} versionInfo - Version information
   */
  async fillVersionInfo(selectors, versionInfo) {
    if (!versionInfo) {
      console.log('📝 No version info - normal version');
      await safeClick(this.page, selectors.versionNo);
    } else if (versionInfo === 'Radio Edit') {
      console.log('📝 Setting version: Radio Edit');
      await safeClick(this.page, selectors.versionRadioEdit);
    } else {
      console.log(`📝 Setting custom version: ${versionInfo}`);
      await safeClick(this.page, selectors.versionOther);
      await this.page.waitForTimeout(500);
      
      // Fill custom version text
      const versionInput = '.versionInput1Other';
      await safeType(this.page, versionInput, versionInfo, { clear: true });
    }
  }

  /**
   * Upload audio file
   * @param {Object} selectors - Form selectors
   * @param {string} filePath - Path to audio file
   */
  async uploadAudioFile(selectors, filePath) {
    console.log(`📁 Uploading audio file: ${filePath}`);
    
    // Verify file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Audio file not found: ${filePath}`);
    }
    
    const uploadSuccess = await uploadFile(this.page, selectors.audioFileInput, filePath);
    if (!uploadSuccess) {
      throw new Error('Failed to upload audio file');
    }
    
    console.log('✅ Audio file uploaded successfully');
    
    // Wait for upload processing
    await this.page.waitForTimeout(3000);
  }

  /**
   * Fill songwriter information
   * @param {string} trackId - Track identifier
   * @param {Array} songwriters - Songwriter information array
   */
  async fillSongwriterInfo(trackId, songwriters) {
    if (songwriters.length === 0) {
      console.log('⚠️ No songwriter information provided');
      return;
    }

    console.log(`📝 Adding ${songwriters.length} songwriter(s)`);
    
    for (let i = 0; i < songwriters.length; i++) {
      const songwriter = songwriters[i];
      const songwriterNum = i + 1;
      
      // Role selection
      const roleSelect = `.songwriter_real_name_role`;
      if (i === 0) {
        // First songwriter form should already be visible
        await this.page.select(roleSelect, this.getRoleValue(songwriter.role));
      }
      
      // Fill name fields
      const firstNameInput = `input[name="songwriter_real_name_first${songwriterNum}"]`;
      const middleNameInput = `input[name="songwriter_real_name_middle${songwriterNum}"]`;
      const lastNameInput = `input[name="songwriter_real_name_last${songwriterNum}"]`;
      
      await safeType(this.page, firstNameInput, songwriter.firstName || '', { clear: true });
      await safeType(this.page, middleNameInput, songwriter.middleName || '', { clear: true });
      await safeType(this.page, lastNameInput, songwriter.lastName || '', { clear: true });
      
      // Add another songwriter if needed
      if (i < songwriters.length - 1) {
        await safeClick(this.page, `#js-add-another-songwriter-link-1`);
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Get role value for songwriter
   * @param {string} role - Role description
   * @returns {string} Role value
   */
  getRoleValue(role) {
    const roleMap = {
      'Music': '125',
      'Lyrics': '126',
      'Music and lyrics': '197'
    };
    return roleMap[role] || '197';
  }

  /**
   * Set explicit lyrics option
   * @param {Object} selectors - Form selectors
   * @param {boolean} isExplicit - Whether track contains explicit lyrics
   */
  async setExplicitLyrics(selectors, isExplicit) {
    console.log(`📝 Setting explicit lyrics: ${isExplicit ? 'Yes' : 'No'}`);
    const selector = isExplicit ? selectors.explicitYes : selectors.explicitNo;
    await safeClick(this.page, selector);
  }

  /**
   * Set radio edit option
   * @param {Object} selectors - Form selectors
   * @param {boolean} isRadioEdit - Whether track is a radio edit
   */
  async setRadioEdit(selectors, isRadioEdit) {
    console.log(`📝 Setting radio edit: ${isRadioEdit ? 'Yes' : 'No'}`);
    const selector = isRadioEdit ? selectors.cleanedYes : selectors.cleanedNo;
    await safeClick(this.page, selector);
  }

  /**
   * Set instrumental option
   * @param {Object} selectors - Form selectors
   * @param {boolean} isInstrumental - Whether track is instrumental
   */
  async setInstrumental(selectors, isInstrumental) {
    console.log(`📝 Setting instrumental: ${isInstrumental ? 'Yes' : 'No'}`);
    const selector = isInstrumental ? selectors.instrumentalYes : selectors.instrumentalNo;
    await safeClick(this.page, selector);
  }

  /**
   * Set preview start time
   * @param {string} trackId - Track identifier
   * @param {Object|null} previewTime - Preview start time {minutes, seconds}
   */
  async setPreviewStartTime(trackId, previewTime) {
    if (!previewTime) {
      console.log('📝 Using automatic preview start time');
      await safeClick(this.page, `input[name="previewStart_1"][value="no"]`);
    } else {
      console.log(`📝 Setting custom preview start time: ${previewTime.minutes}:${previewTime.seconds}`);
      await safeClick(this.page, `input[name="previewStart_1"][value="yes"]`);
      await this.page.waitForTimeout(500);
      
      // Set minutes and seconds
      await this.page.select('.previewStartMinutes_1', previewTime.minutes.toString());
      await this.page.select('.previewStartSeconds_1', previewTime.seconds.toString());
    }
  }

  /**
   * Set track price
   * @param {Object} selectors - Form selectors
   * @param {string} price - Price tier
   */
  async setTrackPrice(selectors, price) {
    console.log(`📝 Setting track price: ${price}`);
    try {
      await this.page.select(selectors.priceSelect, price);
    } catch (error) {
      console.warn(`Could not set price to ${price}, using default`);
    }
  }

  /**
   * Fill cover song information
   * @param {Object} selectors - Form selectors
   * @param {Object} coverInfo - Cover song information
   */
  async fillCoverSongInfo(selectors, coverInfo) {
    console.log('📝 Setting up cover song information');
    await safeClick(this.page, selectors.coverSongYes);
    await this.page.waitForTimeout(1000);
    
    if (coverInfo) {
      // Fill cover song details
      if (coverInfo.originalArtist) {
        await safeType(this.page, `input[name="originalArtist_${trackId}"]`, coverInfo.originalArtist);
      }
      if (coverInfo.originalTitle) {
        await safeType(this.page, `input[name="originalSongTitle_${trackId}"]`, coverInfo.originalTitle);
      }
      if (coverInfo.originalSongwriters) {
        await safeType(this.page, `input[name="originalSongwriters_${trackId}"]`, coverInfo.originalSongwriters);
      }
    }
  }

  /**
   * Enable Dolby Atmos option
   * @param {string} trackId - Track identifier
   * @param {string} dolbyAtmosFile - Path to Dolby Atmos file
   */
  async enableDolbyAtmos(trackId, dolbyAtmosFile) {
    console.log('📝 Enabling Dolby Atmos');
    await safeClick(this.page, `input[name="dolby_1"][value="1"]`);
    await this.page.waitForTimeout(1000);
    
    if (dolbyAtmosFile) {
      console.log(`📁 Uploading Dolby Atmos file: ${dolbyAtmosFile}`);
      const dolbyInput = '.dolbyAtmosInput';
      await uploadFile(this.page, dolbyInput, dolbyAtmosFile);
    }
  }

  /**
   * Wait for user to submit the form
   * @returns {Promise<Object>} Submission result
   */
  async waitForUserSubmission() {
    console.log('⏳ Waiting for user to review and submit the form...');
    console.log('💡 The browser will remain open for you to review and submit manually');
    
    return new Promise((resolve) => {
      // Set up a simple polling mechanism to detect form submission
      const checkSubmission = async () => {
        try {
          const currentUrl = this.page.url();
          
          // Check if we've navigated away from upload page (indicating submission)
          if (!currentUrl.includes('/upload')) {
            console.log('✅ Form appears to have been submitted!');
            resolve({
              submitted: true,
              finalUrl: currentUrl,
              timestamp: new Date().toISOString()
            });
            return;
          }
          
          // Check if page is closed
          if (this.page.isClosed()) {
            console.log('🔒 Browser was closed by user');
            resolve({
              submitted: false,
              reason: 'Browser closed by user',
              timestamp: new Date().toISOString()
            });
            return;
          }
          
          // Continue polling
          setTimeout(checkSubmission, 2000);
        } catch (error) {
          console.log('🔒 Session ended');
          resolve({
            submitted: false,
            reason: 'Session ended',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      };
      
      // Start polling
      setTimeout(checkSubmission, 2000);
    });
  }

  /**
   * Take screenshot with timestamp
   * @param {string} step - Current step name
   * @returns {Promise<Buffer|null>} Screenshot buffer
   */
  async takeScreenshot(step) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}-${step}.png`;
      const screenshotPath = join(this.config.screenshotPath, filename);
      
      return await takeScreenshot(this.page, { 
        path: screenshotPath,
        fullPage: true 
      });
    } catch (error) {
      console.warn(`Failed to take screenshot for step '${step}':`, error.message);
      return null;
    }
  }

  /**
   * Close browser and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      this.page = null;
      this.browser = null;
      this.isAuthenticated = false;
      
      console.log('🔒 Browser closed and resources cleaned up');
    } catch (error) {
      console.warn('⚠️ Error during cleanup:', error.message);
    }
  }
}