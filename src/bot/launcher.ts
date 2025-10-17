import { chromium, type Browser, type BrowserContext } from 'playwright'
import { config } from '../config/index'
import { createLogger } from '../shared/logger'

export class BrowserLauncher {
  private browser: Browser | null = null
  private contexts: Map<string, BrowserContext> = new Map()
  private logger = createLogger({ component: 'BrowserLauncher' })

  async launch(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    this.logger.info('Launching Chromium browser')

    const args = [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--disable-features=WebRtcHideLocalIpsWithMdns',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-audio-service-sandbox=false',
    ]

    if (config.bot.headless) {
      args.unshift('--headless=new')
    }

    try {
      this.browser = await chromium.launch({
        headless: config.bot.headless,
        args,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      })

      this.logger.info('Chromium browser launched successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      this.logger.error({ error: errorMessage, stack: errorStack }, 'Failed to launch browser')
      throw error
    }

    return this.browser
  }

  async createContext(sessionId: string): Promise<BrowserContext> {
    const browser = await this.launch()

    this.logger.info({ sessionId }, 'Creating browser context')

    const context = await browser.newContext({
      permissions: ['microphone', 'camera'],
      bypassCSP: true,
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    })

    this.contexts.set(sessionId, context)

    this.logger.info({ sessionId }, 'Browser context created')

    return context
  }

  getContext(sessionId: string): BrowserContext | undefined {
    return this.contexts.get(sessionId)
  }

  async closeContext(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId)
    if (!context) {
      return
    }

    this.logger.info({ sessionId }, 'Closing browser context')

    await context.close()
    this.contexts.delete(sessionId)

    this.logger.info({ sessionId }, 'Browser context closed')
  }

  async close(): Promise<void> {
    if (!this.browser) {
      return
    }

    this.logger.info('Closing browser')

    for (const [sessionId, context] of this.contexts.entries()) {
      try {
        await context.close()
        this.contexts.delete(sessionId)
      } catch (error) {
        this.logger.error({ sessionId, error }, 'Error closing context')
      }
    }

    await this.browser.close()
    this.browser = null

    this.logger.info('Browser closed')
  }

  isRunning(): boolean {
    return this.browser !== null
  }
}

export const browserLauncher = new BrowserLauncher()
