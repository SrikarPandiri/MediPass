/**
 * MediPass Module A & G: Patient Portal Controller
 * Handles rolling dynamic 45s QR token generation, scope checkboxes,
 * instant live revocation kill-switch, audit timeline, and Elderly Mode TTS.
 */

class PatientPortal {
  constructor() {
    this.currentPatient = null;
    this.activeSessionId = null;
    this.qrTimer = null;
    this.secondsRemaining = 45;
    this.isElderlyMode = false;
    this.speechSynth = window.speechSynthesis;

    this.selectedScopes = ['allergies', 'prescriptions', 'vitals'];
  }

  init(patientData) {
    this.currentPatient = patientData;
    this.isElderlyMode = !!patientData.elderly_mode_enabled;

    this.renderPatientHeader();
    this.fetchPatientData();
    this.generateRollingQR();

    // Connect WebSocket
    if (window.wsClient) {
      window.wsClient.connect(patientData.user_id, 'PATIENT');
    }

    if (this.isElderlyMode) {
      document.body.classList.add('elderly-mode');
    }
  }

  renderPatientHeader() {
    const headerEl = document.getElementById('patient-profile-header');
    if (!headerEl || !this.currentPatient) return;

    headerEl.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 backdrop-blur-md text-white shadow-xl">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-cyan-500/20">
            ${this.currentPatient.name.charAt(0)}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold tracking-tight text-slate-100">${this.currentPatient.name}</h2>
              <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">ABHA Verified</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              ABHA ID: <span class="font-mono text-cyan-400 font-semibold">${this.currentPatient.abha_id}</span> • Phone: ${this.currentPatient.phone_number}
            </p>
            <div class="flex items-center gap-3 text-xs text-slate-300 mt-1">
              <span>Blood Group: <strong class="text-red-400">${this.currentPatient.blood_group}</strong></span> •
              <span>Age/Gender: <strong>${this.currentPatient.age} yrs / ${this.currentPatient.gender}</strong></span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Elderly Mode Toggle -->
          <button id="elderly-mode-toggle" onclick="patientPortal.toggleElderlyMode()" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium flex items-center gap-2 transition-all">
            <i class="fa-solid ${this.isElderlyMode ? 'fa-eye' : 'fa-universal-access'} text-sm"></i>
            <span>${this.isElderlyMode ? 'Exit Elderly Mode' : 'Elderly Mode (Voice & Large Text)'}</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Fetch patient medical records and audit history from backend
   */
  async fetchPatientData() {
    if (!this.currentPatient) return;
    try {
      const res = await fetch(`/api/records/patient/${this.currentPatient.user_id}`);
      const data = await res.json();
      if (data.success) {
        this.renderMedicalRecords(data.records);
        this.renderAuditTimeline(data.audit_logs);
        // Cache locally for offline availability
        if (window.offlineMesh) {
          window.offlineMesh.cachePatientRecords(data.patient, data.records);
        }
      }
    } catch (err) {
      console.warn('Network error fetching live records, loading offline cache...');
      if (window.offlineMesh) {
        const cached = await window.offlineMesh.getCachedRecords(this.currentPatient.user_id);
        this.renderMedicalRecords(cached);
      }
    }
  }

  /**
   * Generate 45-Second Dynamic Rolling QR Code with Selected Scopes
   */
  async generateRollingQR() {
    if (!this.currentPatient) return;

    if (this.qrTimer) clearInterval(this.qrTimer);

    // Get selected scopes from UI checkboxes
    const checkboxes = document.querySelectorAll('.scope-checkbox:checked');
    if (checkboxes.length > 0) {
      this.selectedScopes = Array.from(checkboxes).map(c => c.value);
    }

    try {
      let qrToken = null;
      let sessionId = null;

      if (navigator.onLine) {
        const res = await fetch('/api/qr/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: this.currentPatient.user_id,
            scopes: this.selectedScopes,
          }),
        });
        const data = await res.json();
        if (data.success) {
          qrToken = data.token;
          sessionId = data.session_id;
        }
      }

      // Offline fallback token generator
      if (!qrToken && window.offlineMesh) {
        const offlineData = window.offlineMesh.generateOfflineQRToken(this.currentPatient);
        qrToken = offlineData.token;
        sessionId = offlineData.session_id;
      }

      this.activeSessionId = sessionId;

      // Register session with WebSocket
      if (window.wsClient) {
        window.wsClient.joinSession(sessionId);
      }

      // Render QR Canvas using qrcode library
      this.renderQRCanvas(qrToken);
      this.startCountdownTimer();

      // Enable Kill-Switch
      const killSwitchBtn = document.getElementById('kill-switch-btn');
      if (killSwitchBtn) {
        killSwitchBtn.disabled = false;
        killSwitchBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }

    } catch (err) {
      console.error('Failed to generate rolling QR token:', err);
    }
  }

  renderQRCanvas(token) {
    const tokenDisplay = document.getElementById('qr-raw-token');

    if (tokenDisplay) {
      tokenDisplay.innerText = token ? `${token.substring(0, 32)}...` : 'Generating...';
    }

    if (window.renderMediPassQR) {
      window.renderMediPassQR('qr-code-container', token, {
        width: 230,
        height: 230,
        darkColor: '#0f172a',
        lightColor: '#ffffff',
      });
    }
  }

  startCountdownTimer() {
    this.secondsRemaining = 45;
    const timerBar = document.getElementById('qr-timer-bar');
    const timerText = document.getElementById('qr-timer-text');

    if (this.qrTimer) clearInterval(this.qrTimer);

    this.qrTimer = setInterval(() => {
      this.secondsRemaining--;

      if (timerText) {
        timerText.innerText = `${this.secondsRemaining}s remaining`;
      }

      if (timerBar) {
        const percent = (this.secondsRemaining / 45) * 100;
        timerBar.style.width = `${percent}%`;

        if (this.secondsRemaining <= 10) {
          timerBar.className = 'h-2 rounded-full transition-all duration-1000 bg-red-500 shadow-lg shadow-red-500/50';
        } else if (this.secondsRemaining <= 20) {
          timerBar.className = 'h-2 rounded-full transition-all duration-1000 bg-amber-500';
        } else {
          timerBar.className = 'h-2 rounded-full transition-all duration-1000 bg-cyan-400';
        }
      }

      if (this.secondsRemaining <= 0) {
        clearInterval(this.qrTimer);
        this.generateRollingQR(); // Auto-rotate token every 45s
      }
    }, 1000);
  }

  /**
   * INSTANT LIVE REVOCATION KILL-SWITCH (Module A & F)
   */
  async triggerInstantRevocation() {
    if (!this.activeSessionId) {
      window.showToast('No active QR session to revoke.', 'error');
      return;
    }

    const confirmRevoke = confirm('🚨 CRITICAL SAFETY ACTION: Are you sure you want to trigger the Instant Live Revocation Kill-Switch?\n\nThis will IMMEDIATELY lock out all doctors currently viewing your medical record!');
    if (!confirmRevoke) return;

    try {
      const res = await fetch('/api/qr/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.activeSessionId,
          patient_id: this.currentPatient.user_id,
          reason: 'Patient manually toggled instant live revocation kill-switch.',
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (this.qrTimer) clearInterval(this.qrTimer);

        // Render Revoked state inside container
        const container = document.getElementById('qr-code-container');
        if (container) {
          container.innerHTML = `
            <div class="w-full h-full bg-red-100 border-2 border-red-500 rounded-xl flex flex-col items-center justify-center text-red-600 font-extrabold text-sm p-4 text-center shadow-inner">
              <i class="fa-solid fa-ban text-3xl mb-1.5"></i>
              <span>REVOKED</span>
              <span class="text-[10px] text-red-500 font-normal mt-0.5">Session Terminated</span>
            </div>
          `;
        }

        const timerText = document.getElementById('qr-timer-text');
        if (timerText) timerText.innerText = 'ACCESS TERMINATED';

        window.showToast('🛑 LIVE KILL-SWITCH TRIGGERED: Consent session terminated immediately!', 'error', 6000);
        this.fetchPatientData(); // Refresh audit log
      }
    } catch (err) {
      console.error('Revocation failed:', err);
    }
  }

  /**
   * Render Patient Medical Records & Prescriptions
   */
  renderMedicalRecords(records) {
    const recordsContainer = document.getElementById('patient-records-container');
    if (!recordsContainer) return;

    if (!records || records.length === 0) {
      recordsContainer.innerHTML = `<p class="text-sm text-slate-400 p-4">No medical records on file.</p>`;
      return;
    }

    recordsContainer.innerHTML = records.map(rec => {
      const content = rec.content || {};

      let detailsHtml = '';

      if (rec.record_type === 'allergies') {
        const allergies = content.allergies || [];
        detailsHtml = `
          <div class="space-y-2 mt-2">
            ${allergies.map(a => `
              <div class="p-2.5 rounded-lg bg-red-950/40 border border-red-800/40 flex items-center justify-between">
                <div>
                  <span class="font-bold text-red-300 text-sm">${a.allergen}</span>
                  <p class="text-xs text-red-200/80">${a.reaction}</p>
                </div>
                <span class="px-2 py-0.5 text-xs font-bold rounded bg-red-600 text-white">${a.severity}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else if (rec.record_type === 'prescriptions') {
        const rxList = content.prescriptions || [];
        detailsHtml = `
          <div class="space-y-2 mt-2">
            ${content.diagnosis ? `<p class="text-xs text-cyan-300 font-semibold">Diagnosis: ${content.diagnosis}</p>` : ''}
            ${rxList.map(rx => `
              <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <i class="fa-solid fa-pills text-cyan-400"></i>
                    <span class="font-bold text-slate-100 text-sm">${rx.medicine}</span>
                  </div>
                  <p class="text-xs text-slate-300 mt-0.5">Dosage: ${rx.dosage} • Schedule: <span class="text-amber-300 font-medium">${rx.frequency}</span> • Duration: ${rx.duration}</p>
                  <p class="text-xs text-slate-400 italic mt-0.5">${rx.instructions || ''}</p>
                </div>

                <!-- Text to Speech Button (Elderly Mode feature) -->
                <button onclick="patientPortal.speakText('${rx.medicine}. ${rx.instructions || ''}')" class="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 self-start md:self-center">
                  <i class="fa-solid fa-volume-high"></i>
                  <span>Listen Audio</span>
                </button>
              </div>
            `).join('')}
          </div>
        `;
      } else if (rec.record_type === 'vitals') {
        const v = content.vitals || {};
        detailsHtml = `
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
              <span class="text-xs text-slate-400">BP</span>
              <p class="text-sm font-bold text-cyan-300">${v.blood_pressure || 'N/A'}</p>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
              <span class="text-xs text-slate-400">Heart Rate</span>
              <p class="text-sm font-bold text-emerald-300">${v.heart_rate || 'N/A'}</p>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
              <span class="text-xs text-slate-400">SpO2</span>
              <p class="text-sm font-bold text-blue-300">${v.spo2 || 'N/A'}</p>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
              <span class="text-xs text-slate-400">Temp</span>
              <p class="text-sm font-bold text-amber-300">${v.temperature || 'N/A'}</p>
            </div>
          </div>
        `;
      } else {
        detailsHtml = `<pre class="text-xs text-slate-300 mt-2 bg-slate-900 p-2 rounded">${JSON.stringify(content, null, 2)}</pre>`;
      }

      return `
        <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/40 transition-all">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="p-2 rounded-lg bg-slate-700/60 text-cyan-400 text-xs">
                ${rec.record_type.toUpperCase()}
              </span>
              <h4 class="font-bold text-slate-200 text-sm">${rec.title}</h4>
            </div>
            <span class="text-xs text-slate-400">${new Date(rec.created_at).toLocaleDateString()}</span>
          </div>
          ${detailsHtml}
        </div>
      `;
    }).join('');
  }

  /**
   * Render Audit Log Timeline (Module A)
   */
  renderAuditTimeline(logs) {
    const container = document.getElementById('audit-timeline-container');
    if (!container) return;

    if (!logs || logs.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-400 p-3">No access audit logs yet.</p>`;
      return;
    }

    container.innerHTML = logs.map(log => {
      let badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      if (log.action.includes('BREAK_GLASS')) {
        badgeClass = 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse';
      } else if (log.action.includes('REVOKED')) {
        badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      }

      return `
        <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div class="p-2 rounded-full bg-slate-800 text-cyan-400 mt-0.5">
            <i class="fa-solid fa-shield-halved text-xs"></i>
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 text-xs font-bold rounded-md border ${badgeClass}">
                ${log.action}
              </span>
              <span class="text-xs font-mono text-slate-400">${new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
            <p class="text-xs font-semibold text-slate-200 mt-1">${log.doctor_name || 'System'} (${log.hospital || 'MediPass Portal'})</p>
            <p class="text-xs text-slate-400 mt-0.5">${log.details || ''}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Text-to-Speech Accessibility for Elderly Mode (Module G)
   */
  speakText(text) {
    if (!this.speechSynth) {
      window.showToast('Text-to-Speech API not supported in this browser.', 'error');
      return;
    }

    this.speechSynth.cancel(); // Stop any active speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    this.speechSynth.speak(utterance);

    window.showToast(`🔊 Reading Aloud: "${text.substring(0, 40)}..."`, 'info');
  }

  toggleElderlyMode() {
    this.isElderlyMode = !this.isElderlyMode;
    if (this.isElderlyMode) {
      document.body.classList.add('elderly-mode');
      window.showToast('Elderly Mode Enabled: Enlarged Text, High Contrast & Audio narration ready!', 'info');
    } else {
      document.body.classList.remove('elderly-mode');
      window.showToast('Returned to Standard Mode.', 'info');
    }
    this.renderPatientHeader();
  }
}

window.patientPortal = new PatientPortal();
