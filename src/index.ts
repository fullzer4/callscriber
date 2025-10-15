import { Elysia } from 'elysia'
import { staticPlugin } from '@elysiajs/static'
import { config, validateConfig } from './config/index'
import { logger } from './shared/logger'
import { fileStore } from './storage/fileStore'
import { viewRoutes } from './api/views'
import { sessionsRoutes } from './api/routes.sessions'
import { audioWebSocket } from './api/ws.audio'
import { transcriptWebSocket } from './api/ws.transcript'


async function bootstrap() {
  try {
    logger.info('Starting Open Meeting Transcriber')

    validateConfig()
    logger.info({ config }, 'Configuration validated')

    await fileStore.init()

    const app = new Elysia()
      .use(staticPlugin({
        assets: 'public',
        prefix: '/',
      }))
      .use(viewRoutes)

      .get('/api', () => ({
        name: 'Open Meeting Transcriber',
        version: '1.0.0',
        status: 'running',
      }))

      .get('/health', () => ({
        status: 'healthy',
        timestamp: Date.now(),
      }))

      .use(sessionsRoutes)

      .use(audioWebSocket)
      .use(transcriptWebSocket)

      .onError(({ code, error, set }) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error({ code, error: errorMessage }, 'Request error')

        if (code === 'VALIDATION') {
          set.status = 400
          return {
            error: 'Validation Error',
            message: errorMessage,
          }
        }

        if (code === 'NOT_FOUND') {
          set.status = 404
          return {
            error: 'Not Found',
            message: 'The requested resource was not found',
          }
        }

        set.status = 500
        return {
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
        }
      })

      .listen({
        hostname: config.server.host,
        port: config.server.port,
      })

    logger.info(
      {
        host: config.server.host,
        port: config.server.port,
        url: `http://${config.server.host}:${config.server.port}`,
      },
      'Server started successfully',
    )

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully')

      try {
        await app.stop()
        logger.info('Server stopped')
        process.exit(0)
      } catch (error) {
        logger.error({ error }, 'Error during shutdown')
        process.exit(1)
      }
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server')
    process.exit(1)
  }
}

bootstrap()
