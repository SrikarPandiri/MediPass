/**
 * MediPass Real-Time WebSocket Client
 * Connects to server for live state synchronization and instant revocation kill-switch events.
 */

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.userId = null;
    this.userRole = null;
    this.sessionId = null;
    this.listeners = new Map();
  }

  connect(userId = 'pat_001', role = 'PATIENT') {
    this.userId = userId;
    this.userRole = role;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS Client] WebSocket connected successfully.');
        this.register();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('[WS Client] Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        console.warn('[WS Client] Connection lost. Retrying in 3 seconds...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[WS Client] Error:', err);
      };
    } catch (err) {
      console.error('[WS Client] Setup error:', err);
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.userId, this.userRole);
    }, 3000);
  }

  register() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'REGISTER',
        user_id: this.userId,
        role: this.userRole,
        session_id: this.sessionId,
      }));
    }
  }

  joinSession(sessionId) {
    this.sessionId = sessionId;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'JOIN_SESSION',
        session_id: sessionId,
      }));
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  handleMessage(data) {
    console.log('[WS Client] Received message:', data.type, data);

    // Trigger registered event listeners
    if (this.listeners.has(data.type)) {
      this.listeners.get(data.type).forEach(cb => cb(data));
    }

    // Default global actions
    if (data.type === 'CONSENT_REVOKED') {
      if (window.handleConsentRevoked) {
        window.handleConsentRevoked(data);
      }
    } else if (data.type === 'QR_SCANNED_NOTIFICATION') {
      if (window.showToast) {
        window.showToast(`🚨 SCAN ALERT: ${data.message}`, 'info', 6000);
      }
    } else if (data.type === 'BREAK_GLASS_ALERT') {
      if (window.showToast) {
        window.showToast(`⚠️ EMERGENCY ALERT: ${data.message}`, 'error', 8000);
      }
    } else if (data.type === 'RECORD_ADDED') {
      if (window.patientPortal && window.patientPortal.fetchPatientData) {
        window.patientPortal.fetchPatientData();
      }
    }
  }
}

window.wsClient = new WebSocketClient();
