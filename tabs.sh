#!/usr/bin/env bash
set -euo pipefail

# Demucs -> MIDI (Basic Pitch) -> open in TuxGuitar
# Usage:
#   ./demucs2gp.sh "/path/to/song.mp3"
# Options:
#   GP_OPEN=1 ./demucs2gp.sh "song.mp3"      # auto-open TuxGuitar at the end (if installed)
#   MODEL=htdemucs_6s ./demucs2gp.sh "song"  # choose Demucs model (default: htdemucs_6s)
#   OUTDIR=/some/path ./demucs2gp.sh "song"  # choose output dir (default: ./demucs2gp_out)
#   BASIC_PITCH_CMD="micromamba run -n bp39 basic-pitch" ./demucs2gp.sh "song"

SONG_PATH="${1:-}"
if [[ -z "${SONG_PATH}" ]]; then
  echo "Usage: $0 /path/to/song.(mp3|wav|flac|m4a)"
  exit 1
fi

# Configs (env-overridable)
MODEL="${MODEL:-htdemucs_6s}"          # 6-stem model includes a dedicated guitar stem
OUTDIR="${OUTDIR:-$(pwd)/demucs2gp_out}"
GP_OPEN="${GP_OPEN:-0}"
BASIC_PITCH_CMD="${BASIC_PITCH_CMD:-basic-pitch}"

# ---- Dependency checks -------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1; }

if ! need demucs; then
  echo "[!] 'demucs' not found."
  echo "    Install with:  pipx install demucs   # or: pip install demucs"
  exit 2
fi

if [[ "${BASIC_PITCH_CMD}" == "basic-pitch" ]] && ! need basic-pitch; then
  echo "[!] 'basic-pitch' CLI not found."
  echo "    Install with:  pipx install basic-pitch   # or: pip install basic-pitch"
  echo "    Or set BASIC_PITCH_CMD to a wrapper (e.g., micromamba/docker)."
  exit 3
fi

if [[ "${GP_OPEN}" == "1" ]] && ! need tuxguitar; then
  echo "[i] 'tuxguitar' not found; will skip auto-open. Install via your package manager."
  GP_OPEN=0
fi

# ---- Prepare workspace -------------------------------------------------------
mkdir -p "${OUTDIR}"
WORKSTAMP="$(date +%Y%m%d_%H%M%S)"
JOBDIR="${OUTDIR}/${WORKSTAMP}"
mkdir -p "${JOBDIR}"

# ---- 1) Separate stems with Demucs ------------------------------------------
echo "[*] Separating stems with Demucs (${MODEL})..."
demucs -n "${MODEL}" --out "${JOBDIR}" "${SONG_PATH}"

# Demucs output pattern:
# ${JOBDIR}/${MODEL}/${BASENAME_WO_EXT}/[guitar.wav|bass.wav|drums.wav|vocals.wav|piano.wav|other.wav]
# Find the first matching stem file safely (no pipes => no SIGPIPE with pipefail)
STEM_FILE="$(find "${JOBDIR}" -type f \( -name 'guitar.wav' -o -name 'other.wav' \) -print -quit || true)"
if [[ -z "${STEM_FILE}" ]]; then
  echo "[!] Could not locate stems. Check Demucs output under: ${JOBDIR}"
  exit 4
fi
STEM_DIR="$(dirname "${STEM_FILE}")"
echo "[i] Stems directory: ${STEM_DIR}"

# Prefer explicit guitar/bass/drums if present; otherwise fall back to 'other.wav'
GUITAR_WAV=""
if [[ -f "${STEM_DIR}/guitar.wav" ]]; then
  GUITAR_WAV="${STEM_DIR}/guitar.wav"
elif [[ -f "${STEM_DIR}/other.wav" ]]; then
  GUITAR_WAV="${STEM_DIR}/other.wav"
fi
BASS_WAV="${STEM_DIR}/bass.wav"
DRUMS_WAV="${STEM_DIR}/drums.wav"  # kept for reference

if [[ -z "${GUITAR_WAV}" ]]; then
  echo "[!] No guitar/other stem found. Contents:"
  ls -la "${STEM_DIR}"
  exit 5
fi

# ---- 2) Transcribe GUITAR & BASS to MIDI via Basic Pitch --------------------
MIDIDIR="${JOBDIR}/midi"
mkdir -p "${MIDIDIR}"

echo "[*] Transcribing guitar -> MIDI (Basic Pitch)..."
# New CLI: basic-pitch --save-midi <OUTDIR> <AUDIO...>
eval "${BASIC_PITCH_CMD} --save-midi \"${MIDIDIR}\" \"${GUITAR_WAV}\"" >/dev/null

# pick newest .mid and normalize to guitar.mid
GTR_MID_AUTO="$(ls -t "${MIDIDIR}"/*.mid 2>/dev/null | head -n 1 || true)"
if [[ -n "${GTR_MID_AUTO}" ]]; then
  mv -f "${GTR_MID_AUTO}" "${MIDIDIR}/guitar.mid"
else
  echo "[!] Guitar MIDI not produced. Check audio quality or try a cleaner stem."
fi

if [[ -f "${BASS_WAV}" ]]; then
  echo "[*] Transcribing bass -> MIDI (Basic Pitch)..."
  eval "${BASIC_PITCH_CMD} --save-midi \"${MIDIDIR}\" \"${BASS_WAV}\"" >/dev/null
  BASS_MID_AUTO="$(ls -t "${MIDIDIR}"/*.mid 2>/dev/null | grep -v '/guitar\.mid$' | head -n 1 || true)"
  if [[ -n "${BASS_MID_AUTO}" ]]; then
    mv -f "${BASS_MID_AUTO}" "${MIDIDIR}/bass.mid"
  else
    echo "[!] Bass MIDI not produced. You can try isolating bass more or manual transcription."
  fi
else
  echo "[i] No bass.wav found; skipping bass transcription."
fi

# ---- 3) (Optional) Open in TuxGuitar for .gp5 export ------------------------
echo
echo "[✓] Done. Outputs:"
echo "    Stems: ${STEM_DIR}"
echo "    MIDI : ${MIDIDIR}/guitar.mid  ${MIDIDIR}/bass.mid (if produced)"
echo "    Drums WAV (reference): ${DRUMS_WAV:-<none>}"
echo
echo "Next steps to get a .gp5 file:"
echo "  1) Open TuxGuitar"
echo "  2) File → Import → MIDI (import guitar.mid and bass.mid as separate tracks)"
echo "  3) Set tracks to Electric Guitar / Bass; View → Show Tablature"
echo "  4) Clean up rhythms, add bends/slides as needed"
echo "  5) File → Save As… → Guitar Pro 5 (.gp5)"
echo

if [[ "${GP_OPEN}" == "1" ]]; then
  echo "[*] Launching TuxGuitar with produced MIDI files..."
  MIDI_ARGS=()
  [[ -f "${MIDIDIR}/guitar.mid" ]] && MIDI_ARGS+=("${MIDIDIR}/guitar.mid")
  [[ -f "${MIDIDIR}/bass.mid" ]] && MIDI_ARGS+=("${MIDIDIR}/bass.mid")
  if [[ "${#MIDI_ARGS[@]}" -gt 0 ]]; then
    tuxguitar "${MIDI_ARGS[@]}" >/dev/null 2>&1 &
  else
    echo "[i] No MIDI files to open."
  fi
fi
