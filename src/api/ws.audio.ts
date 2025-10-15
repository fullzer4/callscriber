import { Elysia } from 'elysia'
import { sessionManager } from '../core/sessionManager.js'
import { ChunkMetaSchema, type ChunkMetaMessage, type ChunkAckMessage } from '../models/ApiSchemas.js'
import { createLogger } from '../shared/logger.js'

/**
 * WebSocket handler for receiving audio chunks
 * 
 * Protocol:
 * Client -> Server:
 *   1. JSON message with chunk metadata (ChunkMeta)
 *   2. Binary message with audio data (ArrayBuffer)
 * 
 * Server -> Client:
 *   - ACK message after successfully saving chunk
 */
export const audioWebSocket = new Elysia()
  .ws('/sessions/:id/audio', {
    open(ws) {
      const sessionId = ws.data.params.id
      const log = createLogger({ component: 'ws.audio', sessionId })

      if (!sessionManager.hasSession(sessionId)) {
        log.error('Session not found')
        ws.close(1008, 'Session not found')
        return
      }

      sessionManager.updateSessionStatus(sessionId, 'active')

      log.info('Audio WebSocket connected');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws as any).sessionId = sessionId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws as any).log = log;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws as any).pendingMeta = null
    },

    message(ws, message) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log = (ws as any).log as ReturnType<typeof createLogger>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionId = (ws as any).sessionId as string

      try {
        if (typeof message === 'string') {
          const meta = JSON.parse(message) as ChunkMetaMessage
          const validated = ChunkMetaSchema.parse(meta)

          log.debug({ seq: validated.seq }, 'Received chunk metadata');

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ws as any).pendingMeta = validated
        } else if (message instanceof ArrayBuffer || Buffer.isBuffer(message)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pendingMeta = (ws as any).pendingMeta as ChunkMetaMessage | null

          if (!pendingMeta) {
            log.error('Received binary data without metadata')
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Binary data received without metadata',
              }),
            )
            return
          }

          const buffer = Buffer.isBuffer(message)
            ? message
            : Buffer.from(message)

          if (buffer.length !== pendingMeta.len) {
            log.error(
              { expected: pendingMeta.len, received: buffer.length },
              'Length mismatch',
            )
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Length mismatch',
              }),
            )
            return
          }

          const chunkWriter = sessionManager.getChunkWriter(sessionId)
          if (!chunkWriter) {
            log.error('Chunk writer not found')
            ws.close(1011, 'Internal error')
            return
          }

          chunkWriter
            .writeChunk(pendingMeta, buffer)
            .then(() => {
              const ack: ChunkAckMessage = {
                type: 'chunk.ack',
                seq: pendingMeta.seq,
                received_at: Date.now(),
              }

              ws.send(JSON.stringify(ack))

              const session = sessionManager.getSession(sessionId)
              if (session) {
                sessionManager.updateSessionStats(
                  sessionId,
                  session.stats.chunksReceived + 1,
                  session.stats.bytesReceived + buffer.length,
                  session.stats.totalDurationMs + pendingMeta.durMs,
                )
              }

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (ws as any).pendingMeta = null
            })
            .catch((error: unknown) => {
              const err = error as Error
              log.error({ error: err, seq: pendingMeta.seq }, 'Failed to write chunk')
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: 'Failed to save chunk',
                  seq: pendingMeta.seq,
                }),
              )
            })
        } else {
          log.warn({ messageType: typeof message }, 'Unknown message type')
        }
      } catch (error: unknown) {
        const err = error as Error
        log.error({ error: err }, 'Error processing message')
        ws.send(
          JSON.stringify({
            type: 'error',
            message: err.message || 'Internal error',
          }),
        )
      }
    },

    close(ws, code, reason) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log = (ws as any).log as ReturnType<typeof createLogger>
      log.info({ code, reason }, 'Audio WebSocket disconnected')
    },
  })
