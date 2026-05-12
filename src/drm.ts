/**
 * DRM module is used to handle DRM operations with clock skew correction.
 * Currently the only DRM operation is generating the Sec-MS-GEC token value
 * used in all API requests to Microsoft Edge's online text-to-speech service.
 */

import { TRUSTED_CLIENT_TOKEN } from './constants';

const WIN_EPOCH = 11644473600; // Windows epoch (1601-01-01 00:00:00 UTC)
const S_TO_NS = 1e9; // Seconds to nanoseconds

/**
 * Class to handle DRM operations with clock skew correction.
 */
export class DRM {
  private static clockSkewSeconds: number = 0.0;

  /**
   * Adjust the clock skew in seconds in case the system clock is off.
   * @param skewSeconds - The number of seconds to adjust the clock skew to.
   */
  static adjustClockSkewSeconds(skewSeconds: number): void {
    DRM.clockSkewSeconds += skewSeconds;
  }

  /**
   * Gets the current timestamp in Unix format with clock skew correction.
   * @returns The current timestamp in Unix format with clock skew correction.
   */
  static getUnixTimestamp(): number {
    return Date.now() / 1000 + DRM.clockSkewSeconds;
  }

  /**
   * Parses an RFC 2616 date string into a Unix timestamp.
   * @param date - RFC 2616 date string to parse.
   * @returns Unix timestamp of the parsed date string, or null if parsing failed.
   */
  static parseRFC2616Date(date: string): number | null {
    try {
      // RFC 2616 date format: "Wed, 21 Oct 2015 07:28:00 GMT"
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        return null;
      }
      return parsed.getTime() / 1000;
    } catch {
      return null;
    }
  }

  /**
   * Handle a client response error.
   * This method adjusts the clock skew based on the server date in the response headers.
   * @param headers - The response headers.
   * @throws Error if the server date is missing or invalid.
   */
  static handleClientResponseError(headers: Headers): void {
    const serverDate = headers.get('Date');
    if (!serverDate) {
      throw new Error('No server date in headers.');
    }

    const serverDateParsed = DRM.parseRFC2616Date(serverDate);
    if (serverDateParsed === null) {
      throw new Error(`Failed to parse server date: ${serverDate}`);
    }

    const clientDate = DRM.getUnixTimestamp();
    DRM.adjustClockSkewSeconds(serverDateParsed - clientDate);
  }

  /**
   * Generates the Sec-MS-GEC token value.
   * This function generates a token value based on the current time in Windows file time format
   * adjusted for clock skew, and rounded down to the nearest 5 minutes. The token is then hashed
   * using SHA256 and returned as an uppercased hex digest.
   * @returns The generated Sec-MS-GEC token value.
   */
  static async generateSecMsGec(): Promise<string> {
    // Use BigInt for the entire computation to avoid IEEE 754 precision loss.
    // In the range ~10^17 (100-nanosecond ticks since Windows epoch), doubles
    // only have ~15-16 significant digits, so integer values spaced 16 apart
    // may be rounded, producing an incorrect GEC token (→ 403 from server).
    //
    // BigInt arithmetic is exact: the result matches Python's integer path and
    // the f"{ticks:.0f}" format string in the reference implementation.
    const nowSec = BigInt(Math.floor(DRM.getUnixTimestamp()));

    // Switch to Windows file time epoch (1601-01-01 00:00:00 UTC)
    const WIN_EPOCH_BIG = 11644473600n;
    let ticks = nowSec + WIN_EPOCH_BIG;

    // Round down to the nearest 5-minute boundary (300 seconds)
    ticks -= ticks % 300n;

    // Convert to 100-nanosecond intervals (Windows FILETIME format)
    ticks *= 10_000_000n;

    // Hash: SHA-256(ticks_string + TRUSTED_CLIENT_TOKEN)
    const strToHash = `${ticks}${TRUSTED_CLIENT_TOKEN}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(strToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.toUpperCase();
  }

  /**
   * Generates a random MUID.
   * @returns The generated MUID.
   */
  static generateMuid(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /**
   * Returns a copy of the given headers with the MUID header added.
   * @param headers - The original headers.
   * @returns The headers with the MUID header added.
   */
  static headersWithMuid(headers: Record<string, string>): Record<string, string> {
    const combinedHeaders = { ...headers };
    if ('Cookie' in combinedHeaders) {
      throw new Error('Cookie header already exists in headers.');
    }
    combinedHeaders['Cookie'] = `muid=${DRM.generateMuid()};`;
    return combinedHeaders;
  }
}