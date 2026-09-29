const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./server/config');

const authRoutes = require('./server/routes/auth');
const qrRoutes = require('./server/routes/qr');
const recordsRoutes = require('./server/routes/records');
const emergencyRoutes = require('./server/routes/emergency');
const aiRoutes = require('./server/routes/ai');
const wsManager = require('./server/websocket');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/ai', aiRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    app: 'MediPass: Patient-Held Consent-Driven Health Record System',
    version: '1.0.0-PROTOTYPE',
    timestamp: new Date().toISOString(),
    features: [
      '45s Dynamic Rolling QR Code (JWT)',
      'Instant Revocation Kill-Switch (WebSockets)',
      'Sub-3s Zero-Login Doctor Scanner (html5-qrcode)',
      'IndexedDB Offline-First Mesh Architecture',
      'Break-Glass & John Doe Emergency Protocols',
      'AI OCR Prescription Digitizer & Multilingual TTS',
    ],
  });
});

// Fallback route for SPA
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize WebSocket server
wsManager.init(server);

// Start Server if executed directly
if (require.main === module) {
  server.listen(config.PORT, () => {
    console.log(`=======================================================`);
    console.log(` MediPass Health Record & Dynamic QR Access System `);
    console.log(` Server running on http://localhost:${config.PORT}`);
    console.log(` WebSocket server listening on ws://localhost:${config.PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
