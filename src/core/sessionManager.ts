import { nanoid } from 'nanoid'
import { createSession, type Session, type SessionMode, type SessionStatus } from '../models/Session'
import { fileStore } from '../storage/fileStore'
import { createManifest, saveManifest } from './manifest'
import { ChunkWriter } from './chunkWriter'
import { logger } from '../shared/logger'

export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private chunkWriters: Map<string, ChunkWriter> = new Map()

  async createSession(
    meetingLink: string,
    mode: SessionMode = 'realtime',
  ): Promise<Session> {
    const sessionId = nanoid(12)
    const basePath = fileStore.getSessionPath(sessionId)

    const session = createSession(sessionId, meetingLink, mode, basePath)

    await fileStore.createSessionDirs(sessionId)

    const manifest = createManifest(sessionId)
    await saveManifest(manifest)

    const chunkWriter = new ChunkWriter(sessionId)
    this.chunkWriters.set(sessionId, chunkWriter)

    this.sessions.set(sessionId, session)

    logger.info(
      {
        sessionId,
        mode,
        meetingLink,
      },
      'Session created',
    )

    return session
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values())
  }

  updateSessionStatus(sessionId: string, status: SessionStatus): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn({ sessionId }, 'Attempted to update non-existent session')
      return
    }

    session.status = status

    if (status === 'active' && !session.startedAt) {
      session.startedAt = Date.now()
    } else if ((status === 'completed' || status === 'error') && !session.endedAt) {
      session.endedAt = Date.now()
    }

    logger.info({ sessionId, status }, 'Session status updated')
  }

  updateSessionStats(
    sessionId: string,
    chunksReceived: number,
    bytesReceived: number,
    totalDurationMs: number,
  ): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.stats.chunksReceived = chunksReceived
    session.stats.bytesReceived = bytesReceived
    session.stats.totalDurationMs = totalDurationMs
  }

  setSessionError(sessionId: string, message: string, code?: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.status = 'error'
    session.error = { message, code }
    session.endedAt = Date.now()

    logger.error({ sessionId, message, code }, 'Session error')
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    this.updateSessionStatus(sessionId, 'stopping')

    this.chunkWriters.delete(sessionId)

    this.sessions.delete(sessionId)

    logger.info({ sessionId }, 'Session deleted')
  }

  getChunkWriter(sessionId: string): ChunkWriter | undefined {
    return this.chunkWriters.get(sessionId)
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getSessionCount(): number {
    return this.sessions.size
  }
}

export const sessionManager = new SessionManager()
