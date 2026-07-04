import { residents, DUTY_STATUS } from './data/residents.js';

const DEFAULT_MESSAGE = 'دكتور، هل يمكنني أخذ إذن انصراف الآن؟\nمع الشكر.';
const STORAGE = {
  selected: 'gs-leave-selected-residents',
  defaultMessage: 'gs-leave-default-message',
  auth: 'gs-leave-authenticated',
};

const ACCESS_PASSWORD = '0000';

const state = {
  selectedIds: new Set(readSelectedIds()),
  defaultMessage: localStorage.getItem(STORAGE.defaultMessage) || DEFAULT_MESSAGE,
};

const el = {
  navLinks: [...document.querySelectorAll('[data-nav]')],
  views: [...document.querySelectorAll('[data-view]')],
  onDutyList: document.querySelector('#on-duty-list'),
  noOnDuty: document.querySelector('#no-on-duty'),
  selectedCount: document.querySelector('#selected-count'),
  continueBtn: document.querySelector('#continue-btn'),
  clearSelectionBtn: document.querySelector('#clear-selection-btn'),
  recipientTotal: document.querySelector('#recipient-total'),
  messageRecipients: document.querySelector('#message-recipients'),
  messageText: document.querySelector('#message-text'),
  messageCount: document.querySelector('#message-count'),
  sendSmsBtn: document.querySelector('#send-sms-btn'),
  directory: document.querySelector('#residents-directory'),
  residentSearch: document.querySelector('#resident-search'),
  homeResidentSearch: document.querySelector('#home-resident-search'),
  homeResultsCount: document.querySelector('#home-results-count'),
  defaultMessageText: document.querySelector('#default-message-text'),
  saveDefaultMessageBtn: document.querySelector('#save-default-message-btn'),
  resetDefaultMessageBtn: document.querySelector('#reset-default-message-btn'),
  saveStatus: document.querySelector('#save-status'),
  toast: document.querySelector('#toast'),
  loginOverlay: document.querySelector('#login-overlay'),
  loginForm: document.querySelector('#login-form'),
  loginPassword: document.querySelector('#login-password'),
  loginError: document.querySelector('#login-error'),
  logoutBtn: document.querySelector('#logout-btn'),
};

function isAuthenticated() {
  return sessionStorage.getItem(STORAGE.auth) === 'true';
}

function showLogin() {
  document.body.classList.remove('authenticated');
  document.body.classList.add('auth-pending');
  el.loginOverlay.classList.remove('hidden');
  el.loginPassword.value = '';
  el.loginError.textContent = '';
  setTimeout(() => el.loginPassword.focus(), 0);
}

function grantAccess() {
  sessionStorage.setItem(STORAGE.auth, 'true');
  document.body.classList.remove('auth-pending');
  document.body.classList.add('authenticated');
  el.loginOverlay.classList.add('hidden');
}

function initializeAuthentication() {
  if (isAuthenticated()) {
    grantAccess();
  } else {
    showLogin();
  }
}

function readSelectedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE.selected) || '[]');
    const validIds = new Set(residents.map((resident) => resident.id));
    return Array.isArray(parsed) ? parsed.filter((id) => validIds.has(id)) : [];
  } catch {
    return [];
  }
}

function saveSelectedIds() {
  localStorage.setItem(STORAGE.selected, JSON.stringify([...state.selectedIds]));
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
}

function esc(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function getSelectedResidents() {
  return residents.filter((resident) => state.selectedIds.has(resident.id));
}

function searchableResidents(query = '') {
  const normalized = query.trim().toLowerCase();
  const filtered = residents.filter((resident) => {
    if (!normalized) return true;
    return [resident.nameAr, resident.nameEn, resident.phone, resident.pgy]
      .join(' ')
      .toLowerCase()
      .includes(normalized);
  });
  // المناوبون أولًا إن تم تحديدهم لاحقًا في ملف البيانات، ثم ترتيب أبجدي ثابت.
  return filtered.sort((a, b) => {
    const dutyDifference = Number(Boolean(b.isOnDuty)) - Number(Boolean(a.isOnDuty));
    return dutyDifference || a.nameAr.localeCompare(b.nameAr, 'ar');
  });
}

function residentCard(resident) {
  const isSelected = state.selectedIds.has(resident.id);
  return `
    <article class="resident-card resident-select-card ${isSelected ? 'selected' : ''}"
      data-resident-card="${esc(resident.id)}"
      tabindex="0"
      role="checkbox"
      aria-checked="${isSelected}"
      aria-label="اختيار ${esc(resident.nameAr)}"
      style="--resident-color:${esc(resident.color)}">
      <div class="avatar" aria-hidden="true">${esc(initials(resident.nameAr))}</div>
      <div class="resident-info">
        <h3 class="resident-name">${esc(resident.nameAr)}</h3>
        <p class="resident-sub">${esc(resident.phone)}</p>
        <div class="status-line"><span class="status-dot"></span>${esc(resident.dutyStatus || DUTY_STATUS.ON_DUTY)}</div>
      </div>
      <label class="check-wrap" title="اختيار ${esc(resident.nameAr)}">
        <input type="checkbox" data-resident-checkbox="${esc(resident.id)}" ${isSelected ? 'checked' : ''} aria-label="اختيار ${esc(resident.nameAr)}" />
      </label>
    </article>`;
}

function renderHome(query = el.homeResidentSearch?.value || '') {
  const list = searchableResidents(query);
  el.onDutyList.innerHTML = list.map(residentCard).join('');
  el.noOnDuty.classList.toggle('hidden', list.length > 0);
  el.homeResultsCount.textContent = query.trim() ? `${list.length} نتيجة` : `${residents.length} مقيمًا`;
  el.selectedCount.textContent = state.selectedIds.size;
  el.continueBtn.disabled = state.selectedIds.size === 0;
}

function renderMessage() {
  const selected = getSelectedResidents();
  el.recipientTotal.textContent = selected.length;
  el.messageRecipients.innerHTML = selected.length ? selected.map((resident) => `
    <div class="recipient-item">
      <div class="avatar" style="--resident-color:${esc(resident.color)}">${esc(initials(resident.nameAr))}</div>
      <div><strong>${esc(resident.nameAr)}</strong><small>${esc(resident.phone)}</small></div>
    </div>`).join('') : '<p class="muted-message">لم يتم اختيار أي مقيم بعد.</p>';
  if (!el.messageText.value || el.messageText.dataset.initialized !== 'true') {
    el.messageText.value = state.defaultMessage;
    el.messageText.dataset.initialized = 'true';
  }
  updateMessageCount();
  el.sendSmsBtn.disabled = selected.length === 0;
}

function renderDirectory(query = '') {
  const normalized = query.trim().toLowerCase();
  const filtered = residents.filter((resident) => {
    if (!normalized) return true;
    return [resident.nameAr, resident.nameEn, resident.phone, resident.pgy].join(' ').toLowerCase().includes(normalized);
  });
  el.directory.innerHTML = filtered.map((resident) => `
    <article class="directory-card">
      <div class="avatar" style="--resident-color:${esc(resident.color)}">${esc(initials(resident.nameAr))}</div>
      <div class="directory-info">
        <h3>${esc(resident.nameAr)}</h3>
        <p>${esc(resident.nameEn)} · ${esc(resident.pgy)}</p>
        <p class="directory-number">${esc(resident.phone)}</p>
        <div class="directory-actions">
          <a class="icon-btn" href="tel:${esc(resident.phone)}" aria-label="اتصال بـ ${esc(resident.nameAr)}" title="اتصال">☎</a>
          <a class="icon-btn" target="_blank" rel="noopener" href="https://wa.me/${esc(resident.phone.replace(/\D/g, ''))}" aria-label="واتساب ${esc(resident.nameAr)}" title="واتساب">◔</a>
          <button class="icon-btn copy-number-btn" type="button" data-phone="${esc(resident.phone)}" aria-label="نسخ رقم ${esc(resident.nameAr)}" title="نسخ الرقم">⧉</button>
        </div>
      </div>
    </article>`).join('') || '<div class="empty-state"><h3>لا توجد نتائج</h3><p>جرّب البحث باسم آخر أو جزء من رقم الهاتف.</p></div>';
}

function renderSettings() {
  el.defaultMessageText.value = state.defaultMessage;
}

function updateMessageCount() {
  el.messageCount.textContent = `${el.messageText.value.length} / 480`;
}

function showToast(text) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove('show'), 3000);
}

function chooseResident(id, checked) {
  checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
  saveSelectedIds();
  renderHome();
}

function smsUrl(numbers, body) {
  const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? ';' : ',';
  const recipients = numbers.join(separator);
  return `sms:${recipients}?body=${encodeURIComponent(body)}`;
}

function openMessageView() {
  if (state.selectedIds.size === 0) {
    showToast('اختر مقيمًا واحدًا على الأقل أولًا.');
    location.hash = '#home';
    return;
  }
  el.messageText.dataset.initialized = 'false';
  location.hash = '#message';
}

function route() {
  const key = (location.hash || '#home').slice(1);
  const valid = ['home', 'message', 'residents', 'settings', 'about'];
  const view = valid.includes(key) ? key : 'home';
  if (key === 'message' && state.selectedIds.size === 0) {
    location.hash = '#home';
    return;
  }
  el.views.forEach((section) => section.classList.toggle('active', section.dataset.view === view));
  el.navLinks.forEach((link) => link.classList.toggle('active', link.dataset.nav === view));
  if (view === 'home') renderHome();
  if (view === 'message') renderMessage();
  if (view === 'residents') renderDirectory(el.residentSearch.value);
  if (view === 'settings') renderSettings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

el.onDutyList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-resident-checkbox]');
  if (!checkbox) return;
  chooseResident(checkbox.dataset.residentCheckbox, checkbox.checked);
});
el.onDutyList.addEventListener('click', (event) => {
  if (event.target.closest('input, label')) return;
  const card = event.target.closest('[data-resident-card]');
  if (!card) return;
  const id = card.dataset.residentCard;
  chooseResident(id, !state.selectedIds.has(id));
});
el.onDutyList.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const card = event.target.closest('[data-resident-card]');
  if (!card) return;
  event.preventDefault();
  const id = card.dataset.residentCard;
  chooseResident(id, !state.selectedIds.has(id));
});
el.continueBtn.addEventListener('click', openMessageView);
el.clearSelectionBtn.addEventListener('click', () => {
  state.selectedIds.clear();
  saveSelectedIds();
  renderHome();
  showToast('تم إلغاء الاختيار.');
});
el.messageText.addEventListener('input', updateMessageCount);
el.sendSmsBtn.addEventListener('click', () => {
  const selected = getSelectedResidents();
  const body = el.messageText.value.trim();
  if (!selected.length) return showToast('اختر مقيمًا واحدًا على الأقل.');
  if (!body) return showToast('اكتب نص الرسالة أولًا.');
  window.location.href = smsUrl(selected.map((resident) => resident.phone), body);
});
el.residentSearch.addEventListener('input', (event) => renderDirectory(event.target.value));
el.homeResidentSearch.addEventListener('input', (event) => renderHome(event.target.value));
el.directory.addEventListener('click', async (event) => {
  const button = event.target.closest('.copy-number-btn');
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.phone);
    showToast('تم نسخ رقم الهاتف.');
  } catch {
    showToast(`انسخ الرقم يدويًا: ${button.dataset.phone}`);
  }
});
el.saveDefaultMessageBtn.addEventListener('click', () => {
  const value = el.defaultMessageText.value.trim();
  if (!value) return showToast('لا يمكن حفظ نص فارغ.');
  state.defaultMessage = value;
  localStorage.setItem(STORAGE.defaultMessage, value);
  el.saveStatus.textContent = 'تم حفظ النص الافتراضي على هذا الجهاز.';
  showToast('تم حفظ النص الافتراضي.');
});
el.resetDefaultMessageBtn.addEventListener('click', () => {
  state.defaultMessage = DEFAULT_MESSAGE;
  el.defaultMessageText.value = DEFAULT_MESSAGE;
  localStorage.setItem(STORAGE.defaultMessage, DEFAULT_MESSAGE);
  el.saveStatus.textContent = 'تمت إعادة النص الافتراضي.';
  showToast('تمت إعادة النص الافتراضي.');
});
el.loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (el.loginPassword.value === ACCESS_PASSWORD) {
    grantAccess();
    showToast('مرحبًا بك في نظام إذن الانصراف.');
    return;
  }
  el.loginError.textContent = 'رمز الدخول غير صحيح.';
  el.loginPassword.select();
});
el.loginPassword.addEventListener('input', () => {
  el.loginError.textContent = '';
});
el.logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(STORAGE.auth);
  showLogin();
});
window.addEventListener('hashchange', route);

renderHome();
renderDirectory();
renderSettings();
route();
initializeAuthentication();
