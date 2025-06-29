# DistroKid Form Filler

The DistroKid Form Filler is a headful Puppeteer-based automation tool that opens a browser, logs into your DistroKid account, navigates to the upload page, and prefills all the form fields with your track data. The browser remains open for you to review the information and manually submit the form.

## Features

- **Headful Browser**: Opens a visible browser window for user interaction
- **Automatic Login**: Logs into your DistroKid account automatically
- **Form Prefilling**: Fills all track metadata fields based on your configuration
- **Manual Submission**: Waits for you to review and submit the form manually
- **Screenshot Capture**: Takes screenshots at key steps for debugging
- **Comprehensive Form Support**: Handles all DistroKid form fields including:
  - Track title and artist information
  - Featured artists
  - Version information (Radio Edit, custom versions)
  - Audio file upload
  - Songwriter information (real names and roles)
  - Explicit lyrics settings
  - Radio edit/clean version settings
  - Instrumental track settings
  - Preview clip start time
  - Track pricing
  - Cover song information
  - Dolby Atmos support

## Installation

The DistroKid Form Filler is included with the main music publishing CLI. Ensure you have all dependencies installed:

```bash
pnpm install
```

## Configuration

### Using Configuration File (Recommended)

Create a configuration file based on the example:

```bash
cp examples/distrokid-form-config.json my-track-config.json
```

Edit the configuration file:

```json
{
  "distrokidCredentials": {
    "email": "your-email@example.com",
    "password": "your-password"
  },
  "trackData": {
    "title": "Your Track Title",
    "artist": "Your Artist Name",
    "filePath": "./path/to/your/audio.wav",
    "explicit": false,
    "instrumental": false,
    "isRadioEdit": false,
    "isCoverSong": false,
    "songwriters": [
      {
        "role": "Music and lyrics",
        "firstName": "John",
        "middleName": "",
        "lastName": "Doe"
      }
    ],
    "featuredArtists": [],
    "versionInfo": null,
    "previewStartTime": null,
    "price": "Track Mid",
    "dolbyAtmos": false
  },
  "options": {
    "screenshotPath": "./screenshots/distrokid",
    "timeout": 30000
  }
}
```

### Using Command Line Options

You can also specify all options via command line arguments:

```bash
node src/cli.js distrokid-fill \
  --email "your-email@example.com" \
  --password "your-password" \
  --title "Your Track Title" \
  --artist "Your Artist Name" \
  --file "./path/to/your/audio.wav"
```

## Usage

### Basic Usage with Configuration File

```bash
node src/cli.js distrokid-fill --config ./my-track-config.json
```

### Command Line Usage

```bash
node src/cli.js distrokid-fill \
  --email "user@example.com" \
  --password "password123" \
  --title "Blood in the Algorithm" \
  --artist "Velocity Vibe" \
  --file "./Velocity Vibe/Circuits of Dissent/001-Blood in the Algorithm-Circuits of Dissent.wav"
```

### With Additional Options

```bash
node src/cli.js distrokid-fill \
  --config ./my-track-config.json \
  --explicit \
  --radio-edit \
  --verbose
```

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <file>` | Path to configuration file | `./examples/distrokid-form-config.json` |
| `-e, --email <email>` | DistroKid account email | From config file |
| `-p, --password <password>` | DistroKid account password | From config file |
| `-t, --title <title>` | Track title | From config file |
| `-a, --artist <artist>` | Artist name | From config file |
| `-f, --file <path>` | Path to audio file | From config file |
| `--explicit` | Track contains explicit lyrics | `false` |
| `--instrumental` | Track is instrumental | `false` |
| `--radio-edit` | Track is a radio edit | `false` |
| `--cover-song` | Track is a cover song | `false` |
| `-v, --verbose` | Verbose output | `false` |

## Track Data Configuration

### Basic Track Information

```json
{
  "title": "Your Track Title",
  "artist": "Your Artist Name",
  "filePath": "./path/to/audio.wav"
}
```

### Songwriter Information

```json
{
  "songwriters": [
    {
      "role": "Music and lyrics",  // "Music", "Lyrics", or "Music and lyrics"
      "firstName": "John",
      "middleName": "Q",           // Optional
      "lastName": "Doe"
    }
  ]
}
```

### Featured Artists

```json
{
  "featuredArtists": [
    {
      "name": "Featured Artist Name",
      "type": "featured"  // or "remixer"
    }
  ]
}
```

### Version Information

```json
{
  "versionInfo": "Radio Edit"  // or custom version name, null for normal version
}
```

### Preview Start Time

```json
{
  "previewStartTime": {
    "minutes": 1,
    "seconds": 30
  }
}
```

### Cover Song Information

```json
{
  "isCoverSong": true,
  "coverSongInfo": {
    "originalArtist": "Original Artist Name",
    "originalTitle": "Original Song Title",
    "originalSongwriters": "Original Songwriter Names"
  }
}
```

### Dolby Atmos Support

```json
{
  "dolbyAtmos": true,
  "dolbyAtmosFile": "./path/to/dolby-atmos-file.wav"
}
```

## Workflow

1. **Initialization**: The tool creates a headful browser instance
2. **Authentication**: Logs into your DistroKid account
3. **Navigation**: Goes to the upload page
4. **Form Detection**: Extracts the track ID from the page
5. **Form Filling**: Fills all form fields with your track data
6. **User Review**: Browser stays open for you to review the information
7. **Manual Submission**: You manually submit the form when ready
8. **Monitoring**: Tool monitors for form submission or browser closure

## Screenshots

The tool automatically takes screenshots at key steps:

- `form-filled.png`: After all fields are filled
- `error-state.png`: If an error occurs

Screenshots are saved to the configured screenshot directory (default: `./screenshots/distrokid`).

## Error Handling

The tool includes comprehensive error handling for:

- Invalid credentials
- Missing required fields
- File not found errors
- Network timeouts
- Form element not found
- Browser crashes

## Security Considerations

- **Credentials**: Store credentials securely and never commit them to version control
- **Headful Mode**: The browser is visible, so ensure you're in a secure environment
- **File Paths**: Use absolute paths or ensure relative paths are correct
- **Screenshots**: Screenshots may contain sensitive information

## Troubleshooting

### Common Issues

1. **Login Failed**: Check your email and password
2. **File Not Found**: Verify the audio file path exists
3. **Form Elements Not Found**: DistroKid may have updated their form structure
4. **Browser Crashes**: Ensure you have sufficient system resources

### Debug Mode

Use the `--verbose` flag for detailed logging:

```bash
node src/cli.js distrokid-fill --config ./my-config.json --verbose
```

### Manual Intervention

If the automation fails at any step, you can:

1. Continue manually in the open browser
2. Check the screenshots for the current state
3. Restart the process with corrected configuration

## Limitations

- **Manual Submission Required**: The tool does not automatically submit the form
- **Single Track**: Currently supports one track at a time
- **Browser Dependency**: Requires a graphical environment (not suitable for headless servers)
- **DistroKid Changes**: May break if DistroKid updates their form structure

## Integration with Album Generation

You can combine this with the album generation workflow:

1. Generate an album using the Suno API
2. Use the DistroKid Form Filler to upload each track
3. Manually submit each track after review

Example workflow:

```bash
# Generate album
node src/cli.js generate --album ./examples/album.json

# Upload first track to DistroKid
node src/cli.js distrokid-fill \
  --title "Generated Track 1" \
  --artist "AI Artist" \
  --file "./albums/My Album/001-Generated Track 1.wav"
```

## Contributing

When contributing to the DistroKid Form Filler:

1. Test with the actual DistroKid website
2. Handle form changes gracefully
3. Add comprehensive error handling
4. Update selectors if DistroKid changes their HTML structure
5. Maintain backward compatibility when possible

## Legal Notice

This tool is for educational and automation purposes. Users are responsible for:

- Complying with DistroKid's Terms of Service
- Ensuring they have rights to upload the content
- Using the tool responsibly and ethically
- Not violating any applicable laws or regulations

The tool does not automatically submit forms to ensure user review and compliance.