import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAnalytics, logEvent, setAnalyticsCollectionEnabled } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js';
import { getPerformance } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-performance.js';
import { getRemoteConfig, fetchAndActivate, getValue } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-remote-config.js';

const firebaseConfig = {
  "projectId": "textrec-2d585",
  "appId": "1:112242341918:web:cb377f098650adeb7ad60f",
  "storageBucket": "textrec-2d585.firebasestorage.app",
  "apiKey": "AIzaSyDPyGzX6O6WUIFzr5sdeZgFRHZIbrnFUc4",
  "authDomain": "textrec-2d585.firebaseapp.com",
  "messagingSenderId": "112242341918",
  "measurementId": "G-1DVPPJ34ZC"
};
const CONSENT_KEY = 'fb-analytics-consent-v1';
const PRIVACY_URL = 'privacy/';
const DEFAULT_LANG = 'en';
const APP_NAME = 'extras';

const app = getApps().find((item) => item.name === APP_NAME) || initializeApp(firebaseConfig, APP_NAME);
let analytics = null;
let remoteConfig = null;

try { getPerformance(app); } catch (error) {}
try {
  remoteConfig = getRemoteConfig(app);
  remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
  fetchAndActivate(remoteConfig).catch(() => {});
} catch (error) {}

function enableAnalytics() {
  if (!analytics) {
    try { analytics = getAnalytics(app); } catch (error) { return; }
  }
  try { setAnalyticsCollectionEnabled(analytics, true); } catch (error) {}
}

function track(name, params) {
  if (!analytics) return;
  try { logEvent(analytics, name, params || {}); } catch (error) {}
}

function remoteString(key, fallback) {
  if (!remoteConfig) return fallback;
  try {
    const value = getValue(remoteConfig, key);
    return value.asString() || fallback;
  } catch (error) {
    return fallback;
  }
}

window.FB = { app, analytics: () => analytics, track, remoteString };

function langCode() {
  const value = (document.documentElement.lang || DEFAULT_LANG || navigator.language || 'en').toLowerCase();
  return value.indexOf('tr') === 0 ? 'tr' : 'en';
}

function consentStyles() {
  if (document.getElementById('fbConsentStyles')) return;
  const style = document.createElement('style');
  style.id = 'fbConsentStyles';
  style.textContent = [
    '#fbConsent{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99998;width:min(440px,calc(100vw - 24px));background:#fff;color:#234d6c;border:1px solid #d7e5f1;border-radius:16px;box-shadow:0 18px 40px rgba(20,30,60,.22);padding:14px 14px 12px;font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;}',
    '#fbConsent .fb-title{font-weight:700;font-size:14px;margin-bottom:4px;}',
    '#fbConsent .fb-copy{color:#4c7493;font-size:12px;margin-bottom:10px;}',
    '#fbConsent .fb-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
    '#fbConsent .fb-accept{border:0;border-radius:9px;padding:8px 12px;background:#5a4ad8;color:#fff;font-weight:700;cursor:pointer;}',
    '#fbConsent .fb-reject{border:1px solid #c3d8e8;border-radius:9px;padding:8px 12px;background:#fff;color:#234d6c;font-weight:600;cursor:pointer;}',
    '#fbConsent .fb-link{margin-left:auto;color:#5a4ad8;font-size:11px;text-decoration:none;}',
    '@media (prefers-color-scheme:dark){#fbConsent{background:#161d31;color:#eef1f8;border-color:#263051;}#fbConsent .fb-copy{color:#a2abc8;}#fbConsent .fb-reject{background:#1d253d;color:#eef1f8;border-color:#323d63;}}'
  ].join('');
  document.head.appendChild(style);
}

function showConsent() {
  if (document.getElementById('fbConsent')) return;
  consentStyles();
  const tr = langCode() === 'tr';
  const wrap = document.createElement('div');
  wrap.id = 'fbConsent';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'false');
  wrap.innerHTML = `
    <div class="fb-title">${tr ? 'Kullanım verileri için izin' : 'Usage data permission'}</div>
    <div class="fb-copy">${tr ? 'Uygulamayı geliştirmek için anonim kullanım ve performans verilerini işlemek istiyoruz. Analitik çerezlerine izin veriyor musun?' : 'We would like to process anonymous usage and performance data to improve the app. Do you allow analytics cookies?'}</div>
    <div class="fb-actions">
      <button type="button" class="fb-accept" data-fb-accept>${tr ? 'Kabul et' : 'Accept'}</button>
      <button type="button" class="fb-reject" data-fb-reject>${tr ? 'Reddet' : 'Decline'}</button>
      <a class="fb-link" href="${PRIVACY_URL}">${tr ? 'Gizlilik Politikası' : 'Privacy Policy'}</a>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-fb-accept]').addEventListener('click', () => {
    try { localStorage.setItem(CONSENT_KEY, 'granted'); } catch (error) {}
    enableAnalytics();
    wrap.remove();
  });
  wrap.querySelector('[data-fb-reject]').addEventListener('click', () => {
    try { localStorage.setItem(CONSENT_KEY, 'denied'); } catch (error) {}
    wrap.remove();
  });
}

let choice = null;
try { choice = localStorage.getItem(CONSENT_KEY); } catch (error) {}
if (choice === 'granted') enableAnalytics();
else if (choice !== 'denied') showConsent();
