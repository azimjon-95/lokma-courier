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

/**
 * Customer koordinatalarini turli mumkin bo'lgan fieldlardan olish.
 *
 * MUHIM:
 * addressLabel / addressNote dan koordinata qidirmaydi.
 * Faqat haqiqiy lat/lng qiymatlarini oladi.
 */
function getCustomerCoords(order) {
  if (!order) return null;

  const candidates = [
    // Eng oddiy variant
    {
      lat: order.lat,
      lng: order.lng,
    },

    // Customer prefix bilan
    {
      lat: order.customerLat,
      lng: order.customerLng,
    },

    // delivery prefix bilan
    {
      lat: order.deliveryLat,
      lng: order.deliveryLng,
    },

    // location obyektlari
    {
      lat: order.customerLocation?.lat,
      lng: order.customerLocation?.lng,
    },
    {
      lat: order.deliveryLocation?.lat,
      lng: order.deliveryLocation?.lng,
    },
    {
      lat: order.location?.lat,
      lng: order.location?.lng,
    },

    // GeoJSON
    {
      lat: order.customerLocation?.coordinates?.[1],
      lng: order.customerLocation?.coordinates?.[0],
    },
    {
      lat: order.deliveryLocation?.coordinates?.[1],
      lng: order.deliveryLocation?.coordinates?.[0],
    },
    {
      lat: order.location?.coordinates?.[1],
      lng: order.location?.coordinates?.[0],
    },
  ];

  for (const candidate of candidates) {
    if (hasCoords(candidate.lat, candidate.lng)) {
      return {
        lat: Number(candidate.lat),
        lng: Number(candidate.lng),
      };
    }
  }

  return null;
}

export function CourierPage() {
  const { token } = useParams();

  const [state, setState] = useState({
    loading: true,
    view: null,
    order: null,
    error: null,
  });

  const [accepting, setAccepting] = useState(false);
  const [showDeliverConfirm, setShowDeliverConfirm] = useState(false);
  const [delivering, setDelivering] = useState(false);

  const [mapTarget, setMapTarget] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  /**
   * MUHIM:
   * Barcha hooklar conditional returnlardan OLDIN bo'lishi kerak.
   * Aks holda React error #310 chiqadi.
   */

  const load = useCallback(async () => {
    try {
      const res = await api.getInvite(token);

      console.log(
        '[COURIER ORDER]',
        JSON.stringify(res.order, null, 2)
      );

      const customerCoords = getCustomerCoords(res.order);

      console.log('[CUSTOMER COORDS]', {
        lat: customerCoords?.lat,
        lng: customerCoords?.lng,
        found: Boolean(customerCoords),
      });

      setState({
        loading: false,
        view: res.view,
        order: res.order,
        error: null,
      });
    } catch (e) {
      console.error('[COURIER LOAD ERROR]', e);

      setState({
        loading: false,
        view: null,
        order: null,
        error: e.message,
      });
    }
  }, [token]);

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
              new Error('GPS koordinatalari olinmadi.')
            );
            return;
          }

          resolve({
            lat,
            lng,
          });
        },
        (error) => {
          let message =
            'GPS joylashuvingizni aniqlab bo‘lmadi.';

          if (
            error.code ===
            error.PERMISSION_DENIED
          ) {
            message =
              'GPS uchun ruxsat berilmagan. Brauzer sozlamalaridan Location/GPS ruxsatini yoqing.';
          }

          if (
            error.code ===
            error.POSITION_UNAVAILABLE
          ) {
            message =
              'GPS joylashuvi hozircha mavjud emas.';
          }

          if (
            error.code ===
            error.TIMEOUT
          ) {
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
      if (
        !hasCoords(
          target?.lat,
          target?.lng
        )
      ) {
        setLocationError(
          'Mijozning GPS koordinatalari mavjud emas. Manzil adresi orqali yo‘l ko‘rsatish bloklandi.'
        );
        return;
      }

      setMapTarget(target);
      setLocationError(null);
      setLocating(true);

      try {
        const location =
          await getCourierLocation();

        setCourierLocation(location);
      } catch (error) {
        console.error(
          '[COURIER GPS ERROR]',
          error
        );

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

      if (
        !hasCoords(
          mapTarget.lat,
          mapTarget.lng
        )
      ) {
        setLocationError(
          'Mijozning GPS koordinatalari mavjud emas.'
        );
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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state.view !== 'offer') return;

    const timer = setInterval(
      load,
      4000
    );

    return () =>
      clearInterval(timer);
  }, [state.view, load]);

  const handleAccept = async () => {
    setAccepting(true);

    try {
      await api.accept(token);
      await load();
    } catch (e) {
      await load();

      if (e.status !== 409) {
        alert(e.message);
      }
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

  /**
   * Endi conditional returnlar hooklardan KEYIN.
   */

  if (state.loading) {
    return (
      <Centered>
        <div className="spinner" />
      </Centered>
    );
  }

  if (
    state.error ||
    state.view === 'not_found'
  ) {
    return (
      <Centered>
        <div className="status-icon">🔗</div>

        <h1>Havola topilmadi</h1>

        <p>
          Bu havola noto‘g‘ri yoki eskirgan
          bo‘lishi mumkin.
        </p>
      </Centered>
    );
  }

  if (state.view === 'taken') {
    return (
      <Centered>
        <div className="status-icon">🚴</div>

        <h1>Band qilindi</h1>

        <p>
          Bu buyurtmani boshqa kuryer
          allaqachon qabul qildi.
        </p>
      </Centered>
    );
  }

  if (state.view === 'closed') {
    return (
      <Centered>
        <div className="status-icon">✅</div>

        <h1>Yakunlangan</h1>

        <p>
          Bu buyurtma allaqachon yetkazib
          berilgan.
        </p>
      </Centered>
    );
  }

  if (state.view === 'delivered') {
    return (
      <Centered>
        <div className="status-icon status-icon--success">
          🎉
        </div>

        <h1>Rahmat!</h1>

        <p>
          Siz bu buyurtmani muvaffaqiyatli
          yetkazdingiz.
        </p>
      </Centered>
    );
  }

  // view === 'offer' | 'mine'

  const o = state.order;

  if (!o) {
    return (
      <Centered>
        <div className="status-icon">⚠️</div>

        <h1>Buyurtma topilmadi</h1>

        <p>
          Buyurtma ma’lumotlarini olishda
          muammo yuz berdi.
        </p>
      </Centered>
    );
  }

  const isMine = state.view === 'mine';

  const customerCoords =
    getCustomerCoords(o);

  const km = distanceKm(
    o.restaurantLat,
    o.restaurantLng,
    customerCoords?.lat,
    customerCoords?.lng
  );

  return (
    <div className="courier-page">

      <header className="cp-header">
        <div className="cp-header__top">
          <span
            className={`cp-badge ${
              isMine ? 'is-mine' : ''
            }`}
          >
            {isMine
              ? 'Sizga biriktirilgan'
              : 'Yangi taklif'}
          </span>

          {o.orderCode && (
            <span className="cp-code">
              #{o.orderCode}
            </span>
          )}
        </div>

        {(o.deliveryFee > 0 ||
          km != null) && (
          <div className="cp-earn">
            {o.deliveryFee > 0 ? (
              <div className="cp-earn__main">
                <span className="cp-earn__label">
                  Yetkazish haqi
                </span>

                <b>
                  {som(o.deliveryFee)}
                  <i>so‘m</i>
                </b>
              </div>
            ) : (
              <div className="cp-earn__main">
                <span className="cp-earn__label">
                  Buyurtma
                </span>

                <b className="cp-earn__plain">
                  {som(o.total)}
                  <i>so‘m</i>
                </b>
              </div>
            )}

            {km != null && (
              <div className="cp-earn__km">
                <span>{km}</span>
                <i>km</i>
              </div>
            )}
          </div>
        )}
      </header>

      <div
        className={`cp-pay ${
          o.isPaid
            ? 'is-paid'
            : 'is-cash'
        }`}
      >
        {o.isPaid ? (
          <>
            <span className="cp-pay__icon">
              ✓
            </span>

            <div>
              <b>To‘langan</b>
              <span>
                Mijozdan pul olinmaydi
              </span>
            </div>
          </>
        ) : (
          <>
            <span className="cp-pay__icon">
              💵
            </span>

            <div>
              <b>
                {som(
                  o.collectAmount ||
                    o.total
                )}{' '}
                so‘m
              </b>

              <span>
                Mijozdan naqd olinadi
              </span>
            </div>
          </>
        )}
      </div>

      <div className="cp-route">

        <Point
          step="1"
          label="OLIB KETISH"
          title={o.restaurantName}
          sub={o.restaurantAddress}
          to={{
            lat: o.restaurantLat,
            lng: o.restaurantLng,
            address:
              o.restaurantAddress,
          }}
          phone={o.restaurantPhone}
        />

        <div className="cp-route__line">
          {km != null && (
            <span>{km} km</span>
          )}
        </div>

        <Point
          step="2"
          label="YETKAZISH"
          title={
            o.addressLabel ||
            'Manzil'
          }
          sub={
            isMine
              ? o.addressNote
              : null
          }
          to={
            isMine &&
            customerCoords
              ? {
                  lat:
                    customerCoords.lat,
                  lng:
                    customerCoords.lng,
                }
              : null
          }
          from={null}
          phone={
            isMine
              ? o.customerPhone
              : null
          }
          person={
            isMine
              ? o.customerName
              : null
          }
          username={
            isMine
              ? o.customerUsername
              : null
          }
          locked={!isMine}
          onNavigate={
            handleOpenMaps
          }
        />
      </div>

      <div className="cp-card">
        <div className="cp-card__label">
          TAOMLAR
        </div>

        {o.items?.length ? (
          <ul className="cp-items">
            {o.items.map(
              (it, i) => (
                <li key={i}>
                  <span className="cp-items__qty">
                    {it.quantity}×
                  </span>

                  <span className="cp-items__name">
                    {it.name}
                  </span>
                </li>
              )
            )}
          </ul>
        ) : (
          <div className="cp-card__sub">
            {o.itemsSummary}
          </div>
        )}

        {o.note && (
          <div className="cp-note">
            <b>Izoh:</b> {o.note}
          </div>
        )}
      </div>

      <div className="cp-footer">
        {!isMine ? (
          <>
            <button
              className="cp-btn cp-btn--primary"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting
                ? 'Yuborilmoqda...'
                : '✓ Qabul qilaman'}
            </button>

            <p className="cp-footer__hint">
              Birinchi qabul qilgan kuryer
              oladi
            </p>
          </>
        ) : !showDeliverConfirm ? (
          <button
            className="cp-btn cp-btn--primary"
            onClick={() =>
              setShowDeliverConfirm(true)
            }
          >
            📦 Topshirdim
          </button>
        ) : (
          <div className="cp-confirm">
            <p>
              {o.isPaid
                ? 'Buyurtmani topshirdingizmi?'
                : `${som(
                    o.collectAmount ||
                      o.total
                  )} so‘m oldingizmi?`}
            </p>

            <div className="cp-confirm__row">
              <button
                className="cp-btn cp-btn--ghost"
                onClick={() =>
                  setShowDeliverConfirm(
                    false
                  )
                }
                disabled={delivering}
              >
                Yo‘q
              </button>

              <button
                className="cp-btn cp-btn--primary"
                onClick={
                  handleDeliver
                }
                disabled={delivering}
              >
                {delivering
                  ? '...'
                  : 'Ha, topshirdim'}
              </button>
            </div>
          </div>
        )}
      </div>

      <MapChooserModal
        open={Boolean(mapTarget)}
        target={mapTarget}
        courierLocation={
          courierLocation
        }
        locating={locating}
        error={locationError}
        onClose={() => {
          setMapTarget(null);
          setLocationError(null);
        }}
        onSelect={
          openSelectedMap
        }
      />
    </div>
  );
}

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
  return (
    <div
      className={`cp-point ${
        locked ? 'is-locked' : ''
      }`}
    >
      <div className="cp-point__step">
        {step}
      </div>

      <div className="cp-point__body">
        <div className="cp-point__label">
          {label}
        </div>

        <div className="cp-point__title">
          {title}
        </div>

        {sub && (
          <div className="cp-point__sub">
            {sub}
          </div>
        )}

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
            🔒 Aniq manzil, telefon va xarita
            qabul qilgandan keyin
          </div>
        )}

        {(
          (!locked &&
            hasCoords(
              to?.lat,
              to?.lng
            )) ||
          phone
        ) && (
          <div className="cp-point__actions">

            {!locked &&
              hasCoords(
                to?.lat,
                to?.lng
              ) && (
                <button
                  type="button"
                  className="cp-act cp-act--map"
                  onClick={() =>
                    onNavigate?.(
                      to
                    )
                  }
                >
                  🧭 Yo‘l ko‘rsatish
                </button>
              )}

            {phone && (
              <a
                href={telUrl(phone)}
                className="cp-act cp-act--call"
              >
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
        onClick={(event) =>
          event.stopPropagation()
        }
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
            Mijozning GPS koordinatalari
            topilmadi.
          </div>
        )}

        {hasTarget && (
          <>
            {locating && (
              <div className="cp-map-modal__loading">
                📍 Courier joylashuvi
                aniqlanmoqda...
              </div>
            )}

            {!locating &&
              courierLocation && (
                <div className="cp-map-modal__success">
                  ✓ Courier GPS joylashuvi
                  olindi
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
                onClick={() =>
                  onSelect('yandex')
                }
              >
                <span className="cp-map-modal__icon">
                  Я
                </span>

                <span>
                  <strong>
                    Yandex Maps
                  </strong>

                  <small>
                    Yandex orqali yo‘l
                  </small>
                </span>
              </button>

              <button
                type="button"
                className="cp-map-modal__option"
                disabled={locating}
                onClick={() =>
                  onSelect('google')
                }
              >
                <span className="cp-map-modal__icon">
                  G
                </span>

                <span>
                  <strong>
                    Google Maps
                  </strong>

                  <small>
                    Google orqali yo‘l
                  </small>
                </span>
              </button>

              <button
                type="button"
                className="cp-map-modal__option"
                disabled={locating}
                onClick={() =>
                  onSelect('apple')
                }
              >
                <span className="cp-map-modal__icon">
                  
                </span>

                <span>
                  <strong>
                    Apple Maps
                  </strong>

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
  return (
    <div className="courier-page courier-page--centered">
      {children}
    </div>
  );
}