/**
 * Utility functions for edge-tts
 */

import { TTSConfig } from './types';

/**
 * Returns the headers and data from the given data.
 * @param data - The data to be parsed.
 * @param headerLength - The length of the header.
 * @returns The headers and data to be used in the request.
 */
export function getHeadersAndData(
  data: Uint8Array,
  headerLength: number
): { headers: Record<string, string>; data: Uint8Array } {
  const headers: Record<string, string> = {};
  const headerText = new TextDecoder().decode(data.slice(0, headerLength));

  for (const line of headerText.split('\r\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex);
      const value = line.slice(colonIndex + 1);
      headers[key] = value;
    }
  }

  return { headers, data: data.slice(headerLength + 2) };
}

/**
 * The service does not support a couple character ranges.
 * Most important being the vertical tab character which is
 * commonly present in OCR-ed PDFs.
 * @param string - The string to be cleaned.
 * @returns The cleaned string.
 */
export function removeIncompatibleCharacters(string: string): string {
  const chars = string.split('');

  for (let idx = 0; idx < chars.length; idx++) {
    const code = chars[idx].charCodeAt(0);
    if ((0 <= code && code <= 8) || (11 <= code && code <= 12) || (14 <= code && code <= 31)) {
      chars[idx] = ' ';
    }
  }

  return chars.join('');
}

/**
 * Returns a UUID without dashes.
 * @returns A UUID without dashes.
 */
export function connectId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Finds the index of the rightmost preferred split character (newline or space)
 * within the initial `limit` bytes of the text.
 * @param text - The byte string to search within.
 * @param limit - The maximum index (exclusive) to search up to.
 * @returns The index of the last found newline or space within the limit, or -1 if neither is found.
 */
function findLastNewlineOrSpaceWithinLimit(text: Uint8Array, limit: number): number {
  // Prioritize finding a newline character
  let splitAt = -1;
  for (let i = limit - 1; i >= 0; i--) {
    if (text[i] === 0x0a) { // \n
      splitAt = i;
      break;
    }
  }

  // If no newline is found, search for a space
  if (splitAt < 0) {
    for (let i = limit - 1; i >= 0; i--) {
      if (text[i] === 0x20) { // space
        splitAt = i;
        break;
      }
    }
  }

  return splitAt;
}

/**
 * Finds the rightmost possible byte index such that the
 * segment `text_segment[:index]` is a valid UTF-8 sequence.
 * @param textSegment - The byte segment being considered for splitting.
 * @returns The index of the safe split point.
 */
function findSafeUtf8SplitPoint(textSegment: Uint8Array): number {
  let splitAt = textSegment.length;

  while (splitAt > 0) {
    try {
      new TextDecoder().decode(textSegment.slice(0, splitAt));
      return splitAt;
    } catch {
      splitAt--;
    }
  }

  return splitAt;
}

/**
 * Adjusts a proposed split point backward to prevent splitting inside an XML entity.
 * @param text - The text segment being considered.
 * @param splitAt - The proposed split point index.
 * @returns The adjusted split point index.
 */
function adjustSplitPointForXmlEntity(text: Uint8Array, splitAt: number): number {
  let adjustedSplitAt = splitAt;

  while (adjustedSplitAt > 0) {
    let ampersandIndex = -1;
    for (let i = adjustedSplitAt - 1; i >= 0; i--) {
      if (text[i] === 0x26) { // &
        ampersandIndex = i;
        break;
      }
    }

    if (ampersandIndex === -1) {
      break;
    }

    // Check if a semicolon exists between the ampersand and the split point
    let hasSemicolon = false;
    for (let i = ampersandIndex + 1; i < adjustedSplitAt; i++) {
      if (text[i] === 0x3b) { // ;
        hasSemicolon = true;
        break;
      }
    }

    if (hasSemicolon) {
      break;
    }

    adjustedSplitAt = ampersandIndex;
  }

  return adjustedSplitAt;
}

/**
 * Splits text into chunks, each not exceeding a maximum byte length.
 * @param text - The input text.
 * @param byteLength - The maximum allowed byte length for any yielded chunk.
 * @returns Text chunks (UTF-8 encoded, stripped of leading/trailing whitespace).
 */
export function* splitTextByByteLength(text: string, byteLength: number): Generator<Uint8Array> {
  if (byteLength <= 0) {
    throw new Error('byte_length must be greater than 0');
  }

  let data = new TextEncoder().encode(text);

  while (data.length > byteLength) {
    // Find the initial split point based on whitespace or UTF-8 boundary
    let splitAt = findLastNewlineOrSpaceWithinLimit(data, byteLength);

    if (splitAt < 0) {
      // No newline or space found, so we need to find a safe UTF-8 split point
      splitAt = findSafeUtf8SplitPoint(data);
    }

    // Adjust the split point to avoid cutting in the middle of an xml entity
    splitAt = adjustSplitPointForXmlEntity(data, splitAt);

    if (splitAt < 0) {
      throw new Error(
        'Maximum byte length is too small or invalid text structure near & or invalid UTF-8'
      );
    }

    // Yield the chunk
    const chunk = data.slice(0, splitAt);
    const trimmedChunk = trimWhitespace(chunk);
    if (trimmedChunk.length > 0) {
      yield trimmedChunk;
    }

    // Prepare for the next iteration
    data = data.slice(splitAt > 0 ? splitAt : 1);
  }

  // Yield the remaining part
  const remainingChunk = trimWhitespace(data);
  if (remainingChunk.length > 0) {
    yield remainingChunk;
  }
}

/**
 * Trim leading and trailing whitespace from a Uint8Array.
 */
function trimWhitespace(data: Uint8Array): Uint8Array {
  let start = 0;
  let end = data.length;

  while (start < end && (data[start] === 0x20 || data[start] === 0x09 || data[start] === 0x0a || data[start] === 0x0d)) {
    start++;
  }

  while (end > start && (data[end - 1] === 0x20 || data[end - 1] === 0x09 || data[end - 1] === 0x0a || data[end - 1] === 0x0d)) {
    end--;
  }

  return data.slice(start, end);
}

/**
 * Creates a SSML string from the given parameters.
 * @param tc - The TTS configuration.
 * @param escapedText - The escaped text.
 * @returns The SSML string.
 */
export function mkssml(tc: TTSConfig, escapedText: string): string {
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${tc.voice}'>` +
    `<prosody pitch='${tc.pitch}' rate='${tc.rate}' volume='${tc.volume}'>` +
    escapedText +
    '</prosody>' +
    '</voice>' +
    '</speak>'
  );
}

/**
 * Return Javascript-style date string.
 * @returns Javascript-style date string.
 */
export function dateToString(): string {
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[now.getUTCDay()];
  const monthName = months[now.getUTCMonth()];
  const day = now.getUTCDate().toString().padStart(2, '0');
  const year = now.getUTCFullYear();
  const hours = now.getUTCHours().toString().padStart(2, '0');
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');
  const seconds = now.getUTCSeconds().toString().padStart(2, '0');

  return `${dayName} ${monthName} ${day} ${year} ${hours}:${minutes}:${seconds} GMT+0000 (Coordinated Universal Time)`;
}

/**
 * Returns the headers and data to be used in the request.
 * @param requestId - The request ID.
 * @param timestamp - The timestamp.
 * @param ssml - The SSML string.
 * @returns The headers and data to be used in the request.
 */
export function ssmlHeadersPlusData(requestId: string, timestamp: string, ssml: string): string {
  return (
    `X-RequestId:${requestId}\r\n` +
    'Content-Type:application/ssml+xml\r\n' +
    `X-Timestamp:${timestamp}Z\r\n` + // This is not a mistake, Microsoft Edge bug.
    'Path:ssml\r\n\r\n' +
    ssml
  );
}

/**
 * Escape XML special characters.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&' + 'amp;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;')
    .replace(/"/g, '&' + 'quot;')
    .replace(/'/g, '&' + 'apos;');
}

/**
 * Unescape XML special characters.
 */
export function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}