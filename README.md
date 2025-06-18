# Music Publisher CLI

A unified Node.js CLI tool for automated music publishing to multiple platforms including FUGA and TuneCore. The tool automatically detects the appropriate platform based on your directory structure and metadata format.

## Features

- **Unified Publishing**: Single command publishes to FUGA or TuneCore automatically
- **Platform Auto-Detection**: Automatically detects platform based on metadata structure
- **Dual Metadata Support**: 
  - FUGA: Uses embedded metadata from audio files
  - TuneCore: Uses structured `metadata.json` files
- **Comprehensive Validation**: Validates metadata, file formats, and API configurations
- **Progress Tracking**: Real-time upload progress with ora spinners
- **Robust Error Handling**: Retry mechanisms and detailed error reporting
- **Test Coverage**: 64+ comprehensive tests with Mocha and Chai

## Installation

```bash
# Install dependencies
pnpm install

# Install globally (optional)
pnpm link
```

## Configuration

Create a `.env` file with your API credentials:

```bash
# FUGA Configuration (optional)
FUGA_API_TOKEN=your_fuga_api_token
FUGA_CLIENT_ID=your_fuga_client_id
FUGA_CLIENT_SECRET=your_fuga_client_secret
FUGA_API_BASE_URL=https://api.fuga.com

# TuneCore Configuration (optional)
TUNECORE_PARTNER_ID=your_partner_id
TUNECORE_API_KEY=your_api_key
TUNECORE_API_BASE_URL=https://api.tunecore.com

# General Settings
MAX_CONCURRENT_UPLOADS=3
UPLOAD_TIMEOUT_MS=300000
RETRY_ATTEMPTS=3
RETRY_DELAY_MS=5000
LOG_LEVEL=info
```

**Note**: You only need to configure the platform(s) you plan to use. The tool will automatically detect which platform to use based on your directory structure.

## Usage

### Basic Commands

```bash
# Publish music (auto-detects platform)
music-publish publish ./my-album

# Force specific platform
music-publish publish ./my-album --platform tunecore

# Validate without publishing
music-publish publish ./my-album --dry-run

# Validate directory structure
music-publish validate ./my-album

# Show platform information
music-publish platforms

# Detect platform for directory
music-publish detect ./my-album
```

### Platform Detection

The tool automatically detects which platform to use:

- **TuneCore**: Directories containing `metadata.json` files
- **FUGA**: Directories with embedded metadata in audio files

## Directory Structures

### TuneCore Format (Structured Metadata)

```
my-album/
├── metadata.json          # Album and track metadata
├── track1.mp3
├── track2.mp3
└── cover.jpg
```

**metadata.json example:**
```json
{
  "title": "My Album",
  "artist": "My Artist",
  "upc": "123456789012",
  "releaseDate": "2024-01-15",
  "genre": "Pop",
  "tracks": [
    {
      "title": "Track 1",
      "isrc": "US1234567890",
      "duration": 180
    },
    {
      "title": "Track 2", 
      "isrc": "US1234567891",
      "duration": 200
    }
  ]
}
```

### FUGA Format (Embedded Metadata)

```
Artist Name/
└── Album Name/
    ├── 01 - Track 1.mp3    # Embedded metadata
    ├── 02 - Track 2.mp3    # Embedded metadata
    └── cover.jpg
```

Audio files should contain embedded metadata (ID3 tags) with:
- Title, Artist, Album
- Track number, Genre
- Optional: ISRC, UPC

## API Reference

### Publisher Class

```javascript
import { Publisher } from './src/services/publisher.js';

const publisher = new Publisher();

// Detect platform
const platform = await publisher.detectPlatform('./my-album');

// Publish to detected platform
const result = await publisher.publish('./my-album', config);
```

### Platform Requirements

```javascript
// Get platform requirements
const requirements = publisher.getPlatformRequirements('tunecore');
console.log(requirements);
// {
//   configFields: ['partnerId', 'apiKey', 'baseUrl'],
//   metadataSource: 'structured',
//   supportedFormats: ['mp3', 'wav', 'flac'],
//   description: 'Requires metadata.json file...'
// }
```

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- --grep "Publisher"

# Run with coverage
pnpm run test:coverage
```

### Code Quality

```bash
# Lint code
pnpm run lint

# Format code
pnpm run format

# Type checking (if using TypeScript)
pnpm run type-check
```

## Architecture

### Core Components

- **Publisher**: Unified service that handles both platforms
- **FugaClient**: FUGA API integration with embedded metadata
- **TuneCoreClient**: TuneCore API integration with structured metadata
- **FileScanner**: Scans directories for audio files and embedded metadata
- **MetadataScanner**: Handles structured metadata.json files
- **CLI**: Command-line interface with auto-detection

### Platform Detection Logic

1. Check for `metadata.json` files in directory
2. If found → TuneCore (structured metadata)
3. If not found → FUGA (embedded metadata)

### Error Handling

- Automatic retry with exponential backoff
- Detailed error messages with context
- Graceful degradation for network issues
- Validation before upload to prevent API errors

## Supported Formats

- **Audio**: MP3, WAV, FLAC
- **Images**: JPG, PNG (for cover art)
- **Metadata**: ID3 tags, JSON files

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the documentation above
- Run `music-publish platforms` for configuration help
- Review test files for usage examples
- Open an issue on GitHub

---

**Built with Node.js 20+, ESM modules, and modern JavaScript features.**
