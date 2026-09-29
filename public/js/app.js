/**
 * MediPass Main Application Controller
 * Handles global state, portal switching, offline network simulation, and UI toasts.
 */

class AppController {
  constructor() {
    this.currentPortal = 'patient'; // 'patient' | 'doctor'
    this.demoPatients = [];
    this.activePatient = null;
  }

  async init() {
    console.log('[MediPass App] Initializing prototype...');
    await this.loadDemoAccounts();
    this.setupPortalSwitchers();
    this.setupOfflineSimulator();

    // Default initialize Patient Portal with Patient 1 (John Doe)
    if (this.demoPatients.length > 0) {
      this.switchPatientAccount(this.demoPatients[0].user_id);
    }

    // Initialize Doctor Portal
    if (window.doctorPortal) {
      window.doctorPortal.init();
    }
  }

  async loadDemoAccounts() {
    try {
      const res = await fetch('/api/auth/demo-accounts');
      const data = await res.json();
      if (data.patients) {
        this.demoPatients = data.patients;
        this.renderDemoPatientSelector();
      }
    } catch (err) {
      console.error('Failed to load demo accounts:', err);
    }
  }

  renderDemoPatientSelector() {
    const selector = document.getElementById('demo-patient-select');
    if (!selector) return;

    selector.innerHTML = this.demoPatients.map(p => `
      <option value="${p.user_id}">
        ${p.name} (${p.phone_number}) ${p.elderly_mode_enabled ? '[Elderly Mode]' : ''}
      </option>
    `).join('');

    selector.addEventListener('change', (e) => {
      this.switchPatientAccount(e.target.value);
    });
  }

  switchPatientAccount(patientId) {
    const patient = this.demoPatients.find(p => p.user_id === patientId);
    if (!patient) return;

    this.activePatient = patient;
    console.log('[App] Switched active patient to:', patient.name);

    if (window.patientPortal) {
      window.patientPortal.init(patient);
    }

    const selectEl = document.getElementById('demo-patient-select');
    if (selectEl) selectEl.value = patientId;
  }

  setupPortalSwitchers() {
    const btnPatient = document.getElementById('tab-patient-portal');
    const btnDoctor = document.getElementById('tab-doctor-portal');
    const viewPatient = document.getElementById('view-patient-portal');
    const viewDoctor = document.getElementById('view-doctor-portal');

    if (btnPatient && btnDoctor) {
      btnPatient.addEventListener('click', () => {
        this.currentPortal = 'patient';
        btnPatient.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20';
        btnDoctor.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-800';

        viewPatient.classList.remove('hidden');
        viewDoctor.classList.add('hidden');
      });

      btnDoctor.addEventListener('click', () => {
        this.currentPortal = 'doctor';
        btnDoctor.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20';
        btnPatient.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-800';

        viewDoctor.classList.remove('hidden');
        viewPatient.classList.add('hidden');
      });
    }
  }

  setupOfflineSimulator() {
    const offlineToggle = document.getElementById('sim-offline-toggle');
    const statusBadge = document.getElementById('network-status-badge');

    if (offlineToggle && statusBadge) {
      offlineToggle.addEventListener('change', (e) => {
        const isSimulatedOffline = e.target.checked;
        if (isSimulatedOffline) {
          statusBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse';
          statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> SIMULATED OFFLINE MESH`;
          window.showToast('📶 Network set to SIMULATED OFFLINE MODE. Local Mesh IndexedDB Active.', 'info', 5000);
        } else {
          statusBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5';
          statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> ONLINE & SYNCED`;
          window.showToast('🟢 Back ONLINE. Auto-syncing local offline queue...', 'success', 5000);
          if (window.offlineMesh) {
            window.offlineMesh.triggerAutoSync();
          }
        }
      });
    }
  }
}

/**
 * Global Notification Toast Function
 */
window.showToast = function(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');

  let bgClasses = 'bg-slate-800 text-slate-100 border-slate-700';
  if (type === 'error') bgClasses = 'bg-red-950 text-red-100 border-red-600';
  if (type === 'success') bgClasses = 'bg-emerald-950 text-emerald-100 border-emerald-600';
  if (type === 'info') bgClasses = 'bg-cyan-950 text-cyan-100 border-cyan-600';

  toast.className = `p-3.5 rounded-xl border shadow-xl text-xs font-medium backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2 max-w-md ${bgClasses}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
  window.app.init();
});
