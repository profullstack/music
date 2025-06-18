# TODO: Generate CLI Tool for AI Song Generation

## Overview
Implement a `generate` command for the existing CLI that creates songs using the Suno API.

## Requirements Analysis
- **Input**: Title, lyrics file path, optional style, optional output directory, optional format
- **Output**: Generated song file (MP3/WAV) saved locally
- **API**: Suno API integration with polling for completion
- **User Experience**: Progress feedback, error handling, clear status messages

## Tasks

### 1. Setup and Dependencies
- [x] Add required dependencies for HTTP requests and file handling
- [x] Update package.json with new `generate` binary entry
- [x] Add Suno API environment variables to .env.example

### 2. Core Suno API Client
- [x] Create `src/api/suno-client.js` with API integration
- [x] Implement authentication handling
- [x] Implement song generation request
- [x] Implement status polling mechanism
- [x] Implement file download functionality

### 3. Generate Service Layer
- [x] Create `src/services/generator.js` for business logic
- [x] Implement lyrics file reading
- [x] Implement filename slugification
- [x] Implement output directory management
- [x] Implement progress tracking

### 4. CLI Integration
- [x] Add `generate` command to existing CLI
- [x] Implement argument parsing and validation
- [x] Integrate with existing spinner/progress system
- [x] Add help documentation

### 5. Testing (TDD Approach)
- [x] Write tests for Suno API client
- [x] Write tests for generator service
- [x] Write tests for CLI command integration
- [x] Write integration tests for end-to-end flow

### 6. Error Handling & Edge Cases
- [x] Handle API rate limiting
- [x] Handle network failures with retry logic
- [x] Handle invalid lyrics files
- [x] Handle insufficient disk space
- [x] Handle API authentication failures

### 7. Documentation
- [x] Update README with generate command usage
- [x] Add example lyrics files
- [x] Document environment variables

## Implementation Order
1. Write tests first (TDD)
2. Implement Suno API client
3. Implement generator service
4. Integrate with CLI
5. Add comprehensive error handling
6. Update documentation

## Dependencies to Add
- No additional dependencies needed (using built-in fetch and existing commander/ora)

## Environment Variables
```env
SUNO_API_TOKEN=your_suno_token_here
SUNO_API_BASE=https://api.sunoapi.org