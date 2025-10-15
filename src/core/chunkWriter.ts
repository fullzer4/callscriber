import { createChunk, type ChunkMeta } from '../models/Chunk'
import { fileStore } from '../storage/fileStore'
import { writeChunkFile } from '../shared/fsx'
import { sha256Buffer } from '../shared/crypto'
import { appendChunk } from './manifest'
import { logger } from '../shared/logger'

/**
 * ChunkWriter handles atomic writing of audio chunks
 * 
 * Flow:
 * 1. Receive chunk metadata and binary data
 * 2. Write to .tmp file
 * 3. fsync to ensure data is on disk
 * 4. Rename to final filename (atomic)
 * 5. Calculate SHA-256 hash
 * 6. Append to manifest
 */
export class ChunkWriter {
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async writeChunk(meta: ChunkMeta, data: Buffer): Promise<void> {
    const startTime = Date.now()

    try {
      const extension = this.getExtensionFromMime(meta.mime)
      const chunkPath = fileStore.getChunkPath(this.sessionId, meta.seq, extension)

      const hash = sha256Buffer(data)

      await writeChunkFile(chunkPath, data)

      const chunk = createChunk(meta, chunkPath, hash, data.length)

      await appendChunk(this.sessionId, chunk)

      const duration = Date.now() - startTime
      logger.info(
        {
          sessionId: this.sessionId,
          seq: meta.seq,
          size: data.length,
          hash,
          duration,
        },
        'Chunk written successfully',
      )
    } catch (error) {
      logger.error(
        {
          sessionId: this.sessionId,
          seq: meta.seq,
          error,
        },
        'Failed to write chunk',
      )
      throw error
    }
  }

  private getExtensionFromMime(mime: string): string {
    if (mime.includes('webm')) return 'webm'
    if (mime.includes('ogg')) return 'ogg'
    if (mime.includes('opus')) return 'opus'
    if (mime.includes('wav')) return 'wav'
    if (mime.includes('mp4')) return 'mp4'
    if (mime.includes('mpeg')) return 'mp3'

    return 'webm'
  }
}
