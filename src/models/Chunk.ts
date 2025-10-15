export interface Chunk {
  seq: number;
  ts: number;
  durMs: number;
  mime: string;
  path: string;
  sha256: string;
  size: number;
  receivedAt: number;
}

export interface ChunkMeta {
  seq: number;
  ts: number;
  durMs: number;
  mime: string;
  len: number;
}

export function createChunk(
  meta: ChunkMeta,
  path: string,
  sha256: string,
  size: number,
): Chunk {
  return {
    seq: meta.seq,
    ts: meta.ts,
    durMs: meta.durMs,
    mime: meta.mime,
    path,
    sha256,
    size,
    receivedAt: Date.now(),
  }
}
