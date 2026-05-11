/**
 * NotificationSocket.ts
 * ---------------------
 * Singleton WebSocket para recibir notificaciones en tiempo real.
 * URL: wss://host/ws/notifications/?token=<clerk_jwt>
 *
 * Características:
 *   - Reconexión exponential backoff (1s → 2s → 4s → … → 30s)
 *   - Ping/pong keepalive cada 30s
 *   - Callbacks tipados para notificaciones y cambios de estado
 */

import { WS_BASE_URL } from '@constants/config'

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WsNotification {
  type:       'notification'
  id:         string
  code:       string
  title:      string
  body:       string
  data:       Record<string, unknown>
  created_at: string
}

type StatusCallback      = (status: WsStatus) => void
type NotifCallback       = (notif: WsNotification) => void

const PING_INTERVAL_MS = 30_000
const MAX_BACKOFF_MS   = 30_000

class NotificationSocket {
  private ws:             WebSocket | null = null
  private token:          string | null    = null
  private status:         WsStatus         = 'disconnected'
  private pingTimer:      ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout>  | null = null
  private attempts        = 0
  private destroyed       = false

  private onStatus: StatusCallback = () => {}
  private onNotif:  NotifCallback  = () => {}

  setCallbacks(opts: { onStatus?: StatusCallback; onNotif?: NotifCallback }) {
    if (opts.onStatus) this.onStatus = opts.onStatus
    if (opts.onNotif)  this.onNotif  = opts.onNotif
  }

  connect(token: string) {
    if (this.destroyed) return
    this.token    = token
    this.attempts = 0
    this._connect()
  }

  disconnect() {
    this.destroyed = true
    this._cleanup()
    this._setStatus('disconnected')
  }

  private _connect() {
    if (!this.token || this.destroyed) return
    this._setStatus('connecting')

    const url = `${WS_BASE_URL}/ws/notifications/?token=${this.token}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.attempts = 0
      this._setStatus('connected')
      this._startPing()
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        if (data.type === 'notification') {
          this.onNotif(data as WsNotification)
        }
      } catch {
        // ignore malformed message
      }
    }

    this.ws.onerror = () => {
      this._setStatus('error')
    }

    this.ws.onclose = () => {
      this._cleanup()
      if (!this.destroyed) {
        this._scheduleReconnect()
      }
    }
  }

  private _startPing() {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, PING_INTERVAL_MS)
  }

  private _scheduleReconnect() {
    const backoff = Math.min(1000 * 2 ** this.attempts, MAX_BACKOFF_MS)
    this.attempts++
    this.reconnectTimer = setTimeout(() => this._connect(), backoff)
  }

  private _cleanup() {
    if (this.pingTimer)      { clearInterval(this.pingTimer);  this.pingTimer = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null }
  }

  private _setStatus(s: WsStatus) {
    this.status = s
    this.onStatus(s)
  }

  getStatus() { return this.status }
}

// Singleton exportado
export const notificationSocket = new NotificationSocket()
