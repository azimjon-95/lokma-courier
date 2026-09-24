import { resilientFetch } from './resilientFetch.js';
/**
 * Kuryer portali API klienti — BOSQICH 1 (2026-08, ulashish
 * orqali, kuryerlar reyestrisiz).
 *
 * XAVFSIZLIK MEXANIZMI — LOGIN YO'Q, lekin bardoshli:
 * Bitta havola bir nechta odamga forward qilinishi mumkin —
 * hammasida token BIR XIL. Kimdir "Qabul qilaman" bossa, server
 * unga ALOHIDA, tasodifiy `secret` qaytaradi. Shu qurilma
 * `secret`ni localStorage'da (tokenga bog'lab) saqlaydi va
 * keyingi har bir so'rovda yuboradi — shu orqali server "bu
 * ANIQ o'sha qabul qilgan qurilmami" deb tekshiradi.
 *
 * `secret` HECH QACHON URL'da yurmaydi (faqat javob tanasida
 * keladi, so'rovlarda query parametr yoki POST body sifatida
 * yuboriladi) — brauzer tarixi/loglarda qolib ketmasligi uchun.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function secretKey(token) {
  return `lokma_courier_secret_${token}`;
}

export function getSavedSecret(token) {
  try { return localStorage.getItem(secretKey(token)); } catch { return null; }
}

function saveSecret(token, secret) {
  try { localStorage.setItem(secretKey(token), secret); } catch { /* xotira toldi yoki bloklangan — jim */ }
}

async function request(path, opts = {}) {
  // Vaqt chegarasi + o'qishda qayta urinish (resilientFetch.js)
  const res = await resilientFetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });

  let data = null;
  try { data = await res.json(); } catch { /* bo'sh javob */ }

  if (!res.ok) {
    const msg = data?.error || `Server xatosi (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  /** Token holatini oladi — saqlangan `secret` (bor bo'lsa) bilan birga. */
  getInvite: (token) => {
    const secret = getSavedSecret(token);
    const qs = secret ? `?secret=${encodeURIComponent(secret)}` : '';
    return request(`/courier-portal/${token}${qs}`);
  },

  /** "Qabul qilaman" — muvaffaqiyatli bo'lsa qaytgan secret AVTOMATIK saqlanadi. */
  accept: async (token) => {
    const res = await request(`/courier-portal/${token}/accept`, { method: 'POST' });
    if (res.secret) saveSecret(token, res.secret);
    return res;
  },

  /** "Topshirdim" — saqlangan secret bilan. */
  deliver: (token) => {
    const secret = getSavedSecret(token);
    return request(`/courier-portal/${token}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ secret }),
    });
  },
};
