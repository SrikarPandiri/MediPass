/**
 * MediPass Modules B, D & E: Doctor Point-of-Care Portal Controller
 * Zero-login friction scanner (html5-qrcode), sub-3s record renderer,
 * post-consultation prescription logger with AI OCR paper slip digitizer,
 * Break-Glass emergency override, John Doe intake & retroactive linking.
 */

class DoctorPortal {
  constructor() {
    this.currentDoctor = {
      doctor_id: 'doc_001',
      name: 'Dr. Ananya Rao',
      license: 'MED-884920',
      hospital: 'Apollo Care Hospital, Hyderabad',
    };

    this.activePatientSession = null;
    this.html5QrScanner = null;
    this.isScanning = false;
    this.breakGlassTimer = null;
    this.breakGlassSecondsRemaining = 60;
  }

  init() {
    this.renderDoctorHeader();
    this.setupRevocationListener();

    if (window.wsClient) {
      window.wsClient.connect(this.currentDoctor.doctor_id, 'DOCTOR');
    }
  }

  renderDoctorHeader() {
    const headerEl = document.getElementById('doctor-profile-header');
    if (!headerEl) return;

    headerEl.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/90 border border-slate-700/60 backdrop-blur-md text-white shadow-xl">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-bold text-white shadow-md shadow-emerald-500/20">
            <i class="fa-solid fa-user-doctor"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold text-slate-100">${this.currentDoctor.name}</h3>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Verified Clinician</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              License: <span class="font-mono text-emerald-400">${this.currentDoctor.license}</span> • ${this.currentDoctor.hospital}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Break-Glass Emergency Button -->
          <button onclick="doctorPortal.openBreakGlassModal()" class="px-3.5 py-2 rounded-xl bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/50 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-900/30 animate-pulse">
            <i class="fa-solid fa-[#fa5252] fa-kit-medical text-red-400"></i>
            <span>🚨 BREAK-GLASS EMERGENCY</span>
          </button>

          <!-- John Doe Emergency Intake Button -->
          <button onclick="doctorPortal.openJohnDoeModal()" class="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-2 transition-all">
            <i class="fa-solid fa-user-ninja"></i>
            <span>JOHN DOE INTAKE</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Listen for instant live revocation kill-switch signals via WebSocket
   */
  setupRevocationListener() {
    window.handleConsentRevoked = (data) => {
      if (this.activePatientSession && (this.activePatientSession.session_id === data.session_id || this.activePatientSession.patient.user_id === data.patient_id)) {
        // Lock out screen immediately!
        this.lockoutScreenForRevocation(data.message);
      }
    };
  }

  lockoutScreenForRevocation(message) {
    const viewer = document.getElementById('doctor-record-viewer');
    if (!viewer) return;

    this.activePatientSession = null;

    viewer.innerHTML = `
      <div class="p-8 rounded-2xl bg-red-950/80 border-2 border-red-600 text-center space-y-4 shadow-2xl backdrop-blur-md animate-bounce-short">
        <div class="w-16 h-16 rounded-full bg-red-600/30 text-red-400 flex items-center justify-center mx-auto text-3xl">
          <i class="fa-solid fa-ban"></i>
        </div>
        <h3 class="text-2xl font-extrabold text-red-200 uppercase tracking-wide">ACCESS INSTANTLY REVOKED</h3>
        <p class="text-sm text-red-300/90 max-w-lg mx-auto">
          ${message || 'The patient activated their instant live revocation kill-switch. Clinical payload has been zeroed and session invalidated.'}
        </p>
        <button onclick="doctorPortal.resetScanner()" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700">
          <i class="fa-solid fa-arrow-rotate-left mr-1.5"></i> Scan Next Patient QR
        </button>
      </div>
    `;

    window.showToast('🛑 CLINICAL LOCKOUT: Patient revoked consent session live.', 'error', 7000);
  }

  /**
   * Start Camera Scanner using html5-qrcode library
   */
  startCameraScanner() {
    const readerDiv = document.getElementById('qr-reader');
    if (!readerDiv) return;

    if (this.html5QrScanner) {
      this.html5QrScanner.clear();
    }

    readerDiv.classList.remove('hidden');

    this.html5QrScanner = new Html5QrcodeScanner('qr-reader', {
      fps: 10,
      qrbox: { width: 220, height: 220 },
    }, false);

    this.html5QrScanner.render(
      (decodedText) => {
        // Successfully scanned code!
        console.log('[Scanner] QR Code scanned:', decodedText);
        this.html5QrScanner.clear();
        readerDiv.classList.add('hidden');
        this.verifyAndDisplayQRToken(decodedText);
      },
      (error) => {
        // Scanning frame error (normal while scanning)
      }
    );
  }

  /**
   * Quick Demo Scan Shortcut Button (Instant testing without camera)
   */
  async quickDemoScan(patientId = 'pat_001') {
    window.showToast('Simulating zero-login camera scan of patient QR code...', 'info');

    // Request active token from backend
    try {
      const res = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          scopes: ['allergies', 'prescriptions', 'vitals', 'lab_results'],
        }),
      });

      const data = await res.json();
      if (data.success && data.token) {
        this.verifyAndDisplayQRToken(data.token);
      }
    } catch (err) {
      console.error('Quick scan failed:', err);
    }
  }

  /**
   * Parse & Verify scanned QR JWT token against backend API in < 3s (Module B & F)
   */
  async verifyAndDisplayQRToken(token) {
    const viewer = document.getElementById('doctor-record-viewer');
    if (viewer) {
      viewer.innerHTML = `
        <div class="p-8 text-center space-y-3 bg-slate-800/60 rounded-2xl border border-slate-700">
          <div class="inline-block animate-spin text-cyan-400 text-3xl">
            <i class="fa-solid fa-circle-notch"></i>
          </div>
          <p class="text-sm font-semibold text-slate-200">Verifying JWT signature & single-use token burn...</p>
          <p class="text-xs text-slate-400">Target latency: &lt; 3.0s point-of-care speed</p>
        </div>
      `;
    }

    const startTime = performance.now();

    try {
      const res = await fetch('/api/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          doctor_id: this.currentDoctor.doctor_id,
          doctor_name: this.currentDoctor.name,
          hospital: this.currentDoctor.hospital,
        }),
      });

      const data = await res.json();
      const endTime = performance.now();
      const elapsedMs = Math.round(endTime - startTime);

      if (!data.success) {
        // Check if single-use burn or revocation error
        viewer.innerHTML = `
          <div class="p-6 rounded-2xl bg-amber-950/70 border border-amber-600 text-slate-200 space-y-3">
            <div class="flex items-center gap-3">
              <i class="fa-solid fa-triangle-exclamation text-amber-400 text-2xl"></i>
              <h4 class="font-bold text-amber-300 text-base">QR Consent Validation Failed</h4>
            </div>
            <p class="text-xs text-amber-200">${data.reason || 'Invalid or expired QR code.'}</p>
            <div class="pt-2">
              <button onclick="doctorPortal.resetScanner()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700">
                Try Scanning Fresh QR
              </button>
            </div>
          </div>
        `;
        return;
      }

      this.activePatientSession = data;

      // Join WebSocket session room
      if (window.wsClient) {
        window.wsClient.joinSession(data.session_id);
      }

      this.renderPatientRecordView(data, elapsedMs);

    } catch (err) {
      console.error('Error verifying QR token:', err);
      window.showToast('Network error during QR verification.', 'error');
    }
  }

  /**
   * Render Decrypted Point-of-Care Health Records in Doctor Portal View
   */
  renderPatientRecordView(sessionData, latencyMs) {
    const viewer = document.getElementById('doctor-record-viewer');
    if (!viewer) return;

    const patient = sessionData.patient;
    const records = sessionData.records || [];
    const scopes = sessionData.granted_scopes || [];

    viewer.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Patient Banner -->
        <div class="p-5 rounded-2xl bg-slate-800/90 border border-cyan-500/40 shadow-xl space-y-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-xl font-bold text-slate-100">${patient.name}</h3>
                <span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <i class="fa-solid fa-circle-check mr-1"></i> Consent Validated
                </span>
                <span class="px-2 py-0.5 text-xs font-mono rounded bg-slate-700 text-cyan-400">
                  ${latencyMs}ms Latency
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-1">
                ABHA ID: <span class="font-mono text-cyan-400 font-semibold">${patient.abha_id}</span> • Phone: ${patient.phone_number}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <span class="px-3 py-1 text-xs font-bold rounded-lg bg-red-500/20 text-red-300 border border-red-500/30">
                Blood Group: ${patient.blood_group}
              </span>
              <span class="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-700 text-slate-300">
                ${patient.age} Yrs / ${patient.gender}
              </span>
            </div>
          </div>

          <!-- Granted Scopes Bar -->
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-slate-400 font-medium">Granted Scopes:</span>
              ${scopes.map(s => `
                <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold uppercase">
                  ${s}
                </span>
              `).join('')}
            </div>

            <span class="text-xs text-slate-400 italic">
              Single-Use JTI Burned • AES-256 Payload Decrypted
            </span>
          </div>
        </div>

        <!-- Health Records Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Allergies Card -->
          <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h4 class="font-bold text-slate-200 text-sm flex items-center gap-2">
              <i class="fa-solid fa-triangle-exclamation text-red-400"></i>
              <span>Allergies & Contraindications</span>
            </h4>
            ${this.renderRecordCategory(records, 'allergies')}
          </div>

          <!-- Active Prescriptions Card -->
          <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h4 class="font-bold text-slate-200 text-sm flex items-center gap-2">
              <i class="fa-solid fa-pills text-cyan-400"></i>
              <span>Active Prescriptions</span>
            </h4>
            ${this.renderRecordCategory(records, 'prescriptions')}
          </div>

          <!-- Vitals Card -->
          <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h4 class="font-bold text-slate-200 text-sm flex items-center gap-2">
              <i class="fa-solid fa-heart-pulse text-emerald-400"></i>
              <span>Recent Vitals</span>
            </h4>
            ${this.renderRecordCategory(records, 'vitals')}
          </div>

          <!-- Lab Diagnostics Card -->
          <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h4 class="font-bold text-slate-200 text-sm flex items-center gap-2">
              <i class="fa-solid fa-vial text-purple-400"></i>
              <span>Diagnostic Lab Results</span>
            </h4>
            ${this.renderRecordCategory(records, 'lab_results')}
          </div>
        </div>

        <!-- Post-Consultation Form (Module B & E) -->
        <div class="p-5 rounded-2xl bg-slate-800/90 border border-teal-500/40 shadow-xl space-y-4">
          <div class="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <h4 class="font-bold text-slate-100 text-base flex items-center gap-2">
              <i class="fa-solid fa-notes-medical text-teal-400"></i>
              <span>Post-Consultation Prescription & Clinical Entry</span>
            </h4>

            <!-- AI OCR Digitizer Action Button (Module E) -->
            <button onclick="doctorPortal.triggerAIOCRDigitizer()" class="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center gap-1.5">
              <i class="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
              <span>Snap & Extract Paper Slip (AI OCR)</span>
            </button>
          </div>

          <form id="post-consultation-form" onsubmit="doctorPortal.submitPrescriptionForm(event)" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Clinical Diagnosis *</label>
                <input type="text" id="rx-diagnosis" required placeholder="e.g. Acute Bacterial Upper Respiratory Infection" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Prescription Medication *</label>
                <input type="text" id="rx-medicine" required placeholder="e.g. Amoxicillin 500mg Capsules" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-teal-400" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Dosage & Frequency</label>
                <input type="text" id="rx-dosage" placeholder="e.g. 1 Cap twice daily (1-0-1)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Duration</label>
                <input type="text" id="rx-duration" placeholder="e.g. 5 Days" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Patient Instructions</label>
                <input type="text" id="rx-instructions" placeholder="e.g. Take after meals with warm water." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-teal-400" />
              </div>
            </div>

            <!-- Multilingual Auto-Translator Tool (Module E) -->
            <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="fa-solid fa-language text-cyan-400 text-lg"></i>
                <span class="text-xs text-slate-300">Auto-Translate Instructions into Regional Language:</span>
              </div>
              <div class="flex items-center gap-2 w-full md:w-auto">
                <select id="target-lang-select" class="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none">
                  <option value="telugu">Telugu (తెలుగు)</option>
                  <option value="hindi">Hindi (हिंदी)</option>
                  <option value="tamil">Tamil (தமிழ்)</option>
                  <option value="spanish">Spanish (Español)</option>
                </select>
                <button type="button" onclick="doctorPortal.translatePrescriptionInstructions()" class="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold">
                  Translate & Play
                </button>
              </div>
            </div>

            <div id="translation-preview-box" class="hidden p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-200">
            </div>

            <div class="flex justify-end gap-3 pt-2 border-t border-slate-700/60">
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-500/20">
                <i class="fa-solid fa-paper-plane mr-1.5"></i> Save & Record Post-Consultation Note
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  renderRecordCategory(records, categoryKey) {
    const items = records.filter(r => r.record_type === categoryKey);
    if (items.length === 0) {
      return `<p class="text-xs text-slate-400 italic">No ${categoryKey} recorded under granted scopes.</p>`;
    }

    return items.map(item => {
      const content = item.content || {};
      if (categoryKey === 'allergies') {
        const list = content.allergies || [];
        return list.map(a => `
          <div class="p-2 rounded-lg bg-red-950/40 border border-red-800/40 text-xs flex justify-between items-center">
            <div>
              <span class="font-bold text-red-300">${a.allergen}</span>
              <p class="text-slate-300 text-xs">${a.reaction}</p>
            </div>
            <span class="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-xs">${a.severity}</span>
          </div>
        `).join('');
      } else if (categoryKey === 'prescriptions') {
        const rx = content.prescriptions || [];
        return rx.map(p => `
          <div class="p-2 rounded-lg bg-slate-900/60 border border-slate-700/40 text-xs space-y-1">
            <span class="font-bold text-cyan-300">${p.medicine}</span>
            <p class="text-slate-300">${p.dosage} • ${p.frequency}</p>
            <p class="text-slate-400 italic">${p.instructions || ''}</p>
          </div>
        `).join('');
      } else if (categoryKey === 'vitals') {
        const v = content.vitals || {};
        return `
          <div class="text-xs text-slate-300 space-y-1 bg-slate-900/60 p-2.5 rounded-lg">
            <p>BP: <strong class="text-cyan-300">${v.blood_pressure || 'N/A'}</strong> | Heart Rate: <strong class="text-emerald-300">${v.heart_rate || 'N/A'}</strong></p>
            <p>SpO2: <strong class="text-blue-300">${v.spo2 || 'N/A'}</strong> | Temp: <strong class="text-amber-300">${v.temperature || 'N/A'}</strong></p>
          </div>
        `;
      } else {
        return `<pre class="text-xs text-slate-300 bg-slate-900 p-2 rounded">${JSON.stringify(content, null, 2)}</pre>`;
      }
    }).join('');
  }

  /**
   * AI OCR Prescription Photo Digitizer Simulation (Module E)
   */
  async triggerAIOCRDigitizer() {
    window.showToast('🤖 AI Vision Model scanning paper prescription slip...', 'info');

    try {
      const res = await fetch('/api/ai/digitize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_id: 'sample_1' }),
      });

      const data = await res.json();
      if (data.success && data.extracted_data) {
        const ext = data.extracted_data;

        // Auto-fill form fields!
        const diagInput = document.getElementById('rx-diagnosis');
        const medInput = document.getElementById('rx-medicine');
        const dosInput = document.getElementById('rx-dosage');
        const durInput = document.getElementById('rx-duration');
        const insInput = document.getElementById('rx-instructions');

        if (diagInput) diagInput.value = 'Acute Bronchitis & Lower Respiratory Infection';
        if (medInput) medInput.value = ext.medication;
        if (dosInput) dosInput.value = `${ext.dosage} - ${ext.frequency}`;
        if (durInput) durInput.value = ext.duration;
        if (insInput) insInput.value = `${ext.instructions} (${ext.warnings})`;

        window.showToast(`✨ AI OCR Extracted: ${ext.medication} (${Math.round(ext.confidence * 100)}% Confidence)`, 'success', 5000);
      }
    } catch (err) {
      console.error('OCR Error:', err);
    }
  }

  /**
   * Multilingual Translation (Module E)
   */
  async translatePrescriptionInstructions() {
    const insInput = document.getElementById('rx-instructions');
    const langSelect = document.getElementById('target-lang-select');
    const previewBox = document.getElementById('translation-preview-box');

    if (!insInput || !insInput.value) {
      window.showToast('Please enter patient instructions before translating.', 'error');
      return;
    }

    const textToTranslate = insInput.value;
    const targetLang = langSelect ? langSelect.value : 'telugu';

    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          target_language: targetLang,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (previewBox) {
          previewBox.classList.remove('hidden');
          previewBox.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="font-bold">${data.language} Translation:</span>
              <button type="button" onclick="patientPortal.speakText('${data.translated_text}')" class="px-2.5 py-1 rounded bg-cyan-600 text-white font-bold text-xs">
                <i class="fa-solid fa-volume-high mr-1"></i> Play Voice
              </button>
            </div>
            <p class="text-sm font-semibold mt-1.5 text-cyan-100">${data.translated_text}</p>
          `;
        }

        window.showToast(`Translated to ${data.language}`, 'success');
      }
    } catch (err) {
      console.error('Translation error:', err);
    }
  }

  /**
   * Submit Post-Consultation Prescription Form
   */
  async submitPrescriptionForm(e) {
    e.preventDefault();

    if (!this.activePatientSession || !this.activePatientSession.patient) {
      window.showToast('No active patient session available.', 'error');
      return;
    }

    const patientId = this.activePatientSession.patient.user_id;
    const diagnosis = document.getElementById('rx-diagnosis').value;
    const medicine = document.getElementById('rx-medicine').value;
    const dosage = document.getElementById('rx-dosage').value;
    const duration = document.getElementById('rx-duration').value;
    const instructions = document.getElementById('rx-instructions').value;

    const payload = {
      patient_id: patientId,
      doctor_id: this.currentDoctor.doctor_id,
      doctor_name: this.currentDoctor.name,
      hospital: this.currentDoctor.hospital,
      diagnosis,
      prescriptions: [
        { medicine, dosage, frequency: dosage, duration, instructions }
      ],
      session_id: this.activePatientSession.session_id,
    };

    // Check if online or offline
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/records/prescription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          window.showToast('Post-consultation prescription recorded successfully!', 'success');
          // Re-verify to refresh record view
          this.quickDemoScan(patientId);
        }
      } catch (err) {
        console.error('Prescription submit error:', err);
      }
    } else {
      // Optimistic Local Queueing (Module C)
      if (window.offlineMesh) {
        await window.offlineMesh.enqueueOfflinePrescription(payload);
        window.showToast('📶 OFFLINE MESH: Prescription queued locally (PENDING_SYNC). Will auto-sync once internet returns!', 'info', 6000);
      }
    }
  }

  /**
   * BREAK-GLASS EMERGENCY OVERRIDE (Module D)
   */
  openBreakGlassModal() {
    const modal = document.getElementById('break-glass-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeBreakGlassModal() {
    const modal = document.getElementById('break-glass-modal');
    if (modal) modal.classList.add('hidden');
  }

  async executeBreakGlassOverride(e) {
    e.preventDefault();

    const identifier = document.getElementById('bg-identifier').value;
    const license = document.getElementById('bg-license').value;
    const reason = document.getElementById('bg-reason').value;

    try {
      const res = await fetch('/api/emergency/break-glass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          doctor_id: this.currentDoctor.doctor_id,
          doctor_name: this.currentDoctor.name,
          medical_license: license,
          hospital: this.currentDoctor.hospital,
          emergency_reason: reason,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        window.showToast(data.error || 'Break-Glass activation failed', 'error');
        return;
      }

      this.closeBreakGlassModal();
      this.renderBreakGlassEmergencyView(data.break_glass_session);

    } catch (err) {
      console.error('Break-Glass error:', err);
    }
  }

  renderBreakGlassEmergencyView(session) {
    const viewer = document.getElementById('doctor-record-viewer');
    if (!viewer) return;

    this.breakGlassSecondsRemaining = 60;
    if (this.breakGlassTimer) clearInterval(this.breakGlassTimer);

    const patient = session.patient;
    const emergencyRecords = session.emergency_records || {};

    viewer.innerHTML = `
      <div class="space-y-4 animate-fade-in">
        <!-- Emergency Red Banner -->
        <div class="p-5 rounded-2xl bg-red-950/90 border-2 border-red-500 shadow-2xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center text-xl animate-pulse">
                <i class="fa-solid fa-triangle-exclamation"></i>
              </span>
              <div>
                <h3 class="text-lg font-extrabold text-red-100 uppercase tracking-wide">
                  🚨 BREAK-GLASS EMERGENCY OVERRIDE ACTIVE
                </h3>
                <p class="text-xs text-red-300">
                  Immutable Audit Logged • SMS Alert Dispatched to Patient
                </p>
              </div>
            </div>

            <!-- 60s Countdown Timer -->
            <div class="text-right">
              <span id="bg-timer-text" class="text-2xl font-mono font-extrabold text-red-400">60s</span>
              <p class="text-xs text-red-300/80">Restricted Window</p>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-red-800/60 text-xs">
            <div>Patient: <strong class="text-white">${patient.name}</strong></div>
            <div>ABHA ID: <strong class="text-cyan-300 font-mono">${patient.abha_id}</strong></div>
            <div>Blood Group: <strong class="text-red-300 font-bold">${patient.blood_group}</strong></div>
            <div>Emergency Contact: <strong class="text-amber-300">${patient.emergency_contact}</strong></div>
          </div>
        </div>

        <!-- Emergency Critical Allergies -->
        <div class="p-4 rounded-xl bg-slate-800/60 border border-red-500/40 space-y-2">
          <h4 class="font-bold text-red-400 text-sm flex items-center gap-2">
            <i class="fa-solid fa-shield-virus"></i>
            <span>Life-Threatening Allergies & Contraindications</span>
          </h4>
          ${this.renderRecordCategory(emergencyRecords.allergies || [], 'allergies')}
        </div>

        <!-- Emergency Vitals -->
        <div class="p-4 rounded-xl bg-slate-800/60 border border-amber-500/40 space-y-2">
          <h4 class="font-bold text-amber-400 text-sm flex items-center gap-2">
            <i class="fa-solid fa-heart-pulse"></i>
            <span>Baseline Vitals</span>
          </h4>
          ${this.renderRecordCategory(emergencyRecords.vitals || [], 'vitals')}
        </div>
      </div>
    `;

    // 60-second timer countdown
    this.breakGlassTimer = setInterval(() => {
      this.breakGlassSecondsRemaining--;
      const timerEl = document.getElementById('bg-timer-text');
      if (timerEl) timerEl.innerText = `${this.breakGlassSecondsRemaining}s`;

      if (this.breakGlassSecondsRemaining <= 0) {
        clearInterval(this.breakGlassTimer);
        viewer.innerHTML = `
          <div class="p-6 text-center space-y-3 bg-slate-800 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-red-400 text-lg">Break-Glass 60s Window Expired</h4>
            <p class="text-xs text-slate-400">Emergency session timed out and locked for patient privacy protection.</p>
          </div>
        `;
      }
    }, 1000);
  }

  /**
   * "JOHN DOE" UNIVERSAL EMERGENCY FALLBACK (Module D)
   */
  openJohnDoeModal() {
    const modal = document.getElementById('john-doe-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeJohnDoeModal() {
    const modal = document.getElementById('john-doe-modal');
    if (modal) modal.classList.add('hidden');
  }

  async executeJohnDoeIntake(e) {
    e.preventDefault();

    const findings = document.getElementById('jd-findings').value;
    const ageGroup = document.getElementById('jd-age').value;
    const gender = document.getElementById('jd-gender').value;

    try {
      const res = await fetch('/api/emergency/john-doe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_name: this.currentDoctor.name,
          hospital: this.currentDoctor.hospital,
          initial_findings: findings,
          estimated_age_group: ageGroup,
          gender,
        }),
      });

      const data = await res.json();
      if (data.success) {
        this.closeJohnDoeModal();
        window.showToast(`Temporary Emergency Intake Chart created [${data.patient.abha_id}]`, 'success', 6000);
        this.renderJohnDoeView(data);
      }
    } catch (err) {
      console.error('John Doe intake error:', err);
    }
  }

  renderJohnDoeView(data) {
    const viewer = document.getElementById('doctor-record-viewer');
    if (!viewer) return;

    const patient = data.patient;

    viewer.innerHTML = `
      <div class="p-5 rounded-2xl bg-purple-950/80 border border-purple-500/50 shadow-xl space-y-4 animate-fade-in">
        <div class="flex items-center justify-between border-b border-purple-800/60 pb-3">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center text-lg">
              <i class="fa-solid fa-user-ninja"></i>
            </span>
            <div>
              <h3 class="text-lg font-bold text-purple-100">${patient.name}</h3>
              <p class="text-xs text-purple-300">Temp ID: <span class="font-mono text-amber-300">${patient.abha_id}</span></p>
            </div>
          </div>

          <!-- Retroactive Linking Button -->
          <button onclick="doctorPortal.openLinkJohnDoeModal('${patient.user_id}')" class="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-900 text-xs font-bold shadow-lg">
            <i class="fa-solid fa-link mr-1"></i> Retroactively Link to Permanent Profile
          </button>
        </div>

        <div class="text-xs text-purple-200 space-y-2">
          <p>Estimated Age: <strong>${patient.age}</strong> | Gender: <strong>${patient.gender}</strong></p>
          <p>Initial Trauma Findings: <em>${data.initial_record ? data.initial_record.title : 'Emergency Intake'}</em></p>
        </div>
      </div>
    `;
  }

  openLinkJohnDoeModal(johnDoeId) {
    const johnDoeIdInput = document.getElementById('link-john-doe-id');
    if (johnDoeIdInput) johnDoeIdInput.value = johnDoeId;

    const modal = document.getElementById('link-john-doe-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeLinkJohnDoeModal() {
    const modal = document.getElementById('link-john-doe-modal');
    if (modal) modal.classList.add('hidden');
  }

  async executeRetroactiveLink(e) {
    e.preventDefault();

    const johnDoeId = document.getElementById('link-john-doe-id').value;
    const targetIdentifier = document.getElementById('link-target-phone').value;

    try {
      const res = await fetch('/api/emergency/link-john-doe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          john_doe_id: johnDoeId,
          target_patient_identifier: targetIdentifier,
          doctor_name: this.currentDoctor.name,
        }),
      });

      const data = await res.json();
      if (data.success) {
        this.closeLinkJohnDoeModal();
        window.showToast(`Successfully retroactively linked emergency chart to ${data.permanent_patient.name}!`, 'success', 6000);
        this.quickDemoScan(data.permanent_patient.user_id);
      } else {
        window.showToast(data.error || 'Linking failed', 'error');
      }
    } catch (err) {
      console.error('Retroactive link error:', err);
    }
  }

  resetScanner() {
    const viewer = document.getElementById('doctor-record-viewer');
    if (viewer) {
      viewer.innerHTML = `
        <div class="p-8 text-center space-y-3 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700">
          <i class="fa-solid fa-qrcode text-4xl text-slate-500"></i>
          <p class="text-sm text-slate-400">Scan a patient QR code using your camera or click the quick demo scan button below.</p>
        </div>
      `;
    }
  }
}

window.doctorPortal = new DoctorPortal();
