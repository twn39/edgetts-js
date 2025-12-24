/**
 * Tests for DRM class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DRM } from '../drm';

describe('DRM', () => {
    beforeEach(() => {
        // Reset clock skew before each test
        // Access private field for testing
        (DRM as unknown as { clockSkewSeconds: number }).clockSkewSeconds = 0;
    });

    describe('generateSecMsGec', () => {
        it('should return a 64-character uppercase hex string', async () => {
            const token = await DRM.generateSecMsGec();
            expect(token).toMatch(/^[A-F0-9]{64}$/);
        });

        it('should return the same token within a 5-minute window', async () => {
            const token1 = await DRM.generateSecMsGec();
            const token2 = await DRM.generateSecMsGec();
            expect(token1).toBe(token2);
        });
    });

    describe('generateMuid', () => {
        it('should return a 32-character uppercase hex string', () => {
            const muid = DRM.generateMuid();
            expect(muid).toMatch(/^[A-F0-9]{32}$/);
        });

        it('should generate unique MUIDs', () => {
            const muid1 = DRM.generateMuid();
            const muid2 = DRM.generateMuid();
            expect(muid1).not.toBe(muid2);
        });
    });

    describe('parseRFC2616Date', () => {
        it('should parse valid RFC 2616 date', () => {
            const date = 'Wed, 21 Oct 2015 07:28:00 GMT';
            const timestamp = DRM.parseRFC2616Date(date);
            expect(timestamp).toBeTypeOf('number');
            expect(timestamp).toBeGreaterThan(0);
        });

        it('should return null for invalid date', () => {
            const timestamp = DRM.parseRFC2616Date('not a date');
            expect(timestamp).toBeNull();
        });
    });

    describe('adjustClockSkewSeconds', () => {
        it('should accumulate clock skew adjustments', () => {
            const before = DRM.getUnixTimestamp();
            DRM.adjustClockSkewSeconds(10);
            const after = DRM.getUnixTimestamp();
            // Should be approximately 10 seconds ahead
            expect(after - before).toBeGreaterThanOrEqual(9);
            expect(after - before).toBeLessThanOrEqual(11);
        });
    });

    describe('getUnixTimestamp', () => {
        it('should return current timestamp with clock skew', () => {
            const timestamp = DRM.getUnixTimestamp();
            const now = Date.now() / 1000;
            // Should be within 1 second of actual time (when skew is 0)
            expect(Math.abs(timestamp - now)).toBeLessThan(1);
        });
    });

    describe('headersWithMuid', () => {
        it('should add Cookie header with MUID', () => {
            const headers = { 'User-Agent': 'Test' };
            const result = DRM.headersWithMuid(headers);

            expect(result['Cookie']).toMatch(/^muid=[A-F0-9]{32};$/);
            expect(result['User-Agent']).toBe('Test');
        });

        it('should not modify original headers', () => {
            const headers = { 'User-Agent': 'Test' };
            DRM.headersWithMuid(headers);

            expect(headers).not.toHaveProperty('Cookie');
        });

        it('should throw if Cookie header already exists', () => {
            const headers = { 'Cookie': 'existing=value' };
            expect(() => DRM.headersWithMuid(headers)).toThrow();
        });
    });

    describe('handleClientResponseError', () => {
        it('should adjust clock skew with valid server date', () => {
            const mockHeaders = new Headers();
            mockHeaders.set('Date', 'Wed, 21 Oct 2015 07:28:00 GMT');

            // Reset skew first
            (DRM as unknown as { clockSkewSeconds: number }).clockSkewSeconds = 0;

            // This should adjust the clock skew
            DRM.handleClientResponseError(mockHeaders);

            // Clock skew should now be non-zero (adjusted to the 2015 date)
            const skew = (DRM as unknown as { clockSkewSeconds: number }).clockSkewSeconds;
            expect(skew).not.toBe(0);
        });

        it('should throw if no Date header', () => {
            const mockHeaders = new Headers();

            expect(() => DRM.handleClientResponseError(mockHeaders)).toThrow('No server date in headers');
        });

        it('should throw if Date header is invalid', () => {
            const mockHeaders = new Headers();
            mockHeaders.set('Date', 'invalid date format');

            expect(() => DRM.handleClientResponseError(mockHeaders)).toThrow('Failed to parse server date');
        });
    });
});
