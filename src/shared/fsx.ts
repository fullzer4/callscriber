import { mkdir, writeFile, rename, open } from 'fs/promises'
import { dirname } from 'path'
import { logger } from './logger'

export async function mkdirp(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export async function atomicWrite(
  targetPath: string,
  data: Buffer | string,
): Promise<void> {
  await mkdirp(dirname(targetPath))

  const tempPath = `${targetPath}.tmp`

  try {
    await writeFile(tempPath, data)

    const fd = await open(tempPath, 'r+')
    try {
      await fd.sync()
    } finally {
      await fd.close()
    }

    await rename(tempPath, targetPath)

    logger.trace({ path: targetPath }, 'Atomic write completed')
  } catch (error) {
    logger.error({ error, path: targetPath }, 'Atomic write failed')
    throw error
  }
}

export async function writeChunkFile(
  path: string,
  data: Buffer,
): Promise<void> {
  await atomicWrite(path, data)
}

export async function writeJSON(path: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  await atomicWrite(path, json)
}
