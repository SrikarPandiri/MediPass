const express = require('express');
const router = express.Router();
const {
  db,
  findUserById,
  getPatientRecords,
  addMedicalRecord,
  addAuditLog,
  getAuditLogsForPatient,
} = require('../db');
const wsManager = require('../websocket');

/**
 * Get full patient records (Patient Portal View)
 */
router.get('/patient/:patient_id', (req, res) => {
  const { patient_id } = req.params;
  const patient = findUserById(patient_id);

  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const records = getPatientRecords(patient_id, ['all']);
  const auditLogs = getAuditLogsForPatient(patient_id);

  return res.json({
    success: true,
    patient,
    records,
    audit_logs: auditLogs,
  });
});

/**
 * Doctor submits Post-Consultation Prescription / Clinical Note (Module B)
 */
router.post('/prescription', (req, res) => {
  const {
    patient_id,
    doctor_id,
    doctor_name,
    hospital,
    diagnosis,
    prescriptions,
    vitals,
    doctor_notes,
    session_id,
    is_offline_sync,
  } = req.body;

  if (!patient_id || !diagnosis) {
    return res.status(400).json({ error: 'patient_id and diagnosis are required' });
  }

  const docName = doctor_name || 'Dr. Ananya Rao';
  const hosp = hospital || 'Apollo Care Hospital';

  // 1. Add Prescription record
  const rxRecord = addMedicalRecord(patient_id, 'prescriptions', `Consultation Note: ${diagnosis}`, {
    diagnosis,
    doctor_name: docName,
    hospital: hosp,
    prescriptions: prescriptions || [],
    notes: doctor_notes || '',
    consultation_date: new Date().toISOString(),
  });

  // 2. If vitals provided, add vitals record
  if (vitals && Object.keys(vitals).length > 0) {
    addMedicalRecord(patient_id, 'vitals', `Vitals recorded by ${docName}`, {
      vitals,
      doctor_name: docName,
    });
  }

  // 3. Log Audit Entry
  addAuditLog({
    session_id: session_id || 'sess_consultation',
    patient_id,
    doctor_id: doctor_id || 'doc_001',
    doctor_name: docName,
    hospital: hosp,
    action: is_offline_sync ? 'POST_CONSULTATION_OFFLINE_SYNC' : 'POST_CONSULTATION_UPDATE',
    scopes: ['prescriptions', 'vitals'],
    details: `Added new prescription & clinical diagnosis: "${diagnosis}". ${is_offline_sync ? '(Synced from Optimistic Local Queue)' : ''}`,
  });

  // 4. Notify patient via WebSocket
  wsManager.notifyRecordAdded(patient_id, rxRecord);

  return res.json({
    success: true,
    message: is_offline_sync
      ? 'Offline optimistic prescription queue successfully synced to server database!'
      : 'Post-consultation prescription recorded successfully.',
    record: rxRecord,
  });
});

/**
 * Get patient audit timeline
 */
router.get('/audit-logs/:patient_id', (req, res) => {
  const { patient_id } = req.params;
  const logs = getAuditLogsForPatient(patient_id);
  return res.json({
    success: true,
    patient_id,
    logs,
  });
});

module.exports = router;
