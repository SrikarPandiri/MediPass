const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'medipass_super_secret_jwt_key_2026_x89f7',
  AES_SECRET_KEY: process.env.AES_SECRET_KEY || 'medipass_aes256_secret_key_32b_len!!',
  QR_EXPIRATION_SECONDS: 45, // 45-second token rotation
  BREAK_GLASS_WINDOW_SECONDS: 60, // 60-second emergency access window
};
