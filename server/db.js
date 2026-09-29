/**
 * MediPass In-Memory Database & Seed Data Store
 * Supports JSON schema models for Users, MedicalRecords, ConsentSessions, and AuditLogs.
 */

const { encryptPayload, decryptPayload } = require('./crypto');

const db = {
  users: [
    {
      user_id: 'pat_001',
      name: 'John Doe',
      role: 'PATIENT',
      phone_number: '+919876543210',
      abha_id: '12-3456-7890-1234',
      age: 34,
      gender: 'Male',
      blood_group: 'O+',
      emergency_contact: '+919876500000 (Spouse: Sarah Doe)',
    },
    {
      user_id: 'pat_002',
      name: 'Rajesh Sharma',
      role: 'PATIENT',
      phone_number: '+919123456789',
      abha_id: '99-8877-6655-4433',
      age: 68,
      gender: 'Male',
      blood_group: 'B+',
      emergency_contact: '+919123499999 (Son: Amit Sharma)',
      elderly_mode_enabled: true,
    },
    {
      user_id: 'doc_001',
      name: 'Dr. Ananya Rao',
      role: 'DOCTOR',
      phone_number: '+919988776655',
      abha_id: 'DOC-IN-554433',
      medical_license: 'MED-884920',
      hospital: 'Apollo Care Hospital, Hyderabad',
      specialty: 'General Internal Medicine',
    },
    {
      user_id: 'doc_002',
      name: 'Dr. Vikramaditya Singh',
      role: 'DOCTOR',
      phone_number: '+919776655443',
      abha_id: 'DOC-IN-990011',
      medical_license: 'MED-331092',
      hospital: 'AIIMS Emergency & Trauma Center, New Delhi',
      specialty: 'Emergency Medicine',
    },
  ],

  medicalRecords: [
    // Patient 1: John Doe
    {
      record_id: 'rec_101',
      patient_id: 'pat_001',
      record_type: 'allergies',
      title: 'Critical Drug & Food Allergies',
      content_encrypted: encryptPayload({
        allergies: [
          { allergen: 'Penicillin', severity: 'HIGH / ANAPHYLAXIS', reaction: 'Acute respiratory distress, facial hives' },
          { allergen: 'Shellfish', severity: 'MODERATE', reaction: 'Skin rash, gastrointestinal distress' },
        ],
      }),
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
    {
      record_id: 'rec_102',
      patient_id: 'pat_001',
      record_type: 'prescriptions',
      title: 'Active Prescriptions',
      content_encrypted: encryptPayload({
        prescriptions: [
          { medicine: 'Amoxicillin 500mg', dosage: '1 Capsule', frequency: 'Twice daily (1-0-1)', duration: '5 days', instructions: 'Take after food. DO NOT take if penicillin allergic!' },
          { medicine: 'Paracetamol 650mg', dosage: '1 Tablet', frequency: 'As needed (max 3/day)', duration: '3 days', instructions: 'For fever above 100°F' },
          { medicine: 'Cetirizine 10mg', dosage: '1 Tablet', frequency: 'Once daily at night (0-0-1)', duration: '7 days', instructions: 'May cause drowsiness' },
        ],
      }),
      created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    },
    {
      record_id: 'rec_103',
      patient_id: 'pat_001',
      record_type: 'vitals',
      title: 'Baseline Vitals',
      content_encrypted: encryptPayload({
        vitals: {
          blood_pressure: '120/80 mmHg',
          heart_rate: '72 bpm',
          spo2: '98% on room air',
          temperature: '98.6 °F',
          weight: '74 kg',
          bmi: '23.4',
        },
      }),
      created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    },
    {
      record_id: 'rec_104',
      patient_id: 'pat_001',
      record_type: 'lab_results',
      title: 'Laboratory Diagnostic Report',
      content_encrypted: encryptPayload({
        lab_results: [
          { test_name: 'Complete Blood Count (CBC)', result: 'Normal', hemoglobin: '14.8 g/dL', wbc: '6,500 /mcL', platelets: '250,000 /mcL' },
          { test_name: 'Fasting Blood Sugar (FBS)', result: '95 mg/dL (Normal)', range: '70-99 mg/dL' },
        ],
      }),
      created_at: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
    },

    // Patient 2: Rajesh Sharma (Elderly)
    {
      record_id: 'rec_201',
      patient_id: 'pat_002',
      record_type: 'allergies',
      title: 'Drug Allergies',
      content_encrypted: encryptPayload({
        allergies: [
          { allergen: 'Sulfa Antibiotics (Sulfamethoxazole)', severity: 'HIGH', reaction: 'Severe skin rash, fever' },
          { allergen: 'Aspirin / NSAIDs', severity: 'MODERATE', reaction: 'Gastric irritation, bronchospasm' },
        ],
      }),
      created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    },
    {
      record_id: 'rec_202',
      patient_id: 'pat_002',
      record_type: 'prescriptions',
      title: 'Daily Chronic Care Medication',
      content_encrypted: encryptPayload({
        prescriptions: [
          { medicine: 'Metformin 500mg (Glucophage)', dosage: '1 Tablet', frequency: 'Twice daily after meals (1-0-1)', duration: 'Ongoing', instructions: 'Take with breakfast and dinner. Do not skip meals.' },
          { medicine: 'Amlodipine 5mg', dosage: '1 Tablet', frequency: 'Once daily morning (1-0-0)', duration: 'Ongoing', instructions: 'For blood pressure control.' },
          { medicine: 'Atorvastatin 10mg', dosage: '1 Tablet', frequency: 'Once daily bedtime (0-0-1)', duration: 'Ongoing', instructions: 'For cholesterol management.' },
        ],
      }),
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    },
    {
      record_id: 'rec_203',
      patient_id: 'pat_002',
      record_type: 'vitals',
      title: 'Cardiovascular Vitals',
      content_encrypted: encryptPayload({
        vitals: {
          blood_pressure: '138/85 mmHg (Mildly Elevated)',
          heart_rate: '68 bpm',
          spo2: '96% on room air',
          temperature: '98.4 °F',
          weight: '68 kg',
        },
      }),
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    },
    {
      record_id: 'rec_204',
      patient_id: 'pat_002',
      record_type: 'lab_results',
      title: 'HbA1c & Lipid Panel',
      content_encrypted: encryptPayload({
        lab_results: [
          { test_name: 'HbA1c (Glycated Hemoglobin)', result: '7.1%', status: 'Mildly Elevated Diabetes' },
          { test_name: 'Lipid Profile', result: 'LDL: 115 mg/dL, HDL: 45 mg/dL, Triglycerides: 160 mg/dL' },
        ],
      }),
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    },
  ],

  consentSessions: {},
  // Format: { [session_id]: { session_id, patient_id, scopes, status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'CONSUMED', created_at, expires_at } }

  consumedTokens: new Set(), // Track burned single-use JTIs to prevent replay attacks

  auditLogs: [
    {
      log_id: 'log_001',
      session_id: 'sess_init',
      patient_id: 'pat_001',
      doctor_id: 'doc_001',
      doctor_name: 'Dr. Ananya Rao',
      hospital: 'Apollo Care Hospital, Hyderabad',
      action: 'CONSENT_GRANTED',
      scopes: ['allergies', 'prescriptions', 'vitals'],
      timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      details: 'Patient scanned QR code and granted 45-second access window for consultation.',
    },
  ],
};

/**
 * DB Helper Functions
 */
function findUserByPhone(phone) {
  return db.users.find(u => u.phone_number === phone || u.phone_number.replace(/\s+/g, '') === phone.replace(/\s+/g, ''));
}

function findUserByAbha(abha) {
  return db.users.find(u => u.abha_id === abha);
}

function findUserById(id) {
  return db.users.find(u => u.user_id === id);
}

function getPatientRecords(patient_id, allowed_scopes = null) {
  const records = db.medicalRecords.filter(r => r.patient_id === patient_id);
  const decryptedRecords = records.map(r => {
    let payload = null;
    try {
      payload = decryptPayload(r.content_encrypted);
    } catch (e) {
      payload = { error: 'Failed to decrypt payload' };
    }
    return {
      record_id: r.record_id,
      patient_id: r.patient_id,
      record_type: r.record_type,
      title: r.title,
      content: payload,
      created_at: r.created_at,
    };
  });

  if (!allowed_scopes || allowed_scopes.includes('all')) {
    return decryptedRecords;
  }

  return decryptedRecords.filter(r => allowed_scopes.includes(r.record_type));
}

function addMedicalRecord(patient_id, record_type, title, content_obj) {
  const newRecord = {
    record_id: 'rec_' + Date.now(),
    patient_id,
    record_type,
    title,
    content_encrypted: encryptPayload(content_obj),
    created_at: new Date().toISOString(),
  };
  db.medicalRecords.unshift(newRecord);
  return newRecord;
}

function createConsentSession(patient_id, scopes) {
  const session_id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const session = {
    session_id,
    patient_id,
    scopes: scopes || ['allergies', 'prescriptions', 'vitals', 'lab_results'],
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
  };
  db.consentSessions[session_id] = session;
  return session;
}

function revokeConsentSession(session_id) {
  if (db.consentSessions[session_id]) {
    db.consentSessions[session_id].status = 'REVOKED';
    db.consentSessions[session_id].revoked_at = new Date().toISOString();
    return db.consentSessions[session_id];
  }
  return null;
}

function addAuditLog(log_entry) {
  const log = {
    log_id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    ...log_entry,
  };
  db.auditLogs.unshift(log);
  return log;
}

function getAuditLogsForPatient(patient_id) {
  return db.auditLogs.filter(l => l.patient_id === patient_id);
}

module.exports = {
  db,
  findUserByPhone,
  findUserByAbha,
  findUserById,
  getPatientRecords,
  addMedicalRecord,
  createConsentSession,
  revokeConsentSession,
  addAuditLog,
  getAuditLogsForPatient,
};
