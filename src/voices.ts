/**
 * This module contains functions to list all available voices and a class to find the
 * correct voice based on their attributes.
 */

import { VOICE_LIST, VOICE_HEADERS, SEC_MS_GEC_VERSION } from './constants';
import { DRM } from './drm';
import { Voice, VoicesManagerVoice, VoicesManagerFind } from './types';
import { SkewAdjustmentError } from './exceptions';

/**
 * Private function that makes the request to the voice list URL and parses the
 * JSON response. This function is used by listVoices() and makes it easier to
 * handle client response errors related to clock skew.
 * 
 * @param url - The URL to fetch voices from.
 * @param headers - The headers to include in the request.
 * @returns A list of voices and their attributes.
 */
async function __listVoices(
  url: string,
  headers: Record<string, string>
): Promise<Voice[]> {
  const response = await fetch(url, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: Voice[] = await response.json();

  // Ensure VoiceTag exists and has required properties
  for (const voice of data) {
    if (!voice.VoiceTag) {
      voice.VoiceTag = {
        ContentCategories: [],
        VoicePersonalities: [],
      };
    }

    if (!voice.VoiceTag.ContentCategories) {
      voice.VoiceTag.ContentCategories = [];
    }

    if (!voice.VoiceTag.VoicePersonalities) {
      voice.VoiceTag.VoicePersonalities = [];
    }
  }

  return data;
}

/**
 * List all available voices and their attributes.
 * 
 * This pulls data from the URL used by Microsoft Edge to return a list of
 * all available voices.
 * 
 * @param proxy - The proxy to use for the request (not supported in browser).
 * @returns A list of voices and their attributes.
 */
export async function listVoices(proxy?: string): Promise<Voice[]> {
  if (proxy !== undefined) {
    console.warn('Proxy is not supported in browser environment');
  }

  const secMsGec = await DRM.generateSecMsGec();
  const url = `${VOICE_LIST}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
  const headers = DRM.headersWithMuid(VOICE_HEADERS);

  try {
    return await __listVoices(url, headers);
  } catch (error) {
    // Check if it's a 403 error and retry with adjusted clock skew
    if (error instanceof Error && error.message.includes('403')) {
      // In browser, we can't easily access response headers
      // We'll try to adjust clock skew and retry
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
      });

      if (response.status === 403) {
        const serverDate = response.headers.get('Date');
        if (serverDate) {
          const serverDateParsed = DRM.parseRFC2616Date(serverDate);
          if (serverDateParsed !== null) {
            const clientDate = DRM.getUnixTimestamp();
            DRM.adjustClockSkewSeconds(serverDateParsed - clientDate);
            
            // Retry with adjusted clock skew
            const newSecMsGec = await DRM.generateSecMsGec();
            const newUrl = `${VOICE_LIST}&Sec-MS-GEC=${newSecMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
            const newHeaders = DRM.headersWithMuid(VOICE_HEADERS);
            return await __listVoices(newUrl, newHeaders);
          }
        }
        throw new SkewAdjustmentError('No server date in headers.');
      }
      throw error;
    }
    throw error;
  }
}

/**
 * A class to find the correct voice based on their attributes.
 */
export class VoicesManager {
  private voices: VoicesManagerVoice[] = [];
  private calledCreate: boolean = false;

  /**
   * Creates a VoicesManager object and populates it with all available voices.
   * @param customVoices - Optional custom voices to use instead of fetching from the service.
   * @returns A VoicesManager instance populated with voices.
   */
  static async create(customVoices?: Voice[]): Promise<VoicesManager> {
    const manager = new VoicesManager();
    const voices = customVoices ?? await listVoices();
    
    manager.voices = voices.map(voice => ({
      ...voice,
      Language: voice.Locale.split('-')[0]
    }));
    
    manager.calledCreate = true;
    return manager;
  }

  /**
   * Finds all matching voices based on the provided attributes.
   * @param criteria - The criteria to match voices against.
   * @returns A list of matching voices.
   * @throws Error if find() is called before create().
   */
  find(criteria: VoicesManagerFind): VoicesManagerVoice[] {
    if (!this.calledCreate) {
      throw new Error('VoicesManager.find() called before VoicesManager.create()');
    }

    return this.voices.filter(voice => {
      // Check if all provided criteria match
      for (const [key, value] of Object.entries(criteria)) {
        if (value !== undefined && voice[key as keyof VoicesManagerVoice] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get all voices in the manager.
   * @returns All voices.
   */
  getAllVoices(): VoicesManagerVoice[] {
    if (!this.calledCreate) {
      throw new Error('VoicesManager.getAllVoices() called before VoicesManager.create()');
    }
    return [...this.voices];
  }

  /**
   * Get all unique locales available.
   * @returns An array of unique locale strings.
   */
  getLocales(): string[] {
    if (!this.calledCreate) {
      throw new Error('VoicesManager.getLocales() called before VoicesManager.create()');
    }
    const locales = new Set(this.voices.map(voice => voice.Locale));
    return Array.from(locales).sort();
  }

  /**
   * Get all unique languages available.
   * @returns An array of unique language codes.
   */
  getLanguages(): string[] {
    if (!this.calledCreate) {
      throw new Error('VoicesManager.getLanguages() called before VoicesManager.create()');
    }
    const languages = new Set(this.voices.map(voice => voice.Language));
    return Array.from(languages).sort();
  }

  /**
   * Find voices by locale.
   * @param locale - The locale to search for (e.g., 'en-US').
   * @returns A list of matching voices.
   */
  findByLocale(locale: string): VoicesManagerVoice[] {
    return this.find({ Locale: locale });
  }

  /**
   * Find voices by language.
   * @param language - The language code to search for (e.g., 'en').
   * @returns A list of matching voices.
   */
  findByLanguage(language: string): VoicesManagerVoice[] {
    return this.find({ Language: language });
  }

  /**
   * Find voices by gender.
   * @param gender - The gender to search for ('Female' or 'Male').
   * @returns A list of matching voices.
   */
  findByGender(gender: 'Female' | 'Male'): VoicesManagerVoice[] {
    return this.find({ Gender: gender });
  }
}