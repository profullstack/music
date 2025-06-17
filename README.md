# Music File Organizer

A bash script for organizing and converting audio files with automatic numbering and directory structure creation.

## Overview

The `move.sh` script helps organize WAV audio files by:
- Renaming files with sequential numbering (001, 002, etc.)
- Moving files to organized directory structures
- Converting WAV files to high-quality MP3 format using ffmpeg
- Supporting multiple output formats (WAV, MP3, or both)

## Prerequisites

- **Bash shell** (Linux/macOS/WSL)
- **ffmpeg** (required for MP3 conversion)

### Installing ffmpeg

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS (with Homebrew)
brew install ffmpeg

# CentOS/RHEL/Fedora
sudo dnf install ffmpeg
# or
sudo yum install ffmpeg
```

## Usage

```bash
./move.sh [--mp3|--wav|--both] <target_path>
```

### Command-line Options

| Option | Description |
|--------|-------------|
| `--mp3` | Convert WAV files to MP3 and move to target path |
| `--wav` | Move WAV files to target path (default behavior) |
| `--both` | Move WAV files AND create MP3 copies in target path |
| `--help`, `-h` | Display help information |

### Arguments

- `target_path`: Directory path where files should be moved (e.g., `./artist/album`)

## Examples

### Convert to MP3 only
```bash
./move.sh --mp3 ./VelocityVibe/PulseRevolution
```

### Move WAV files (default)
```bash
./move.sh --wav ./VelocityVibe/PulseRevolution
# or simply
./move.sh ./VelocityVibe/PulseRevolution
```

### Keep WAV and create MP3 copies
```bash
./move.sh --both ./VelocityVibe/PulseRevolution
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
- Target path: `./VelocityVibe/PulseRevolution`
- Result: `001-track1-PulseRevolution.wav`

## MP3 Conversion Settings

When converting to MP3, the script uses high-quality settings:

- **Codec**: libmp3lame
- **Bitrate**: 320 kbps (highest quality)
- **Sample Rate**: 44.1 kHz (CD quality)
- **Channels**: Stereo (2 channels)
- **Format**: MP3

## Features

### ✅ Automatic Directory Creation
- Creates target directories if they don't exist
- Supports nested directory structures

### ✅ Sequential Numbering
- Automatically numbers files with leading zeros (001, 002, 003...)
- Maintains consistent ordering

### ✅ Error Handling
- Validates command-line arguments
- Checks for ffmpeg availability
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

## Script Behavior

### WAV Mode (`--wav`)
1. Renames WAV files with sequential numbering
2. Moves files to target directory
3. Original files are moved (not copied)

### MP3 Mode (`--mp3`)
1. Converts WAV files to high-quality MP3
2. Moves MP3 files to target directory
3. Original WAV files are deleted after successful conversion

### Both Mode (`--both`)
1. Renames and moves WAV files to target directory
2. Creates MP3 copies from the moved WAV files
3. Both formats are preserved in the target directory

## Error Handling

The script handles various error conditions:

- **Missing ffmpeg**: Provides installation instructions
- **Invalid arguments**: Shows usage information
- **Directory creation failures**: Reports specific errors
- **Conversion failures**: Tracks and reports failed conversions
- **No WAV files found**: Warns if no input files are available

## Output Example

```
Processing WAV files with format: both
Target directory: ./VelocityVibe/PulseRevolution

✓ Moved WAV: 001-Deployed-PulseRevolution.wav
Converting: 001-Deployed-PulseRevolution.wav -> 001-Deployed-PulseRevolution.mp3
✓ Conversion successful: 001-Deployed-PulseRevolution.mp3
✓ Moved WAV: 002-Integration-PulseRevolution.wav
Converting: 002-Integration-PulseRevolution.wav -> 002-Integration-PulseRevolution.mp3
✓ Conversion successful: 002-Integration-PulseRevolution.mp3

=== Processing Complete ===
Files processed: 2
Conversion errors: 0
Target directory: ./VelocityVibe/PulseRevolution
```

## Troubleshooting

### ffmpeg not found
```
Error: ffmpeg is required for MP3 conversion but not found.
Please install ffmpeg: sudo apt install ffmpeg (Ubuntu/Debian) or brew install ffmpeg (macOS)
```
**Solution**: Install ffmpeg using your system's package manager.

### No WAV files found
```
Warning: No WAV files found in current directory
```
**Solution**: Ensure you're running the script from a directory containing `.wav` files.

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

## License

This script is provided as-is for personal and educational use.