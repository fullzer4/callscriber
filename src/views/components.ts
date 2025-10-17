import { config } from '../config/index'

export function loginForm(error?: string, csrfToken?: string) {
  return `
    <div class="min-h-screen flex items-center justify-center p-5 bg-gray-950">
      <div class="bg-gray-900 border border-gray-800 rounded-lg shadow-xl p-10 max-w-md w-full">
        <h1 class="text-2xl font-semibold text-gray-100 mb-2">${config.app.name}</h1>
        <p class="text-gray-400 text-sm mb-8">Sign in to manage transcription sessions</p>
        
        ${error ? `<div class="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded text-sm mb-6">${error}</div>` : ''}
        
        <form hx-post="/login" hx-target="#app" hx-swap="innerHTML">
          ${csrfToken ? `<input type="hidden" name="csrf_token" value="${csrfToken}">` : ''}
          
          <div class="mb-4">
            <label for="username" class="block mb-2 text-gray-300 text-sm font-medium">Username</label>
            <input 
              type="text" 
              id="username" 
              name="username" 
              required 
              autocomplete="username"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded text-gray-100 focus:outline-none focus:border-blue-600 transition"
            >
          </div>
          
          <div class="mb-6">
            <label for="password" class="block mb-2 text-gray-300 text-sm font-medium">Password</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              required 
              autocomplete="current-password"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded text-gray-100 focus:outline-none focus:border-blue-600 transition"
            >
          </div>
          
          <button 
            type="submit" 
            class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded font-medium transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  `
}

export function dashboard(username: string, csrfToken: string) {
  return `
    <div class="min-h-screen bg-gray-950">
      <div class="bg-gray-900 border-b border-gray-800">
        <div class="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 class="text-xl font-semibold text-gray-100">${config.app.name}</h1>
          <div class="flex items-center gap-4">
            <span class="text-gray-400 text-sm">${username}</span>
            <button 
              hx-post="/logout" 
              hx-swap="none"
              class="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-4 py-2 rounded text-sm transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div class="container mx-auto px-6 py-8">
        <!-- Create Session -->
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-100 mb-4">Create New Session</h2>
          <form hx-post="/sessions/create" hx-target="#sessionsList" hx-swap="innerHTML">
            <input type="hidden" name="csrf_token" value="${csrfToken}">
            <div class="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
              <input 
                type="url" 
                name="meeting_link" 
                placeholder="https://meet.google.com/xxx-xxxx-xxx" 
                required
                class="px-4 py-2.5 bg-gray-950 border border-gray-800 rounded text-gray-100 focus:outline-none focus:border-blue-600 transition"
              >
              <select 
                name="mode"
                class="px-4 py-2.5 bg-gray-950 border border-gray-800 rounded text-gray-100 focus:outline-none focus:border-blue-600 transition"
              >
                <option value="realtime">Realtime</option>
                <option value="record">Record</option>
              </select>
              <button 
                type="submit" 
                class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded font-medium transition"
              >
                Create
              </button>
            </div>
          </form>
        </div>

        <!-- Active Sessions -->
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-100 mb-4">Active Sessions</h2>
          <div 
            id="sessionsList" 
            hx-get="/sessions/list" 
            hx-trigger="load, every 5s" 
            hx-swap="innerHTML"
            hx-headers='{"X-CSRF-Token": "${csrfToken}"}'
          >
            <div class="text-center py-8 text-gray-500 text-sm animate-pulse">Loading sessions...</div>
          </div>
        </div>
      </div>
    </div>
  `
}

export function sessionsList(sessions: Array<Record<string, unknown>>, csrfToken: string) {
  if (sessions.length === 0) {
    return '<div class="text-center py-8 text-gray-500 text-sm">No active sessions</div>'
  }
  
  return `<div class="space-y-3">${sessions.map((session) => `
    <div class="bg-gray-950 border border-gray-800 p-4 rounded flex justify-between items-center">
      <div class="flex-1">
        <div class="font-mono text-sm text-gray-300 mb-1">${session.id}</div>
        <div class="text-gray-500 text-xs flex items-center gap-3">
          <span class="inline-block px-2 py-1 rounded text-xs font-medium uppercase
            ${session.status === 'created' ? 'bg-blue-950 text-blue-400 border border-blue-900' : ''}
            ${session.status === 'joining' ? 'bg-yellow-950 text-yellow-400 border border-yellow-900' : ''}
            ${session.status === 'active' ? 'bg-green-950 text-green-400 border border-green-900' : ''}
            ${session.status === 'error' ? 'bg-red-950 text-red-400 border border-red-900' : ''}
            ${session.status === 'stopping' ? 'bg-pink-950 text-pink-400 border border-pink-900' : ''}
          ">
            ${session.status}
          </span>
          <span>${session.mode}</span>
          <span class="truncate max-w-md">${session.meeting_link}</span>
        </div>
      </div>
      <button 
        hx-delete="/sessions/delete/${session.id}" 
        hx-target="#sessionsList" 
        hx-swap="innerHTML"
        hx-headers='{"X-CSRF-Token": "${csrfToken}"}'
        hx-confirm="Delete this session?"
        class="bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-400 px-4 py-2 rounded text-sm font-medium transition"
      >
        Delete
      </button>
    </div>
  `).join('')}</div>`
}

export function layout(content: string, csrfToken?: string) {
  return `
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${csrfToken ? `<meta name="csrf-token" content="${csrfToken}">` : ''}
      <title>${config.app.name}</title>
      <script src="https://unpkg.com/htmx.org@2.0.3"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="/styles.css">
      <script>
        // CSRF protection for HTMX requests
        document.addEventListener('DOMContentLoaded', () => {
          const csrf = document.querySelector('meta[name="csrf-token"]')?.content
          if (csrf) {
            document.body.addEventListener('htmx:configRequest', (e) => {
              if (e.detail.verb !== 'get') {
                e.detail.headers['X-CSRF-Token'] = csrf
              }
            })
          }
        })
      </script>
    </head>
    <body class="bg-gray-950">
      <div id="app">
        ${content}
      </div>
    </body>
    </html>
  `
}
