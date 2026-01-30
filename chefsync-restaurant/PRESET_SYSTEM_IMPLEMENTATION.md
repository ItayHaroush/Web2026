# 🎯 Preset System + Auto-Detection Implementation Guide

## מה משתנה?

מעבר מ-**Rule-Based System** (גמיש מדי) ל-**Preset System** (שליטה מלאה)

---

## 1️⃣ Backend Config - `backend/config/ai.php`

### החלף את `'prompt_rules'` (שורה 186) ב:

```php
/*
|--------------------------------------------------------------------------
| Image Enhancement Presets (קטגוריה × סגנון הגשה)
|--------------------------------------------------------------------------
*/
'image_presets' => [

    // 🍕 פיצה
    'pizza_plate' => [
        'strength' => 0.65,
        'prompt' => 'whole pizza or pizza slices on white ceramic plate, restaurant presentation, melted cheese visible, tomato sauce, fresh toppings',
        'negative' => 'sandwich, burger, pita, wrap, meat, shawarma, falafel, hands holding, street food paper',
    ],
    'pizza_street_slice' => [
        'strength' => 0.70,
        'prompt' => 'single pizza slice held in hand with greasy paper napkin, street food style, cheese stretching, triangular slice',
        'negative' => 'whole pizza, plate, sandwich, burger, pita, box',
    ],
    'pizza_box' => [
        'strength' => 0.65,
        'prompt' => 'pizza in open cardboard delivery box, cheese stretching, casual presentation',
        'negative' => 'plate, hands, sandwich, burger, pita, closed box',
    ],

    // 🥙 שווארמה
    'shawarma_pita' => [
        'strength' => 0.80,
        'prompt' => 'shawarma meat wrapped inside fresh pita bread, Israeli street food style, tahini dripping, visible grilled meat slices',
        'negative' => 'pizza, burger, sandwich, baguette, plate with separate items, raw meat',
    ],
    'shawarma_baguette' => [
        'strength' => 0.80,
        'prompt' => 'shawarma meat stuffed in baguette bread, overflowing with toppings, street food style',
        'negative' => 'pizza, burger, pita, plate, raw meat',
    ],
    'shawarma_plate' => [
        'strength' => 0.75,
        'prompt' => 'shawarma meat served on plate with side salads, tahini sauce, hummus, Israeli restaurant style',
        'negative' => 'pizza, burger, sandwich wrap, pita wrap, raw meat',
    ],

    // 🍔 המבורגר
    'burger_street' => [
        'strength' => 0.70,
        'prompt' => 'burger wrapped in paper, held in hands, street food style, visible layers of bun, patty, lettuce, tomato',
        'negative' => 'pizza, shawarma, pita, plate, sandwich, raw meat',
    ],
    'burger_plate' => [
        'strength' => 0.70,
        'prompt' => 'burger on white plate with french fries side, restaurant presentation, visible bun and patty',
        'negative' => 'pizza, shawarma, pita, wrap, hands holding, paper wrap',
    ],
    'burger_closeup' => [
        'strength' => 0.75,
        'prompt' => 'extreme closeup of burger with bite taken, visible layers, cheese melting, juicy patty',
        'negative' => 'pizza, shawarma, whole burger, plate, hands, fries',
    ],

    // 🌯 פלאפל
    'falafel_pita' => [
        'strength' => 0.80,
        'prompt' => 'falafel balls wrapped in pita bread with tahini, Israeli street food, fried chickpea balls visible',
        'negative' => 'pizza, burger, shawarma meat, raw falafel, meatballs',
    ],
    'falafel_plate' => [
        'strength' => 0.75,
        'prompt' => 'falafel balls on plate with salads, tahini, hummus, Israeli style',
        'negative' => 'pizza, burger, pita wrap, meatballs',
    ],

    // 🥗 סלט
    'salad_bowl' => [
        'strength' => 0.60,
        'prompt' => 'fresh salad in white bowl, colorful vegetables, healthy presentation, clean background',
        'negative' => 'pizza, burger, meat, fried food, fast food',
    ],
    'salad_plate' => [
        'strength' => 0.60,
        'prompt' => 'fresh salad on white plate, restaurant presentation, colorful vegetables, garnish',
        'negative' => 'pizza, burger, meat, fried food',
    ],

    // 🍽️ ביסטרו
    'bistro_chef_plate' => [
        'strength' => 0.55,
        'prompt' => 'elegant chef plating on white ceramic plate, minimalist presentation, fine dining style, artistic garnish',
        'negative' => 'pizza, burger, street food, hands, paper, casual presentation',
    ],

    // 🥤 משקאות
    'drink_glass' => [
        'strength' => 0.50,
        'prompt' => 'beverage in clear glass, condensation droplets, ice cubes visible, clean background',
        'negative' => 'food, plate, pizza, burger, bottle, mug',
    ],
    'drink_bottle' => [
        'strength' => 0.45,
        'prompt' => 'beverage bottle with label visible, product photography style, clean background',
        'negative' => 'food, plate, pizza, burger, glass',
    ],

    // ⚪ Fallback
    'generic_food' => [
        'strength' => 0.65,
        'prompt' => 'professional food photography, dish on plate or in bowl, clean presentation, natural lighting',
        'negative' => 'cartoon, illustration, text, watermark, logo',
    ],
],

'base_negative' => 'blurry, low quality, amateur photo, text overlay, watermark, logo, cartoon, illustration, 3d render, artificial, plastic food',

// מילונים לתרגום אוטומטי
'dish_translations' => [
    'מרגריטה' => 'margherita',
    'פפרוני' => 'pepperoni',
    'ארבע גבינות' => 'quattro formaggi',
    'טלה' => 'lamb',
    'עוף' => 'chicken',
    'בקר' => 'beef',
    'בלאק אנגוס' => 'black angus',
    'טבעוני' => 'vegan',
    'צמחוני' => 'vegetarian',
    'אורגני' => 'organic',
    'חריף' => 'spicy',
],

'ingredient_keywords' => [
    'מוצרלה' => 'mozzarella',
    'צ\'דר' => 'cheddar',
    'פרמזן' => 'parmesan',
    'עגבניות' => 'tomatoes',
    'בצל' => 'onions',
    'שום' => 'garlic',
    'זיתים' => 'olives',
    'פטריות' => 'mushrooms',
    'חסה' => 'lettuce',
    'מלפפון' => 'cucumber',
    'בזיליקום' => 'basil',
    'טחינה' => 'tahini',
    'חומוס' => 'hummus',
    'בצל מקורמל' => 'caramelized onions',
    'אבוקדו' => 'avocado',
],
```

---

## 2️⃣ Backend Service - `ImageEnhancementService.php`

### החלף את מתודת `buildPrompt()` (שורה ~186):

```php
/**
 * בניית Prompt מ-Preset + העשרה מפרטי המנה
 */
private function buildPrompt(array $options = []): array
{
    $presets = config('ai.image_presets');
    $baseNegative = config('ai.base_negative');

    // 1️⃣ בחירת Preset
    $presetKey = $this->selectPreset($options);
    
    if (!isset($presets[$presetKey])) {
        Log::warning('⚠️ Preset not found', ['key' => $presetKey]);
        $presetKey = 'generic_food';
    }

    $preset = $presets[$presetKey];
    Log::info('🎯 Selected Preset', ['key' => $presetKey, 'strength' => $preset['strength']]);

    // 2️⃣ העשרת הפרומפט עם פרטי המנה
    $enhancedPrompt = $this->enrichPromptWithDishDetails($preset['prompt'], $options);

    // 3️⃣ Negative prompt
    $fullNegative = $preset['negative'] . ', ' . $baseNegative;
    
    if (!empty($options['is_vegan'])) {
        $fullNegative .= ', meat, chicken, fish, seafood, dairy, eggs, cheese';
    } elseif (!empty($options['is_vegetarian'])) {
        $fullNegative .= ', meat, chicken, fish, seafood';
    }

    return [
        'positive' => $enhancedPrompt,
        'negative' => $fullNegative,
        'strength' => $preset['strength'],
    ];
}

/**
 * בחירת Preset לפי category + presentation
 */
private function selectPreset(array $options): string
{
    if (isset($options['preset'])) {
        return $options['preset'];
    }

    $category = $options['category'] ?? 'generic';
    $presentation = $options['presentation'] ?? 'plate';
    
    $presetKey = $category . '_' . $presentation;
    
    $presets = config('ai.image_presets');
    if (!isset($presets[$presetKey])) {
        if (isset($presets[$category . '_plate'])) {
            return $category . '_plate';
        }
        return 'generic_food';
    }
    
    return $presetKey;
}

/**
 * העשרת פרומפט עם שם מנה + מרכיבים + רמת פרמיום
 */
private function enrichPromptWithDishDetails(string $basePrompt, array $options): string
{
    $enrichments = [];

    // שם המנה (מתורגם)
    if (!empty($options['dish_name'])) {
        $translated = $this->translateDishName($options['dish_name']);
        if (!empty($translated)) {
            $enrichments[] = $translated;
        }
    }

    // מרכיבים מהתיאור
    if (!empty($options['description'])) {
        $ingredients = $this->extractIngredients($options['description']);
        if (!empty($ingredients)) {
            $enrichments[] = 'with ' . implode(', ', $ingredients);
        }
    }

    // פרמיום לפי מחיר
    if (!empty($options['price']) && $options['price'] > 60) {
        $enrichments[] = 'premium quality, gourmet presentation';
    }

    if (!empty($enrichments)) {
        return implode(', ', $enrichments) . ', ' . $basePrompt;
    }

    return $basePrompt;
}

/**
 * תרגום שם מנה
 */
private function translateDishName(string $hebrewName): string
{
    $translations = config('ai.dish_translations', []);
    $nameLower = mb_strtolower($hebrewName);
    $result = [];
    
    foreach ($translations as $he => $en) {
        if (mb_stripos($nameLower, $he) !== false) {
            $result[] = $en;
        }
    }
    
    return implode(' ', $result);
}

/**
 * חילוץ מרכיבים
 */
private function extractIngredients(string $description): array
{
    $keywords = config('ai.ingredient_keywords', []);
    $ingredients = [];
    $descLower = mb_strtolower($description);
    
    foreach ($keywords as $he => $en) {
        if (mb_stripos($descLower, $he) !== false) {
            $ingredients[] = $en;
        }
    }
    
    return array_slice(array_unique($ingredients), 0, 4);
}
```

---

## 3️⃣ Frontend - `imageEnhancementService.js`

### עדכן את `enhance()`:

```javascript
async enhance(imageFile, category, presentation, menuItem = null) {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('category', category);         // pizza
    formData.append('presentation', presentation); // plate
    
    // פרטי המנה להעשרה
    if (menuItem) {
        formData.append('menu_item_id', menuItem.id);
        
        if (menuItem.name) {
            formData.append('dish_name', menuItem.name);
        }
        if (menuItem.description) {
            formData.append('description', menuItem.description);
        }
        if (menuItem.price) {
            formData.append('price', menuItem.price);
        }
        if (menuItem.is_vegan) {
            formData.append('is_vegan', '1');
        }
        if (menuItem.is_vegetarian) {
            formData.append('is_vegetarian', '1');
        }
    }

    const response = await apiClient.post('/admin/ai/enhance-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
    });

    return response.data;
}
```

---

## 4️⃣ Frontend - `AiImageEnhancer.jsx`

### הוסף state חדש (שורה ~20):

```jsx
const [selectedCategory, setSelectedCategory] = useState('pizza');
const [selectedPresentation, setSelectedPresentation] = useState('plate');

const categoryOptions = [
    { value: 'pizza', label: '🍕 פיצה' },
    { value: 'shawarma', label: '🥙 שווארמה' },
    { value: 'burger', label: '🍔 המבורגר' },
    { value: 'falafel', label: '🌯 פלאפל' },
    { value: 'salad', label: '🥗 סלט' },
    { value: 'bistro', label: '🍽️ ביסטרו' },
    { value: 'drink', label: '🥤 משקה' },
];

const presentationOptions = {
    pizza: [
        { value: 'plate', label: 'צלחת מסעדה' },
        { value: 'street_slice', label: 'משולש ביד' },
        { value: 'box', label: 'קרטון משלוח' },
    ],
    shawarma: [
        { value: 'pita', label: 'בפיתה' },
        { value: 'baguette', label: 'באגט' },
        { value: 'plate', label: 'צלחת + סלטים' },
    ],
    burger: [
        { value: 'street', label: 'עטוף נייר' },
        { value: 'plate', label: 'צלחת + צ\'יפס' },
        { value: 'closeup', label: 'קלוזאפ ביס' },
    ],
    falafel: [
        { value: 'pita', label: 'בפיתה' },
        { value: 'plate', label: 'צלחת' },
    ],
    salad: [
        { value: 'bowl', label: 'קערה' },
        { value: 'plate', label: 'צלחת' },
    ],
    bistro: [
        { value: 'chef_plate', label: 'צלחת שף' },
    ],
    drink: [
        { value: 'glass', label: 'כוס' },
        { value: 'bottle', label: 'בקבוק' },
    ],
};
```

### עדכן את `handleGenerate()`:

```jsx
const result = await imageEnhancementService.enhance(
    uploadedFile,
    selectedCategory,      // במקום background
    selectedPresentation,  // במקום angle
    menuItem
);
```

### עדכן את ה-UI (שורה ~200):

```jsx
{/* שלב 2: בחירת קטגוריה וסגנון */}
{step === 2 && (
    <div className="space-y-6">
        {/* קטגוריה */}
        <div>
            <h3 className="text-lg font-semibold mb-3">סוג האוכל:</h3>
            <div className="grid grid-cols-3 gap-4">
                {categoryOptions.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => setSelectedCategory(option.value)}
                        className={`p-4 rounded-xl ${
                            selectedCategory === option.value
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        {/* סגנון הגשה */}
        <div>
            <h3 className="text-lg font-semibold mb-3">איך להגיש:</h3>
            <div className="grid grid-cols-2 gap-4">
                {presentationOptions[selectedCategory]?.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => setSelectedPresentation(option.value)}
                        className={`p-4 rounded-xl ${
                            selectedPresentation === option.value
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        <button onClick={handleGenerate}>
            צור שיפור
        </button>
    </div>
)}
```

---

## 🎯 דוגמה מלאה

### Input:
```javascript
menuItem = {
    name: "פיצה מרגריטה",
    description: "עם רוטב עגבניות טרי, מוצרלה ובזיליקום",
    price: 45,
    category: { name: "פיצות" }
}

category: "pizza"
presentation: "plate"
```

### Output Prompt:
```
pizza margherita, with mozzarella, tomatoes, basil, whole pizza or pizza slices on white ceramic plate, restaurant presentation, melted cheese visible, tomato sauce, fresh toppings

Negative: sandwich, burger, pita, wrap, meat, shawarma, falafel, hands holding, blurry, low quality, text overlay, watermark

Strength: 0.65
```

---

**זה המערכת המשודרגת! עכשיו פיצה תמיד תצא פיצה 🍕✨**
