import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  googleMapsUrl,
  yandexMapsUrl,
  appleMapsUrl,
  hasCoords,
  distanceKm,
  telUrl,
} from '../lib/maps';
import './CourierPage.css';

const som = (n) => (n ?? 0).toLocaleString('ru-RU').replace(/,/g, ' ');

export function CourierPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, view: null, order: null, error: null });
  const [accepting, setAccepting] = useState(false);
  const [showDeliverConfirm, setShowDeliverConfirm] = useState(false);
  const [delivering, setDelivering] = useState(false);
  
  const [mapTarget, setMapTarget] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getInvite(token);

      console.log(
        '[COURIER ORDER]',
        JSON.stringify(res.order, null, 2)
      );

      console.log('[CUSTOMER COORDS]', {
        lat: res.order?.lat,
        lng: res.order?.lng,
      });
      
      setState({
        loading: false,
        view: res.view,
        order: res.order,
        error: null,
      });
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


  const getCourierLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            'Bu qurilmada GPS/geolocation qo‘llab-quvvatlanmaydi.'
          )
        );
        return;
      }
  
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
  
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            reject(
              new Error(
                'GPS koordinatalari olinmadi.'
              )
            );
            return;
          }
  
          resolve({
            lat,
            lng,
          });
        },
        (error) => {
          let message = 'GPS joylashuvingizni aniqlab bo‘lmadi.';
  
          if (error.code === error.PERMISSION_DENIED) {
            message =
              'GPS uchun ruxsat berilmagan. Brauzer sozlamalaridan Location/GPS ruxsatini yoqing.';
          }
  
          if (error.code === error.POSITION_UNAVAILABLE) {
            message =
              'GPS joylashuvi hozircha mavjud emas.';
          }
  
          if (error.code === error.TIMEOUT) {
            message =
              'GPS joylashuvini aniqlash vaqti tugadi.';
          }
  
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    });
  }, []);

  const handleOpenMaps = useCallback(
  async (target) => {
    if (!hasCoords(target?.lat, target?.lng)) {
      setLocationError(
        'Mijozning GPS koordinatalari mavjud emas. Manzil adresi orqali yo‘l ko‘rsatish bloklandi.'
      );
      return;
    }

    setMapTarget(target);
    setLocationError(null);
    setLocating(true);

    try {
      const location = await getCourierLocation();

      setCourierLocation(location);
    } catch (error) {
      console.error('[COURIER GPS ERROR]', error);

      setCourierLocation(null);
      setLocationError(
        error?.message ||
          'Courier GPS joylashuvini aniqlab bo‘lmadi.'
      );
    } finally {
      setLocating(false);
    }
  },
  [getCourierLocation]
  );

  const openSelectedMap = useCallback(
  (provider) => {
    if (!mapTarget) return;

    if (!hasCoords(mapTarget.lat, mapTarget.lng)) {
      return;
    }

    let url = null;

    if (provider === 'google') {
      url = googleMapsUrl(
        mapTarget,
        courierLocation
      );
    }

    if (provider === 'yandex') {
      url = yandexMapsUrl(
        mapTarget,
        courierLocation
      );
    }

    if (provider === 'apple') {
      url = appleMapsUrl(
        mapTarget,
        courierLocation
      );
    }

    if (!url) {
      setLocationError(
        'Xarita uchun kerakli koordinatalar mavjud emas.'
      );
      return;
    }

    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    );

    setMapTarget(null);
  },
  [mapTarget, courierLocation]
  );

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
        {/*
          1-nuqta: marshrut KURYERNING JORIY joylashuvidan
          restoranga chiziladi (`from` berilmaydi — Google
          telefonning GPS'idan boshlaydi).
        */}
        <Point
          step="1"
          label="OLIB KETISH"
          title={o.restaurantName}
          sub={o.restaurantAddress}
          to={{ lat: o.restaurantLat, lng: o.restaurantLng, address: o.restaurantAddress }}
          phone={o.restaurantPhone}
        />

        <div className="cp-route__line">
          {km != null && <span>{km} km</span>}
        </div>

        {/*
          2-nuqta: marshrut RESTORANDAN MIJOZ KOORDINATASIGA
          chiziladi — kuryer taomni olgach shu yo'ldan boradi.

          MUHIM: mijoz koordinatasi bo'lsa manzil MATNI umuman
          ishlatilmaydi. Avval "Uy — 18, xon. 6" kabi matn
          xaritaga qidiruv sifatida ketardi va butunlay boshqa
          shahardagi ko'chani ochib qo'yardi. Matn endi faqat
          koordinata YO'Q bo'lgandagina zaxira sifatida ishlaydi.
        */}
       <Point
          step="2"
          label="YETKAZISH"
          title={o.addressLabel || 'Manzil'}
          sub={isMine ? o.addressNote : null}
          to={
            isMine
              ? {
                  lat: o.lat,
                  lng: o.lng,
                }
              : null
          }
          from={null}
          phone={isMine ? o.customerPhone : null}
          person={isMine ? o.customerName : null}
          username={isMine ? o.customerUsername : null}
          locked={!isMine}
          onNavigate={handleOpenMaps}
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

      <MapChooserModal
        open={Boolean(mapTarget)}
        target={mapTarget}
        courierLocation={courierLocation}
        locating={locating}
        error={locationError}
        onClose={() => {
          setMapTarget(null);
          setLocationError(null);
        }}
        onSelect={openSelectedMap}
      />
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
function Point({
  step,
  label,
  title,
  sub,
  to,
  from,
  phone,
  person,
  username,
  locked,
  onNavigate,
}) {
  /*
   * `to`   — qayerga borish (koordinata, bo'lmasa manzil matni)
   * `from` — qayerdan (berilmasa: kuryerning joriy joylashuvi)
   */
  // const nav = locked ? null : navUrl(to || {}, from);

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
          shart koordinata emas, `nav` ning o'zi tekshiriladi.
        */}
       {((!locked && hasCoords(to?.lat, to?.lng)) || phone) && (
          <div className="cp-point__actions">
            {!locked && hasCoords(to?.lat, to?.lng) && (
              <button
                type="button"
                className="cp-act cp-act--map"
                onClick={() => onNavigate?.(to)}
              >
                🧭 Yo‘l ko‘rsatish
              </button>
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
function MapChooserModal({
  open,
  target,
  courierLocation,
  locating,
  error,
  onClose,
  onSelect,
}) {
  if (!open) {
    return null;
  }

  const hasTarget = hasCoords(
    target?.lat,
    target?.lng
  );

  return (
    <div
      className="cp-map-modal__backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="cp-map-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-map-modal-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="cp-map-modal__header">
          <div>
            <h3 id="cp-map-modal-title">
              Yo‘l ko‘rsatish
            </h3>

            <p>
              Xarita ilovasini tanlang
            </p>
          </div>

          <button
            type="button"
            className="cp-map-modal__close"
            onClick={onClose}
            aria-label="Yopish"
          >
            ×
          </button>
        </div>

        {!hasTarget && (
          <div className="cp-map-modal__error">
            Mijozning GPS koordinatalari topilmadi.
          </div>
        )}

        {hasTarget && (
          <>
            {locating && (
              <div className="cp-map-modal__loading">
                📍 Courier joylashuvi aniqlanmoqda...
              </div>
            )}

            {!locating && courierLocation && (
              <div className="cp-map-modal__success">
                ✓ Courier GPS joylashuvi olindi
              </div>
            )}

            {error && (
              <div className="cp-map-modal__error">
                {error}
              </div>
            )}

            <div className="cp-map-modal__buttons">
              <button
                type="button"
                className="cp-map-modal__option"
                disabled={locating}
                onClick={() => onSelect('yandex')}
              >
                <span className="cp-map-modal__icon">
                  Я
                </span>

                <span>
                  <strong>Yandex Maps</strong>
                  <small>
                    Yandex orqali yo‘l
                  </small>
                </span>
              </button>

              <button
                type="button"
                className="cp-map-modal__option"
                disabled={locating}
                onClick={() => onSelect('google')}
              >
                <span className="cp-map-modal__icon">
                  G
                </span>

                <span>
                  <strong>Google Maps</strong>
                  <small>
                    Google orqali yo‘l
                  </small>
                </span>
              </button>

              <button
                type="button"
                className="cp-map-modal__option"
                disabled={locating}
                onClick={() => onSelect('apple')}
              >
                <span className="cp-map-modal__icon">
                  
                </span>

                <span>
                  <strong>Apple Maps</strong>
                  <small>
                    Apple orqali yo‘l
                  </small>
                </span>
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          className="cp-map-modal__cancel"
          onClick={onClose}
        >
          Bekor qilish
        </button>
      </div>
    </div>
  );
}

function Centered({ children }) {
  return <div className="courier-page courier-page--centered">{children}</div>;
}
