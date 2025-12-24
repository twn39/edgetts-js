/**
 * Communicate with the service. Only the Communicate class should be used by
 * end-users. The other classes and functions are for internal use only.
 */

import { DEFAULT_VOICE, SEC_MS_GEC_VERSION, WSS_HEADERS, WSS_URL } from './constants';
import { TTSChunk, TTSChunkMetadata, TTSConfig, CommunicateOptions, CommunicateState } from './types';
import { DRM } from './drm';
import {
  connectId,
  dateToString,
  escapeXml,
  getHeadersAndData,
  mkssml,
  removeIncompatibleCharacters,
  splitTextByByteLength,
  ssmlHeadersPlusData,
  unescapeXml,
} from './utils';
import {
  UnknownResponse,
  UnexpectedResponse,
  NoAudioReceived,
  WebSocketError,
} from './exceptions';

/**
 * Validates and normalizes the voice parameter.
 */
function validateVoice(voice: string): string {
  const match = voice.match(/^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/);
  if (match !== null) {
    const lang = match[1];
    let region = match[2];
    let name = match[3];

    if (name.includes('-')) {
      region = `${region}-${name.substring(0, name.indexOf('-'))}`;
      name = name.substring(name.indexOf('-') + 1);
    }

    return `Microsoft Server Speech Text to Speech Voice (${lang}-${region}, ${name})`;
  }

  // Validate the voice format
  const voicePattern = /^Microsoft Server Speech Text to Speech Voice \(.+,.+\)$/;
  if (!voicePattern.test(voice)) {
    throw new Error(`Invalid voice '${voice}'.`);
  }

  return voice;
}

/**
 * Validates TTS configuration parameters.
 */
function validateTTSConfig(config: TTSConfig): void {
  config.voice = validateVoice(config.voice);

  const ratePattern = /^[+-]\d+%$/;
  if (!ratePattern.test(config.rate)) {
    throw new Error(`Invalid rate '${config.rate}'.`);
  }

  const volumePattern = /^[+-]\d+%$/;
  if (!volumePattern.test(config.volume)) {
    throw new Error(`Invalid volume '${config.volume}'.`);
  }

  const pitchPattern = /^[+-]\d+Hz$/;
  if (!pitchPattern.test(config.pitch)) {
    throw new Error(`Invalid pitch '${config.pitch}'.`);
  }
}

/**
 * Communicate class for streaming audio and metadata from the Edge TTS service.
 */
export class Communicate {
  private ttsConfig: TTSConfig;
  private texts: Generator<Uint8Array>;
  private proxy?: string;
  private connectTimeout: number;
  private receiveTimeout: number;
  private state: CommunicateState;

  /**
   * Creates a new Communicate instance.
   * @param text - The text to convert to speech.
   * @param options - Optional configuration options.
   */
  constructor(text: string, options: CommunicateOptions = {}) {
    // Validate and create TTS configuration
    this.ttsConfig = {
      voice: options.voice ?? DEFAULT_VOICE,
      rate: options.rate ?? '+0%',
      volume: options.volume ?? '+0%',
      pitch: options.pitch ?? '+0Hz',
      boundary: options.boundary ?? 'SentenceBoundary',
    };
    validateTTSConfig(this.ttsConfig);

    // Validate the text parameter
    if (typeof text !== 'string') {
      throw new TypeError('text must be string');
    }

    // Split the text into multiple chunks
    this.texts = splitTextByByteLength(
      escapeXml(removeIncompatibleCharacters(text)),
      4096
    );

    // Validate the proxy parameter
    if (options.proxy !== undefined && typeof options.proxy !== 'string') {
      throw new TypeError('proxy must be string');
    }
    this.proxy = options.proxy;

    // Validate the timeout parameters
    this.connectTimeout = options.connectTimeout ?? 10;
    this.receiveTimeout = options.receiveTimeout ?? 60;

    // Store current state of TTS
    this.state = {
      partialText: new Uint8Array(0),
      offsetCompensation: 0,
      lastDurationOffset: 0,
      streamWasCalled: false,
    };
  }

  /**
   * Parse metadata from the received data.
   */
  private parseMetadata(data: Uint8Array): TTSChunkMetadata {
    const text = new TextDecoder().decode(data);
    const json = JSON.parse(text);

    for (const metaObj of json.Metadata) {
      const metaType = metaObj.Type;
      if (metaType === 'WordBoundary' || metaType === 'SentenceBoundary') {
        const currentOffset = metaObj.Data.Offset + this.state.offsetCompensation;
        const currentDuration = metaObj.Data.Duration;
        return {
          type: metaType,
          offset: currentOffset,
          duration: currentDuration,
          text: unescapeXml(metaObj.Data.text.Text),
        };
      }
      if (metaType === 'SessionEnd') {
        continue;
      }
      throw new UnknownResponse(`Unknown metadata type: ${metaType}`);
    }
    throw new UnexpectedResponse('No WordBoundary metadata found');
  }

  /**
   * Internal stream method that handles a single WebSocket connection.
   */
  private async* streamInternal(): AsyncGenerator<TTSChunk, void, unknown> {
    // audioWasReceived indicates whether we have received audio data
    let audioWasReceived = false;

    // Build WebSocket URL
    const secMsGec = await DRM.generateSecMsGec();
    const wsUrl = `${WSS_URL}&ConnectionId=${connectId()}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);

    // Set binary type to arraybuffer (browser default is blob)
    ws.binaryType = 'arraybuffer';

    // Note: WebSocket API doesn't support custom headers in browser
    // We rely on URL parameters for authentication

    // Create a promise that resolves when the WebSocket is ready
    const readyPromise = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (error) => reject(new WebSocketError(error?.toString() ?? 'Unknown error'));
      ws.onclose = (event) => {
        if (event.code !== 1000) {
          reject(new WebSocketError(`WebSocket closed with code ${event.code}`));
        }
      };
    });

    // Wait for connection
    await readyPromise;

    // Send command request
    const wordBoundary = this.ttsConfig.boundary === 'WordBoundary';
    const wd = wordBoundary ? 'true' : 'false';
    const sq = !wordBoundary ? 'true' : 'false';

    const commandRequest = (
      `X-Timestamp:${dateToString()}\r\n` +
      'Content-Type:application/json; charset=utf-8\r\n' +
      'Path:speech.config\r\n\r\n' +
      '{"context":{"synthesis":{"audio":{"metadataoptions":{' +
      `"sentenceBoundaryEnabled":"${sq}","wordBoundaryEnabled":"${wd}"` +
      '},' +
      '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"' +
      '}}}}\r\n'
    );
    ws.send(commandRequest);

    // Send SSML request
    const partialTextStr = new TextDecoder().decode(this.state.partialText);
    const ssmlRequest = ssmlHeadersPlusData(
      connectId(),
      dateToString(),
      mkssml(this.ttsConfig, partialTextStr)
    );
    ws.send(ssmlRequest);

    // Create a message queue for yielding messages
    const messageQueue: TTSChunk[] = [];
    let resolvePromise: (() => void) | null = null;
    let rejectPromise: ((error: Error) => void) | null = null;

    // Set up message handler
    ws.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          // TEXT message
          const encodedData = new TextEncoder().encode(event.data);
          const headerEnd = encodedData.findIndex((_, i, arr) =>
            i + 3 < arr.length && arr[i] === 13 && arr[i + 1] === 10 && arr[i + 2] === 13 && arr[i + 3] === 10
          );

          if (headerEnd === -1) {
            if (rejectPromise) {
              rejectPromise(new UnexpectedResponse('Could not find header end in text message'));
            }
            return;
          }

          const { headers, data } = getHeadersAndData(encodedData, headerEnd);
          const path = headers['Path'];

          if (path === 'audio.metadata') {
            // Parse the metadata and add to queue
            const parsedMetadata = this.parseMetadata(data);
            messageQueue.push(parsedMetadata);

            // Update the last duration offset for use by the next SSML request
            this.state.lastDurationOffset = parsedMetadata.offset + parsedMetadata.duration;
          } else if (path === 'turn.end') {
            // Update the offset compensation for the next SSML request
            this.state.offsetCompensation = this.state.lastDurationOffset;

            // Use average padding typically added by the service
            this.state.offsetCompensation += 8_750_000;

            // Signal that we're done with this chunk
            if (resolvePromise) {
              resolvePromise();
            }
          } else if (path !== 'response' && path !== 'turn.start') {
            if (rejectPromise) {
              rejectPromise(new UnknownResponse(`Unknown path received: ${path}`));
            }
          }
        } else {
          // BINARY message
          const data = event.data as ArrayBuffer;
          const dataArray = new Uint8Array(data);

          // Message is too short to contain header length
          if (dataArray.length < 2) {
            if (rejectPromise) {
              rejectPromise(new UnexpectedResponse(
                'We received a binary message, but it is missing the header length.'
              ));
            }
            return;
          }

          // The first two bytes of the binary message contain the header length
          const headerLength = (dataArray[0] << 8) | dataArray[1];
          if (headerLength > dataArray.length) {
            if (rejectPromise) {
              rejectPromise(new UnexpectedResponse(
                'The header length is greater than the length of the data.'
              ));
            }
            return;
          }

          // Parse the headers and data from the binary message
          const { headers, data: audioData } = getHeadersAndData(dataArray, headerLength);

          // Check if the path is audio
          if (headers['Path'] !== 'audio') {
            if (rejectPromise) {
              rejectPromise(new UnexpectedResponse(
                'Received binary message, but the path is not audio.'
              ));
            }
            return;
          }

          // At termination of the stream, the service sends a binary message
          // with no Content-Type; this is expected
          const contentType = headers['Content-Type'];
          if (contentType !== 'audio/mpeg' && contentType !== undefined) {
            if (rejectPromise) {
              rejectPromise(new UnexpectedResponse(
                'Received binary message, but with an unexpected Content-Type.'
              ));
            }
            return;
          }

          // We only allow no Content-Type if there is no data
          if (contentType === undefined) {
            if (audioData.length === 0) {
              return;
            }

            // If the data is not empty, then we need to raise an exception
            if (rejectPromise) {
              rejectPromise(new UnexpectedResponse(
                'Received binary message with no Content-Type, but with data.'
              ));
            }
            return;
          }

          // If the data is empty now, then we need to raise an exception
          if (audioData.length === 0) {
            if (rejectPromise) {
              rejectPromise(new UnexpectedResponse(
                'Received binary message, but it is missing the audio data.'
              ));
            }
            return;
          }

          // Add audio data to queue
          audioWasReceived = true;
          messageQueue.push({ type: 'audio', data: audioData });
        }
      } catch (error) {
        if (rejectPromise) {
          rejectPromise(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    ws.onerror = (error) => {
      if (rejectPromise) {
        rejectPromise(new WebSocketError(error?.toString() ?? 'Unknown error'));
      }
    };

    // Create a promise that resolves when we receive turn.end
    const messagePromise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // Yield messages from the queue
    while (true) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else {
        // Check if we're done
        const done = await Promise.race([
          messagePromise.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10)),
        ]);

        if (done) {
          // Yield any remaining messages
          while (messageQueue.length > 0) {
            yield messageQueue.shift()!;
          }
          break;
        }
      }
    }

    // Close the WebSocket
    ws.close();

    if (!audioWasReceived) {
      throw new NoAudioReceived(
        'No audio was received. Please verify that your parameters are correct.'
      );
    }
  }

  /**
   * Streams audio and metadata from the service.
   * @returns An async generator that yields TTS chunks.
   */
  async* stream(): AsyncGenerator<TTSChunk, void, unknown> {
    // Check if stream was called before
    if (this.state.streamWasCalled) {
      throw new Error('stream can only be called once.');
    }
    this.state.streamWasCalled = true;

    // Stream the audio and metadata from the service
    for (const partialText of this.texts) {
      this.state.partialText = partialText;
      try {
        yield* this.streamInternal();
      } catch (error) {
        // Handle 403 errors by retrying with adjusted clock skew
        if (error instanceof WebSocketError && error.message.includes('403')) {
          // In browser, we can't easily access response headers
          // We'll just retry once
          yield* this.streamInternal();
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Save the audio and metadata to the specified files.
   * @param audioData - Array to store audio data chunks.
   * @param metadataData - Optional array to store metadata chunks.
   */
  async save(audioData: Uint8Array[], metadataData?: TTSChunk[]): Promise<void> {
    for await (const chunk of this.stream()) {
      if (chunk.type === 'audio') {
        audioData.push(chunk.data);
      } else if (metadataData && (chunk.type === 'WordBoundary' || chunk.type === 'SentenceBoundary')) {
        metadataData.push(chunk);
      }
    }
  }
}