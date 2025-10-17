import { Elysia, t } from 'elysia'
import { sessionManager } from '../core/sessionManager'
import { GoogleMeetJoiner } from '../bot/join.meet'
import { config } from '../config/index'
import { logger } from '../shared/logger'
import {
  CreateSessionRequestSchema,
  type CreateSessionResponse,
  type GetSessionResponse,
  type DeleteSessionResponse,
} from '../models/ApiSchemas'

const activeBots = new Map<string, GoogleMeetJoiner>()

function detectPlatform(url: string): 'meet' | 'zoom' | 'teams' | 'unknown' {
  if (url.includes('meet.google.com')) return 'meet'
  if (url.includes('zoom.us')) return 'zoom'
  if (url.includes('teams.microsoft.com')) return 'teams'
  return 'unknown'
}

async function startBot(sessionId: string, meetingLink: string, wsAudioUrl: string): Promise<void> {
  const platform = detectPlatform(meetingLink)

  logger.info({ sessionId, platform, meetingLink }, 'Starting bot')

  sessionManager.updateSessionStatus(sessionId, 'joining')

  try {
    if (platform === 'meet') {
      const meetJoiner = new GoogleMeetJoiner(sessionId, meetingLink)
      activeBots.set(sessionId, meetJoiner)

      await meetJoiner.join(wsAudioUrl)

      sessionManager.updateSessionStatus(sessionId, 'active')

      logger.info({ sessionId }, 'Bot successfully joined meeting')
    } else {
      throw new Error(`Platform ${platform} not supported yet. Only Google Meet is currently supported.`)
    }
  } catch (error) {
    logger.error({ sessionId, error }, 'Bot failed to join meeting')
    sessionManager.updateSessionStatus(sessionId, 'error')
    throw error
  }
}

export const sessionsRoutes = new Elysia({ prefix: '/api/sessions' })

  .post(
    '/',
    async ({ body, set }) => {
      try {
        const validated = CreateSessionRequestSchema.parse(body)

        const session = await sessionManager.createSession(
          validated.meeting_link,
          validated.mode,
        )

        // Build WebSocket URLs
        // Use localhost for bot to avoid mixed content issues with HTTPS pages
        const publicHost = `${config.server.host}:${config.server.port}`
        const botHost = `localhost:${config.server.port}`
        const wsAudioUrl = `ws://${botHost}/sessions/${session.id}/audio`
        const wsTranscriptUrl =
          session.mode === 'realtime'
            ? `ws://${publicHost}/sessions/${session.id}/transcript`
            : undefined

        const response: CreateSessionResponse = {
          session_id: session.id,
          status: session.status,
          ws_audio_url: `ws://${publicHost}/sessions/${session.id}/audio`,
          ws_transcript_url: wsTranscriptUrl,
        }

        startBot(session.id, validated.meeting_link, wsAudioUrl)
          .catch((error) => {
            logger.error({ sessionId: session.id, error }, 'Failed to start bot')
            sessionManager.setSessionError(session.id, 'Failed to join meeting', 'BOT_JOIN_FAILED')
          })

        set.status = 201
        return response
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create session'
        logger.error({ error }, 'Failed to create session')
        set.status = 400
        return {
          error: 'Bad Request',
          message: errorMessage,
        }
      }
    },
    {
      body: t.Object({
        meeting_link: t.String(),
        mode: t.Optional(t.Union([t.Literal('realtime'), t.Literal('record')])),
      }),
    },
  )

  .get('/:id', ({ params, set }) => {
    const session = sessionManager.getSession(params.id)

    if (!session) {
      set.status = 404
      return {
        error: 'Not Found',
        message: `Session ${params.id} not found`,
      }
    }

    const response: GetSessionResponse = {
      id: session.id,
      mode: session.mode,
      status: session.status,
      meeting_link: session.meetingLink,
      created_at: session.createdAt,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      stats: {
        chunks_received: session.stats.chunksReceived,
        bytes_received: session.stats.bytesReceived,
        total_duration_ms: session.stats.totalDurationMs,
      },
      error: session.error,
    }

    return response
  })

  .get('/', () => {
    const sessions = sessionManager.getAllSessions()

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        mode: s.mode,
        status: s.status,
        created_at: s.createdAt,
        started_at: s.startedAt,
        ended_at: s.endedAt,
      })),
      count: sessions.length,
    }
  })

  .delete('/:id', async ({ params, set }) => {
    try {
      const session = sessionManager.getSession(params.id)

      if (!session) {
        set.status = 404
        return {
          error: 'Not Found',
          message: `Session ${params.id} not found`,
        }
      }

      const bot = activeBots.get(params.id)
      if (bot) {
        try {
          await bot.leave()
          activeBots.delete(params.id)
          logger.info({ sessionId: params.id }, 'Bot stopped')
        } catch (error) {
          logger.error({ sessionId: params.id, error }, 'Error stopping bot')
        }
      }

      await sessionManager.deleteSession(params.id)

      const response: DeleteSessionResponse = {
        success: true,
        message: `Session ${params.id} deleted successfully`,
      }

      return response
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete session'
      logger.error({ error, sessionId: params.id }, 'Failed to delete session')
      set.status = 500
      return {
        error: 'Internal Server Error',
        message: errorMessage,
      }
    }
  })
