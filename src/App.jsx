import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CourierPage } from './pages/CourierPage';

/**
 * Marshrutlash juda oddiy — chunki bu ilovaning DEYARLI BUTUN
 * mazmuni bitta sahifada: /k/:token.
 *
 * Login sahifasi YO'Q — kuryer Telegram/WhatsApp orqali kelgan
 * havolani bosib to'g'ridan-to'g'ri shu yerga tushadi.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/k/:token" element={<CourierPage />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/** Token'siz kirilsa — botga qaytarish. */
function Landing() {
  return (
    <div className="landing">
      <div className="landing__logo">🛵</div>
      <h1>LokmaGo Kuryer</h1>
      <p>Buyurtma havolasi Telegram botingizga yuboriladi.</p>
    </div>
  );
}
