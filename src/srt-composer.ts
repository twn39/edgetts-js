/**
 * A tiny library for composing SRT files.
 * 
 * Based on https://github.com/cdown/srt with parsing, subtitle modifying
 * functionality and Python 2 support removed.
 * 
 * Typing support was added, and more modern JavaScript/TypeScript features were used.
 * 
 * Copyright (c) 2014-2023 Christopher Down
 * Copyright (c) 2025- edge-tts-js contributors
 * 
 * This file is licensed under the MIT License (MIT).
 */

import { Subtitle } from './types';

const MULTI_WS_REGEX = /\n\n+/g;

// Info message if truthy return -> Function taking a Subtitle, skip if True
const SUBTITLE_SKIP_CONDITIONS: Array<[string, (sub: Subtitle) => boolean]> = [
  ['No content', (sub) => !sub.content.trim()],
  ['Start time < 0 seconds', (sub) => sub.start < 0],
  ['Subtitle start time >= end time', (sub) => sub.start >= sub.end],
];

const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_MINUTE = 60;
const HOURS_IN_DAY = 24;
const MICROSECONDS_IN_MILLISECOND = 1000;

/**
 * The metadata relating to a single subtitle. Subtitles are sorted by start
 * time by default. If no index was provided, index 0 will be used on writing
 * an SRT block.
 */
export class SubtitleClass implements Subtitle {
  index: number | null;
  start: number; // in milliseconds
  end: number; // in milliseconds
  content: string;

  constructor(index: number | null, start: number, end: number, content: string) {
    this.index = index;
    this.start = start;
    this.end = end;
    this.content = content;
  }

  /**
   * Convert the current Subtitle to an SRT block.
   * @param eol - The end of line string to use (default "\n")
   * @returns The metadata of the current Subtitle object as an SRT formatted subtitle block
   */
  toSrt(eol: string | null = null): string {
    const outputContent = makeLegalContent(this.content);

    const lineEnding = eol ?? '\n';
    const finalContent = eol !== '\n' ? outputContent.replace(/\n/g, lineEnding) : outputContent;

    const template = '{idx}{eol}{start} --> {end}{eol}{content}{eol}{eol}';
    return template
      .replace('{idx}', String(this.index ?? 0))
      .replace(/{eol}/g, lineEnding)
      .replace('{start}', timedeltaToSrtTimestamp(this.start))
      .replace('{end}', timedeltaToSrtTimestamp(this.end))
      .replace('{content}', finalContent);
  }

  /**
   * Get a hash of the subtitle for comparison.
   */
  get hash(): number {
    let hash = 0;
    const str = JSON.stringify({ index: this.index, start: this.start, end: this.end, content: this.content });
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Check if two subtitles are equal.
   */
  equals(other: SubtitleClass): boolean {
    return (
      this.index === other.index &&
      this.start === other.start &&
      this.end === other.end &&
      this.content === other.content
    );
  }

  /**
   * Compare two subtitles for sorting.
   */
  compareTo(other: SubtitleClass): number {
    if (this.start !== other.start) return this.start - other.start;
    if (this.end !== other.end) return this.end - other.end;
    return (this.index ?? 0) - (other.index ?? 0);
  }
}

/**
 * Remove illegal content from a content block. Illegal content includes:
 * - Blank lines
 * - Starting or ending with a blank line
 * @param content - The content to make legal
 * @returns The legalised content
 */
export function makeLegalContent(content: string): string {
  // Optimisation: Usually the content we get is legally valid. Do a quick
  // check to see if we really need to do anything here.
  if (content && content[0] !== '\n' && !MULTI_WS_REGEX.test(content)) {
    return content;
  }

  const legalContent = content.trim().replace(MULTI_WS_REGEX, '\n');
  return legalContent;
}

/**
 * Convert a millisecond timestamp to an SRT timestamp.
 * @param milliseconds - The timestamp in milliseconds
 * @returns The timestamp in SRT format (HH:MM:SS,mmm)
 */
export function timedeltaToSrtTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hrs = Math.floor(totalSeconds / SECONDS_IN_HOUR);
  const secsRemainder = totalSeconds % SECONDS_IN_HOUR;
  const mins = Math.floor(secsRemainder / SECONDS_IN_MINUTE);
  const secs = secsRemainder % SECONDS_IN_MINUTE;
  const msecs = milliseconds % 1000;

  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${msecs.toString().padStart(3, '0')}`;
}

/**
 * Should skip exception for subtitle filtering.
 */
class ShouldSkipException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShouldSkipException';
  }
}

/**
 * Check if a subtitle should be skipped based on the rules in
 * SUBTITLE_SKIP_CONDITIONS.
 * @param subtitle - A Subtitle to check whether to skip
 * @throws ShouldSkipException If the subtitle should be skipped
 */
function shouldSkipSub(subtitle: SubtitleClass): void {
  for (const [infoMsg, subSkipper] of SUBTITLE_SKIP_CONDITIONS) {
    if (subSkipper(subtitle)) {
      throw new ShouldSkipException(infoMsg);
    }
  }
}

/**
 * Reorder subtitles to be sorted by start time order, and rewrite the indexes
 * to be in that same order. This ensures that the SRT file will play in an
 * expected fashion after, for example, times were changed in some subtitles
 * and they may need to be resorted.
 * 
 * If skip=true, subtitles will also be skipped if they are considered not to
 * be useful. Currently, the conditions to be considered "not useful" are as
 * follows:
 * - Content is empty, or only whitespace
 * - The start time is negative
 * - The start time is equal to or later than the end time
 * 
 * @param subtitles - Subtitle objects in any order
 * @param startIndex - The index to start from
 * @param inPlace - Whether to modify subs in-place for performance
 * @param skip - Whether to skip subtitles considered not useful
 * @returns The sorted subtitles as a generator
 */
export function* sortAndReindex(
  subtitles: Iterable<SubtitleClass>,
  startIndex: number = 1,
  inPlace: boolean = false,
  skip: boolean = true
): Generator<SubtitleClass> {
  const sorted = Array.from(subtitles).sort((a, b) => a.compareTo(b));
  let skippedSubs = 0;

  for (let subNum = startIndex; subNum < startIndex + sorted.length; subNum++) {
    const subtitle = sorted[subNum - startIndex];

    if (!inPlace) {
      // Create a copy
      const copy = new SubtitleClass(
        subtitle.index,
        subtitle.start,
        subtitle.end,
        subtitle.content
      );
      subtitle.index = copy.index;
      subtitle.start = copy.start;
      subtitle.end = copy.end;
      subtitle.content = copy.content;
    }

    if (skip) {
      try {
        shouldSkipSub(subtitle);
      } catch (e) {
        if (e instanceof ShouldSkipException) {
          if (subtitle.index === null) {
            // console.info(`Skipped subtitle with no index: ${e.message}`);
          } else {
            // console.info(`Skipped subtitle at index ${subtitle.index}: ${e.message}`);
          }
          skippedSubs++;
          continue;
        }
        throw e;
      }
    }

    subtitle.index = subNum - skippedSubs;
    yield subtitle;
  }
}

/**
 * Convert an iterator of Subtitle objects to a string of joined SRT blocks.
 * @param subtitles - The subtitles to convert to SRT blocks
 * @param reindex - Whether to reindex subtitles based on start time
 * @param startIndex - If reindexing, the index to start reindexing from
 * @param eol - The end of line string to use (default "\n")
 * @param inPlace - Whether to reindex subs in-place for performance
 * @returns A single SRT formatted string, with each input Subtitle represented as an SRT block
 */
export function compose(
  subtitles: Iterable<SubtitleClass>,
  reindex: boolean = true,
  startIndex: number = 1,
  eol: string | null = null,
  inPlace: boolean = false
): string {
  let subIterable: Iterable<SubtitleClass> = subtitles;

  if (reindex) {
    subIterable = sortAndReindex(subtitles, startIndex, inPlace);
  }

  const blocks: string[] = [];
  for (const subtitle of subIterable) {
    blocks.push(subtitle.toSrt(eol));
  }

  return blocks.join('');
}