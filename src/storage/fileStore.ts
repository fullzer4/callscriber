import { join } from 'path'
import { readFile, readdir, stat } from 'fs/promises'
import { config } from '../config/index'
import { mkdirp, writeJSON } from '../shared/fsx'
import { logger } from '../shared/logger'

export class FileStore {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir || config.storage.dataDir
  }

  async init(): Promise<void> {
    await mkdirp(this.baseDir)
    logger.info({ baseDir: this.baseDir }, 'FileStore initialized')
  }

  getSessionPath(sessionId: string): string {
    return join(this.baseDir, sessionId)
  }

  getChunksPath(sessionId: string): string {
    return join(this.getSessionPath(sessionId), 'chunks')
  }

  getManifestPath(sessionId: string): string {
    return join(this.getSessionPath(sessionId), 'manifest.json')
  }

  getTranscriptPath(sessionId: string): string {
    return join(this.getSessionPath(sessionId), 'transcript.json')
  }

  async createSessionDirs(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId)
    const chunksPath = this.getChunksPath(sessionId)

    await mkdirp(sessionPath)
    await mkdirp(chunksPath)

    logger.info({ sessionId, sessionPath }, 'Session directories created')
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const sessionPath = this.getSessionPath(sessionId)
      const stats = await stat(sessionPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true })
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    } catch (error) {
      logger.error({ error }, 'Failed to list sessions')
      return []
    }
  }

  async readManifest(sessionId: string): Promise<unknown> {
    try {
      const manifestPath = this.getManifestPath(sessionId)
      const content = await readFile(manifestPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      logger.debug({ sessionId, error }, 'Failed to read manifest')
      return null
    }
  }

  async writeManifest(sessionId: string, manifest: unknown): Promise<void> {
    const manifestPath = this.getManifestPath(sessionId)
    await writeJSON(manifestPath, manifest)
    logger.debug({ sessionId }, 'Manifest written')
  }

  getChunkPath(sessionId: string, seq: number, extension: string = 'webm'): string {
    return join(this.getChunksPath(sessionId), `chunk-${seq.toString().padStart(6, '0')}.${extension}`)
  }

  async readTranscript(sessionId: string): Promise<unknown> {
    try {
      const transcriptPath = this.getTranscriptPath(sessionId)
      const content = await readFile(transcriptPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      logger.debug({ sessionId, error }, 'Failed to read transcript')
      return null
    }
  }

  async writeTranscript(sessionId: string, transcript: unknown): Promise<void> {
    const transcriptPath = this.getTranscriptPath(sessionId)
    await writeJSON(transcriptPath, transcript)
    logger.info({ sessionId }, 'Transcript written')
  }
}

export const fileStore = new FileStore()
