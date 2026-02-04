# קבצי סאונד להתראות

## הוראות התקנה

העתק את הקובץ `notification_bell_soft.wav` לתיקייה זו.

הקובץ ישמש להתראות במערכת:
- הזמנות חדשות (AdminOrders)
- עדכוני סטטוס (OrderStatusPage)

## מיקום הקובץ
```
frontend/public/sounds/notification_bell_soft.wav
```

## שימוש בקוד
הקוד משתמש ב-`new Audio('/sounds/notification_bell_soft.wav')` כדי להשמיע את ההתראה.

עוצמת הקול:
- OrderStatusPage: 0.5 (50%)
- AdminOrders: 0.6 (60%)
