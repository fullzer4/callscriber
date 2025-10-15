import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

export function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function sha256File(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return sha256Buffer(buffer)
}

export function sha256ArrayBuffer(arrayBuffer: ArrayBuffer): string {
  const buffer = Buffer.from(arrayBuffer)
  return sha256Buffer(buffer)
}
