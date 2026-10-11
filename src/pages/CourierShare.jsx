import { useEffect, useRef, useState } from 'react';
import { api, getSavedProfile, saveProfile } from '../lib/api';

/*
 * Qabul qilingan buyurtmada kuryer MIJOZGA ko'rinadi:
 *   1) Ism, telefon, transport — BIR MARTA kiritiladi (keyingi buyurtmalarda avtomatik yuboriladi);
 *   2) Jonli joylashuv — har ~8 soniyada serverga yuboriladi; mijoz ilovasida kuryer xaritada harakatlanadi.
 * Joylashuv faqat shu buyurtma "mine" bo'lganda yuboriladi (topshirilgach sahifa o'zgaradi va to'xtaydi).
 */
const SEND_EVERY_MS = 8000;
const VEHICLES = [['scooter', '🛵 Skuter'], ['bike', '🚲 Velosiped'], ['car', '🚗 Mashina'], ['foot', '🚶 Piyoda']];
const sentKey = (token) => `lokma_courier_profile_sent_${token}`;

export function CourierShare({ token }) {
  const saved = getSavedProfile();
  const [sent, setSent] = useState(() => { try { return localStorage.getItem(sentKey(token)) === '1'; } catch { return false; } });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: saved?.name || '', phone: saved?.phone || '+998', vehicle: saved?.vehicle || 'scooter' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState('asking'); // asking | live | denied | unsupported
  const last = useRef(null);
  const lastSent = useRef(0);

  const submit = async (data) => {
    setBusy(true); setErr(null);
    try {
      await api.profile(token, data);
      saveProfile(data);
      try { localStorage.setItem(sentKey(token), '1'); } catch { /* jim */ }
      setSent(true); setEditing(false);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // Ilgari kiritilgan ma'lumot bo'lsa — qayta so'ramasdan avtomatik yuboriladi
  useEffect(() => {
    if (!sent && saved?.name && saved?.phone && !busy) submit(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jonli joylashuv
  useEffect(() => {
    if (!navigator.geolocation) { setGps('unsupported'); return undefined; }
    let wake = null;
    navigator.wakeLock?.request('screen').then((w) => { wake = w; }).catch(() => {});
    const id = navigator.geolocation.watchPosition(
      (pos) => { last.current = pos; setGps('live'); },
      (e) => setGps(e.code === 1 ? 'denied' : 'asking'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    const timer = setInterval(() => {
      const p = last.current;
      if (!p || Date.now() - lastSent.current < SEND_EVERY_MS - 500) return;
      lastSent.current = Date.now();
      api.location(token, { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, ...(Number.isFinite(p.coords.heading) ? { heading: p.coords.heading } : {}) }).catch(() => {});
    }, 2000);
    return () => { navigator.geolocation.clearWatch(id); clearInterval(timer); try { wake?.release(); } catch { /* */ } };
  }, [token]);

  const valid = form.name.trim().length >= 2 && form.phone.replace(/\D/g, '').length >= 9;

  return (
    <section className="cs">
      <div className={`cs__gps is-${gps}`}>
        <span className="cs__dot" />
        {gps === 'live' && 'Joylashuvingiz mijozga ko‘rinmoqda'}
        {gps === 'asking' && 'Joylashuv aniqlanmoqda… (ruxsat bering)'}
        {gps === 'denied' && 'Joylashuv o‘chiq — mijoz sizni xaritada ko‘rmaydi. Brauzer sozlamasidan yoqing'}
        {gps === 'unsupported' && 'Bu qurilmada joylashuv yo‘q'}
      </div>

      {sent && !editing ? (
        <div className="cs__me">
          <span>{saved?.name} · {VEHICLES.find((v) => v[0] === saved?.vehicle)?.[1] || ''}</span>
          <button type="button" onClick={() => setEditing(true)}>O‘zgartirish</button>
        </div>
      ) : (
        <div className="cs__form">
          <b>Mijoz sizni shunday ko‘radi</b>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ismingiz" maxLength={60} autoComplete="name" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" inputMode="tel" maxLength={20} autoComplete="tel" />
          <div className="cs__veh">
            {VEHICLES.map(([k, l]) => (
              <button key={k} type="button" className={form.vehicle === k ? 'is-on' : ''} onClick={() => setForm({ ...form, vehicle: k })}>{l}</button>
            ))}
          </div>
          {err && <p className="cs__err">{err}</p>}
          <button type="button" className="cs__save" disabled={!valid || busy} onClick={() => submit({ name: form.name.trim(), phone: form.phone.trim(), vehicle: form.vehicle })}>
            {busy ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      )}
    </section>
  );
}
