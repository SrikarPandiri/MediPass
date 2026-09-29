const express = require('express');
const router = express.Router();
const {
  db,
  findUserByPhone,
  findUserByAbha,
  findUserById,
  getPatientRecords,
  addAuditLog,
  addMedicalRecord,
} = require('../db');
const wsManager = require('../websocket');
const config = require('../config');

/**
 * Break-Glass Emergency Override Endpoint (Module D)
 * Bypasses QR check in life-threatening scenarios with 60-second restricted view
 */
router.post('/break-glass', (req, res) => {
  const {
    identifier, // Phone number or ABHA ID
    doctor_id,
    doctor_name,
    medical_license,
    hospital,
    emergency_reason,
  } = req.body;

  if (!identifier || !medical_license || !emergency_reason) {
    return res.status(400).json({
      error: 'Identifier (Mobile/ABHA), Doctor License ID, and Emergency Justification Reason are required.',
    });
  }

  // Find patient by Phone or ABHA ID
  let patient = findUserByPhone(identifier) || findUserByAbha(identifier) || findUserById(identifier);

  if (!patient) {
    return res.status(404).json({
      error: 'Patient profile not found for provided Mobile/ABHA ID.',
    });
  }

  const docName = doctor_name || 'Dr. Vikramaditya Singh';
  const hosp = hospital || 'AIIMS Emergency & Trauma Center';
  const session_id = 'break_glass_' + Date.now();

  // Create immutable Audit Log for Break-Glass Access
  const auditLog = addAuditLog({
    session_id,
    patient_id: patient.user_id,
    doctor_id: doctor_id || 'doc_002',
    doctor_name: docName,
    medical_license,
    hospital: hosp,
    action: 'BREAK_GLASS_EMERGENCY_OVERRIDE',
    scopes: ['allergies', 'blood_group', 'emergency_contact', 'vitals'],
    details: `EMERGENCY BREAK-GLASS ACTIVATED. Reason: "${emergency_reason}". Medical License: ${medical_license}. Restricted 60s emergency window opened.`,
  });

  // Trigger Mock SMS alert simulation
  const mockSmsPayload = {
    to: patient.phone_number,
    message: `[MEDIPASS EMERGENCY ALERT] Dr. ${docName} (${hosp}) used Break-Glass protocol to access your critical health records. Reason: ${emergency_reason}. If this was unauthorized, report immediately.`,
    sent_at: new Date().toISOString(),
  };

  // Notify via WebSocket
  wsManager.notifyBreakGlass(patient.user_id, docName, hosp, emergency_reason);

  // Fetch restricted emergency record (Blood Group + Severe Allergies + Vitals + Emergency Contact)
  const fullRecords = getPatientRecords(patient.user_id, ['allergies', 'vitals']);
  const emergencyAllergies = fullRecords.filter(r => r.record_type === 'allergies');
  const emergencyVitals = fullRecords.filter(r => r.record_type === 'vitals');

  return res.json({
    success: true,
    message: 'EMERGENCY BREAK-GLASS OVERRIDE EXECUTED. Immutable security audit recorded.',
    break_glass_session: {
      session_id,
      patient: {
        user_id: patient.user_id,
        name: patient.name,
        abha_id: patient.abha_id,
        phone_number: patient.phone_number,
        blood_group: patient.blood_group,
        emergency_contact: patient.emergency_contact,
        age: patient.age,
        gender: patient.gender,
      },
      emergency_records: {
        allergies: emergencyAllergies,
        vitals: emergencyVitals,
      },
      expires_in_seconds: config.BREAK_GLASS_WINDOW_SECONDS,
      audit_log_id: auditLog.log_id,
      mock_sms_sent: mockSmsPayload,
    },
  });
});

/**
 * "John Doe" Universal Emergency Fallback Intake (Module D)
 * Creates temporary emergency intake profile when patient is unidentified
 */
router.post('/john-doe', (req, res) => {
  const { doctor_name, hospital, initial_findings, estimated_age_group, gender, triage_level } = req.body;

  const johnDoeId = 'john_doe_' + Date.now();
  const tempAbha = 'TEMP-EMG-' + Math.floor(100000 + Math.random() * 900000);

  const johnDoePatient = {
    user_id: johnDoeId,
    name: 'Unidentified Patient (John/Jane Doe)',
    role: 'PATIENT',
    is_john_doe: true,
    phone_number: 'UNIDENTIFIED',
    abha_id: tempAbha,
    age: estimated_age_group || 'Approx. 30-40',
    gender: gender || 'Unspecified',
    blood_group: 'UNKNOWN (Crossmatch Required)',
    emergency_contact: 'Trauma Team Intake',
  };

  db.users.push(johnDoePatient);

  const initialRecord = addMedicalRecord(johnDoeId, 'vitals', 'Emergency Trauma Room Intake Findings', {
    triage_level: triage_level || 'RED / CRITICAL',
    initial_findings: initial_findings || 'Unconscious patient brought to ER via ambulance. No physical ID found.',
    admitted_by: doctor_name || 'Dr. Vikramaditya Singh',
    hospital: hospital || 'AIIMS Emergency & Trauma Center',
    intake_time: new Date().toISOString(),
  });

  addAuditLog({
    session_id: 'john_doe_intake_' + Date.now(),
    patient_id: johnDoeId,
    doctor_id: 'doc_002',
    doctor_name: doctor_name || 'Dr. Vikramaditya Singh',
    hospital: hospital || 'AIIMS Emergency & Trauma Center',
    action: 'JOHN_DOE_EMERGENCY_INTAKE',
    scopes: ['all'],
    details: `Created temporary emergency intake chart [${tempAbha}] for unidentified patient.`,
  });

  return res.json({
    success: true,
    message: 'Temporary John Doe Emergency Chart created successfully.',
    patient: johnDoePatient,
    initial_record: initialRecord,
  });
});

/**
 * Retroactive Linking of John Doe Emergency Session to Permanent Profile (Module D)
 */
router.post('/link-john-doe', (req, res) => {
  const { john_doe_id, target_patient_identifier, doctor_name } = req.body;

  if (!john_doe_id || !target_patient_identifier) {
    return res.status(400).json({ error: 'john_doe_id and target_patient_identifier (Phone or ABHA ID) are required.' });
  }

  const johnDoePatient = findUserById(john_doe_id);
  let permanentPatient = findUserByPhone(target_patient_identifier) || findUserByAbha(target_patient_identifier) || findUserById(target_patient_identifier);

  if (!johnDoePatient || !johnDoePatient.is_john_doe) {
    return res.status(404).json({ error: 'Valid John Doe emergency chart not found.' });
  }

  if (!permanentPatient) {
    return res.status(404).json({ error: 'Target permanent patient profile not found for provided identifier.' });
  }

  // Move all medical records from John Doe to Permanent Patient
  let transferredCount = 0;
  db.medicalRecords.forEach((rec) => {
    if (rec.patient_id === john_doe_id) {
      rec.patient_id = permanentPatient.user_id;
      transferredCount++;
    }
  });

  // Mark John Doe user as linked
  johnDoePatient.linked_to = permanentPatient.user_id;
  johnDoePatient.status = 'LINKED';

  addAuditLog({
    session_id: 'link_' + Date.now(),
    patient_id: permanentPatient.user_id,
    doctor_id: 'doc_002',
    doctor_name: doctor_name || 'Dr. Vikramaditya Singh',
    hospital: 'AIIMS Emergency & Trauma Center',
    action: 'JOHN_DOE_RETROACTIVE_LINK',
    scopes: ['all'],
    details: `Retroactively linked temporary emergency chart ${john_doe_id} to permanent profile ${permanentPatient.name} (${permanentPatient.abha_id}). Transferred ${transferredCount} emergency clinical records.`,
  });

  return res.json({
    success: true,
    message: `Successfully retroactively linked emergency intake chart to permanent profile of ${permanentPatient.name}.`,
    transferred_records_count: transferredCount,
    permanent_patient: permanentPatient,
  });
});

module.exports = router;
