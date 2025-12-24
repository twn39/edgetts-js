/**
 * Custom exceptions for edge-tts package.
 */

/**
 * Base exception for the edge-tts package.
 */
export class EdgeTTSException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdgeTTSException';
  }
}

/**
 * Raised when an unknown response is received from the server.
 */
export class UnknownResponse extends EdgeTTSException {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownResponse';
  }
}

/**
 * Raised when an unexpected response is received from the server.
 * This hasn't happened yet, but it's possible that the server will
 * change its response format in the future.
 */
export class UnexpectedResponse extends EdgeTTSException {
  constructor(message: string) {
    super(message);
    this.name = 'UnexpectedResponse';
  }
}

/**
 * Raised when no audio is received from the server.
 */
export class NoAudioReceived extends EdgeTTSException {
  constructor(message: string) {
    super(message);
    this.name = 'NoAudioReceived';
  }
}

/**
 * Raised when a WebSocket error occurs.
 */
export class WebSocketError extends EdgeTTSException {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketError';
  }
}

/**
 * Raised when an error occurs while adjusting the clock skew.
 */
export class SkewAdjustmentError extends EdgeTTSException {
  constructor(message: string) {
    super(message);
    this.name = 'SkewAdjustmentError';
  }
}