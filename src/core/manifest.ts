import type { Chunk } from '../models/Chunk'
import { fileStore } from '../storage/fileStore'
import { logger } from '../shared/logger'

export interface Manifest {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  chunks: Chunk[];
  metadata: {
    totalDurationMs: number;
    totalSizeBytes: number;
    chunkCount: number;
  };
}

export function createManifest(sessionId: string): Manifest {
  const now = Date.now()
  return {
    sessionId,
    createdAt: now,
    updatedAt: now,
    chunks: [],
    metadata: {
      totalDurationMs: 0,
      totalSizeBytes: 0,
      chunkCount: 0,
    },
  }
}

export async function loadManifest(sessionId: string): Promise<Manifest | null> {
  try {
    const data = await fileStore.readManifest(sessionId)
    if (!data) {
      return null
    }
    return data as Manifest
  } catch (error) {
    logger.error({ sessionId, error }, 'Failed to load manifest')
    return null
  }
}

export async function saveManifest(manifest: Manifest): Promise<void> {
  manifest.updatedAt = Date.now()
  await fileStore.writeManifest(manifest.sessionId, manifest)
}

export async function appendChunk(
  sessionId: string,
  chunk: Chunk,
): Promise<void> {
  let manifest = await loadManifest(sessionId)

  if (!manifest) {
    manifest = createManifest(sessionId)
  }

  manifest.chunks.push(chunk)

  manifest.metadata.chunkCount = manifest.chunks.length
  manifest.metadata.totalDurationMs += chunk.durMs
  manifest.metadata.totalSizeBytes += chunk.size

  await saveManifest(manifest)

  logger.debug(
    {
      sessionId,
      seq: chunk.seq,
      chunkCount: manifest.metadata.chunkCount,
    },
    'Chunk appended to manifest',
  )
}

export async function getManifestStats(
  sessionId: string,
): Promise<Manifest['metadata'] | null> {
  const manifest = await loadManifest(sessionId)
  return manifest?.metadata || null
}
