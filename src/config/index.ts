import { resolve } from 'path'

export const config = {
  app: {
    name: process.env.APP_NAME || 'Open Meeting Transcriber',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    models: {
      batch: process.env.TRANSCRIBE_MODEL_BATCH || 'whisper-1',
      realtime: process.env.TRANSCRIBE_MODEL_REALTIME || 'gpt-4o-realtime-preview',
    },
  },

  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  storage: {
    dataDir: resolve(process.env.DATA_DIR || './data/sessions'),
  },

  audio: {
    chunkMs: parseInt(process.env.CHUNK_MS || '2000', 10),
    mimeType: 'audio/webm;codecs=opus',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  bot: {
    headless: process.env.BOT_HEADLESS !== 'false',
    autoplayPolicy: 'no-user-gesture-required',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
  },

  auth: {
    username: process.env.AUTH_USERNAME || 'admin',
    password: process.env.AUTH_PASSWORD || 'admin123',
  },
} as const


export function validateConfig(): void {
  const errors: string[] = []

  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`)
  }
}
