/**
 * edge-tts-js allows you to use Microsoft Edge's online text-to-speech service
 * without needing Windows or the Edge browser.
 * 
 * This is a TypeScript/JavaScript port of the Python edge-tts library,
 * designed to work in browser environments using native WebSocket and Fetch APIs.
 */

// Main classes
export { Communicate } from './communicate';
export { SubMaker } from './submaker';
export { VoicesManager, listVoices } from './voices';

// Exceptions
export {
  EdgeTTSException,
  UnknownResponse,
  UnexpectedResponse,
  NoAudioReceived,
  WebSocketError,
  SkewAdjustmentError,
} from './exceptions';

// Types
export type {
  BoundaryType,
  GenderType,
  VoiceStatus,
  VoiceTag,
  Voice,
  VoicesManagerVoice,
  VoicesManagerFind,
  TTSChunkAudio,
  TTSChunkMetadata,
  TTSChunk,
  TTSConfig,
  CommunicateState,
  Subtitle,
  CommunicateOptions,
} from './types';

// SRT Composer
export {
  SubtitleClass,
  makeLegalContent,
  timedeltaToSrtTimestamp,
  sortAndReindex,
  compose,
} from './srt-composer';

// Constants
export {
  BASE_URL,
  TRUSTED_CLIENT_TOKEN,
  WSS_URL,
  VOICE_LIST,
  DEFAULT_VOICE,
  CHROMIUM_FULL_VERSION,
  CHROMIUM_MAJOR_VERSION,
  SEC_MS_GEC_VERSION,
  BASE_HEADERS,
  WSS_HEADERS,
  VOICE_HEADERS,
} from './constants';

// DRM
export { DRM } from './drm';

// Utils
export {
  getHeadersAndData,
  removeIncompatibleCharacters,
  connectId,
  splitTextByByteLength,
  mkssml,
  dateToString,
  ssmlHeadersPlusData,
  escapeXml,
  unescapeXml,
} from './utils';