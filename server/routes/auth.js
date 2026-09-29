const express = require('express');
const router = express.Router();
const { findUserByPhone, db } = require('../db');

/**
 * Request OTP (simulated)
 */
router.post('/otp-request', (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const user = findUserByPhone(phone_number);
  // Generate mock 6-digit OTP
  const mockOtp = '123456';

  return res.json({
    success: true,
    message: `OTP sent to ${phone_number}. (Demo Mode: use OTP 123456)`,
    user_found: !!user,
    demo_otp: mockOtp,
  });
});

/**
 * Verify OTP & Login
 */
router.post('/otp-verify', (req, res) => {
  const { phone_number, otp } = req.body;

  if (!phone_number || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP are required' });
  }

  if (otp !== '123456' && otp !== '000000') {
    return res.status(401).json({ error: 'Invalid OTP code. Please enter 123456 for demo.' });
  }

  let user = findUserByPhone(phone_number);

  if (!user) {
    // Auto-create standard demo patient if unknown number provided
    user = {
      user_id: 'pat_' + Date.now(),
      name: 'New Patient (' + phone_number.slice(-4) + ')',
      role: 'PATIENT',
      phone_number,
      abha_id: '11-2233-4455-' + Math.floor(1000 + Math.random() * 9000),
      age: 30,
      gender: 'Other',
      blood_group: 'O+',
      emergency_contact: 'Not Specified',
    };
    db.users.push(user);
  }

  return res.json({
    success: true,
    user,
    token: 'jwt_auth_session_token_' + user.user_id,
  });
});

/**
 * Get all available demo accounts for quick switcher UI
 */
router.get('/demo-accounts', (req, res) => {
  return res.json({
    patients: db.users.filter(u => u.role === 'PATIENT'),
    doctors: db.users.filter(u => u.role === 'DOCTOR'),
  });
});

module.exports = router;
