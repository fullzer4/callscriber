import pino from 'pino'
import { config } from '../config/index.js'

export const logger = pino({
  level: config.logging.level,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
  },
})

export function createLogger(context: Record<string, unknown>) {
  return logger.child(context)
}
