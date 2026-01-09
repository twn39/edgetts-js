
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Communicate } from '../communicate';
import { WSS_HEADERS } from '../constants';
import WebSocket from 'ws';

// Increase timeout for real network requests
const TIMEOUT = 20000;

// Monkey-patch global WebSocket to inject necessary headers
// @ts-ignore
global.WebSocket = class extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
        // Inject headers that are required for Edge TTS but not set by standard WebSocket API
        super(url, protocols, {
            headers: WSS_HEADERS
        });
    }
} as any;

describe('Real API Test', () => {
    it('should successfully stream audio from Edge TTS service', async () => {
        const text = 'Hello, this is a test.';
        const comm = new Communicate(text);

        const chunks: any[] = [];
        let hasAudio = false;
        let hasMetadata = false;

        try {
            for await (const chunk of comm.stream()) {
                chunks.push(chunk);
                if (chunk.type === 'audio') {
                    hasAudio = true;
                    expect(chunk.data).toBeInstanceOf(Uint8Array);
                    expect(chunk.data.length).toBeGreaterThan(0);
                } else if (chunk.type === 'WordBoundary') {
                    hasMetadata = true;
                    expect(chunk).toHaveProperty('offset');
                    expect(chunk).toHaveProperty('duration');
                    expect(chunk).toHaveProperty('text');
                }
            }
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(hasAudio).toBe(true);
        if (hasMetadata) {
            console.log('Received metadata successfully');
        }
    }, TIMEOUT);
});
