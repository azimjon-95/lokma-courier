function isCoord(v) {
  if (v === null || v === undefined || v === '') return false;

  const n = Number(v);

  return Number.isFinite(n) && n !== 0;
}

export function hasCoords(lat, lng) {
  return isCoord(lat) && isCoord(lng);
}

function coordString(point) {
  return `${Number(point.lat)},${Number(point.lng)}`;
}

/**
 * Google Maps route
 *
 * MUHIM:
 * destination faqat LAT/LNG orqali beriladi.
 * Address fallback YO'Q.
 */
export function googleMapsUrl(to = {}, from = null) {
  if (!hasCoords(to.lat, to.lng)) {
    return null;
  }

  const params = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    destination: coordString(to),
  });

  if (from && hasCoords(from.lat, from.lng)) {
    params.set('origin', coordString(from));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Yandex Maps route
 *
 * Yandex navigator uchun:
 * fromLat,fromLng~toLat,toLng
 */
export function yandexMapsUrl(to = {}, from = null) {
  if (!hasCoords(to.lat, to.lng)) {
    return null;
  }

  const destination = coordString(to);

  if (from && hasCoords(from.lat, from.lng)) {
    const origin = coordString(from);

    return (
      `https://yandex.com/maps/?rtext=` +
      `${encodeURIComponent(origin)}~${encodeURIComponent(destination)}` +
      `&rtt=auto`
    );
  }

  /*
   * GPS yo'q — marshrut chizib bo'lmaydi.
   *
   * `rtext` ga bitta nuqta berilsa Yandex marshrut qurish
   * rejimida ochiladi va ikkinchi nuqtani so'rab turadi —
   * kuryer uchun chalg'ituvchi. Shuning uchun shunchaki
   * MANZIL NUQTASI ko'rsatiladi, kuryer o'zi "marshrut"
   * tugmasini bosadi.
   *
   * DIQQAT: `ll` va `pt` da Yandex tartibi — LONGITUDE,LATITUDE
   * (rtext dagidan teskari). Buni adashtirish manzilni butunlay
   * boshqa joyga olib boradi.
   */
  const lon = Number(to.lng);
  const lat = Number(to.lat);

  return `https://yandex.com/maps/?ll=${lon},${lat}&z=17&pt=${lon},${lat},pm2rdm`;
}

/**
 * Apple Maps route
 */
export function appleMapsUrl(to = {}, from = null) {
  if (!hasCoords(to.lat, to.lng)) {
    return null;
  }

  const params = new URLSearchParams({
    daddr: coordString(to),
    dirflg: 'd',
  });

  if (from && hasCoords(from.lat, from.lng)) {
    params.set('saddr', coordString(from));
  }

  return `https://maps.apple.com/?${params.toString()}`;
}

/**
 * Eski kodda ishlatilgan nom.
 * Agar boshqa joylarda navUrl() ishlatilayotgan bo'lsa,
 * ularni buzmaslik uchun qoldiryapmiz.
 *
 * MUHIM: address fallback endi YO'Q.
 */
export function navUrl(to = {}, from = null) {
  return googleMapsUrl(to, from);
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  if (!hasCoords(lat1, lng1) || !hasCoords(lat2, lng2)) {
    return null;
  }

  const lat1Num = Number(lat1);
  const lng1Num = Number(lng1);
  const lat2Num = Number(lat2);
  const lng2Num = Number(lng2);

  const R = 6371;

  const dLat = ((lat2Num - lat1Num) * Math.PI) / 180;
  const dLng = ((lng2Num - lng1Num) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1Num * Math.PI) / 180) *
      Math.cos((lat2Num * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

export function telUrl(phone) {
  if (!phone) return null;

  return `tel:${String(phone).replace(/[^\d+]/g, '')}`;
}