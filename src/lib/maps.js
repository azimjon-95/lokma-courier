/*
 * ═══════════════════════════════════════════════════════════
 * XARITA HAVOLALARI — GOOGLE MAPS
 * ═══════════════════════════════════════════════════════════
 *
 * NIMA UCHUN GOOGLE, YANDEX EMAS:
 * Yandex O'zbekiston qishloqlari va yangi mahallalarini to'liq
 * qamrab olmaydi — kuryer manzilni topa olmay qolardi. Google
 * bu hududlarda ancha to'liq.
 *
 * NIMA UCHUN MANZIL MATNI EMAS, KOORDINATA:
 * "Uy — 18, xon. 6" kabi matnni xarita butunlay boshqa shaharda
 * topib berardi (Moskvadagi ko'chani ko'rsatgan holat bo'lgan).
 * Koordinata bo'lsa matn UMUMAN ishlatilmaydi — xarita aniq
 * nuqtaga boradi.
 *
 * Google Maps URL API hujjati:
 * https://developers.google.com/maps/documentation/urls/get-started
 */

/** Koordinata haqiqiy sonmi (0 ham to'g'ri qiymat bo'lishi mumkin). */
function isCoord(v) {
  return Number.isFinite(Number(v)) && Number(v) !== 0;
}

export function hasCoords(lat, lng) {
  return isCoord(lat) && isCoord(lng);
}

/**
 * Navigatsiya havolasi — MARSHRUT chizib beradi (yo'l chizig'i bilan).
 *
 * @param {object} to    Manzil: { lat, lng, address }
 * @param {object} [from] Boshlanish nuqtasi: { lat, lng }.
 *   Berilmasa — Google foydalanuvchining JORIY joylashuvidan
 *   boshlab chizadi (kuryer uchun odatda shu kerak).
 *
 * Qaytaradi: URL yoki null (hech qanday ma'lumot bo'lmasa).
 */
export function navUrl(to = {}, from = null) {
  const params = new URLSearchParams({ api: '1', travelmode: 'driving' });

  if (hasCoords(to.lat, to.lng)) {
    // Aniq nuqta — matn qo'shilmaydi, aks holda qidiruv chalg'itadi
    params.set('destination', `${Number(to.lat)},${Number(to.lng)}`);
  } else if (to.address && String(to.address).trim()) {
    // Koordinata yo'q (mijoz manzilni qo'lda yozgan) — matn bo'yicha
    params.set('destination', String(to.address).trim());
  } else {
    return null;
  }

  if (from && hasCoords(from.lat, from.lng)) {
    params.set('origin', `${Number(from.lat)},${Number(from.lng)}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Ikki nuqta orasidagi masofa (taxminiy, km) — Haversine formulasi. */
export function distanceKm(lat1, lng1, lat2, lng2) {
  // Ilgari `!lat1` tekshirilardi — bu 0 koordinatani ham rad etardi
  if (!hasCoords(lat1, lng1) || !hasCoords(lat2, lng2)) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function telUrl(phone) {
  if (!phone) return null;
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
