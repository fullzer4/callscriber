import type { Page } from 'playwright'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { browserLauncher } from './launcher'
import { config } from '../config/index'
import { createLogger } from '../shared/logger'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Google Meet specific joiner
 * Handles Meet's specific UI interactions and permission flows
 */
export class GoogleMeetJoiner {
  private sessionId: string
  private meetingLink: string
  private page: Page | null = null
  private logger: ReturnType<typeof createLogger>

  constructor(sessionId: string, meetingLink: string) {
    this.sessionId = sessionId
    this.meetingLink = meetingLink
    this.logger = createLogger({ component: 'GoogleMeetJoiner', sessionId })
  }

  async join(wsAudioUrl: string): Promise<void> {
    try {
      this.logger.info({ meetingLink: this.meetingLink }, 'Joining Google Meet')

      const context = await browserLauncher.createContext(this.sessionId)

      this.page = await context.newPage()

      this.page.on('console', (msg) => {
        this.logger.debug({ text: msg.text(), type: msg.type() }, 'Browser console')
      })

      this.page.on('pageerror', (error) => {
        this.logger.error({ error: error.message }, 'Browser page error')
      })

      this.logger.info('Navigating to Google Meet')
      await this.page.goto(this.meetingLink, {
        waitUntil: 'networkidle',
        timeout: 60000,
      })

      await this.handleMeetUI()

      await this.injectCaptureScript(wsAudioUrl)

      this.logger.info('Successfully joined Google Meet and started capture')
    } catch (error) {
      this.logger.error({ error }, 'Failed to join Google Meet')
      throw error
    }
  }

  private async handleMeetUI(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized')
    }

    this.logger.info('Handling Google Meet UI')

    await this.page.waitForTimeout(2000)

    try {
      await this.dismissBanners()
      await this.handlePermissions()
      await this.turnOffCamera()
      await this.clickJoinButton()
      await this.waitForMeetingToLoad()

      this.logger.info('Successfully navigated Google Meet UI')
    } catch (error) {
      this.logger.error({ error }, 'Error handling Meet UI')
      throw error
    }
  }

  private async dismissBanners(): Promise<void> {
    if (!this.page) return

    try {
      const bannerSelectors = [
        'button:has-text("Reject all")',
        'button:has-text("Rejeitar tudo")',
        'button:has-text("I agree")',
        'button:has-text("Concordo")',
        'button:has-text("Accept")',
        'button:has-text("Aceitar")',
        '[aria-label*="cookie"]',
      ]

      for (const selector of bannerSelectors) {
        try {
          const button = await this.page.$(selector)
          if (button) {
            await button.click()
            this.logger.debug({ selector }, 'Dismissed banner')
            await this.page.waitForTimeout(500)
            break
          }
        } catch {
          // Ignore, try next selector
        }
      }
    } catch {
      this.logger.debug('No banners to dismiss')
    }
  }

  private async handlePermissions(): Promise<void> {
    if (!this.page) return

    try {
      // Google Meet usually shows permission prompts before joining
      // With our browser flags, these should be auto-granted
      // But we'll check for any UI elements that might need clicking

      // Wait a bit for permissions to be processed
      await this.page.waitForTimeout(1000)

      this.logger.debug('Permissions should be auto-granted via browser flags')
    } catch {
      this.logger.debug('No permission prompts to handle')
    }
  }

  private async turnOffCamera(): Promise<void> {
    if (!this.page) return

    try {
      const cameraButtonSelectors = [
        '[data-is-muted="false"][aria-label*="camera"]',
        '[data-is-muted="false"][aria-label*="câmera"]',
        'button[aria-label*="Turn off camera"]',
        'button[aria-label*="Desativar câmera"]',
        '[jsname][data-is-muted="false"]',
      ]

      for (const selector of cameraButtonSelectors) {
        try {
          const button = await this.page.$(selector)
          if (button) {
            const isMuted = await button.getAttribute('data-is-muted')
            if (isMuted === 'false') {
              await button.click()
              this.logger.info('Turned off camera')
              await this.page.waitForTimeout(500)
              break
            }
          }
        } catch {
          // Try next selector
        }
      }
    } catch {
      this.logger.warn('Could not toggle camera, continuing anyway')
    }
  }

  private async clickJoinButton(): Promise<void> {
    if (!this.page) return

    this.logger.info('Looking for join button')

    const joinButtonSelectors = [
      'button:has-text("Join now")',
      'button:has-text("Participar agora")',
      'button:has-text("Ask to join")',
      'button:has-text("Pedir para participar")',
      '[jsname="Qx7Oae"]',
      'button[aria-label*="Join"]',
      'button[aria-label*="Participar"]',
    ]

    let joined = false
    for (const selector of joinButtonSelectors) {
      try {
        const button = await this.page.$(selector)
        if (button && await button.isVisible()) {
          this.logger.info({ selector }, 'Clicking join button')
          await button.click()
          joined = true
          break
        }
      } catch {
        // Try next selector
      }
    }

    if (!joined) {
      this.logger.info('No join button found, might already be in meeting')
    }

    await this.page.waitForTimeout(3000)
  }

  private async waitForMeetingToLoad(): Promise<void> {
    if (!this.page) return

    this.logger.info('Waiting for meeting to load')

    try {
      await this.page.waitForSelector(
        '[data-self-participant-id], [jscontroller], .participant-container',
        { timeout: 30000 },
      )

      this.logger.info('Meeting loaded successfully')

      await this.page.waitForTimeout(2000)
    } catch {
      this.logger.warn('Could not detect meeting load, continuing anyway')
    }
  }

  private async injectCaptureScript(wsAudioUrl: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized')
    }

    this.logger.info('Injecting capture script')

    const captureScriptPath = join(__dirname, 'page-scripts', 'capture.js')
    const captureScript = await readFile(captureScriptPath, 'utf-8')

    await this.page.evaluate(
      ({ script, wsUrl, chunkMs, sessionId }) => {
        // @ts-expect-error - window.CAPTURE_CONFIG set in browser context
        window.CAPTURE_CONFIG = {
          wsUrl,
          chunkMs,
          sessionId,
        }

        // Execute capture script
        eval(script)
      },
      {
        script: captureScript,
        wsUrl: wsAudioUrl,
        chunkMs: config.audio.chunkMs,
        sessionId: this.sessionId,
      },
    )

    this.logger.info('Capture script injected')
  }

  async leave(): Promise<void> {
    this.logger.info('Leaving Google Meet')

    if (this.page) {
      try {
        const leaveButtonSelectors = [
          'button[aria-label*="Leave call"]',
          'button[aria-label*="Sair da chamada"]',
          '[data-call-ended]',
        ]

        for (const selector of leaveButtonSelectors) {
          try {
            const button = await this.page.$(selector)
            if (button) {
              await button.click()
              this.logger.info('Clicked leave button')
              await this.page.waitForTimeout(1000)
              break
            }
          } catch {
            // Try next selector
          }
        }

        await this.page.evaluate(() => {
          // @ts-expect-error - window.stopCapture exists in browser context
          if (window.stopCapture) {
            // @ts-expect-error - window.stopCapture exists in browser context
            window.stopCapture()
          }
        })

        await this.page.close()
        this.page = null
      } catch (error) {
        this.logger.error({ error }, 'Error closing page')
      }
    }

    await browserLauncher.closeContext(this.sessionId)

    this.logger.info('Left Google Meet')
  }

  isInMeeting(): boolean {
    return this.page !== null && !this.page.isClosed()
  }

  async takeScreenshot(path: string): Promise<void> {
    if (this.page) {
      await this.page.screenshot({ path, fullPage: true })
      this.logger.info({ path }, 'Screenshot saved')
    }
  }
}
