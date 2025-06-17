#!/bin/bash

# Function to display usage
usage() {
    echo "Usage: $0 [--mp3|--wav|--flac|--all] [--delete-everything] [directory_path]"
    echo ""
    echo "Options:"
    echo "  --mp3               Convert WAV files to MP3 in the same directory (keeps WAV files)"
    echo "  --wav               Rename WAV files with sequential numbering (default)"
    echo "  --flac              Convert WAV files to FLAC in the same directory (keeps WAV files)"
    echo "  --all               Rename WAV files and create MP3 and FLAC copies in the same directory"
    echo "  --delete-everything Delete original WAV files after conversion (requires confirmation)"
    echo ""
    echo "Arguments:"
    echo "  directory_path      Directory containing WAV files (default: current directory)"
    echo ""
    echo "Examples:"
    echo "  $0 --mp3                                    # Convert WAV to MP3, keep WAV files"
    echo "  $0 --flac \"./Velocity Vibe/Pulse Revolution\" # Convert WAV to FLAC, keep WAV files"
    echo "  $0 --mp3 --delete-everything                # Convert to MP3 and delete WAV files (with confirmation)"
    echo "  $0 --all \"./Velocity Vibe/Pulse Revolution\"  # Rename WAV and create MP3 and FLAC copies"
    echo "  $0 \"./Velocity Vibe/Pulse Revolution\"        # Just rename WAV files (default)"
    exit 1
}

# Function to check if transcoder is available
check_transcoder() {
    if ! command -v transcoder &> /dev/null; then
        echo "Error: transcoder CLI is required but not found."
        echo "Please install it with: pnpm add -g @profullstack/transcoder"
        exit 1
    fi
    
    echo "Transcoder CLI found and ready to use."
}

# Function to convert WAV to MP3 using @profullstack/transcoder CLI
convert_to_mp3() {
    local input_file="$1"
    local output_file="$2"
    
    echo "Converting: $(basename "$input_file") -> $(basename "$output_file")"
    
    # Use transcoder CLI with proper syntax
    if transcoder "$input_file" "$output_file" \
        --audio-codec libmp3lame \
        --audio-bitrate 320k; then
        echo "✓ Conversion successful: $(basename "$output_file")"
        return 0
    else
        echo "✗ Conversion failed: $(basename "$input_file")"
        return 1
    fi
}

# Function to convert WAV to FLAC using @profullstack/transcoder CLI
convert_to_flac() {
    local input_file="$1"
    local output_file="$2"
    
    echo "Converting: $(basename "$input_file") -> $(basename "$output_file")"
    
    # Use transcoder CLI with FLAC codec
    if transcoder "$input_file" "$output_file" \
        --audio-codec flac; then
        echo "✓ Conversion successful: $(basename "$output_file")"
        return 0
    else
        echo "✗ Conversion failed: $(basename "$input_file")"
        return 1
    fi
}

# Function to confirm deletion of WAV files
confirm_deletion() {
    echo ""
    echo "⚠️  WARNING: You are about to delete original WAV files after conversion!"
    echo "This action cannot be undone. The original high-quality WAV files will be permanently removed."
    echo ""
    read -p "Are you sure you want to delete the original WAV files? [N/y]: " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operation cancelled. WAV files will be preserved."
        return 1
    fi
    
    echo "Proceeding with WAV file deletion after conversion..."
    return 0
}

# Function to confirm overwrite of existing files
confirm_overwrite() {
    local file_type="$1"
    local filename="$2"
    
    echo ""
    echo "⚠️  File already exists: $filename"
    read -p "Do you want to overwrite this $file_type file? [y/N]: " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Proceeding with overwrite..."
        return 0
    else
        echo "Skipping file to preserve existing version."
        return 1
    fi
}

# Parse command line arguments
FORMAT="wav"  # default
WORK_DIR="."  # default to current directory
DELETE_WAVS=false  # default to preserve WAV files

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
        --flac)
            FORMAT="flac"
            shift
            ;;
        --all)
            FORMAT="all"
            shift
            ;;
        --delete-everything)
            DELETE_WAVS=true
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
if [[ "$FORMAT" == "mp3" || "$FORMAT" == "flac" || "$FORMAT" == "all" ]]; then
    check_transcoder
fi

# Confirm deletion if --delete-everything flag is used
if [[ "$DELETE_WAVS" == true ]]; then
    if ! confirm_deletion; then
        DELETE_WAVS=false
    fi
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
        # Skip files that have already been processed (contain numbered format)
        if [[ "$file" =~ ^[0-9]{3}- ]]; then
            echo "Skipping already processed file: $file"
            continue
        fi
        
        # Format counter with leading zeros (001)
        printf -v num "%03d" "$counter"

        # Clean up original filename (remove extension)
        base=$(basename "$file" .wav)

        # Create new filenames
        wav_name="${num}-${base}-${album}.wav"
        mp3_name="${num}-${base}-${album}.mp3"
        flac_name="${num}-${base}-${album}.flac"

        case $FORMAT in
            "wav")
                # Check if target WAV file already exists
                if [[ -f "$wav_name" ]]; then
                    if ! confirm_overwrite "WAV" "$wav_name"; then
                        ((counter++))
                        continue
                    fi
                fi
                
                # Rename WAV file only
                if mv "$file" "$wav_name"; then
                    echo "✓ Renamed: $wav_name"
                    ((processed_files++))
                else
                    echo "✗ Failed to rename: $file"
                fi
                ;;
            "mp3")
                # Check if MP3 already exists
                if [[ -f "$mp3_name" ]]; then
                    if ! confirm_overwrite "MP3" "$mp3_name"; then
                        ((counter++))
                        continue
                    fi
                fi
                
                # Convert to MP3 (optionally remove original WAV)
                if convert_to_mp3 "$file" "$mp3_name"; then
                    if [[ "$DELETE_WAVS" == true ]]; then
                        # Remove original WAV file after successful conversion
                        rm "$file"
                        echo "🗑️  Deleted original WAV: $file"
                    else
                        # Rename original WAV file to match numbering scheme if it doesn't already exist
                        if [[ ! -f "$wav_name" ]]; then
                            if mv "$file" "$wav_name"; then
                                echo "✓ Renamed original WAV: $wav_name"
                            fi
                        elif [[ "$file" != "$wav_name" ]]; then
                            # If WAV target exists but source is different, ask to overwrite
                            if confirm_overwrite "WAV" "$wav_name"; then
                                if mv "$file" "$wav_name"; then
                                    echo "✓ Renamed original WAV: $wav_name"
                                fi
                            else
                                # Keep original file if user doesn't want to overwrite
                                echo "ℹ️  Keeping original file: $file"
                            fi
                        fi
                    fi
                    ((processed_files++))
                else
                    ((conversion_errors++))
                fi
                ;;
            "flac")
                # Check if FLAC already exists
                if [[ -f "$flac_name" ]]; then
                    if ! confirm_overwrite "FLAC" "$flac_name"; then
                        ((counter++))
                        continue
                    fi
                fi
                
                # Convert to FLAC (optionally remove original WAV)
                if convert_to_flac "$file" "$flac_name"; then
                    if [[ "$DELETE_WAVS" == true ]]; then
                        # Remove original WAV file after successful conversion
                        rm "$file"
                        echo "🗑️  Deleted original WAV: $file"
                    else
                        # Rename original WAV file to match numbering scheme if it doesn't already exist
                        if [[ ! -f "$wav_name" ]]; then
                            if mv "$file" "$wav_name"; then
                                echo "✓ Renamed original WAV: $wav_name"
                            fi
                        elif [[ "$file" != "$wav_name" ]]; then
                            # If WAV target exists but source is different, ask to overwrite
                            if confirm_overwrite "WAV" "$wav_name"; then
                                if mv "$file" "$wav_name"; then
                                    echo "✓ Renamed original WAV: $wav_name"
                                fi
                            else
                                # Keep original file if user doesn't want to overwrite
                                echo "ℹ️  Keeping original file: $file"
                            fi
                        fi
                    fi
                    ((processed_files++))
                else
                    ((conversion_errors++))
                fi
                ;;
            "all")
                # Rename WAV and create MP3 and FLAC copies
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
                
                # Convert to FLAC from the renamed WAV file
                if [[ "$wav_success" == true ]]; then
                    if convert_to_flac "$wav_name" "$flac_name"; then
                        echo "✓ Created FLAC copy: $flac_name"
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
