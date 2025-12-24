/**
 * Tests for SRT Composer
 */

import { describe, it, expect } from 'vitest';
import {
    SubtitleClass,
    makeLegalContent,
    timedeltaToSrtTimestamp,
    sortAndReindex,
    compose,
} from '../srt-composer';

describe('timedeltaToSrtTimestamp', () => {
    it('should format zero milliseconds', () => {
        expect(timedeltaToSrtTimestamp(0)).toBe('00:00:00,000');
    });

    it('should format milliseconds only', () => {
        expect(timedeltaToSrtTimestamp(500)).toBe('00:00:00,500');
    });

    it('should format seconds', () => {
        expect(timedeltaToSrtTimestamp(5000)).toBe('00:00:05,000');
    });

    it('should format minutes', () => {
        expect(timedeltaToSrtTimestamp(65000)).toBe('00:01:05,000');
    });

    it('should format hours', () => {
        expect(timedeltaToSrtTimestamp(3661500)).toBe('01:01:01,500');
    });

    it('should handle complex timestamps', () => {
        // 2 hours, 34 minutes, 56 seconds, 789 milliseconds
        const ms = 2 * 3600000 + 34 * 60000 + 56 * 1000 + 789;
        expect(timedeltaToSrtTimestamp(ms)).toBe('02:34:56,789');
    });
});

describe('makeLegalContent', () => {
    it('should return unchanged content when already legal', () => {
        expect(makeLegalContent('Hello World')).toBe('Hello World');
    });

    it('should trim leading whitespace', () => {
        expect(makeLegalContent('\nHello')).toBe('Hello');
    });

    it('should collapse multiple newlines', () => {
        expect(makeLegalContent('Hello\n\n\nWorld')).toBe('Hello\nWorld');
    });

    it('should handle empty string', () => {
        expect(makeLegalContent('')).toBe('');
    });
});

describe('SubtitleClass', () => {
    describe('constructor', () => {
        it('should create subtitle with provided values', () => {
            const sub = new SubtitleClass(1, 1000, 2000, 'Hello');
            expect(sub.index).toBe(1);
            expect(sub.start).toBe(1000);
            expect(sub.end).toBe(2000);
            expect(sub.content).toBe('Hello');
        });
    });

    describe('toSrt', () => {
        it('should format subtitle as SRT block', () => {
            const sub = new SubtitleClass(1, 1000, 2500, 'Hello World');
            const srt = sub.toSrt();

            expect(srt).toContain('1');
            expect(srt).toContain('00:00:01,000 --> 00:00:02,500');
            expect(srt).toContain('Hello World');
        });

        it('should use custom EOL when provided', () => {
            const sub = new SubtitleClass(1, 1000, 2000, 'Hello');
            const srt = sub.toSrt('\r\n');
            expect(srt).toContain('\r\n');
        });
    });

    describe('compareTo', () => {
        it('should sort by start time', () => {
            const sub1 = new SubtitleClass(1, 1000, 2000, 'First');
            const sub2 = new SubtitleClass(2, 500, 1500, 'Second');

            expect(sub1.compareTo(sub2)).toBeGreaterThan(0);
            expect(sub2.compareTo(sub1)).toBeLessThan(0);
        });

        it('should sort by end time if start times are equal', () => {
            const sub1 = new SubtitleClass(1, 1000, 2000, 'First');
            const sub2 = new SubtitleClass(2, 1000, 1500, 'Second');

            expect(sub1.compareTo(sub2)).toBeGreaterThan(0);
        });
    });

    describe('equals', () => {
        it('should return true for equal subtitles', () => {
            const sub1 = new SubtitleClass(1, 1000, 2000, 'Hello');
            const sub2 = new SubtitleClass(1, 1000, 2000, 'Hello');

            expect(sub1.equals(sub2)).toBe(true);
        });

        it('should return false for different subtitles', () => {
            const sub1 = new SubtitleClass(1, 1000, 2000, 'Hello');
            const sub2 = new SubtitleClass(2, 1000, 2000, 'World');

            expect(sub1.equals(sub2)).toBe(false);
        });
    });

    describe('hash', () => {
        it('should return a number', () => {
            const sub = new SubtitleClass(1, 1000, 2000, 'Hello');
            expect(typeof sub.hash).toBe('number');
        });

        it('should return same hash for equal subtitles', () => {
            const sub1 = new SubtitleClass(1, 1000, 2000, 'Hello');
            const sub2 = new SubtitleClass(1, 1000, 2000, 'Hello');

            expect(sub1.hash).toBe(sub2.hash);
        });

        it('should return different hash for different subtitles', () => {
            const sub1 = new SubtitleClass(1, 1000, 2000, 'Hello');
            const sub2 = new SubtitleClass(2, 1000, 2000, 'World');

            expect(sub1.hash).not.toBe(sub2.hash);
        });
    });

    describe('toSrt with null index', () => {
        it('should use 0 when index is null', () => {
            const sub = new SubtitleClass(null, 1000, 2000, 'Hello');
            const srt = sub.toSrt();

            expect(srt).toContain('0\n');
        });
    });

    describe('compareTo edge cases', () => {
        it('should compare by index when start and end times are equal', () => {
            const sub1 = new SubtitleClass(2, 1000, 2000, 'First');
            const sub2 = new SubtitleClass(1, 1000, 2000, 'Second');

            expect(sub1.compareTo(sub2)).toBeGreaterThan(0);
        });

        it('should handle null index in comparison', () => {
            const sub1 = new SubtitleClass(null, 1000, 2000, 'First');
            const sub2 = new SubtitleClass(1, 1000, 2000, 'Second');

            expect(sub1.compareTo(sub2)).toBeLessThan(0);
        });
    });
});

describe('sortAndReindex', () => {
    it('should sort subtitles by start time', () => {
        const subtitles = [
            new SubtitleClass(1, 2000, 3000, 'Second'),
            new SubtitleClass(2, 1000, 2000, 'First'),
        ];

        const sorted = Array.from(sortAndReindex(subtitles));

        expect(sorted[0].content).toBe('First');
        expect(sorted[1].content).toBe('Second');
    });

    it('should reindex starting from 1 by default', () => {
        const subtitles = [
            new SubtitleClass(5, 2000, 3000, 'Second'),
            new SubtitleClass(3, 1000, 2000, 'First'),
        ];

        const sorted = Array.from(sortAndReindex(subtitles));

        expect(sorted[0].index).toBe(1);
        expect(sorted[1].index).toBe(2);
    });

    it('should skip subtitles with empty content when skip=true', () => {
        const subtitles = [
            new SubtitleClass(1, 1000, 2000, 'Valid'),
            new SubtitleClass(2, 2000, 3000, ''),
        ];

        const sorted = Array.from(sortAndReindex(subtitles, 1, false, true));

        expect(sorted.length).toBe(1);
        expect(sorted[0].content).toBe('Valid');
    });

    it('should skip subtitles with start >= end when skip=true', () => {
        const subtitles = [
            new SubtitleClass(1, 1000, 2000, 'Valid'),
            new SubtitleClass(2, 3000, 2000, 'Invalid'),
        ];

        const sorted = Array.from(sortAndReindex(subtitles, 1, false, true));

        expect(sorted.length).toBe(1);
    });
});

describe('compose', () => {
    it('should compose multiple subtitles into SRT format', () => {
        const subtitles = [
            new SubtitleClass(1, 1000, 2000, 'First line'),
            new SubtitleClass(2, 3000, 4000, 'Second line'),
        ];

        const srt = compose(subtitles);

        expect(srt).toContain('1');
        expect(srt).toContain('00:00:01,000 --> 00:00:02,000');
        expect(srt).toContain('First line');
        expect(srt).toContain('2');
        expect(srt).toContain('00:00:03,000 --> 00:00:04,000');
        expect(srt).toContain('Second line');
    });

    it('should handle empty subtitles array', () => {
        const srt = compose([]);
        expect(srt).toBe('');
    });
});
