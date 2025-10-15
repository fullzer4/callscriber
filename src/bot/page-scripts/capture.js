/**
 * Audio Capture Script - Injected into meeting page
 * 
 * This script captures audio from the meeting using MediaRecorder API
 * and sends chunks to the server via WebSocket.
 * 
 * Requirements:
 * - window.CAPTURE_CONFIG must be set before running this script
 *   - wsUrl: WebSocket URL to send audio chunks
 *   - chunkMs: Duration of each chunk in milliseconds
 *   - sessionId: Session identifier
 */

(function () {
  'use strict'

  const config = window.CAPTURE_CONFIG
  if (!config) {
    console.error('[Capture] CAPTURE_CONFIG not found')
    return
  }

  console.log('[Capture] Starting audio capture', config)

  let ws = null
  let mediaRecorder = null
  let audioStream = null
  let chunkSequence = 0
  let startTime = Date.now()
  let isCapturing = false
  
  function initWebSocket() {
    console.log('[Capture] Connecting to WebSocket:', config.wsUrl)

    ws = new WebSocket(config.wsUrl)

    ws.onopen = () => {
      console.log('[Capture] WebSocket connected')
      startAudioCapture()
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('[Capture] Received message:', message)

        if (message.type === 'chunk.ack') {
          console.log(`[Capture] Chunk ${message.seq} acknowledged`)
        } else if (message.type === 'error') {
          console.error('[Capture] Server error:', message.message)
        }
      } catch (error) {
        console.error('[Capture] Failed to parse message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('[Capture] WebSocket error:', error)
    }

    ws.onclose = (event) => {
      console.log('[Capture] WebSocket closed:', event.code, event.reason)
      stopAudioCapture()
    }
  }

  async function getAudioStream() {
    console.log('[Capture] Getting audio stream')

    try {
      const mediaElements = document.querySelectorAll('audio, video')
      for (const element of mediaElements) {
        if (element.srcObject && element.srcObject.getAudioTracks().length > 0) {
          console.log('[Capture] Found audio in media element')
          return element.srcObject
        }

        if (typeof element.captureStream === 'function') {
          const stream = element.captureStream()
          if (stream.getAudioTracks().length > 0) {
            console.log('[Capture] Captured stream from media element')
            return stream
          }
        }
      }

      console.log('[Capture] Requesting getUserMedia')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      console.log('[Capture] Got audio stream from getUserMedia')
      return stream
    } catch (error) {
      console.error('[Capture] Failed to get audio stream:', error)
      throw error
    }
  }

  async function startAudioCapture() {
    if (isCapturing) {
      console.warn('[Capture] Already capturing')
      return
    }

    try {
      console.log('[Capture] Starting audio capture')

      audioStream = await getAudioStream()

      const mimeType = getSupportedMimeType()
      console.log('[Capture] Using MIME type:', mimeType)

      mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000,
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          sendChunk(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('[Capture] MediaRecorder error:', event.error)
      }

      mediaRecorder.onstop = () => {
        console.log('[Capture] MediaRecorder stopped')
        isCapturing = false
      }

      mediaRecorder.start(config.chunkMs)
      isCapturing = true
      startTime = Date.now()

      console.log('[Capture] Recording started')
    } catch (error) {
      console.error('[Capture] Failed to start audio capture:', error)
      throw error
    }
  }

  function getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return ''
  }

  async function sendChunk(blob) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[Capture] WebSocket not ready, dropping chunk')
      return
    }

    try {
      const seq = chunkSequence++
      const ts = Date.now() - startTime
      const durMs = config.chunkMs
      const mime = blob.type
      const len = blob.size

      const meta = {
        seq,
        ts,
        durMs,
        mime,
        len,
      }

      console.log(`[Capture] Sending chunk ${seq}:`, meta)
      ws.send(JSON.stringify(meta))

      const arrayBuffer = await blob.arrayBuffer()
      ws.send(arrayBuffer)

      console.log(`[Capture] Chunk ${seq} sent (${len} bytes)`)
    } catch (error) {
      console.error('[Capture] Failed to send chunk:', error)
    }
  }

  function stopAudioCapture() {
    console.log('[Capture] Stopping audio capture')

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop())
      audioStream = null
    }

    if (ws) {
      ws.close()
      ws = null
    }

    isCapturing = false
    console.log('[Capture] Audio capture stopped')
  }

  window.stopCapture = stopAudioCapture

  initWebSocket()

  console.log('[Capture] Initialization complete')
})()
