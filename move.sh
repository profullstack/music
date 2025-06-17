#!/bin/bash

# Function to display usage
usage() {
    echo "Usage: $0 [--mp3|--wav|--both] [directory_path]"
    echo ""
    echo "Options:"
    echo "  --mp3     Convert WAV files to MP3 in the same directory"
    echo "  --wav     Rename WAV files with sequential numbering (default)"
    echo "  --both    Rename WAV files and create MP3 copies in the same directory"
    echo ""
    echo "Arguments:"
    echo "  directory_path   Directory containing WAV files (default: current directory)"
    echo ""
    echo "Examples:"
    echo "  $0 --mp3                                    # Convert WAV to MP3 in current directory"
    echo "  $0 --mp3 \"./Velocity Vibe/Pulse Revolution\"  # Convert in specific directory"
    echo "  $0 --both \"./Velocity Vibe/Pulse Revolution\" # Rename WAV and create MP3 copies"
    echo "  $0 \"./Velocity Vibe/Pulse Revolution\"        # Just rename WAV files (default)"
    exit 1
}

# Function to check if @profullstack/transcoder is available
check_transcoder() {
    if ! command -v npx &> /dev/null; then
        echo "Error: npx is required but not found. Please install Node.js."
        exit 1
    fi
    
    echo "Checking @profullstack/transcoder availability..."
    # Test if the package can be accessed via npx
    if ! npx --yes @profullstack/transcoder --help &> /dev/null; then
        echo "Note: @profullstack/transcoder will be downloaded on first use via npx"
    fi
}

# Function to convert WAV to MP3 using @profullstack/transcoder
convert_to_mp3() {
    local input_file="$1"
    local output_file="$2"
    
    echo "Converting: $(basename "$input_file") -> $(basename "$output_file")"
    
    # Use @profullstack/transcoder via npx
    if npx --yes @profullstack/transcoder \
        --input "$input_file" \
        --output "$output_file" \
        --format mp3 \
        --bitrate 320k \
        --sample-rate 44100; then
        echo "✓ Conversion successful: $(basename "$output_file")"
        return 0
    else
        echo "✗ Conversion failed: $(basename "$input_file")"
        return 1
    fi
}

# Parse command line arguments
FORMAT="wav"  # default
WORK_DIR="."  # default to current directory

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
            if [[ -z "$WORK_DIR" || "$WORK_DIR" == "." ]]; then
                WORK_DIR="$1"
            else
                echo "Error: Multiple directories specified"
                usage
            fi
            shift
            ;;
    esac
done

# Validate working directory
if [[ ! -d "$WORK_DIR" ]]; then
    echo "Error: Directory does not exist: $WORK_DIR"
    exit 1
fi

# Check if transcoder is available when needed
if [[ "$FORMAT" == "mp3" || "$FORMAT" == "both" ]]; then
    check_transcoder
fi

# Initialize counter
counter=1
processed_files=0
conversion_errors=0

echo "Processing WAV files with format: $FORMAT"
echo "Working directory: $WORK_DIR"
echo ""

# Change to working directory
cd "$WORK_DIR" || {
    echo "Error: Cannot access directory: $WORK_DIR"
    exit 1
}

# Extract album name from directory (last component)
album=$(basename "$(pwd)")

# Loop through all wav files in the directory
for file in *.wav; do
    if [[ -f "$file" ]]; then
        # Format counter with leading zeros (001)
        printf -v num "%03d" "$counter"

        # Clean up original filename (remove extension)
        base=$(basename "$file" .wav)

        # Create new filenames
        wav_name="${num}-${base}-${album}.wav"
        mp3_name="${num}-${base}-${album}.mp3"

        case $FORMAT in
            "wav")
                # Rename WAV file only
                if mv "$file" "$wav_name"; then
                    echo "✓ Renamed: $wav_name"
                    ((processed_files++))
                else
                    echo "✗ Failed to rename: $file"
                fi
                ;;
            "mp3")
                # Convert to MP3 and remove original WAV
                if convert_to_mp3 "$file" "$mp3_name"; then
                    # Remove original WAV file after successful conversion
                    rm "$file"
                    ((processed_files++))
                else
                    ((conversion_errors++))
                fi
                ;;
            "both")
                # Rename WAV and create MP3 copy
                wav_success=false
                
                # Rename WAV file
                if mv "$file" "$wav_name"; then
                    echo "✓ Renamed WAV: $wav_name"
                    wav_success=true
                    ((processed_files++))
                else
                    echo "✗ Failed to rename WAV: $file"
                fi
                
                # Convert to MP3 from the renamed WAV file
                if [[ "$wav_success" == true ]]; then
                    if convert_to_mp3 "$wav_name" "$mp3_name"; then
                        echo "✓ Created MP3 copy: $mp3_name"
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
echo "Working directory: $(pwd)"

# Check if no files were found
if [[ $counter -eq 1 ]]; then
    echo ""
    echo "Warning: No WAV files found in directory: $WORK_DIR"
    exit 1
fi
