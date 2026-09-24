/*
 * ═══════════════════════════════════════════════════════════
 * CHIDAMLI FETCH — SERVER JAVOB BERMASA OSILIB QOLMASIN
 * ═══════════════════════════════════════════════════════════
 *
 * MUAMMO: oddiy `fetch` da vaqt chegarasi YO'Q. Server qayta
 * ishga tushayotganda (pm2 reload), tarmoq uzilganda yoki server
 * juda sekin javob berganda so'rov CHEKSIZ kutadi — ekranda
 * aylanuvchi belgi abadiy qoladi va foydalanuvchi hech narsa
 * qila olmaydi.
 *
 * YECHIM — ikki himoya:
 *
 *   1) VAQT CHEGARASI (standart 15 s). Undan keyin so'rov
 *      to'xtatiladi va tushunarli xato qaytadi — sahifa
 *      "Qayta urinish" holatiga o'tadi, osilib qolmaydi.
 *
 *   2) QAYTA URINISH — faqat O'QISH so'rovlarida (GET/HEAD).
 *      Server qayta ishga tushayotgan paytda (502/503/504 yoki
 *      tarmoq xatosi) 2 marta, oraliq bilan qayta uriniladi.
 *      Qayta ishga tushish odatda bir necha soniya — foydalanuvchi
 *      buni sezmay qoladi.
 *
 *      YOZISH so'rovlari (POST/PATCH/PUT/DELETE) HECH QACHON
 *      qayta yuborilmaydi: buyurtma yoki to'lov ikki marta
 *      yaratilib qolishi mumkin.
 *
 * Tashqi `signal` (masalan sahifadan chiqilganda bekor qilish)
 * avvalgidek ishlaydi — u vaqt chegarasi bilan birlashtiriladi.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_DELAYS_MS = [700, 1800];
const RETRY_STATUSES = new Set([502, 503, 504]);
const SAFE_METHODS = new Set(['GET', 'HEAD']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bitta urinish — vaqt chegarasi bilan. */
async function attempt(url, init, timeoutMs, outerSignal) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);

  // Tashqi bekor qilish — ichki so'rovni ham to'xtatadi
  const onOuterAbort = () => ctrl.abort();
  if (outerSignal) {
    if (outerSignal.aborted) ctrl.abort();
    else outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (timedOut) {
      const err = new Error('Server javob bermadi. Birozdan keyin qayta urinib ko‘ring');
      err.kind = 'timeout';
      err.name = 'TimeoutError';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener?.('abort', onOuterAbort);
  }
}

/**
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number, retries?: number }} [init]
 * @returns {Promise<Response>}
 */
export async function resilientFetch(url, init = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries, signal, ...rest } = init;
  const method = String(rest.method || 'GET').toUpperCase();
  const maxRetries = SAFE_METHODS.has(method)
    ? (retries ?? RETRY_DELAYS_MS.length)
    : 0;

  for (let i = 0; ; i++) {
    try {
      const res = await attempt(url, rest, timeoutMs, signal);
      // Server qayta ishga tushmoqda — o'qish so'rovini qayta urinamiz
      if (RETRY_STATUSES.has(res.status) && i < maxRetries) {
        await sleep(RETRY_DELAYS_MS[i] ?? 2000);
        continue;
      }
      return res;
    } catch (e) {
      // Foydalanuvchi o'zi bekor qildi — qayta urinmaymiz
      if (e?.name === 'AbortError' || signal?.aborted) throw e;
      if (i >= maxRetries) throw e;
      await sleep(RETRY_DELAYS_MS[i] ?? 2000);
    }
  }
}
