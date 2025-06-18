# DistroKid Automation Feature

## Overview
Automate DistroKid album creation and submission using Puppeteer for web automation. This feature will handle the complete workflow from album setup to manual preview before submission.

## Requirements

### Core Features
- [ ] DistroKid account authentication and session management
- [ ] Album creation with metadata (title, artist, genre, release date)
- [ ] Artwork upload (album cover, banner images)
- [ ] Track upload with individual metadata and lyrics
- [ ] Manual preview functionality before submission
- [ ] Error handling and retry mechanisms
- [ ] Progress reporting and logging

### Technical Requirements
- [ ] Puppeteer integration for browser automation
- [ ] Headless and non-headless modes for debugging
- [ ] Screenshot capture for verification
- [ ] File upload handling for audio and image files
- [ ] Form validation and error detection
- [ ] Session persistence and recovery

### Integration Points
- [ ] Integrate with existing AlbumGenerator service
- [ ] CLI command for DistroKid publishing
- [ ] Configuration management for DistroKid credentials
- [ ] Support for existing album directory structure

## Implementation Plan

### Phase 1: Core Infrastructure
1. **DistroKid Client Setup**
   - [ ] Create `src/api/distrokid-client.js`
   - [ ] Implement authentication flow
   - [ ] Session management and persistence
   - [ ] Basic navigation and page detection

2. **Testing Foundation**
   - [ ] Create `test/distrokid-client.test.js`
   - [ ] Mock Puppeteer for unit tests
   - [ ] Test authentication flows
   - [ ] Test error handling

### Phase 2: Album Creation Automation
1. **Album Setup**
   - [ ] Create new album workflow
   - [ ] Album metadata form filling
   - [ ] Genre and category selection
   - [ ] Release date configuration

2. **Asset Upload**
   - [ ] Album artwork upload
   - [ ] Banner image upload
   - [ ] File validation and error handling

### Phase 3: Track Management
1. **Track Upload**
   - [ ] Audio file upload for each track
   - [ ] Track metadata (title, artist, ISRC)
   - [ ] Lyrics upload and formatting
   - [ ] Track ordering and organization

2. **Quality Assurance**
   - [ ] Preview functionality
   - [ ] Validation checks
   - [ ] Error detection and reporting

### Phase 4: Publishing Service
1. **Publisher Service**
   - [ ] Create `src/services/distrokid-publisher.js`
   - [ ] Integration with existing album structure
   - [ ] Batch processing capabilities
   - [ ] Progress reporting

2. **CLI Integration**
   - [ ] Add DistroKid commands to CLI
   - [ ] Configuration management
   - [ ] Interactive mode for manual review

### Phase 5: Advanced Features
1. **Enhanced Automation**
   - [ ] Retry mechanisms for failed uploads
   - [ ] Resume interrupted sessions
   - [ ] Bulk album processing

2. **Monitoring and Logging**
   - [ ] Detailed logging and screenshots
   - [ ] Performance metrics
   - [ ] Error reporting and analytics

## File Structure
```
src/
├── api/
│   └── distrokid-client.js          # Core DistroKid automation
├── services/
│   └── distrokid-publisher.js       # High-level publishing service
└── utils/
    └── puppeteer-helpers.js         # Puppeteer utility functions

test/
├── distrokid-client.test.js         # Client unit tests
└── distrokid-publisher.test.js      # Publisher service tests

examples/
└── distrokid-config.json            # Example configuration
```

## Dependencies to Add
- `puppeteer` - Browser automation
- `puppeteer-extra` - Enhanced Puppeteer with plugins
- `puppeteer-extra-plugin-stealth` - Stealth mode to avoid detection

## Configuration
```json
{
  "distrokid": {
    "email": "user@example.com",
    "password": "secure_password",
    "headless": true,
    "timeout": 30000,
    "retries": 3,
    "screenshotPath": "./screenshots"
  }
}
```

## Usage Examples
```bash
# Publish existing album to DistroKid
pnpm run publish distrokid --album "./Velocity Vibe/Pulse Revolution"

# Create and publish new album
pnpm run generate album --config examples/album.json --publish distrokid

# Preview mode (manual review before submission)
pnpm run publish distrokid --album "./albums/my-album" --preview
```

## Testing Strategy
- Unit tests with mocked Puppeteer
- Integration tests with DistroKid sandbox (if available)
- Manual testing with real DistroKid account
- Screenshot-based verification
- Error scenario testing

## Security Considerations
- Secure credential storage
- Session token management
- Rate limiting and respectful automation
- CAPTCHA handling strategies
- Account safety measures

## Success Criteria
- [ ] Successfully authenticate with DistroKid
- [ ] Create complete album with all metadata
- [ ] Upload all tracks with lyrics
- [ ] Generate preview for manual review
- [ ] Handle common error scenarios gracefully
- [ ] Integrate seamlessly with existing CLI