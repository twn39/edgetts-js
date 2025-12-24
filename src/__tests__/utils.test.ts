/**
 * Tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import {
    escapeXml,
    unescapeXml,
    removeIncompatibleCharacters,
    connectId,
    splitTextByByteLength,
    mkssml,
    dateToString,
    ssmlHeadersPlusData,
    getHeadersAndData,
} from '../utils';
import { TTSConfig } from '../types';

describe('escapeXml', () => {
    it('should escape ampersand', () => {
        expect(escapeXml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape less than', () => {
        expect(escapeXml('foo < bar')).toBe('foo &lt; bar');
    });

    it('should escape greater than', () => {
        expect(escapeXml('foo > bar')).toBe('foo &gt; bar');
    });

    it('should escape double quotes', () => {
        expect(escapeXml('foo "bar"')).toBe('foo &quot;bar&quot;');
    });

    it('should escape single quotes', () => {
        expect(escapeXml("foo 'bar'")).toBe('foo &apos;bar&apos;');
    });

    it('should escape all special characters', () => {
        expect(escapeXml('<tag attr="value">text & more</tag>')).toBe(
            '&lt;tag attr=&quot;value&quot;&gt;text &amp; more&lt;/tag&gt;'
        );
    });
});

describe('unescapeXml', () => {
    it('should unescape ampersand', () => {
        expect(unescapeXml('foo &amp; bar')).toBe('foo & bar');
    });

    it('should unescape less than', () => {
        expect(unescapeXml('foo &lt; bar')).toBe('foo < bar');
    });

    it('should unescape greater than', () => {
        expect(unescapeXml('foo &gt; bar')).toBe('foo > bar');
    });

    it('should unescape double quotes', () => {
        expect(unescapeXml('foo &quot;bar&quot;')).toBe('foo "bar"');
    });

    it('should unescape single quotes', () => {
        expect(unescapeXml('foo &apos;bar&apos;')).toBe("foo 'bar'");
    });

    it('should be the inverse of escapeXml', () => {
        const original = '<tag attr="value">text & more</tag>';
        expect(unescapeXml(escapeXml(original))).toBe(original);
    });
});

describe('removeIncompatibleCharacters', () => {
    it('should replace null character with space', () => {
        expect(removeIncompatibleCharacters('foo\x00bar')).toBe('foo bar');
    });

    it('should replace vertical tab with space', () => {
        expect(removeIncompatibleCharacters('foo\x0bbar')).toBe('foo bar');
    });

    it('should replace form feed with space', () => {
        expect(removeIncompatibleCharacters('foo\x0cbar')).toBe('foo bar');
    });

    it('should keep newline and carriage return', () => {
        expect(removeIncompatibleCharacters('foo\n\rbar')).toBe('foo\n\rbar');
    });

    it('should keep normal text unchanged', () => {
        expect(removeIncompatibleCharacters('Hello, World!')).toBe('Hello, World!');
    });
});

describe('connectId', () => {
    it('should return a 32-character hex string', () => {
        const id = connectId();
        expect(id).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should not contain dashes', () => {
        const id = connectId();
        expect(id).not.toContain('-');
    });

    it('should generate unique IDs', () => {
        const id1 = connectId();
        const id2 = connectId();
        expect(id1).not.toBe(id2);
    });
});

describe('splitTextByByteLength', () => {
    it('should yield single chunk for short text', () => {
        const chunks = Array.from(splitTextByByteLength('Hello, World!', 100));
        expect(chunks.length).toBe(1);
        expect(new TextDecoder().decode(chunks[0])).toBe('Hello, World!');
    });

    it('should split long text at spaces', () => {
        const text = 'Hello World Foo Bar';
        const chunks = Array.from(splitTextByByteLength(text, 12));
        // Should split at word boundaries
        expect(chunks.length).toBeGreaterThan(1);
        // All chunks should be valid UTF-8
        for (const chunk of chunks) {
            expect(() => new TextDecoder().decode(chunk)).not.toThrow();
        }
    });

    it('should handle UTF-8 multibyte characters correctly', () => {
        // Chinese characters are 3 bytes each in UTF-8
        const text = '你好世界';
        const chunks = Array.from(splitTextByByteLength(text, 7));
        // Each chunk should be valid UTF-8
        for (const chunk of chunks) {
            expect(() => new TextDecoder().decode(chunk)).not.toThrow();
        }
    });

    it('should throw for zero byte length', () => {
        expect(() => Array.from(splitTextByByteLength('test', 0))).toThrow();
    });

    it('should throw for negative byte length', () => {
        expect(() => Array.from(splitTextByByteLength('test', -1))).toThrow();
    });

    it('should split at newlines preferentially', () => {
        const text = 'Hello\nWorld\nFoo';
        const chunks = Array.from(splitTextByByteLength(text, 8));
        // Should split at newlines
        for (const chunk of chunks) {
            const decoded = new TextDecoder().decode(chunk);
            // Each chunk should be a single word (split at newlines)
            expect(decoded.trim().split('\n').length).toBeLessThanOrEqual(2);
        }
    });

    it('should preserve XML entities when splitting', () => {
        const text = 'Hello &amp; World';
        const chunks = Array.from(splitTextByByteLength(text, 20));
        const combined = chunks.map(c => new TextDecoder().decode(c)).join('');
        // Entity should not be broken
        expect(combined).toContain('&amp;');
    });

    it('should handle text that fits exactly in byte length', () => {
        const text = 'Hello';
        const chunks = Array.from(splitTextByByteLength(text, 5));
        expect(chunks.length).toBe(1);
        expect(new TextDecoder().decode(chunks[0])).toBe('Hello');
    });

    it('should handle empty string', () => {
        const chunks = Array.from(splitTextByByteLength('', 100));
        expect(chunks.length).toBe(0);
    });

    it('should handle whitespace-only string', () => {
        const chunks = Array.from(splitTextByByteLength('   ', 100));
        expect(chunks.length).toBe(0);
    });
});

describe('mkssml', () => {
    it('should create valid SSML', () => {
        const config: TTSConfig = {
            voice: 'en-US-JennyNeural',
            rate: '+0%',
            volume: '+0%',
            pitch: '+0Hz',
            boundary: 'SentenceBoundary',
        };
        const ssml = mkssml(config, 'Hello, World!');
        expect(ssml).toContain("<speak version='1.0'");
        expect(ssml).toContain("name='en-US-JennyNeural'");
        expect(ssml).toContain("pitch='+0Hz'");
        expect(ssml).toContain("rate='+0%'");
        expect(ssml).toContain("volume='+0%'");
        expect(ssml).toContain('Hello, World!');
        expect(ssml).toContain('</speak>');
    });
});

describe('dateToString', () => {
    it('should return a JavaScript-style date string', () => {
        const dateStr = dateToString();
        // Should match format: "Sun Jan 01 2023 00:00:00 GMT+0000 (Coordinated Universal Time)"
        expect(dateStr).toMatch(
            /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT\+0000 \(Coordinated Universal Time\)$/
        );
    });
});

describe('ssmlHeadersPlusData', () => {
    it('should create proper request headers with SSML data', () => {
        const requestId = 'abc123';
        const timestamp = dateToString();
        const ssml = '<speak>Hello</speak>';
        const result = ssmlHeadersPlusData(requestId, timestamp, ssml);

        expect(result).toContain('X-RequestId:abc123');
        expect(result).toContain('Content-Type:application/ssml+xml');
        expect(result).toContain(`X-Timestamp:${timestamp}Z`);
        expect(result).toContain('Path:ssml');
        expect(result).toContain('<speak>Hello</speak>');
    });
});

describe('getHeadersAndData', () => {
    it('should parse headers and data from binary message', () => {
        const headerText = 'Path:audio\r\nContent-Type:audio/mpeg';
        const audioData = new Uint8Array([1, 2, 3, 4, 5]);
        const separator = new Uint8Array([13, 10]); // \r\n

        const combined = new Uint8Array([
            ...new TextEncoder().encode(headerText),
            ...separator,
            ...audioData,
        ]);

        const headerLength = headerText.length;
        const result = getHeadersAndData(combined, headerLength);

        expect(result.headers['Path']).toBe('audio');
        expect(result.headers['Content-Type']).toBe('audio/mpeg');
        expect(result.data).toEqual(audioData);
    });
});
