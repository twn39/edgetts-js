/**
 * Tests for Communicate class validation
 * Note: These tests don't make real WebSocket connections
 */

import { describe, it, expect } from 'vitest';
import { Communicate } from '../communicate';

describe('Communicate', () => {
    describe('constructor', () => {
        it('should create instance with default options', () => {
            const comm = new Communicate('Hello, World!');
            expect(comm).toBeInstanceOf(Communicate);
        });

        it('should accept valid voice short name', () => {
            expect(() => new Communicate('Test', { voice: 'en-US-JennyNeural' })).not.toThrow();
        });

        it('should accept valid voice long name', () => {
            const voice = 'Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)';
            expect(() => new Communicate('Test', { voice })).not.toThrow();
        });

        it('should throw for invalid voice format', () => {
            expect(() => new Communicate('Test', { voice: 'invalid-voice' })).toThrow("Invalid voice");
        });

        it('should accept valid rate', () => {
            expect(() => new Communicate('Test', { rate: '+50%' })).not.toThrow();
            expect(() => new Communicate('Test', { rate: '-25%' })).not.toThrow();
        });

        it('should throw for invalid rate', () => {
            expect(() => new Communicate('Test', { rate: '50%' })).toThrow("Invalid rate");
            expect(() => new Communicate('Test', { rate: '+50' })).toThrow("Invalid rate");
        });

        it('should accept valid volume', () => {
            expect(() => new Communicate('Test', { volume: '+50%' })).not.toThrow();
            expect(() => new Communicate('Test', { volume: '-25%' })).not.toThrow();
        });

        it('should throw for invalid volume', () => {
            expect(() => new Communicate('Test', { volume: '50%' })).toThrow("Invalid volume");
            expect(() => new Communicate('Test', { volume: '+50' })).toThrow("Invalid volume");
        });

        it('should accept valid pitch', () => {
            expect(() => new Communicate('Test', { pitch: '+50Hz' })).not.toThrow();
            expect(() => new Communicate('Test', { pitch: '-25Hz' })).not.toThrow();
        });

        it('should throw for invalid pitch', () => {
            expect(() => new Communicate('Test', { pitch: '50Hz' })).toThrow("Invalid pitch");
            expect(() => new Communicate('Test', { pitch: '+50' })).toThrow("Invalid pitch");
        });

        it('should throw if text is not a string', () => {
            // @ts-expect-error Testing invalid input
            expect(() => new Communicate(123)).toThrow('text must be string');
        });

        it('should accept boundary type WordBoundary', () => {
            expect(() => new Communicate('Test', { boundary: 'WordBoundary' })).not.toThrow();
        });

        it('should accept boundary type SentenceBoundary', () => {
            expect(() => new Communicate('Test', { boundary: 'SentenceBoundary' })).not.toThrow();
        });
    });

    describe('voice format conversion', () => {
        it('should convert short voice name to long format', () => {
            // This is validated internally by checking it doesn't throw
            const comm = new Communicate('Test', { voice: 'en-US-JennyNeural' });
            expect(comm).toBeInstanceOf(Communicate);
        });

        it('should handle multi-part regional voices', () => {
            // voices like fil-PH-AngeloNeural should be converted correctly
            const comm = new Communicate('Test', { voice: 'fil-PH-AngeloNeural' });
            expect(comm).toBeInstanceOf(Communicate);
        });
    });

    describe('stream method', () => {
        it('should throw if called twice', async () => {
            const comm = new Communicate('Test');

            // First call to stream() - get the generator
            const stream1 = comm.stream();

            // Try to consume it (will fail in test env, but that's okay)
            try {
                await stream1.next();
            } catch {
                // Expected to fail due to no actual WebSocket in test environment
            }

            // Second call should throw - the check happens when stream() is called
            // Since stream_was_called is set in stream(), calling it again should throw
            // Note: The actual error happens when iterating
            const stream2 = comm.stream();
            await expect(stream2.next()).rejects.toThrow('stream can only be called once');
        });
    });

    describe('text handling', () => {
        it('should handle empty text', () => {
            expect(() => new Communicate('')).not.toThrow();
        });

        it('should handle text with special characters', () => {
            expect(() => new Communicate('<script>alert("xss")</script>')).not.toThrow();
        });

        it('should handle very long text', () => {
            const longText = 'Hello World '.repeat(1000);
            expect(() => new Communicate(longText)).not.toThrow();
        });

        it('should handle unicode text', () => {
            expect(() => new Communicate('你好世界 🌍 مرحبا العالم')).not.toThrow();
        });
    });
});
