# TODO: Alternative AI Music Generation APIs

## Problem
The unofficial Suno API (sunoapi.org) has been discontinued, so we need alternative solutions for AI music generation.

## Alternative Solutions

### 1. **Udio API** (Most Similar to Suno)
- **URL**: https://udio.com
- **Status**: Has unofficial API wrappers available
- **Features**: Text-to-music generation, style control, high quality output
- **Implementation**: Update SunoClient to UdioClient

### 2. **MusicGen by Meta** (Open Source)
- **URL**: https://huggingface.co/facebook/musicgen-large
- **Status**: Available via Hugging Face API
- **Features**: Text-to-music, controllable generation
- **Implementation**: Create MusicGenClient

### 3. **Stable Audio by Stability AI**
- **URL**: https://stableaudio.com
- **Status**: Has API access
- **Features**: High-quality audio generation, commercial use
- **Implementation**: Create StableAudioClient

### 4. **Mubert API** (Commercial)
- **URL**: https://mubert.com/api
- **Status**: Official API available
- **Features**: Royalty-free music generation, style control
- **Implementation**: Create MubertClient

### 5. **Local Generation with MusicGen**
- **Implementation**: Run MusicGen locally via Python subprocess
- **Pros**: No API costs, full control
- **Cons**: Requires local setup, slower generation

## Recommended Implementation Plan

### Phase 1: Multi-Provider Architecture
1. Create abstract `MusicGenerationClient` base class
2. Implement provider-specific clients (Udio, MusicGen, etc.)
3. Add provider selection via environment variable
4. Update CLI to support multiple providers

### Phase 2: Provider-Specific Features
1. Udio: Direct Suno-like replacement
2. MusicGen: Local generation option
3. Mubert: Commercial-grade generation
4. Stable Audio: High-quality output

### Phase 3: Fallback System
1. Implement provider fallback chain
2. Auto-retry with different providers on failure
3. Provider health checking

## Implementation Strategy

```javascript
// Abstract base class
class MusicGenerationClient {
  async generateSong(params) { throw new Error('Not implemented'); }
  async getGenerationStatus(id) { throw new Error('Not implemented'); }
  async downloadSong(url) { throw new Error('Not implemented'); }
}

// Provider implementations
class UdioClient extends MusicGenerationClient { ... }
class MusicGenClient extends MusicGenerationClient { ... }
class MubertClient extends MusicGenerationClient { ... }

// Factory pattern
class MusicClientFactory {
  static create(provider) {
    switch(provider) {
      case 'udio': return new UdioClient();
      case 'musicgen': return new MusicGenClient();
      case 'mubert': return new MubertClient();
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
```

## Environment Configuration

```env
# Primary provider
MUSIC_PROVIDER=udio

# Provider-specific configs
UDIO_API_TOKEN=your_token
MUSICGEN_API_TOKEN=your_hf_token
MUBERT_API_TOKEN=your_token
STABLE_AUDIO_API_TOKEN=your_token

# Fallback chain
MUSIC_FALLBACK_PROVIDERS=udio,musicgen,mubert
```

## Migration Path

1. **Immediate**: Update documentation to mention API discontinuation
2. **Short-term**: Implement Udio client as direct replacement
3. **Medium-term**: Add MusicGen and Mubert support
4. **Long-term**: Full multi-provider architecture with fallbacks