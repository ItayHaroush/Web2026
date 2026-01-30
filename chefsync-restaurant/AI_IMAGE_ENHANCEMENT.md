# 🎨 AI Image Enhancement System - Complete

## Overview
מערכת שיפור תמונות מנות עם בינה מלאכותית (DALL-E 3 / Stability AI) המשולבת ב-AdminMenu.

## Flow (4 שלבים)
```
1️⃣ העלאת תמונה → 2️⃣ בחירת אופציות → 3️⃣ יצירת וריאציות → 4️⃣ בחירה סופית
```

## Features
- ✅ 3 רקעים: שיש מרשים / עץ חם / רקע נקי
- ✅ 3 זוויות: מלמעלה / מהצד / עם ידיים
- ✅ יצירת 3 וריאציות AI (עלות: 3 קרדיטים)
- ✅ בחירת וריאציה אחת → מחיקת 2 האחרות אוטומטית
- ✅ Prompt דינמי: `{dish_name}` / `{angle}` / `{background}`

## Backend Structure

### Migration
```php
// ai_image_enhancements
- id
- restaurant_id (FK)
- menu_item_id (nullable FK)
- original_path
- background (enum: marble/wood/clean)
- angle (enum: top/side/hands)
- variations (JSON array)
- selected_path (nullable)
- status (enum: pending/processing/completed/failed)
- cost_credits (default: 3)
- timestamps
```

### Models
- `AiImageEnhancement.php` - relations: restaurant(), menuItem()
- Helper methods: isReady(), getVariationUrls(), getSelectedUrl()

### Service Layer
`ImageEnhancementService.php`:
- `enhance($file, $background, $angle, $menuItemId)` - יצירת וריאציות
- `selectVariation($enhancementId, $selectedIndex)` - בחירה + cleanup
- `validateImage($file)` - בדיקת סוג + גודל
- `buildPrompt($dishName, $background, $angle)` - בניית prompt
- `generateVariations($imagePath, $prompt)` - קריאה ל-OpenAI

### Controller
`AiImageController.php`:
- `POST /admin/ai/enhance-image` - יצירת שיפור
- `POST /admin/ai/select-variation` - בחירת וריאציה
- `GET /admin/ai/enhancements` - היסטוריה
- `DELETE /admin/ai/enhancements/{id}` - מחיקה

### Config
`backend/config/ai.php`:
```php
'image_enhancement' => [
    'backgrounds' => [
        'marble' => 'רקע שיש מרשים',
        'wood' => 'רקע עץ חם',
        'clean' => 'רקע נקי'
    ],
    'angles' => [
        'top' => 'מלמעלה',
        'side' => 'מהצד',
        'hands' => 'עם ידיים מחזיקות'
    ],
    'prompt_template' => 'צלם מנת {dish_name} בזווית {angle} עם {background}...',
    'cost_per_enhancement' => 3,
]
```

## Frontend Structure

### Service
`imageEnhancementService.js`:
- `enhance(file, background, angle, menuItemId)` - FormData upload
- `selectVariation(enhancementId, selectedIndex)`
- `getEnhancements()` - היסטוריה
- `deleteEnhancement(id)`

### Component
`AiImageEnhancer.jsx`:
- Props: `onComplete(imageUrl)`, `menuItemId`, `buttonClassName`
- State: step (1-4), uploadedFile, variations, selectedIndex
- UI: Modal עם 4 מצבים (upload/options/generating/select)

### Integration
`AdminMenu.jsx`:
```jsx
<AiImageEnhancer
  onComplete={(imageUrl) => console.log('Enhanced:', imageUrl)}
  menuItemId={editItem?.id}
/>
```

## Development Mode
Service כולל **mock variations** לפיתוח:
```php
// ImageEnhancementService::generateVariations()
if (config('app.env') === 'local') {
    return [
        ['url' => Storage::url($imagePath), 'path' => $imagePath],
        ['url' => Storage::url($imagePath), 'path' => $imagePath],
        ['url' => Storage::url($imagePath), 'path' => $imagePath],
    ];
}
```

## Testing Flow
1. התחבר ל-Admin Panel
2. לחץ "ניהול תפריט" → "הוסף מנה"
3. לחץ "שפר תמונה עם AI"
4. העלה תמונת מנה (עד 5MB)
5. בחר רקע + זווית
6. לחץ "צור 3 וריאציות" → המתן 5-10 שניות
7. בחר וריאציה מועדפת → שמירה אוטומטית

## API Examples

### Enhance Image
```bash
curl -X POST http://localhost:8000/api/admin/ai/enhance-image \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-ID: pizza-palace" \
  -F "image=@dish.jpg" \
  -F "background=marble" \
  -F "angle=top"
```

Response:
```json
{
  "success": true,
  "data": {
    "enhancement_id": 1,
    "variations": [
      {"url": "/storage/enhancements/1/variation_0.jpg", "path": "..."},
      {"url": "/storage/enhancements/1/variation_1.jpg", "path": "..."},
      {"url": "/storage/enhancements/1/variation_2.jpg", "path": "..."}
    ],
    "remaining_credits": 97
  }
}
```

### Select Variation
```bash
curl -X POST http://localhost:8000/api/admin/ai/select-variation \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"enhancement_id": 1, "selected_index": 1}'
```

Response:
```json
{
  "success": true,
  "data": {
    "selected_url": "/storage/enhancements/1/selected.jpg",
    "remaining_credits": 97
  },
  "message": "הווריאציה נבחרה והושלמה בהצלחה"
}
```

## Credits System
- כל שיפור עולה **3 קרדיטים** (בלי קשר למספר הווריאציות)
- בדיקת יתרה: `GET /admin/ai/credits`
- ניכוי אוטומטי בעת יצירת שיפור
- אם אין מספיק קרדיטים → שגיאה 400

## Storage Structure
```
public/storage/
  enhancements/
    {enhancement_id}/
      original.jpg
      variation_0.jpg
      variation_1.jpg
      variation_2.jpg
      selected.jpg  (לאחר בחירה)
```

## Error Handling
- **Invalid file type:** "אנא העלה קובץ תמונה תקין"
- **File too large:** "גודל התמונה חייב להיות עד 5MB"
- **Insufficient credits:** "אין מספיק קרדיטים. נדרשים 3 קרדיטים"
- **Invalid variation:** "אינדקס וריאציה לא תקין"
- **OpenAI API error:** "שגיאה ביצירת וריאציות. נסה שוב מאוחר יותר"

## Roadmap
- [ ] Crop אוטומטי (1:1 aspect ratio)
- [ ] Sharpen filter
- [ ] Hash validation (prevent duplicates)
- [ ] Batch processing (multiple images)
- [ ] Stability AI fallback
- [ ] Preview before enhancement
- [ ] Save presets per restaurant

## Notes
- Prompt קבוע - אין input חופשי מהמשתמש
- וריאציות נמחקות אוטומטית לאחר בחירה (חיסכון בשטח)
- Support ל-JPEG, PNG, WebP (עד 5MB)
- OpenAI DALL-E 3: 1024x1024, quality: hd
