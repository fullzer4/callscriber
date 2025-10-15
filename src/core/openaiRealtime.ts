import WebSocket from 'ws'
import { config } from '../config/index'
import { createLogger } from '../shared/logger'

export class OpenAIRealtime {
  private sessionId: string
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private logger: ReturnType<typeof createLogger>
  private eventCallbacks: Map<string, (event: unknown) => void> = new Map()

  constructor(sessionId: string) {
    this.sessionId = sessionId
    this.logger = createLogger({ component: 'OpenAIRealtime', sessionId })
  }

  connect(): void {
    try {
      const url = 'wss://api.openai.com/v1/realtime'
      
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${config.openai.apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      })

      this.ws.on('open', () => this.handleOpen())
      this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data))
      this.ws.on('error', (error: Error) => this.handleError(error))
      this.ws.on('close', () => this.handleClose())

      this.logger.info('Connecting to OpenAI Realtime API')
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to Realtime API')
      throw error
    }
  }

  private handleOpen(): void {
    this.logger.info('Connected to OpenAI Realtime API')
    this.reconnectAttempts = 0

    this.send({
      type: 'session.update',
      session: {
        model: config.openai.models.realtime,
        modalities: ['text', 'audio'],
        instructions: 'Transcribe the audio in real-time. Provide incremental results.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: null,
      },
    })
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString())
      
      this.logger.debug({ type: message.type }, 'Received message from Realtime API')

      switch (message.type) {
        case 'session.created':
        case 'session.updated':
          this.handleSessionEvent(message)
          break

        case 'response.audio_transcript.delta':
          this.handleTranscriptDelta(message)
          break

        case 'response.audio_transcript.done':
          this.handleTranscriptDone(message)
          break

        case 'error':
          this.handleErrorEvent(message)
          break

        default:
          this.logger.debug({ type: message.type }, 'Unhandled message type')
      }

      this.emit(message.type, message)
    } catch (error) {
      this.logger.error({ error }, 'Failed to parse message')
    }
  }

  private handleSessionEvent(message: Record<string, unknown>): void {
    this.logger.info({ type: message.type }, 'Session event received')
  }

  private handleTranscriptDelta(message: Record<string, unknown>): void {
    const delta = (message.delta as string) || ''
    const ts = Date.now()

    this.logger.debug({ delta }, 'Transcript delta')

    this.emit('transcript.delta', {
      type: 'transcript.delta',
      text: delta,
      ts,
    })
  }

  private handleTranscriptDone(message: Record<string, unknown>): void {
    const text = (message.transcript as string) || ''
    
    this.logger.debug({ text }, 'Transcript final')

    this.emit('transcript.final', {
      type: 'transcript.final',
      text,
      startTs: (message.start_ts as number) || 0,
      endTs: (message.end_ts as number) || Date.now(),
    })
  }

  private handleErrorEvent(message: Record<string, unknown>): void {
    this.logger.error({ error: message }, 'Error from Realtime API')
  }

  private handleError(error: Error): void {
    this.logger.error({ error }, 'WebSocket error')
  }

  private handleClose(): void {
    this.logger.info('Disconnected from OpenAI Realtime API')

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000)
      
      this.logger.info(
        { attempt: this.reconnectAttempts, delay },
        'Attempting reconnection',
      )

      setTimeout(() => this.connect(), delay)
    } else {
      this.logger.error('Max reconnection attempts reached')
    }
  }

  sendAudio(audioData: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('WebSocket not ready, dropping audio data')
      return
    }

    this.send({
      type: 'input_audio_buffer.append',
      audio: audioData.toString('base64'),
    })
  }

  commitAudio(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    this.send({
      type: 'input_audio_buffer.commit',
    })

    this.send({
      type: 'response.create',
    })
  }

  on(event: string, callback: (data: unknown) => void): void {
    this.eventCallbacks.set(event, callback)
  }

  private emit(event: string, data: unknown): void {
    const callback = this.eventCallbacks.get(event)
    if (callback) {
      callback(data)
    }
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.eventCallbacks.clear()
    this.logger.info('Disconnected')
  }
}
