import { Elysia } from 'elysia'
import { html } from '@elysiajs/html'
import { config } from '../config/index'
import { sessionManager } from '../core/sessionManager'
import type { SessionMode } from '../models/Session'
import { logger } from '../shared/logger'
import { sessionStore } from '../shared/sessionStore'
import { layout, loginForm, dashboard, sessionsList } from '../views/components'

const isProduction = process.env.NODE_ENV === 'production'

export const viewRoutes = new Elysia()
  .use(html())

  .get('/', ({ cookie: { session }, set }) => {
    set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    set.headers['Pragma'] = 'no-cache'
    
    const sessionValue = session?.value as string | undefined
    const userSession = sessionStore.validateSession(sessionValue)
    
    if (userSession) {
      return layout(dashboard(userSession.username, userSession.csrfToken), userSession.csrfToken)
    }
    
    return layout(loginForm())
  })

  .post('/login', ({ body, cookie: { session }, set }) => {
    const formData = body as Record<string, string>
    const { username, password } = formData

    if (username === config.auth.username && password === config.auth.password) {
      const { token, csrfToken } = sessionStore.createSession(username)
      
      if (session) {
        session.value = token
        session.httpOnly = true
        session.sameSite = 'lax'
        session.secure = isProduction
        session.maxAge = 60 * 60 * 24 // 1 day
      }

      logger.info({ username }, 'User logged in')

      set.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
      
      return dashboard(username, csrfToken)
    }

    set.status = 401
    return loginForm('Invalid credentials')
  })

  .post('/logout', ({ cookie: { session }, set }) => {
    const sessionValue = session?.value as string | undefined
    if (sessionValue) {
      sessionStore.deleteSession(sessionValue)
      session?.remove()
      logger.info('User logged out')
    }

    set.headers['HX-Redirect'] = '/'
    return ''
  })

  .get('/sessions/list', ({ cookie: { session }, set }) => {
    const sessionValue = session?.value as string | undefined
    const userSession = sessionStore.validateSession(sessionValue)
    
    if (!userSession) {
      set.status = 401
      return '<div class="text-center py-10 text-gray-500">Unauthorized</div>'
    }

    set.headers['Cache-Control'] = 'no-store'

    const allSessions = sessionManager.getAllSessions()
    return sessionsList(allSessions.map((s) => ({
      id: s.id,
      status: s.status,
      mode: s.mode,
      meeting_link: s.meetingLink,
    })), userSession.csrfToken)
  })

  .post('/sessions/create', async ({ body, cookie: { session }, set, headers }) => {
    const sessionValue = session?.value as string | undefined
    const userSession = sessionStore.validateSession(sessionValue)
    
    if (!userSession) {
      set.status = 401
      return '<div class="text-center py-10 text-gray-500">Unauthorized</div>'
    }

    const csrfToken = headers['x-csrf-token']
    if (!sessionStore.validateCsrf(sessionValue, csrfToken)) {
      set.status = 403
      return '<div class="text-center py-10 text-red-500">CSRF validation failed</div>'
    }

    const formData = body as Record<string, string>
    const { meeting_link, mode } = formData

    if (!meeting_link || !mode) {
      set.status = 400
      return '<div class="text-center py-10 text-gray-500">Missing required fields</div>'
    }

    try {
      const sessionMode = mode as SessionMode
      await sessionManager.createSession(meeting_link, sessionMode)
      
      const allSessions = sessionManager.getAllSessions()
      return sessionsList(allSessions.map((s) => ({
        id: s.id,
        status: s.status,
        mode: s.mode,
        meeting_link: s.meetingLink,
      })), userSession.csrfToken)
    } catch (error) {
      logger.error({ error }, 'Failed to create session')
      set.status = 500
      return '<div class="text-center py-10 text-gray-500">Failed to create session</div>'
    }
  })

  .delete('/sessions/delete/:id', ({ params, cookie: { session }, set, headers }) => {
    const sessionValue = session?.value as string | undefined
    const userSession = sessionStore.validateSession(sessionValue)
    
    if (!userSession) {
      set.status = 401
      return '<div class="text-center py-10 text-gray-500">Unauthorized</div>'
    }

    const csrfToken = headers['x-csrf-token']
    if (!sessionStore.validateCsrf(sessionValue, csrfToken)) {
      set.status = 403
      return '<div class="text-center py-10 text-red-500">CSRF validation failed</div>'
    }

    try {
      sessionManager.deleteSession(params.id)
      
      const allSessions = sessionManager.getAllSessions()
      return sessionsList(allSessions.map((s) => ({
        id: s.id,
        status: s.status,
        mode: s.mode,
        meeting_link: s.meetingLink,
      })), userSession.csrfToken)
    } catch (error) {
      logger.error({ error }, 'Failed to delete session')
      
      const allSessions = sessionManager.getAllSessions()
      return sessionsList(allSessions.map((s) => ({
        id: s.id,
        status: s.status,
        mode: s.mode,
        meeting_link: s.meetingLink,
      })), userSession.csrfToken)
    }
  })
