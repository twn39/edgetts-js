/**
 * Tests for SubMaker class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SubMaker } from '../submaker';
import { TTSChunkMetadata } from '../types';

describe('SubMaker', () => {
    let submaker: SubMaker;

    beforeEach(() => {
        submaker = new SubMaker();
    });

    describe('feed', () => {
        it('should accept WordBoundary messages', () => {
            const msg: TTSChunkMetadata = {
                type: 'WordBoundary',
                offset: 10000000, // 1 second in 100-nanosecond units
                duration: 5000000, // 0.5 seconds
                text: 'Hello',
            };

            expect(() => submaker.feed(msg)).not.toThrow();
            expect(submaker.getCueCount()).toBe(1);
        });

        it('should accept SentenceBoundary messages', () => {
            const msg: TTSChunkMetadata = {
                type: 'SentenceBoundary',
                offset: 10000000,
                duration: 10000000,
                text: 'Hello, World!',
            };

            expect(() => submaker.feed(msg)).not.toThrow();
            expect(submaker.getCueCount()).toBe(1);
        });

        it('should throw for audio messages', () => {
            const msg = {
                type: 'audio' as const,
                data: new Uint8Array([1, 2, 3]),
            };

            expect(() => submaker.feed(msg)).toThrow('Invalid message type');
        });

        it('should throw when mixing WordBoundary and SentenceBoundary', () => {
            const wordMsg: TTSChunkMetadata = {
                type: 'WordBoundary',
                offset: 10000000,
                duration: 5000000,
                text: 'Hello',
            };

            const sentenceMsg: TTSChunkMetadata = {
                type: 'SentenceBoundary',
                offset: 20000000,
                duration: 10000000,
                text: 'World!',
            };

            submaker.feed(wordMsg);
            expect(() => submaker.feed(sentenceMsg)).toThrow("Expected message type 'WordBoundary'");
        });

        it('should convert offset from 100-nanosecond units to milliseconds', () => {
            const msg: TTSChunkMetadata = {
                type: 'WordBoundary',
                offset: 10000000, // 10,000,000 * 100ns = 1 second = 1000ms
                duration: 5000000, // 500ms
                text: 'Test',
            };

            submaker.feed(msg);
            const cues = submaker.getCues();

            expect(cues[0].start).toBe(1000); // 10000000 / 10000 = 1000
            expect(cues[0].end).toBe(1500); // (10000000 + 5000000) / 10000 = 1500
        });
    });

    describe('getSrt', () => {
        it('should return empty string for no cues', () => {
            expect(submaker.getSrt()).toBe('');
        });

        it('should return valid SRT for single cue', () => {
            const msg: TTSChunkMetadata = {
                type: 'WordBoundary',
                offset: 10000000,
                duration: 5000000,
                text: 'Hello',
            };

            submaker.feed(msg);
            const srt = submaker.getSrt();

            expect(srt).toContain('1');
            expect(srt).toContain('00:00:01,000 --> 00:00:01,500');
            expect(srt).toContain('Hello');
        });

        it('should return valid SRT for multiple cues', () => {
            const messages: TTSChunkMetadata[] = [
                { type: 'WordBoundary', offset: 10000000, duration: 5000000, text: 'Hello' },
                { type: 'WordBoundary', offset: 20000000, duration: 5000000, text: 'World' },
            ];

            for (const msg of messages) {
                submaker.feed(msg);
            }

            const srt = submaker.getSrt();

            expect(srt).toContain('Hello');
            expect(srt).toContain('World');
        });
    });

    describe('toString', () => {
        it('should return the same as getSrt', () => {
            const msg: TTSChunkMetadata = {
                type: 'WordBoundary',
                offset: 10000000,
                duration: 5000000,
                text: 'Test',
            };

            submaker.feed(msg);

            expect(submaker.toString()).toBe(submaker.getSrt());
        });
    });

    describe('clear', () => {
        it('should remove all cues', () => {
            const msg: TTSChunkMetadata = {
                type: 'WordBoundary',
                offset: 10000000,
                duration: 5000000,
                text: 'Test',
            };

            submaker.feed(msg);
            expect(submaker.getCueCount()).toBe(1);

            submaker.clear();
            expect(submaker.getCueCount()).toBe(0);
        });

        it('should reset type so mixed boundaries work after clear', () => {
            const wordMsg: TTSChunkMetadata = {
                type: 'WordBoundary',
                offset: 10000000,
                duration: 5000000,
                text: 'Hello',
            };

            const sentenceMsg: TTSChunkMetadata = {
                type: 'SentenceBoundary',
                offset: 20000000,
                duration: 10000000,
                text: 'World!',
            };

            submaker.feed(wordMsg);
            submaker.clear();

            // Should not throw after clear
            expect(() => submaker.feed(sentenceMsg)).not.toThrow();
        });
    });

    describe('getCues', () => {
        it('should return a copy of cues', () => {
            const msg: TTSChunkMetadata = {
                type: 'WordBoundary',
                offset: 10000000,
                duration: 5000000,
                text: 'Test',
            };

            submaker.feed(msg);
            const cues = submaker.getCues();

            // Modifying returned array should not affect internal state
            cues.pop();
            expect(submaker.getCueCount()).toBe(1);
        });
    });
});
