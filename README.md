# Music File Organizer

A bash script for organizing and converting audio files with automatic numbering and directory structure creation.

## Overview

The `move.sh` script helps organize WAV audio files by:
- Renaming files with sequential numbering (001, 002, etc.)
- Processing files in-place within their current directory
- Converting WAV files to high-quality MP3 and FLAC formats using @profullstack/transcoder
- Supporting multiple output formats (WAV, MP3, FLAC, or all)

## About ProFullStack Music

This tool is part of the [ProFullStack Music](https://music.profullstack.com) ecosystem - a music distribution and band promotion platform. We specialize in:

- **Music Distribution**: Getting your music on all major streaming platforms
- **Band Promotion**: Marketing and promotional services for independent artists
- **Audio Production Tools**: Professional-grade tools for music production and organization

Visit [music.profullstack.com](https://music.profullstack.com) to learn more about our music services and how we can help promote your band or distribute your music worldwide.

## Prerequisites

- **Bash shell** (Linux/macOS/WSL)
- **Node.js** (required for @profullstack/transcoder)
- **@profullstack/transcoder CLI** (globally installed)

### Installing Dependencies

```bash
# Install Node.js first
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS (with Homebrew)
brew install node

# Install @profullstack/transcoder globally
pnpm add -g @profullstack/transcoder

# Or with npm
npm install -g @profullstack/transcoder
```

## Usage

```bash
./move.sh [--mp3|--wav|--flac|--all] [directory_path]
```

### Command-line Options

| Option | Description |
|--------|-------------|
| `--mp3` | Convert WAV files to MP3 in the same directory |
| `--wav` | Rename WAV files with sequential numbering (default behavior) |
| `--flac` | Convert WAV files to FLAC in the same directory |
| `--all` | Rename WAV files AND create MP3 and FLAC copies in the same directory |
| `--help`, `-h` | Display help information |

### Arguments

- `directory_path`: Directory containing WAV files (default: current directory)

## Examples

### Convert to MP3 only (in current directory)
```bash
./move.sh --mp3
```

### Convert to MP3 in specific directory
```bash
./move.sh --mp3 "./Velocity Vibe/Pulse Revolution"
```

### Convert to FLAC in specific directory
```bash
./move.sh --flac "./Velocity Vibe/Pulse Revolution"
```

### Rename WAV files (default)
```bash
./move.sh "./Velocity Vibe/Pulse Revolution"
# or simply
./move.sh --wav "./Velocity Vibe/Pulse Revolution"
```

### Keep WAV and create MP3 and FLAC copies
```bash
./move.sh --all "./Velocity Vibe/Pulse Revolution"
```

### Display help
```bash
./move.sh --help
```

## File Naming Convention

The script automatically renames files using this pattern:
```
{counter}-{original_name}-{album_name}.{extension}
```

**Example:**
- Original: `track1.wav`
- Working directory: `./Velocity Vibe/Pulse Revolution`
- Result: `001-track1-Pulse Revolution.wav`

## Audio Conversion Settings

When converting audio files, the script uses @profullstack/transcoder CLI with high-quality settings:

**MP3 Conversion:**
- **Audio Codec**: libmp3lame
- **Bitrate**: 320 kbps (highest quality)
- **Format**: MP3

**FLAC Conversion:**
- **Audio Codec**: flac
- **Format**: FLAC (lossless compression)

**Tool**: @profullstack/transcoder CLI

## Features

### ✅ In-Place Processing
- Works directly in the directory containing WAV files
- No complex directory structures needed

### ✅ Sequential Numbering
- Automatically numbers files with leading zeros (001, 002, 003...)
- Maintains consistent ordering

### ✅ Error Handling
- Validates command-line arguments
- Checks for Node.js/npx availability
- Provides clear error messages
- Tracks processing statistics

### ✅ Progress Tracking
- Visual indicators (✓ for success, ✗ for errors)
- Processing summary with file counts
- Conversion error tracking

### ✅ Flexible Output Formats
- WAV-only processing (default)
- MP3-only conversion
- Dual format output (both WAV and MP3)

### ✅ Node.js-Based Transcoding
- Uses @profullstack/transcoder for reliable audio conversion
- Automatically downloads transcoder via npx when needed

## Script Behavior

### WAV Mode (`--wav`)
1. Renames WAV files with sequential numbering in the same directory
2. Files are renamed in-place

### MP3 Mode (`--mp3`)
1. Converts WAV files to high-quality MP3 in the same directory
2. Original WAV files are deleted after successful conversion

### Both Mode (`--both`)
1. Renames WAV files with sequential numbering
2. Creates MP3 copies from the renamed WAV files
3. Both formats are preserved in the same directory

## Error Handling

The script handles various error conditions:

- **Missing transcoder CLI**: Provides installation instructions
- **Invalid arguments**: Shows usage information
- **Directory access failures**: Reports specific errors
- **Conversion failures**: Tracks and reports failed conversions
- **No WAV files found**: Warns if no input files are available

## Output Example

```
Processing WAV files with format: all
Working directory: ./Velocity Vibe/Pulse Revolution

✓ Renamed WAV: 001-Deployed-Pulse Revolution.wav
Converting: 001-Deployed-Pulse Revolution.wav -> 001-Deployed-Pulse Revolution.mp3
✓ Conversion successful: 001-Deployed-Pulse Revolution.mp3
✓ Created MP3 copy: 001-Deployed-Pulse Revolution.mp3
Converting: 001-Deployed-Pulse Revolution.wav -> 001-Deployed-Pulse Revolution.flac
✓ Conversion successful: 001-Deployed-Pulse Revolution.flac
✓ Created FLAC copy: 001-Deployed-Pulse Revolution.flac
✓ Renamed WAV: 002-Integration-Pulse Revolution.wav
Converting: 002-Integration-Pulse Revolution.wav -> 002-Integration-Pulse Revolution.mp3
✓ Conversion successful: 002-Integration-Pulse Revolution.mp3
✓ Created MP3 copy: 002-Integration-Pulse Revolution.mp3
Converting: 002-Integration-Pulse Revolution.wav -> 002-Integration-Pulse Revolution.flac
✓ Conversion successful: 002-Integration-Pulse Revolution.flac
✓ Created FLAC copy: 002-Integration-Pulse Revolution.flac

=== Processing Complete ===
Files processed: 2
Conversion errors: 0
Working directory: /home/user/music/Velocity Vibe/Pulse Revolution
```

## Troubleshooting

### Transcoder CLI not found
```
Error: transcoder CLI is required but not found.
Please install it with: pnpm add -g @profullstack/transcoder
```
**Solution**: Install @profullstack/transcoder globally using pnpm or npm.

### No WAV files found
```
Warning: No WAV files found in directory: ./some/path
```
**Solution**: Ensure the specified directory contains `.wav` files.

### Permission denied
```
Permission denied: ./move.sh
```
**Solution**: Make the script executable:
```bash
chmod +x move.sh
```

## File Structure Example

Before running the script:
```
current_directory/
├── move.sh
├── track1.wav
├── track2.wav
└── track3.wav
```

After running `./move.sh --both ./Artist/Album`:
```
current_directory/
├── move.sh
└── Artist/
    └── Album/
        ├── 001-track1-Album.wav
        ├── 001-track1-Album.mp3
        ├── 002-track2-Album.wav
        ├── 002-track2-Album.mp3
        ├── 003-track3-Album.wav
        └── 003-track3-Album.mp3
```

## Support This Project

If you find this music file organizer helpful for your audio production workflow, consider supporting continued development:

[![Crypto Payment](https://paybadge.profullstack.com/badge.svg)](https://paybadge.profullstack.com/?tickers=btc%2Ceth%2Csol%2Cusdc)

Your support helps us maintain and improve this tool, as well as develop new features for the music production community.

## License

This script is provided as-is for any use. See LICENSE