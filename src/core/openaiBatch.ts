import OpenAI from 'openai'
import { createReadStream } from 'fs'
import { config } from '../config/index'
import { fileStore } from '../storage/fileStore'
import { loadManifest } from './manifest'
import { logger } from '../shared/logger'

export class OpenAIBatch {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    })
  }

  async transcribeFile(
    filePath: string,
    options: {
      model?: string;
      language?: string;
      prompt?: string;
      responseFormat?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
      temperature?: number;
    } = {},
  ): Promise<unknown> {
    const {
      model = config.openai.models.batch,
      responseFormat = 'verbose_json',
      ...otherOptions
    } = options

    try {
      logger.info({ filePath, model }, 'Starting batch transcription')

      const transcription = await this.client.audio.transcriptions.create({
        file: createReadStream(filePath),
        model,
        response_format: responseFormat,
        ...otherOptions,
      })

      logger.info({ filePath }, 'Batch transcription completed')

      return transcription
    } catch (error) {
      logger.error({ filePath, error }, 'Batch transcription failed')
      throw error
    }
  }

  async transcribeSession(sessionId: string): Promise<unknown> {
    try {
      const manifest = await loadManifest(sessionId)
      if (!manifest) {
        throw new Error(`Manifest not found for session ${sessionId}`)
      }

      if (manifest.chunks.length === 0) {
        throw new Error(`No chunks found for session ${sessionId}`)
      }

      logger.info(
        { sessionId, chunkCount: manifest.chunks.length },
        'Starting session transcription',
      )

      const transcripts: Array<Record<string, unknown>> = []

      for (const chunk of manifest.chunks) {
        try {
          const lastTranscript = transcripts[transcripts.length - 1]
          const transcript = await this.transcribeFile(chunk.path, {
            prompt: lastTranscript ? (lastTranscript.text as string) : undefined,
          })

          transcripts.push({
            seq: chunk.seq,
            ts: chunk.ts,
            durMs: chunk.durMs,
            transcript,
          })

          logger.debug(
            { sessionId, seq: chunk.seq },
            'Chunk transcribed',
          )
        } catch (error) {
          logger.error(
            { sessionId, seq: chunk.seq, error },
            'Failed to transcribe chunk',
          )
        }
      }

      const fullTranscript = {
        sessionId,
        createdAt: Date.now(),
        chunks: transcripts,
        fullText: transcripts
          .map((t) => {
            const trans = t.transcript as Record<string, unknown>
            return (trans.text as string) || ''
          })
          .join(' ')
          .trim(),
      }

      await fileStore.writeTranscript(sessionId, fullTranscript)

      logger.info({ sessionId }, 'Session transcription completed')

      return fullTranscript
    } catch (error) {
      logger.error({ sessionId, error }, 'Session transcription failed')
      throw error
    }
  }
}

export const openAIBatch = new OpenAIBatch()
