/**
 * Constants for the edge-tts package
 */

export const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';

export const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
export const VOICE_LIST = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;

export const DEFAULT_VOICE = 'en-US-EmmaMultilingualNeural';

export const CHROMIUM_FULL_VERSION = '143.0.3650.75';
export const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split('.', 1)[0];
export const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;

export const BASE_HEADERS: Record<string, string> = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-US,en;q=0.9',
};

export const WSS_HEADERS: Record<string, string> = {
  ...BASE_HEADERS,
  'Pragma': 'no-cache',
  'Cache-Control': 'no-cache',
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'Sec-WebSocket-Version': '13',
};

export const VOICE_HEADERS: Record<string, string> = {
  ...BASE_HEADERS,
  'Authority': 'speech.platform.bing.com',
  'Sec-CH-UA': `" Not;A Brand";v="99", "Microsoft Edge";v="${CHROMIUM_MAJOR_VERSION}", "Chromium";v="${CHROMIUM_MAJOR_VERSION}"`,
  'Sec-CH-UA-Mobile': '?0',
  'Accept': '*/*',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
};

// Audio timing constants for CBR-based offset compensation.
// The output format "audio-24khz-48kbitrate-mono-mp3" is a 48 kbps constant
// bitrate stream. Microsoft's offset/duration metadata uses 100-nanosecond
// ticks, so 1 second = 10,000,000 ticks.
// For any CBR stream the byte-to-tick conversion is exact integer arithmetic:
//   ticks = total_bytes * 8 * TICKS_PER_SECOND / MP3_BITRATE_BPS
export const TICKS_PER_SECOND = 10_000_000;
export const MP3_BITRATE_BPS = 48_000;