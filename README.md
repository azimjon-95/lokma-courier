# LokmaGo Kuryer (lokma-courier)

Kuryerlar uchun token-asosli veb-sahifa — login yo'q, Telegram
bot orqali yuborilgan shaxsiy havola orqali kirish.

## Arxitektura qarori — nega token, nega login yo'q

Bitta buyurtma bir nechta kuryerga (masalan 5 tasiga) yuborilganda,
HAR BIRIGA ALOHIDA token beriladi (bitta umumiy havola emas).
Token o'zi kredensial: u Telegram orqali FAQAT o'sha kuryerning
shaxsiy chatiga yuborilgan.

**Foyda:** kuryer havolani qaysi brauzer/qurilmadan ochsa ham
(Chrome, Yandex Browser, Windows, iOS — farqi yo'q), server
darhol "bu token — shu kuryerniki" deb biladi. Murakkab device
fingerprint, cookie yoki localStorage saqlash SHART EMAS.

**"Birinchi qabul qiladi" mexanizmi** — barcha 5 ta token bitta
`DeliveryAssignment` yozuviga ishora qiladi. Server tomonda
(`lakmago-server`) atomik `findOneAndUpdate` orqali faqat
BITTASI "assigned" holatiga o'ta oladi — qolganlari o'z
havolasini ochganda "band qilindi" ko'radi.

## Sahifa holatlari

Bitta marshrut — `/t/:token` — quyidagi holatlarni ko'rsatadi:

| Holat | Nima ko'rinadi |
|---|---|
| `offer` | Buyurtma taklifi — restoran, taxminiy manzil, "Qabul qilaman" |
| `mine` | Qabul qilingan — aniq manzil, telefon, "Topshirdim" |
| `taken` | Boshqa kuryer olib ulgurgan |
| `delivered` | Shu kuryer muvaffaqiyatli yetkazgan |
| `closed` | Buyurtma boshqa kuryer tomonidan yakunlangan |
| `not_found` | Token noto'g'ri/eskirgan |

## Ishga tushirish

```bash
npm install
cp .env.example .env.local   # VITE_API_URL ni sozlang
npm run dev                   # http://localhost:5175
```

## Backend bog'lanishi

`lakmago-server` dagi `/courier-portal/:token` endpointlariga
ulanadi (`src/controllers/courier.js`, `src/services/courierDispatch.js`).
Server config'idagi `COURIER_APP_URL` shu loyihaning production
manzilini (https://kuryer.lokma.uz) ko'rsatishi kerak — Telegram
xabaridagi havolalar shu manzil bilan quriladi.

## Keyingi bosqichlar (kelajakda)

- APK versiyasi (React Native yoki WebView o'rash) — kuryerlar
  uchun to'liq logistika, fon rejimida GPS kuzatuvi
- Kuryerning o'z ro'yxatdan o'tish oqimi (hozircha admin qo'lda qo'shadi)
- Yetkazish tarixi va daromad hisoboti sahifasi
