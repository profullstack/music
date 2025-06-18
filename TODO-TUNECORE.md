# TuneCore Music Distribution CLI - Development Tasks

## Project Adaptation (FUGA → TuneCore)
- [ ] Update package.json for TuneCore CLI
- [ ] Rename CLI commands from `fuga-publish` to `tunecore`
- [ ] Update API client from FUGA to TuneCore
- [ ] Modify metadata handling for structured JSON files
- [ ] Update environment variables for TuneCore credentials

## Core Functionality Updates

### Enhanced Metadata Handling
- [ ] Support structured metadata.json files
- [ ] Parse UPC codes for albums
- [ ] Handle ISRC codes for individual tracks
- [ ] Support explicit content flags
- [ ] Validate required metadata fields

### TuneCore API Integration
- [ ] Implement TuneCoreDirect API authentication
- [ ] Add artist/customer account creation
- [ ] Implement album registration
- [ ] Add track registration with metadata
- [ ] Handle audio file uploads (WAV format)
- [ ] Add distribution management

### CLI Interface Updates
- [ ] Update command structure: `tunecore publish <artist> <album>`
- [ ] Update batch command: `tunecore publish-all`
- [ ] Update validation: `tunecore validate`
- [ ] Add progress indicators with ora spinners
- [ ] Enhanced error messages and logging

### File Structure Validation
- [ ] Validate metadata.json presence and structure
- [ ] Ensure track count matches between files and metadata
- [ ] Validate ISRC and UPC format compliance
- [ ] Check audio file format requirements

## Testing Updates
- [ ] Update test cases for TuneCore API client
- [ ] Add tests for metadata.json parsing
- [ ] Test UPC/ISRC validation
- [ ] Update CLI command tests
- [ ] Add integration tests for TuneCore API

## Documentation Updates
- [ ] Update README for TuneCore integration
- [ ] Document metadata.json structure
- [ ] Add TuneCore API credential setup
- [ ] Update usage examples
- [ ] Add troubleshooting for TuneCore-specific issues

## Security & Configuration
- [ ] Update environment variables for TuneCore
- [ ] Secure partner API credential management
- [ ] Add TuneCore-specific validation

## Performance Enhancements
- [ ] Parallel track processing
- [ ] Optimized upload handling
- [ ] Enhanced progress tracking
- [ ] Retry logic for TuneCore API

## Future Enhancements
- [ ] Support for MP3 and FLAC formats
- [ ] Post-release management features
- [ ] Enhanced metadata management
- [ ] Distribution status tracking