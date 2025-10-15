import { randomUUID } from 'crypto'

interface UserSession {
  username: string
  expiresAt: number
  csrfToken: string
}

class SessionStore {
  private sessions = new Map<string, UserSession>()

  createSession(username: string): { token: string; csrfToken: string } {
    const token = randomUUID()
    const csrfToken = randomUUID()
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

    this.sessions.set(token, { username, expiresAt, csrfToken })

    return { token, csrfToken }
  }

  validateSession(token: string | undefined): UserSession | null {
    if (!token) return null

    const session = this.sessions.get(token)
    if (!session) return null

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token)
      return null
    }

    return session
  }

  deleteSession(token: string): void {
    this.sessions.delete(token)
  }

  validateCsrf(token: string | undefined, csrfToken: string | undefined): boolean {
    if (!token || !csrfToken) return false

    const session = this.sessions.get(token)
    if (!session) return false

    return session.csrfToken === csrfToken
  }

  // Cleanup expired sessions periodically
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      for (const [token, session] of this.sessions.entries()) {
        if (now > session.expiresAt) {
          this.sessions.delete(token)
        }
      }
    }, 60 * 60 * 1000) // Every hour
  }
}

export const sessionStore = new SessionStore()
sessionStore.startCleanup()
