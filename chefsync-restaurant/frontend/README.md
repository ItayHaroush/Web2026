# Frontend - TakeEat

React + Vite PWA עם עברית וRTL מלא

---

## התקנה

```bash
npm install
npm run dev          # Development
npm run build        # Production build
npm run preview      # Review build
npm run lint         # ESLint check
```

---

## קבצים חשובים

- **src/App.jsx** - Router ראשי
- **src/constants/** - API endpoints וtexts
- **src/context/** - Auth & Cart state management
- **src/services/** - HTTP clients
- **src/pages/** - כל עמוד (Home, Menu, Cart, OrderStatus)
- **tailwind.config.js** - RTL configuration

---

## RTL Setup

- ✅ `index.html` - `lang="he" dir="rtl"`
- ✅ `tailwind.config.js` - `plugins: [require('tailwindcss-rtl')]`
- ✅ Google Fonts - Cairo + Rubik

---

## חלקים שלא בנויים עדיין

1. **Restaurant Admin Pages** - ממשק מנהל (orders, menu management)
2. **Real-time updates** - WebSockets/Polling
3. **Service Worker** - Offline support
4. **Advanced components** - Forms, modals, etc.

---

## משתנים סביבה

```
VITE_API_URL=http://localhost:8000/api
```

---

TakeEat IL Frontend © 2026
