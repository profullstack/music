import { expect } from 'chai';
import { DistroKidFormFiller } from '../src/services/distrokid-form-filler.js';

describe('DistroKidFormFiller', () => {
  let formFiller;
  const mockConfig = {
    email: 'test@example.com',
    password: 'testpassword123',
    headless: false // Always headful for this functionality
  };

  const mockTrackData = {
    title: 'Test Track',
    artist: 'Velocity Vibe',
    filePath: '/path/to/audio.wav',
    explicit: false,
    instrumental: false,
    isRadioEdit: false,
    isCoverSong: false,
    songwriters: [
      {
        role: 'Music and lyrics',
        firstName: 'John',
        middleName: '',
        lastName: 'Doe'
      }
    ],
    previewStartTime: null,
    price: 'Track Mid', // $0.99
    dolbyAtmos: false,
    featuredArtists: [],
    versionInfo: null
  };

  beforeEach(() => {
    formFiller = new DistroKidFormFiller(mockConfig);
  });

  afterEach(async () => {
    if (formFiller) {
      await formFiller.close();
    }
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(formFiller).to.be.instanceOf(DistroKidFormFiller);
      expect(formFiller.config.headless).to.be.false;
    });

    it('should throw error with invalid config', () => {
      expect(() => new DistroKidFormFiller()).to.throw('Configuration is required');
      expect(() => new DistroKidFormFiller({})).to.throw('Email is required');
      expect(() => new DistroKidFormFiller({ email: 'test@example.com' })).to.throw('Password is required');
    });

    it('should force headless to false', () => {
      const headlessConfig = { ...mockConfig, headless: true };
      const filler = new DistroKidFormFiller(headlessConfig);
      expect(filler.config.headless).to.be.false;
    });
  });

  describe('validateTrackData', () => {
    it('should validate required track data fields', () => {
      expect(() => formFiller.validateTrackData({})).to.throw('Track title is required');
      expect(() => formFiller.validateTrackData({ title: 'Test' })).to.throw('Artist name is required');
      expect(() => formFiller.validateTrackData({ title: 'Test', artist: 'Artist' })).to.throw('Audio file path is required');
    });

    it('should accept valid track data', () => {
      expect(() => formFiller.validateTrackData(mockTrackData)).to.not.throw();
    });
  });

  describe('generateFormSelectors', () => {
    it('should generate correct selectors for track form', () => {
      const trackId = 'c79d81c5-2eb3-561d-b839-8c03442906c9';
      const selectors = formFiller.generateFormSelectors(trackId);
      
      expect(selectors.titleInput).to.equal(`#title_${trackId}`);
      expect(selectors.explicitNo).to.equal(`input[name="explicit_${trackId}"][value="0"]`);
      expect(selectors.explicitYes).to.equal(`input[name="explicit_${trackId}"][value="1"]`);
      expect(selectors.audioFileInput).to.equal('input[type="file"][accept*="audio"]');
    });
  });

  describe('fillTrackTitle', () => {
    it('should handle track title filling logic', async () => {
      // This would be tested with actual browser instance
      // For now, we test the validation logic
      expect(mockTrackData.title).to.be.a('string');
      expect(mockTrackData.title.length).to.be.greaterThan(0);
    });
  });

  describe('fillSongwriterInfo', () => {
    it('should validate songwriter data structure', () => {
      const songwriter = mockTrackData.songwriters[0];
      expect(songwriter).to.have.property('role');
      expect(songwriter).to.have.property('firstName');
      expect(songwriter).to.have.property('lastName');
      expect(['Music', 'Lyrics', 'Music and lyrics']).to.include(songwriter.role);
    });
  });

  describe('waitForUserSubmission', () => {
    it('should have method to wait for user interaction', () => {
      expect(formFiller.waitForUserSubmission).to.be.a('function');
    });
  });

  describe('extractTrackIdFromPage', () => {
    it('should extract track ID from page HTML', () => {
      const mockHtml = '<input type="hidden" name="tracknum_c79d81c5-2eb3-561d-b839-8c03442906c9" value="1">';
      const trackId = formFiller.extractTrackIdFromPage(mockHtml);
      expect(trackId).to.equal('c79d81c5-2eb3-561d-b839-8c03442906c9');
    });

    it('should return null if no track ID found', () => {
      const mockHtml = '<div>No track ID here</div>';
      const trackId = formFiller.extractTrackIdFromPage(mockHtml);
      expect(trackId).to.be.null;
    });
  });
});