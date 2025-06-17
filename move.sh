#!/bin/bash

# Function to display usage
usage() {
    echo "Usage: $0 [--mp3|--wav|--both] <target_path>"
    echo ""
    echo "Options:"
    echo "  --mp3     Convert WAV files to MP3 and move to target path"
    echo "  --wav     Move WAV files to target path (default)"
    echo "  --both    Move WAV files and create MP3 copies in target path"
    echo ""
    echo "Arguments:"
    echo "  target_path   Directory path where files should be moved (e.g., ./artist/album)"
    echo ""
    echo "Examples:"
    echo "  $0 --mp3 ./VelocityVibe/PulseRevolution"
    echo "  $0 --wav ./VelocityVibe/PulseRevolution"
    echo "  $0 --both ./VelocityVibe/PulseRevolution"
    echo "  $0 ./VelocityVibe/PulseRevolution  # defaults to --wav"
    exit 1
}

# Function to check if ffmpeg is available
check_ffmpeg() {
    if ! command -v ffmpeg &> /dev/null; then
        echo "Error: ffmpeg is required for MP3 conversion but not found."
        echo "Please install ffmpeg: sudo apt install ffmpeg (Ubuntu/Debian) or brew install ffmpeg (macOS)"
        exit 1
    fi
}

# Function to convert WAV to MP3 using ffmpeg
convert_to_mp3() {
    local input_file="$1"
    local output_file="$2"
    
    echo "Converting: $(basename "$input_file") -> $(basename "$output_file")"
    
    # Use ffmpeg with standard music settings
    if ffmpeg -i "$input_file" \
        -codec:a libmp3lame \
        -b:a 320k \
        -ar 44100 \
        -ac 2 \
        -f mp3 \
        "$output_file" \
        -y -loglevel error; then
        echo "✓ Conversion successful: $(basename "$output_file")"
        return 0
    else
        echo "✗ Conversion failed: $(basename "$input_file")"
        return 1
    fi
}

# Parse command line arguments
FORMAT="wav"  # default
TARGET_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --mp3)
            FORMAT="mp3"
            shift
            ;;
        --wav)
            FORMAT="wav"
            shift
            ;;
        --both)
            FORMAT="both"
            shift
            ;;
        --help|-h)
            usage
            ;;
        -*)
            echo "Unknown option: $1"
            usage
            ;;
        *)
            if [[ -z "$TARGET_DIR" ]]; then
                TARGET_DIR="$1"
            else
                echo "Error: Multiple target directories specified"
                usage
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$TARGET_DIR" ]]; then
    echo "Error: Target directory is required"
    usage
fi

# Check if ffmpeg is available when needed
if [[ "$FORMAT" == "mp3" || "$FORMAT" == "both" ]]; then
    check_ffmpeg
fi

# Create target directory
mkdir -p "$TARGET_DIR"
if [[ $? -ne 0 ]]; then
    echo "Error: Failed to create target directory: $TARGET_DIR"
    exit 1
fi

# Initialize counter
counter=1
processed_files=0
conversion_errors=0

echo "Processing WAV files with format: $FORMAT"
echo "Target directory: $TARGET_DIR"
echo ""

# Loop through all wav files in current directory
for file in *.wav; do
    if [[ -f "$file" ]]; then
        # Format counter with leading zeros (001)
        printf -v num "%03d" "$counter"

        # Clean up original filename (remove extension)
        base=$(basename "$file" .wav)
        
        # Extract album name from target directory (last component)
        album=$(basename "$TARGET_DIR")

        # Create new filenames
        wav_name="${num}-${base}-${album}.wav"
        mp3_name="${num}-${base}-${album}.mp3"

        case $FORMAT in
            "wav")
                # Move WAV file only
                if mv "$file" "$TARGET_DIR/$wav_name"; then
                    echo "✓ Moved: $wav_name"
                    ((processed_files++))
                else
                    echo "✗ Failed to move: $file"
                fi
                ;;
            "mp3")
                # Convert to MP3 and move
                if convert_to_mp3 "$file" "$TARGET_DIR/$mp3_name"; then
                    # Remove original WAV file after successful conversion
                    rm "$file"
                    ((processed_files++))
                else
                    ((conversion_errors++))
                fi
                ;;
            "both")
                # Move WAV and create MP3 copy
                wav_success=false
                mp3_success=false
                
                # Move WAV file
                if mv "$file" "$TARGET_DIR/$wav_name"; then
                    echo "✓ Moved WAV: $wav_name"
                    wav_success=true
                    ((processed_files++))
                else
                    echo "✗ Failed to move WAV: $file"
                fi
                
                # Convert to MP3 from the moved WAV file
                if [[ "$wav_success" == true ]]; then
                    if convert_to_mp3 "$TARGET_DIR/$wav_name" "$TARGET_DIR/$mp3_name"; then
                        mp3_success=true
                    else
                        ((conversion_errors++))
                    fi
                fi
                ;;
        esac

        # Increment counter
        ((counter++))
    fi
done

# Summary
echo ""
echo "=== Processing Complete ==="
echo "Files processed: $processed_files"
if [[ $conversion_errors -gt 0 ]]; then
    echo "Conversion errors: $conversion_errors"
fi
echo "Target directory: $TARGET_DIR"

# Check if no files were found
if [[ $counter -eq 1 ]]; then
    echo ""
    echo "Warning: No WAV files found in current directory"
    exit 1
fi
