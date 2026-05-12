<div align="center">

# @twn39/edgetts-js

[![npm version](https://img.shields.io/npm/v/@twn39/edgetts-js.svg)](https://www.npmjs.com/package/@twn39/edgetts-js)
[![npm downloads](https://img.shields.io/npm/dm/@twn39/edgetts-js.svg)](https://www.npmjs.com/package/@twn39/edgetts-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Daily Tests](https://github.com/twn39/edgetts-js/actions/workflows/test.yml/badge.svg)](https://github.com/twn39/edgetts-js/actions/workflows/test.yml)

TypeScript/JavaScript port of the Python [edge-tts](https://github.com/rany2/edge-tts) library, designed primarily for Node.js environments.

This library allows you to use Microsoft Edge's online text-to-speech service natively from Node.js without needing Windows or the Edge browser.

</div>

## Features

- 🎯 TypeScript support - Full type definitions included
- 🚀 Node.js native - Uses native `ws` and Fetch APIs
- 🎤 Multiple voices - Access to all Microsoft Edge TTS voices
- 📝 Subtitle support - Generate SRT subtitles with WordBoundary/SentenceBoundary events
- 🔄 Streaming - Stream audio and metadata in real-time
- 🎛️ Configurable - Adjust rate, volume, pitch, and more

## Installation

```bash
npm install @twn39/edgetts-js
```

## Quick Start

```typescript
import { Communicate } from '@twn39/edgetts-js';

const communicate = new Communicate('Hello, world!', {
  voice: 'en-US-EmmaMultilingualNeural',
  rate: '+0%',
  volume: '+0%',
  pitch: '+0Hz',
  boundary: 'SentenceBoundary'
});

for await (const chunk of communicate.stream()) {
  if (chunk.type === 'audio') {
    // Handle audio data (Uint8Array)
    console.log('Received audio chunk:', chunk.data.length, 'bytes');
  } else if (chunk.type === 'WordBoundary' || chunk.type === 'SentenceBoundary') {
    // Handle metadata
    console.log('Word:', chunk.text, 'at', chunk.offset);
  }
}
```


## API Reference

### Communicate

Main class for streaming audio and metadata from the Edge TTS service.

#### Constructor

```typescript
new Communicate(text: string, options?: CommunicateOptions)
```

**Parameters:**
- `text` (string): The text to convert to speech
- `options` (CommunicateOptions, optional): Configuration options

**CommunicateOptions:**
- `voice` (string): Voice name (default: 'en-US-EmmaMultilingualNeural')
- `rate` (string): Speech rate, e.g., '+0%', '+10%', '-20%' (default: '+0%')
- `volume` (string): Volume, e.g., '+0%', '+50%', '-10%' (default: '+0%')
- `pitch` (string): Pitch, e.g., '+0Hz', '+10Hz', '-5Hz' (default: '+0Hz')
- `boundary` ('WordBoundary' | 'SentenceBoundary'): Metadata boundary type (default: 'SentenceBoundary')
- `proxy` (string): Proxy URL (not supported in browser)
- `connectTimeout` (number): Connection timeout in seconds (default: 10)
- `receiveTimeout` (number): Receive timeout in seconds (default: 60)

#### Methods

##### stream()

```typescript
async* stream(): AsyncGenerator<TTSChunk, void, unknown>
```

Streams audio and metadata from the service.

**Yields:** `TTSChunk` objects

**TTSChunk types:**
- `TTSChunkAudio`: `{ type: 'audio', data: Uint8Array }`
- `TTSChunkMetadata`: `{ type: 'WordBoundary' | 'SentenceBoundary', offset: number, duration: number, text: string }`

##### save()

```typescript
async save(audioData: Uint8Array[], metadataData?: TTSChunk[]): Promise<void>
```

Save audio and metadata to the specified arrays.

### SubMaker

Class for generating SRT subtitles from WordBoundary and SentenceBoundary events.

#### Constructor

```typescript
new SubMaker()
```

#### Methods

##### feed()

```typescript
feed(msg: TTSChunk): void
```

Feed a WordBoundary or SentenceBoundary message to the SubMaker.

##### getSrt()

```typescript
getSrt(): string
```

Get the SRT formatted subtitles.

**Example:**

```typescript
import { Communicate, SubMaker } from '@twn39/edgetts-js';

const communicate = new Communicate('Hello world!', { boundary: 'SentenceBoundary' });
const submaker = new SubMaker();

for await (const chunk of communicate.stream()) {
  if (chunk.type === 'SentenceBoundary') {
    submaker.feed(chunk);
  }
}

console.log(submaker.getSrt());
```

### listVoices()

```typescript
async function listVoices(proxy?: string): Promise<Voice[]>
```

List all available voices and their attributes.

**Returns:** Array of `Voice` objects

**Voice object:**
- `Name`: Full voice name
- `ShortName`: Short voice name (e.g., 'en-US-EmmaMultilingualNeural')
- `Gender`: 'Female' or 'Male'
- `Locale`: Locale code (e.g., 'en-US')
- `SuggestedCodec`: Suggested codec
- `FriendlyName`: Friendly name
- `Status`: 'Deprecated', 'GA', or 'Preview'
- `VoiceTag`: Additional voice tags

### VoicesManager

Class for finding voices based on their attributes.

#### Static Methods

##### create()

```typescript
static async create(customVoices?: Voice[]): Promise<VoicesManager>
```

Creates a VoicesManager object and populates it with all available voices.

#### Instance Methods

##### find()

```typescript
find(criteria: VoicesManagerFind): VoicesManagerVoice[]
```

Find all matching voices based on the provided attributes.

**VoicesManagerFind:**
- `Gender`?: 'Female' | 'Male'
- `Locale`?: string
- `Language`?: string

##### Other Methods

- `getAllVoices()`: Get all voices
- `getLocales()`: Get all unique locales
- `getLanguages()`: Get all unique languages
- `findByLocale(locale)`: Find voices by locale
- `findByLanguage(language)`: Find voices by language
- `findByGender(gender)`: Find voices by gender

**Example:**

```typescript
import { VoicesManager } from '@twn39/edgetts-js';

const manager = await VoicesManager.create();

// Find all English female voices
const englishFemaleVoices = manager.find({
  Language: 'en',
  Gender: 'Female'
});

// Find voices by locale
const usVoices = manager.findByLocale('en-US');

console.log('Available locales:', manager.getLocales());
```


## Demo

Open `demo.html` in a browser to try an interactive demo. Since direct browser WebSocket connections to Microsoft's servers are often intercepted by firewalls or routing rules, the demo uses a local Node.js proxy (`proxy.mjs`) to bridge the connection.

```bash
# Start the proxy and local server (runs on port 3000)
pnpm demo

# Then open http://localhost:3000/demo.html
```

The demo showcases:
- 🎙️ Text-to-speech synthesis with adjustable rate/pitch
- 🔍 Voice search and filtering (400+ voices)
- 📝 Real-time SRT subtitle generation
- 🔊 Audio playback

## Building

```bash
# Install dependencies
pnpm install

# Build the library
pnpm build

# Type check
pnpm type-check

# Watch mode for development
pnpm dev
```

## Testing

This library includes comprehensive unit and integration tests using Vitest:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

**Test coverage:**
- ✅ Utils (XML escaping, text splitting, SSML generation)
- ✅ DRM (token generation, MUID, clock skew)
- ✅ Exceptions (error hierarchy)
- ✅ SRT Composer (timestamp formatting, subtitle sorting)
- ✅ SubMaker (subtitle generation)
- ✅ VoicesManager (voice filtering - integration tests with real API)
- ✅ Communicate (parameter validation)

## Environment Compatibility

This library uses:
- `WebSocket` - Provided by `ws` in Node.js
- `fetch` - Native Node.js `fetch` (requires Node 18+)
- `crypto` - Node.js native crypto module
- `AsyncGenerator` - For streaming data

**Minimum Node.js version:**
- Node.js 18+

## Limitations

- **Browser Usage**: Running this library directly in a browser is not supported out-of-the-box because browsers lack the specific TLS fingerprints and headers required to bypass Microsoft's server restrictions (and often get intercepted by network proxies/firewalls). To use it in a browser, you must relay WebSocket traffic through a Node.js proxy, as demonstrated in the included `demo.html` and `proxy.mjs`.

## License

MIT License - See LICENSE file for details.

## Acknowledgments

This is a TypeScript/JavaScript port of the Python [edge-tts](https://github.com/rany2/edge-tts) library by rany.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.