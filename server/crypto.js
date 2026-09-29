const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');

// Ensure 32-byte key for AES-256
const get32ByteKey = (secret) => {
  return crypto.createHash('sha256').update(String(secret)).digest();
};

const KEY = get32ByteKey(config.AES_SECRET_KEY);
const IV_LENGTH = 16;

/**
 * Encrypt payload using AES-256-CBC
 */
function encryptPayload(data) {
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption error:', err);
    throw new Error('Failed to encrypt clinical payload');
  }
}

/**
 * Decrypt AES-256-CBC string payload
 */
function decryptPayload(encryptedText) {
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedData = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    let decrypted = decipher.update(encryptedData, 'utf8', 'utf8');
    decrypted += decipher.final('utf8');
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  } catch (err) {
    console.error('Decryption error:', err);
    throw new Error('Failed to decrypt clinical payload');
  }
}

/**
 * Generate a signed JWT for Dynamic Rolling QR Code
 * @param {Object} params - { patient_id, session_id, scopes, offline_generated }
 */
function generateQRToken(params) {
  const payload = {
    patient_id: params.patient_id,
    session_id: params.session_id,
    scopes: params.scopes || ['allergies', 'prescriptions'],
    jti: crypto.randomUUID(), // unique token identifier to enforce single-use burn
    offline_generated: !!params.offline_generated,
    iat: Math.floor(Date.now() / 1000),
  };

  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.QR_EXPIRATION_SECONDS,
  });

  return {
    token,
    jti: payload.jti,
    expires_at: new Date(Date.now() + config.QR_EXPIRATION_SECONDS * 1000).toISOString(),
    payload,
  };
}

/**
 * Verify QR Token
 */
function verifyQRToken(token) {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    return { valid: true, decoded };
  } catch (err) {
    let reason = 'Invalid token signature';
    if (err.name === 'TokenExpiredError') {
      reason = 'QR Token expired (45s window exceeded)';
    }
    return { valid: false, reason, error: err.message };
  }
}

module.exports = {
  encryptPayload,
  decryptPayload,
  generateQRToken,
  verifyQRToken,
};
