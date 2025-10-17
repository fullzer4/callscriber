import { Elysia } from 'elysia'
import { sessionManager } from '../core/sessionManager'
import { OpenAIRealtime } from '../core/openaiRealtime'
import { createLogger } from '../shared/logger'
import type {
  TranscriptDeltaMessage,
  TranscriptFinalMessage,
} from '../models/ApiSchemas'

/**
 * WebSocket handler for streaming transcript to clients
 * 
 * Protocol:
 * Server -> Client:
 *   - transcript.delta: Partial transcription results
 *   - transcript.final: Final transcription segments
 *   - chunk.saved: Notification when chunk is saved (debug)
 *   - session.closed: Session has ended
 */
export const transcriptWebSocket = new Elysia()
  .ws('/sessions/:id/transcript', {
    open(ws) {
      const sessionId = ws.data.params.id
      const log = createLogger({ component: 'ws.transcript', sessionId })

      const session = sessionManager.getSession(sessionId)
      if (!session) {
        log.error('Session not found')
        ws.close(1008, 'Session not found')
        return
      }

      if (session.mode !== 'realtime') {
        log.error('Session is not in realtime mode')
        ws.close(1008, 'Session is not in realtime mode')
        return
      }

      log.info('Transcript WebSocket connected');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws as any).sessionId = sessionId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws as any).log = log

      const realtimeClient = new OpenAIRealtime(sessionId)

      realtimeClient.on('transcript.delta', (event: unknown) => {
        ws.send(JSON.stringify(event as TranscriptDeltaMessage))
      })

      realtimeClient.on('transcript.final', (event: unknown) => {
        ws.send(JSON.stringify(event as TranscriptFinalMessage))
      })

      realtimeClient.connect()
      log.info('Connected to OpenAI Realtime API');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws as any).realtimeClient = realtimeClient
    },

    message(ws, message) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log = (ws as any).log as ReturnType<typeof createLogger>
      
      log.debug({ message }, 'Received unexpected message from client')
    },

    close(ws, code, reason) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log = (ws as any).log as ReturnType<typeof createLogger>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const realtimeClient = (ws as any).realtimeClient as OpenAIRealtime | undefined

      if (realtimeClient) {
        realtimeClient.disconnect()
      }

      log.info({ code, reason }, 'Transcript WebSocket disconnected')
    },
  })