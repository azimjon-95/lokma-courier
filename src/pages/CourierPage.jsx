import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { mapUrl, distanceKm, telUrl } from '../lib/maps';
import './CourierPage.css';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export function CourierPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, view: null, order: null, error: null });
  const [accepting, setAccepting] = useState(false);
  const [showDeliverConfirm, setShowDeliverConfirm] = useState(false);
  const [delivering, setDelivering] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getInvite(token);
      setState({ loading: false, view: res.view, order: res.order, error: null });
    } catch (e) {
      setState({ loading: false, view: null, order: null, error: e.message });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  /*
   * "Taklif" (offer) holatida — boshqa kuryerlar ham buni ko'rib
   * turishi mumkin. Agar ULAR qabul qilib ulgursa, bu ekran
   * "band qilindi"ga o'zgarishi kerak — shuning uchun 4 soniyada
   * bir marta jonli tekshiramiz (real-time socket o'rniga oddiy
   * polling — kuryer ilovasi uchun bu yetarli va ancha sodda).
   */
  useEffect(() => {
    if (state.view !== 'offer') return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [state.view, load]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await api.accept(token);
      await load();
    } catch (e) {
      // 409 — kimdir bizdan oldin oldi. Holatni qayta yuklaymiz —
      // server "taken" deb to'g'ri ko'rsatadi.
      await load();
      if (e.status !== 409) alert(e.message);
    }
    setAccepting(false);
  };

  const handleDeliver = async () => {
    setDelivering(true);
    try {
      await api.deliver(token);
      setShowDeliverConfirm(false);
      await load();
    } catch (e) {
      alert(e.message);
    }
    setDelivering(false);
  };

  if (state.loading) {
    return <Centered><div className="spinner" /></Centered>;
  }

  if (state.error || state.view === 'not_found') {
    return (
      <Centered>
        <div className="status-icon">🔗</div>
        <h1>Havola topilmadi</h1>
        <p>Bu havola noto'g'ri yoki eskirgan bo'lishi mumkin.</p>
      </Centered>
    );
  }

  if (state.view === 'taken') {
    return (
      <Centered>
        <div className="status-icon">🚴</div>
        <h1>Band qilindi</h1>
        <p>Bu buyurtmani boshqa kuryer allaqachon qabul qildi.</p>
      </Centered>
    );
  }

  if (state.view === 'closed') {
    return (
      <Centered>
        <div className="status-icon">✅</div>
        <h1>Yakunlangan</h1>
        <p>Bu buyurtma allaqachon yetkazib berilgan.</p>
      </Centered>
    );
  }

  if (state.view === 'delivered') {
    return (
      <Centered>
        <div className="status-icon status-icon--success">🎉</div>
        <h1>Rahmat!</h1>
        <p>Siz bu buyurtmani muvaffaqiyatli yetkazdingiz.</p>
      </Centered>
    );
  }

  // view === 'offer' | 'mine'
  const o = state.order;
  const isMine = state.view === 'mine';
  const km = distanceKm(o.restaurantLat, o.restaurantLng, o.lat, o.lng);

  return (
    <div className="courier-page">

      {/* ═══ SARLAVHA ═══
          Kuryer uchun eng muhim ikki raqam: yetkazish haqi
          (uning daromadi) va mijozdan olinadigan summa.
          Ilgari faqat buyurtma jami ko'rinardi — u esa
          kuryerga hech narsa aytmasdi. */}
      <header className="cp-header">
        <div className="cp-header__top">
          <span className={`cp-badge ${isMine ? 'is-mine' : ''}`}>
            {isMine ? 'Sizga biriktirilgan' : 'Yangi taklif'}
          </span>
          {o.orderCode && <span className="cp-code">#{o.orderCode}</span>}
        </div>

        {/*
          Yetkazish haqi 0 bo'lsa BLOK KO'RSATILMAYDI.

          "Yetkazish haqi: 0 so'm" katta harflarda turishi
          kuryerga "bu ish bepul" degan taassurot beradi va
          buyurtmani rad etishga undaydi. Aslida 0 ko'pincha
          "haq restoran bilan alohida kelishilgan" degani.

          Masofa esa foydali — u alohida qoladi.
        */}
        {(o.deliveryFee > 0 || km != null) && (
          <div className="cp-earn">
            {o.deliveryFee > 0 ? (
              <div className="cp-earn__main">
                <span className="cp-earn__label">Yetkazish haqi</span>
                <b>{som(o.deliveryFee)}<i>so‘m</i></b>
              </div>
            ) : (
              <div className="cp-earn__main">
                <span className="cp-earn__label">Buyurtma</span>
                <b className="cp-earn__plain">{som(o.total)}<i>so‘m</i></b>
              </div>
            )}

            {km != null && (
              <div className="cp-earn__km">
                <span>{km}</span><i>km</i>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ═══ PUL YIG'ISH ═══
          Alohida va ko'zga tashlanadigan qilib berilgan:
          kuryer mijoz eshigida turib "pul olamanmi?" degan
          savolga darhol javob topishi kerak. */}
      <div className={`cp-pay ${o.isPaid ? 'is-paid' : 'is-cash'}`}>
        {o.isPaid ? (
          <>
            <span className="cp-pay__icon">✓</span>
            <div>
              <b>To‘langan</b>
              <span>Mijozdan pul olinmaydi</span>
            </div>
          </>
        ) : (
          <>
            <span className="cp-pay__icon">💵</span>
            <div>
              <b>{som(o.collectAmount || o.total)} so‘m</b>
              <span>Mijozdan naqd olinadi</span>
            </div>
          </>
        )}
      </div>

      {/* ═══ MARSHRUT ═══ */}
      <div className="cp-route">
        <Point
          step="1"
          label="OLIB KETISH"
          title={o.restaurantName}
          sub={o.restaurantAddress}
          address={o.restaurantAddress}
          lat={o.restaurantLat}
          lng={o.restaurantLng}
          phone={o.restaurantPhone}
        />

        <div className="cp-route__line">
          {km != null && <span>{km} km</span>}
        </div>

        <Point
          step="2"
          label="YETKAZISH"
          title={o.addressLabel || 'Manzil'}
          sub={isMine ? o.addressNote : null}
          /*
            Xaritaga TO'LIQ manzil beriladi, qisqartirilgani
            emas: "Uy — улица Каховка, 16 к1" dagi "Uy —"
            qismi qidiruvni chalg'itadi, shuning uchun uni
            olib tashlaymiz.
          */
          address={isMine ? String(o.addressLabel || '').replace(/^[^—]*—\s*/, '') : null}
          lat={isMine ? o.lat : null}
          lng={isMine ? o.lng : null}
          phone={isMine ? o.customerPhone : null}
          person={isMine ? o.customerName : null}
          username={isMine ? o.customerUsername : null}
          locked={!isMine}
        />
      </div>

      {/* ═══ TAOMLAR ═══
          Ro'yxat sifatida: kuryer restoranda nechta nima
          olayotganini sanab tekshiradi. Ilgari bitta uzun
          qator edi va ajratib bo'lmasdi. */}
      <div className="cp-card">
        <div className="cp-card__label">TAOMLAR</div>
        {o.items?.length ? (
          <ul className="cp-items">
            {o.items.map((it, i) => (
              <li key={i}>
                <span className="cp-items__qty">{it.quantity}×</span>
                <span className="cp-items__name">{it.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cp-card__sub">{o.itemsSummary}</div>
        )}

        {o.note && (
          <div className="cp-note">
            <b>Izoh:</b> {o.note}
          </div>
        )}
      </div>

      {/* ═══ AMAL ═══ */}
      <div className="cp-footer">
        {!isMine ? (
          <>
            <button className="cp-btn cp-btn--primary" onClick={handleAccept} disabled={accepting}>
              {accepting ? 'Yuborilmoqda...' : '✓ Qabul qilaman'}
            </button>
            <p className="cp-footer__hint">
              Birinchi qabul qilgan kuryer oladi
            </p>
          </>
        ) : !showDeliverConfirm ? (
          <button className="cp-btn cp-btn--primary" onClick={() => setShowDeliverConfirm(true)}>
            📦 Topshirdim
          </button>
        ) : (
          <div className="cp-confirm">
            <p>
              {o.isPaid
                ? 'Buyurtmani topshirdingizmi?'
                : `${som(o.collectAmount || o.total)} so‘m oldingizmi?`}
            </p>
            <div className="cp-confirm__row">
              <button className="cp-btn cp-btn--ghost" onClick={() => setShowDeliverConfirm(false)} disabled={delivering}>
                Yo‘q
              </button>
              <button className="cp-btn cp-btn--primary" onClick={handleDeliver} disabled={delivering}>
                {delivering ? '...' : 'Ha, topshirdim'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Marshrut nuqtasi — olib ketish yoki yetkazish.
 *
 * Navigatsiya va qo'ng'iroq tugmalari BIR JOYDA: kuryer
 * moto ustida, bir qo'li band. Har amal katta va aniq
 * bo'lishi kerak, qidirib o'tirmasin.
 */
function Point({ step, label, title, sub, lat, lng, phone, person, username, locked, address }) {
  /*
   * Navigatsiya uchun eng aniq ma'lumot: koordinata bo'lsa u,
   * bo'lmasa to'liq manzil matni. `address` — mijoz kiritgan
   * manzil, `title` esa qisqartirilgan ko'rinishi.
   */
  const nav = locked ? null : mapUrl(lat, lng, address || title);

  return (
    <div className={`cp-point ${locked ? 'is-locked' : ''}`}>
      <div className="cp-point__step">{step}</div>

      <div className="cp-point__body">
        <div className="cp-point__label">{label}</div>
        <div className="cp-point__title">{title}</div>
        {sub && <div className="cp-point__sub">{sub}</div>}

        {person && (
          <div className="cp-point__person">
            {person}
            {username && (
              <a
                href={`https://t.me/${username}`}
                target="_blank"
                rel="noreferrer"
                className="cp-tg"
              >
                @{username}
              </a>
            )}
          </div>
        )}

        {locked && (
          <div className="cp-point__lock">
            🔒 Aniq manzil, telefon va xarita qabul qilgandan keyin
          </div>
        )}

        {/*
          Navigatsiya havolasi koordinatasiz ham yasaladi —
          manzil matni bo'yicha (maps.js da). Shuning uchun
          shart `lat` emas, `nav` ning o'zi tekshiriladi.

          Ilgari koordinatasiz buyurtmada tugma umuman
          chiqmasdi va kuryer manzilni qo'lda ko'chirishga
          majbur bo'lardi.
        */}
        {(nav || phone) && (
          <div className="cp-point__actions">
            {nav && (
              <a href={nav} target="_blank" rel="noreferrer" className="cp-act cp-act--map">
                🧭 Yo‘l ko‘rsatish
              </a>
            )}
            {phone && (
              <a href={telUrl(phone)} className="cp-act cp-act--call">
                📞 Qo‘ng‘iroq
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return <div className="courier-page courier-page--centered">{children}</div>;
}
