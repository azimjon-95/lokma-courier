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
      <header className="cp-header">
        <div className="cp-header__badge">{isMine ? 'Sizga biriktirilgan' : 'Yangi taklif'}</div>
        <div className="cp-header__total">{som(o.total)} so'm</div>
      </header>

      <div className="cp-card">
        <div className="cp-card__label">RESTORAN</div>
        <div className="cp-card__title">{o.restaurantName}</div>
        {o.restaurantAddress && <div className="cp-card__sub">{o.restaurantAddress}</div>}
        {o.restaurantLat && (
          <a href={mapUrl(o.restaurantLat, o.restaurantLng, o.restaurantName)}
            target="_blank" rel="noreferrer" className="cp-map-btn">
            🗺️ Xaritada ko'rish
          </a>
        )}
      </div>

      <div className="cp-arrow">↓{km != null && <span className="cp-arrow__km">{km} km</span>}</div>

      <div className="cp-card">
        <div className="cp-card__label">MIJOZ</div>
        <div className="cp-card__title">{o.addressLabel || 'Manzil'}</div>
        {isMine && o.addressNote && <div className="cp-card__sub">{o.addressNote}</div>}
        {isMine && o.lat && (
          <a href={mapUrl(o.lat, o.lng, o.addressLabel)}
            target="_blank" rel="noreferrer" className="cp-map-btn">
            🗺️ Xaritada ko'rish
          </a>
        )}
        {isMine && o.customerPhone && (
          <a href={telUrl(o.customerPhone)} className="cp-call-btn">
            📞 {o.customerPhone}
          </a>
        )}
        {!isMine && (
          <p className="cp-card__hint">Aniq manzil qabul qilgandan keyin ko'rinadi</p>
        )}
      </div>

      <div className="cp-card cp-card--items">
        <div className="cp-card__label">TAOMLAR</div>
        <div className="cp-card__items">{o.itemsSummary}</div>
      </div>

      <div className="cp-footer">
        {!isMine ? (
          <button className="cp-btn cp-btn--primary" onClick={handleAccept} disabled={accepting}>
            {accepting ? 'Yuborilmoqda...' : "\u2713 Qabul qilaman"}
          </button>
        ) : !showDeliverConfirm ? (
          <button className="cp-btn cp-btn--primary" onClick={() => setShowDeliverConfirm(true)}>
            {'\ud83d\udce6 Topshirdim'}
          </button>
        ) : (
          <div className="cp-confirm">
            <p>Topshirdingizmi?</p>
            <div className="cp-confirm__row">
              <button className="cp-btn cp-btn--ghost" onClick={() => setShowDeliverConfirm(false)} disabled={delivering}>
                Yo'q
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

function Centered({ children }) {
  return <div className="courier-page courier-page--centered">{children}</div>;
}
