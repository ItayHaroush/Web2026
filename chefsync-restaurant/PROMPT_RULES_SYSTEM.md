# 🎯 מערכת חוקים סגורה לבניית Prompts (Rule-Based Closed System)

## עיקרון

**אין פרומפטים חופשיים.**  
יש **טבלת חוקים** → הרכבה מובנית → AI מבצע.

---

## 📋 טבלת חוקים (config/ai.php)

### 1️⃣ שלד קבוע (BASE - תמיד נוסף)

```
Positive: professional food photography, realistic, high detail, natural lighting, 45 degree angle
Negative: cartoon, illustration, fake food, text, logo, watermark
```

---

### 2️⃣ קטגוריה (Category)

| category | חיובי (add)            | שלילי (negative)   |
|----------|------------------------|-------------------|
| `drink`  | glass, cup, bottle     | food, plate       |
| `food`   | dish, sandwich, bowl   | drink, glass      |

---

### 3️⃣ תת-סוג (SubType) + Strength

| subType    | חיובי (add)                          | שלילי (negative)                | strength |
|------------|--------------------------------------|---------------------------------|----------|
| `soda`     | clear carbonated water, transparent  | cola, coke, pepsi, alcohol      | 0.25     |
| `cola`     | dark carbonated drink                | soda water, transparent liquid  | 0.30     |
| `beer`     | golden beer, foam                    | soda, soft drink                | 0.35     |
| `shawarma` | grilled meat, sliced shawarma        | burger, steak                   | 0.40     |
| `pizza`    | pizza slice or whole pizza           | sandwich, pita                  | 0.40     |
| `burger`   | burger patty, bun, layers            | pizza, sandwich wrap            | 0.40     |
| `falafel`  | falafel balls, fried chickpea        | meatballs, burger               | 0.40     |

**Strength = כמה AI משנה (0-1):**
- 0.25 = שינוי קל (סודה)
- 0.40 = שינוי משמעותי (שווארמה, פיצה)

---

### 4️⃣ צורת הגשה (Serving Style)

| serving    | חיובי (add)           | שלילי (negative)      |
|------------|-----------------------|-----------------------|
| `glass`    | simple clear glass    | mug, bottle           |
| `bottle`   | beverage bottle       | glass                 |
| `pita`     | pita bread            | baguette, plate       |
| `baguette` | baguette bread        | pita                  |
| `plate`    | served on plate       | sandwich wrap         |
| `bowl`     | served in bowl        | plate                 |

---

### 5️⃣ רמת מסעדה (Restaurant Level)

| level      | חיובי (add)                                     |
|------------|-------------------------------------------------|
| `street`   | street food style, authentic, simple            |
| `casual`   | casual restaurant, clean look                   |
| `boutique` | fine dining, elegant plating                    |
| `premium`  | high-end food photography, dramatic lighting    |

---

### 6️⃣ רקע (Background)

| background | חיובי (add)                    |
|------------|--------------------------------|
| `kitchen`  | stainless kitchen background   |
| `table`    | wooden table                   |
| `dark`     | dark restaurant background     |
| `white`    | clean white background         |

---

## 🧩 איך זה עובד?

### דוגמה: בקשה לשיפור תמונת שווארמה

**Input Options:**
```php
[
    'category' => 'food',
    'subType' => 'shawarma',
    'serving' => 'pita',
    'level' => 'street',
    'background' => 'table'
]
```

**המערכת בונה:**

```
Positive Prompt:
professional food photography, realistic, high detail, natural lighting, 45 degree angle,
dish, sandwich, bowl,
grilled meat, sliced shawarma,
pita bread,
street food style, authentic, simple,
wooden table

Negative Prompt:
cartoon, illustration, fake food, text, logo, watermark,
drink, glass,
burger, steak,
baguette, plate

Strength: 0.40
```

---

## 🔧 מימוש טכני

### Backend (Laravel)

**1. config/ai.php:**
```php
'prompt_rules' => [
    'base' => [...],
    'categories' => [...],
    'subTypes' => [...],
    'serving' => [...],
    'levels' => [...],
    'backgrounds' => [...]
]
```

**2. ImageEnhancementService.php:**
```php
private function buildPrompt(array $options): array
{
    $rules = config('ai.prompt_rules');
    
    // הרכבה לפי חוקים
    $positive = [$rules['base']['positive']];
    $negative = [$rules['base']['negative']];
    $strength = 0.35;
    
    // ... לוגיקת הרכבה ...
    
    return [
        'positive' => implode(', ', $positive),
        'negative' => implode(', ', $negative),
        'strength' => $strength,
    ];
}
```

**3. AiImageController.php:**
```php
public function enhance(Request $request)
{
    $validated = $request->validate([
        'category' => 'nullable|in:drink,food',
        'subType' => 'nullable|in:soda,cola,beer,shawarma,pizza,burger,falafel',
        'serving' => 'nullable|in:glass,bottle,pita,baguette,plate,bowl',
        'level' => 'nullable|in:street,casual,boutique,premium',
        'background' => 'nullable|in:kitchen,table,dark,white',
    ]);
    
    $options = [
        'category' => $validated['category'] ?? 'food',
        'subType' => $validated['subType'] ?? null,
        'serving' => $validated['serving'] ?? null,
        'level' => $validated['level'] ?? 'casual',
        'background' => $validated['background'] ?? 'white',
    ];
    
    $service->enhance($image, $options);
}
```

---

## 🚀 Stability AI Integration

**API Call:**
```php
Http::attach('image', $imageData)
    ->post($apiUrl, [
        'prompt' => $promptData['positive'],
        'negative_prompt' => $promptData['negative'],
        'mode' => 'image-to-image',
        'strength' => $promptData['strength'], // 0.25-0.40
        'output_format' => 'jpeg',
    ]);
```

**כאשר strength = 0.40:**
- AI משמר 60% מהמקור
- משנה רק 40% (תאורה, רקע, חדות)

---

## 🥊 למה זה עובד?

✅ **אין ניחושים** - AI מקבל הוראות מדויקות  
✅ **עקביות** - כל קולה נראית כמו קולה (לא סודה בטעות)  
✅ **התאמה לרמה** - Street food ≠ Fine dining  
✅ **קל להרחיב** - רק להוסיף שורה בטבלה  
✅ **שקוף** - רואים בדיוק מה נשלח ל-AI

---

## 📝 הוספת חוק חדש

**דוגמה: הוספת subType=cocktail**

**config/ai.php:**
```php
'subTypes' => [
    // ... existing ...
    'cocktail' => [
        'add' => 'mixed drink, colorful cocktail, garnish',
        'negative' => 'beer, soda, plain water',
        'strength' => 0.35,
    ],
]
```

**Controller validation:**
```php
'subType' => 'nullable|in:soda,cola,beer,shawarma,pizza,burger,falafel,cocktail',
```

**זהו!** המערכת תבנה אוטומטית פרומפטים מדויקים לקוקטיילים.

---

## 🔒 חוקים גלובליים

**תמיד מתווספים ל-Negative:**
```
cartoon, illustration, fake food, text, logo, watermark
```

**אין דרך לעקוף את זה** - זה חלק מה-BASE.

---

## 🎯 סיכום

| רכיב         | מתי משתמשים                     | דוגמה                  |
|--------------|--------------------------------|------------------------|
| **category** | תמיד (אוכל או שתייה)           | `food` / `drink`       |
| **subType**  | אופציונלי (סוג מנה מדויק)      | `shawarma`, `cola`     |
| **serving**  | אופציונלי (צורת הגשה)          | `pita`, `glass`        |
| **level**    | תמיד (רמת מסעדה)               | `street`, `boutique`   |
| **background**| תמיד (רקע רצוי)               | `table`, `white`       |

**אם לא מצוין → ברירת מחדל:**
- category: `food`
- level: `casual`
- background: `white`

---

## 📦 Cost & Credits

**Stability AI SD3:**
- Cost: $0.04 per image
- Credits: 1 credit per enhancement
- Speed: ~8 seconds

**לעומת DALL-E 3 (ישן):**
- Cost: $0.24 (3 × $0.08)
- Credits: 3 credits
- Speed: ~50 seconds
- ⚠️ **בעיה:** Text-to-image (לא img2img)

---

**הכל מוכן!** 🚀
