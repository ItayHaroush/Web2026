# איך ליצור Facebook App ID

## למה צריך את זה?
`fb:app_id` מאפשר לך:
- לקבל Facebook Insights (סטטיסטיקות על שיתופים)
- לעקוב אחרי לייקים ושיתופים
- להשתמש ב-Facebook Login בעתיד
- זיהוי טוב יותר של האתר על ידי פייסבוק

## 📝 שלבים ליצירת Facebook App

### 1. גש ל-Facebook for Developers
**קישור:** https://developers.facebook.com/

### 2. התחבר עם חשבון הפייסבוק שלך

### 3. צור App חדש
1. לחץ על **"My Apps"** בפינה הימנית
2. לחץ על **"Create App"**
3. בחר **"Other"** (או "Consumer" אם זה מופיע)
4. לחץ **"Next"**

### 4. מלא פרטים
- **App Name:** TakeEat
- **App Contact Email:** המייל שלך
- לחץ **"Create App"**

### 5. קבל את ה-App ID
1. אחרי שהאפליקציה נוצרה, תועבר לדף הראשי
2. תראה **App ID** בחלק העליון (מספר ארוך)
3. **העתק את המספר הזה**

### 6. הגדר את הדומיין
1. בתפריט צד, לחץ על **"Settings"** → **"Basic"**
2. גלול למטה ל-**"App Domains"**
3. הוסף: `takeeat.co.il`
4. ב-**"Website"** → **"Site URL"** הוסף: `https://www.takeeat.co.il`
5. לחץ **"Save Changes"**

### 7. עבור למצב Production (חשוב!)
1. בחלק העליון, לחץ על המתג ליד "In Development"
2. בחר **"Switch to Live Mode"** / **"Go Live"**
3. אשר את המעבר

## 🔧 עדכן את index.html

פתח את `frontend/index.html` וחפש את השורה:
```html
<meta property="fb:app_id" content="YOUR_FACEBOOK_APP_ID" />
```

**החלף את `YOUR_FACEBOOK_APP_ID` ב-App ID שקיבלת.**

לדוגמה:
```html
<meta property="fb:app_id" content="123456789012345" />
```

## ✅ בדיקה

אחרי שעדכנת:
1. בנה ועלה מחדש: `npm run build`
2. גש ל-Facebook Debugger: https://developers.facebook.com/tools/debug/
3. הזן: `https://www.takeeat.co.il`
4. לחץ **"Scrape Again"**
5. האזהרה על `fb:app_id` אמורה להיעלם!

## 🤔 האם זה חובה?

**לא!** הקישור יעבוד גם בלי `fb:app_id`.

**אבל מומלץ אם:**
- אתה רוצה לעקוב אחרי שיתופים
- אתה מתכנן להשתמש ב-Facebook Login
- אתה רוצה Facebook Insights

**אפשר לדלג אם:**
- אתה רק רוצה שהקישור לא יהיה חסום
- אין לך זמן עכשיו (תוכל להוסיף מאוחר יותר)

---

## 🚀 אם לא רוצה ליצור App עכשיו

**אפשר פשוט למחוק את השורה:**
```html
<meta property="fb:app_id" content="YOUR_FACEBOOK_APP_ID" />
```

**הקישור יעבוד בדיוק אותו דבר!** האזהרה תישאר אבל זה לא משפיע על השיתוף.
