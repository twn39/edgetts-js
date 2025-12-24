/**
 * SubMaker module is used to generate subtitles from WordBoundary and SentenceBoundary events.
 */

import { SubtitleClass, compose } from './srt-composer';
import { TTSChunk, BoundaryType } from './types';

/**
 * SubMaker is used to generate subtitles from WordBoundary and SentenceBoundary messages.
 */
export class SubMaker {
  private cues: SubtitleClass[] = [];
  private type: BoundaryType | null = null;

  /**
   * Feed a WordBoundary or SentenceBoundary message to the SubMaker object.
   * @param msg - The WordBoundary or SentenceBoundary message.
   * @throws Error if the message type is invalid or doesn't match the expected type.
   */
  feed(msg: TTSChunk): void {
    if (msg.type !== 'WordBoundary' && msg.type !== 'SentenceBoundary') {
      throw new Error(
        "Invalid message type, expected 'WordBoundary' or 'SentenceBoundary'."
      );
    }

    if (this.type === null) {
      this.type = msg.type;
    } else if (this.type !== msg.type) {
      throw new Error(
        `Expected message type '${this.type}', but got '${msg.type}'.`
      );
    }

    // Convert offset from 100-nanosecond units to milliseconds
    const startMs = msg.offset / 10000;
    const endMs = (msg.offset + msg.duration) / 10000;

    this.cues.push(
      new SubtitleClass(
        this.cues.length + 1,
        startMs,
        endMs,
        msg.text
      )
    );
  }

  /**
   * Get the SRT formatted subtitles from the SubMaker object.
   * @returns The SRT formatted subtitles.
   */
  getSrt(): string {
    return compose(this.cues);
  }

  /**
   * Get the string representation (SRT format) of the subtitles.
   * @returns The SRT formatted subtitles.
   */
  toString(): string {
    return this.getSrt();
  }

  /**
   * Clear all cues from the SubMaker.
   */
  clear(): void {
    this.cues = [];
    this.type = null;
  }

  /**
   * Get the number of cues in the SubMaker.
   * @returns The number of cues.
   */
  getCueCount(): number {
    return this.cues.length;
  }

  /**
   * Get all cues from the SubMaker.
   * @returns An array of SubtitleClass objects.
   */
  getCues(): SubtitleClass[] {
    return [...this.cues];
  }
}