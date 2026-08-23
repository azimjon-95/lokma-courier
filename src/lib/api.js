/**
 * Kuryer portali API klienti.
 *
 * MUHIM: bu yerda LOGIN YO'Q. Har bir so'rov URL'dagi TOKEN
 * orqali autentifikatsiya qilinadi — token o'zi kredensial
 * (Telegram orqali faqat shu kuryerga yuborilgan). Shuning
 * uchun Authorization header yo'q, cookie yo'q — hammasi
 * URL'dagi token orqali.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
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
  /** Token holatini va (mavjud bo'lsa) buyurtma tafsilotini oladi. */
  getInvite: (token) => request(`/courier-portal/${token}`),

  /** "Qabul qilaman" — birinchi bosgan yutadi (server tomonda atomik). */
  accept: (token) => request(`/courier-portal/${token}/accept`, { method: 'POST' }),

  /** "Topshirdim" tasdiqlangandan keyin. */
  deliver: (token) => request(`/courier-portal/${token}/deliver`, { method: 'POST' }),
};
