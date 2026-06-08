import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';

export interface SSEMessage {
  event: string;
  data: string;
}

export class SSEClient extends EventEmitter {
  private url: string;
  private options: http.RequestOptions;
  private req: http.ClientRequest | null = null;
  private buffer: string = '';
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(url: string, options: http.RequestOptions = {}) {
    super();
    this.url = url;
    this.options = {
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...options.headers,
      },
      timeout: 30000,
      ...options,
    };

    this.on('error', () => {});
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(this.url);
        const isHttps = urlObj.protocol === 'https:';

        const client = isHttps ? https : http;

        this.req = client.request(urlObj, this.options, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`SSE connection failed with status ${res.statusCode}`));
            return;
          }

          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();

          res.on('data', (chunk: Buffer) => {
            this.buffer += chunk.toString();
            this.processBuffer();
          });

          res.on('end', () => {
            this.connected = false;
            this.emit('disconnected');
            this.attemptReconnect();
          });

          res.on('error', (error: Error) => {
            this.connected = false;
            this.emit('error', error);
            this.attemptReconnect();
          });
        });

        this.req.on('error', (error: Error) => {
          this.connected = false;
          this.emit('error', error);
          this.attemptReconnect();
        });

        this.req.on('timeout', () => {
          this.req?.destroy();
          this.emit('timeout');
        });

        this.req.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    let currentEvent = 'message';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        currentData += line.slice(5).trim();
      } else if (line === '') {
        if (currentData) {
          const message: SSEMessage = {
            event: currentEvent,
            data: currentData,
          };
          this.emit('message', message);
          this.emit(currentEvent, currentData);
        }
        currentEvent = 'message';
        currentData = '';
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      delay,
    });

    setTimeout(() => {
      this.connect().catch(() => {
        // reconnect failed, will try again
      });
    }, delay);
  }

  public disconnect(): void {
    this.maxReconnectAttempts = 0;
    if (this.req) {
      this.req.destroy();
      this.req = null;
    }
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}
