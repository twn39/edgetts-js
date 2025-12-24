/**
 * Custom types for edge-tts
 */

export type BoundaryType = 'WordBoundary' | 'SentenceBoundary';

export type GenderType = 'Female' | 'Male';

export type VoiceStatus = 'Deprecated' | 'GA' | 'Preview';

export interface VoiceTag {
  ContentCategories: string[];
  VoicePersonalities: string[];
}

export interface Voice {
  Name: string;
  ShortName: string;
  Gender: GenderType;
  Locale: string;
  SuggestedCodec: string;
  FriendlyName: string;
  Status: VoiceStatus;
  VoiceTag: VoiceTag;
}

export interface VoicesManagerVoice extends Voice {
  Language: string;
}

export interface VoicesManagerFind {
  Gender?: GenderType;
  Locale?: string;
  Language?: string;
}

export interface TTSChunkAudio {
  type: 'audio';
  data: Uint8Array;
}

export interface TTSChunkMetadata {
  type: BoundaryType;
  offset: number;
  duration: number;
  text: string;
}

export type TTSChunk = TTSChunkAudio | TTSChunkMetadata;

export interface TTSConfig {
  voice: string;
  rate: string;
  volume: string;
  pitch: string;
  boundary: BoundaryType;
}

export interface CommunicateState {
  partialText: Uint8Array;
  offsetCompensation: number;
  lastDurationOffset: number;
  streamWasCalled: boolean;
}

export interface Subtitle {
  index: number | null;
  start: number; // in milliseconds
  end: number; // in milliseconds
  content: string;
}

export interface CommunicateOptions {
  voice?: string;
  rate?: string;
  volume?: string;
  pitch?: string;
  boundary?: BoundaryType;
  proxy?: string;
  connectTimeout?: number;
  receiveTimeout?: number;
}