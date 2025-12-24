/**
 * Tests for exception classes
 */

import { describe, it, expect } from 'vitest';
import {
    EdgeTTSException,
    UnknownResponse,
    UnexpectedResponse,
    NoAudioReceived,
    WebSocketError,
    SkewAdjustmentError,
} from '../exceptions';

describe('EdgeTTSException', () => {
    it('should be instance of Error', () => {
        const error = new EdgeTTSException('test');
        expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
        const error = new EdgeTTSException('test');
        expect(error.name).toBe('EdgeTTSException');
    });

    it('should have correct message', () => {
        const error = new EdgeTTSException('test message');
        expect(error.message).toBe('test message');
    });
});

describe('UnknownResponse', () => {
    it('should extend EdgeTTSException', () => {
        const error = new UnknownResponse('test');
        expect(error).toBeInstanceOf(EdgeTTSException);
    });

    it('should have correct name property', () => {
        const error = new UnknownResponse('test');
        expect(error.name).toBe('UnknownResponse');
    });
});

describe('UnexpectedResponse', () => {
    it('should extend EdgeTTSException', () => {
        const error = new UnexpectedResponse('test');
        expect(error).toBeInstanceOf(EdgeTTSException);
    });

    it('should have correct name property', () => {
        const error = new UnexpectedResponse('test');
        expect(error.name).toBe('UnexpectedResponse');
    });
});

describe('NoAudioReceived', () => {
    it('should extend EdgeTTSException', () => {
        const error = new NoAudioReceived('test');
        expect(error).toBeInstanceOf(EdgeTTSException);
    });

    it('should have correct name property', () => {
        const error = new NoAudioReceived('test');
        expect(error.name).toBe('NoAudioReceived');
    });
});

describe('WebSocketError', () => {
    it('should extend EdgeTTSException', () => {
        const error = new WebSocketError('test');
        expect(error).toBeInstanceOf(EdgeTTSException);
    });

    it('should have correct name property', () => {
        const error = new WebSocketError('test');
        expect(error.name).toBe('WebSocketError');
    });
});

describe('SkewAdjustmentError', () => {
    it('should extend EdgeTTSException', () => {
        const error = new SkewAdjustmentError('test');
        expect(error).toBeInstanceOf(EdgeTTSException);
    });

    it('should have correct name property', () => {
        const error = new SkewAdjustmentError('test');
        expect(error.name).toBe('SkewAdjustmentError');
    });
});
