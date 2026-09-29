const WebSocket = require('ws');

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // socket -> clientInfo { role, user_id, session_id }
  }

  init(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] New client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[WebSocket] Client disconnected');
      });

      // Send connection acknowledgement
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'MediPass WebSocket Bridge Active' }));
    });
  }

  handleMessage(ws, data) {
    switch (data.type) {
      case 'REGISTER':
        // Client registers their identity (Patient or Doctor)
        this.clients.set(ws, {
          user_id: data.user_id,
          role: data.role,
          session_id: data.session_id || null,
        });
        ws.send(JSON.stringify({ type: 'REGISTERED', user_id: data.user_id, role: data.role }));
        break;

      case 'JOIN_SESSION':
        // Doctor or Patient joins a active QR session room
        const client = this.clients.get(ws) || {};
        client.session_id = data.session_id;
        this.clients.set(ws, client);
        break;

      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        break;

      default:
        console.log('[WebSocket] Received action:', data.type);
    }
  }

  /**
   * Broadcast Instant Revocation Kill-Switch event
   * Will instantly notify any doctor viewing this session!
   */
  notifyRevocation(session_id, patient_id) {
    const payload = JSON.stringify({
      type: 'CONSENT_REVOKED',
      session_id,
      patient_id,
      timestamp: new Date().toISOString(),
      message: 'CRITICAL ACCESS REVOCATION: The patient has toggled the instant live kill-switch. Consent is now terminated.',
    });

    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const client = this.clients.get(ws);
        // Send to any doctor viewing this session or patient
        if (client && (client.session_id === session_id || client.user_id === patient_id || client.role === 'DOCTOR')) {
          ws.send(payload);
        }
      }
    });
  }

  /**
   * Broadcast Scan Verification event to Patient (e.g. "Dr. Ananya Rao scanned your QR code")
   */
  notifyScanSuccess(patient_id, doctor_name, hospital, scopes) {
    const payload = JSON.stringify({
      type: 'QR_SCANNED_NOTIFICATION',
      patient_id,
      doctor_name,
      hospital,
      scopes,
      timestamp: new Date().toISOString(),
      message: `Your MediPass QR code was scanned by ${doctor_name} at ${hospital}. Access granted for: ${scopes.join(', ')}.`,
    });

    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const client = this.clients.get(ws);
        if (client && client.user_id === patient_id) {
          ws.send(payload);
        }
      }
    });
  }

  /**
   * Broadcast Emergency Break-Glass event to patient & system
   */
  notifyBreakGlass(patient_id, doctor_name, hospital, reason) {
    const payload = JSON.stringify({
      type: 'BREAK_GLASS_ALERT',
      patient_id,
      doctor_name,
      hospital,
      reason,
      timestamp: new Date().toISOString(),
      message: `EMERGENCY ALERT: Dr. ${doctor_name} activated Break-Glass protocol for your profile. Reason: ${reason}.`,
    });

    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  /**
   * Broadcast New Prescription / Audit event
   */
  notifyRecordAdded(patient_id, record) {
    const payload = JSON.stringify({
      type: 'RECORD_ADDED',
      patient_id,
      record,
      timestamp: new Date().toISOString(),
    });

    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const client = this.clients.get(ws);
        if (client && client.user_id === patient_id) {
          ws.send(payload);
        }
      }
    });
  }
}

module.exports = new WebSocketManager();
