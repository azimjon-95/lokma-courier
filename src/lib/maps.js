/**
 * Xarita havolasi — koordinata bo'yicha.
 *
 * Yandex Xaritalar tanlangan (O'zbekistonda eng ko'p ishlatiladigan
 * navigatsiya xizmati), lekin agar telefon Yandex ilovasini
 * ochib bera olmasa, brauzer o'zi mos xizmatga yo'naltiradi
 * (yandex.uz/maps veb-versiyasi ham ishlaydi).
 */
export function mapUrl(lat, lng, label = '') {
  /*
   * KOORDINATA BO'LMASA MANZIL MATNI ISHLATILADI.
   *
   * Ilgari koordinatasiz `null` qaytarilardi va kuryerda
   * "Yo'l ko'rsatish" tugmasi UMUMAN chiqmasdi — u manzilni
   * qo'lda ko'chirib, xaritaga o'zi yozishi kerak edi.
   *
   * Koordinata har doim ham bo'lmaydi: mijoz manzilni xaritadan
   * emas, qo'lda yozgan bo'lishi mumkin. Bunday holatda Yandex
   * matn bo'yicha qidiradi — aniqlik pastroq, lekin kuryer
   * hech bo'lmasa ko'chani topadi.
   */
  if (lat && lng) {
    const q = label
      ? `?text=${encodeURIComponent(label)}&ll=${lng},${lat}&z=17`
      : `?ll=${lng},${lat}&z=17`;
    return `https://yandex.uz/maps${q}`;
  }

  if (label && label.trim()) {
    return `https://yandex.uz/maps/?text=${encodeURIComponent(label.trim())}`;
  }

  return null;
}

/** Ikki nuqta orasidagi masofa (taxminiy, km) — Haversine formulasi. */
export function distanceKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
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
