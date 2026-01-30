# Frontend Integration Guide - Rule-Based Image Enhancement

## API Request Format

### Endpoint
```
POST /api/admin/ai/enhance-image
```

### Headers
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
X-Tenant-ID: {tenant_id}
```

### Request Body (FormData)

```javascript
const formData = new FormData();

// Required
formData.append('image', imageFile); // File object (JPEG/PNG/WebP, max 5MB)

// Optional (Rule-Based Options)
formData.append('category', 'food');        // 'food' | 'drink' (default: 'food')
formData.append('subType', 'shawarma');     // 'soda' | 'cola' | 'beer' | 'shawarma' | 'pizza' | 'burger' | 'falafel'
formData.append('serving', 'pita');         // 'glass' | 'bottle' | 'pita' | 'baguette' | 'plate' | 'bowl'
formData.append('level', 'street');         // 'street' | 'casual' | 'boutique' | 'premium' (default: 'casual')
formData.append('background', 'table');     // 'kitchen' | 'table' | 'dark' | 'white' (default: 'white')

// Optional
formData.append('menu_item_id', menuItem.id); // Link to specific menu item
```

---

## Example: React Component

```jsx
import { useState } from 'react';
import { imageEnhancementService } from '../services/imageEnhancementService';

function ImageEnhancer({ menuItem }) {
  const [image, setImage] = useState(null);
  const [options, setOptions] = useState({
    category: 'food',
    subType: null,
    serving: null,
    level: 'casual',
    background: 'white',
  });

  const handleEnhance = async () => {
    try {
      const result = await imageEnhancementService.enhance(
        image,
        options,
        menuItem?.id
      );
      
      console.log('Enhanced image:', result.data.variations[0]);
      // Show enhanced image to user
    } catch (error) {
      console.error('Enhancement failed:', error);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files[0])}
      />

      {/* Category */}
      <select
        value={options.category}
        onChange={(e) => setOptions({ ...options, category: e.target.value })}
      >
        <option value="food">אוכל</option>
        <option value="drink">שתייה</option>
      </select>

      {/* SubType (conditional) */}
      {options.category === 'food' && (
        <select
          value={options.subType || ''}
          onChange={(e) => setOptions({ ...options, subType: e.target.value })}
        >
          <option value="">בחר סוג מנה...</option>
          <option value="shawarma">שווארמה</option>
          <option value="pizza">פיצה</option>
          <option value="burger">המבורגר</option>
          <option value="falafel">פלאפל</option>
        </select>
      )}

      {options.category === 'drink' && (
        <select
          value={options.subType || ''}
          onChange={(e) => setOptions({ ...options, subType: e.target.value })}
        >
          <option value="">בחר סוג שתייה...</option>
          <option value="soda">סודה</option>
          <option value="cola">קולה</option>
          <option value="beer">בירה</option>
        </select>
      )}

      {/* Serving */}
      <select
        value={options.serving || ''}
        onChange={(e) => setOptions({ ...options, serving: e.target.value })}
      >
        <option value="">צורת הגשה...</option>
        {options.category === 'food' && (
          <>
            <option value="pita">פיתה</option>
            <option value="baguette">בגט</option>
            <option value="plate">צלחת</option>
            <option value="bowl">קערה</option>
          </>
        )}
        {options.category === 'drink' && (
          <>
            <option value="glass">כוס</option>
            <option value="bottle">בקבוק</option>
          </>
        )}
      </select>

      {/* Level */}
      <select
        value={options.level}
        onChange={(e) => setOptions({ ...options, level: e.target.value })}
      >
        <option value="street">רחוב (Street Food)</option>
        <option value="casual">מזדמן (Casual)</option>
        <option value="boutique">בוטיק (Fine Dining)</option>
        <option value="premium">פרימיום (High-End)</option>
      </select>

      {/* Background */}
      <select
        value={options.background}
        onChange={(e) => setOptions({ ...options, background: e.target.value })}
      >
        <option value="kitchen">מטבח</option>
        <option value="table">שולחן עץ</option>
        <option value="dark">רקע כהה</option>
        <option value="white">רקע לבן</option>
      </select>

      <button onClick={handleEnhance} disabled={!image}>
        שפר תמונה (1 קרדיט)
      </button>
    </div>
  );
}

export default ImageEnhancer;
```

---

## Service Layer (imageEnhancementService.js)

```javascript
import apiClient from './apiClient';

export const imageEnhancementService = {
  /**
   * Enhance image with rule-based options
   */
  enhance: async (imageFile, options, menuItemId = null) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    // Add options (only if provided)
    if (options.category) formData.append('category', options.category);
    if (options.subType) formData.append('subType', options.subType);
    if (options.serving) formData.append('serving', options.serving);
    if (options.level) formData.append('level', options.level);
    if (options.background) formData.append('background', options.background);
    
    if (menuItemId) formData.append('menu_item_id', menuItemId);

    return apiClient.post('/admin/ai/enhance-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * Select final variation
   */
  selectVariation: async (enhancementId, variationIndex) => {
    return apiClient.post('/admin/ai/select-variation', {
      enhancement_id: enhancementId,
      variation_index: variationIndex,
    });
  },

  /**
   * Get enhancement history
   */
  getEnhancements: async (menuItemId = null) => {
    const params = menuItemId ? { menu_item_id: menuItemId } : {};
    return apiClient.get('/admin/ai/enhancements', { params });
  },

  /**
   * Delete enhancement
   */
  delete: async (enhancementId) => {
    return apiClient.delete(`/admin/ai/enhancements/${enhancementId}`);
  },
};
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "תמונה עובדה בהצלחה! בחר את הווריאציה המועדפת",
  "data": {
    "enhancement_id": 123,
    "variations": [
      {
        "url": "http://localhost:8000/storage/ai-images/variations/enhanced_123456.jpg",
        "path": "ai-images/variations/enhanced_123456.jpg"
      }
    ],
    "original_url": "http://localhost:8000/storage/ai-images/originals/original_123456.jpg",
    "status": "ready"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "אין מספיק קרדיטי AI. נותרו: 0"
}
```

---

## Smart Defaults

If you don't provide options, the system will use:

```javascript
{
  category: 'food',
  subType: null,     // No subType = generic food
  serving: null,      // No serving = auto-detect from prompt
  level: 'casual',    // Default restaurant level
  background: 'white' // Clean white background
}
```

---

## UI/UX Tips

### 1. **Smart SubType Detection**
Auto-detect subType from menuItem name:
```javascript
const detectSubType = (name) => {
  const lower = name.toLowerCase();
  if (lower.includes('שווארמה')) return 'shawarma';
  if (lower.includes('פיצה')) return 'pizza';
  if (lower.includes('המבורגר')) return 'burger';
  if (lower.includes('פלאפל')) return 'falafel';
  if (lower.includes('קולה') || lower.includes('coca')) return 'cola';
  if (lower.includes('בירה')) return 'beer';
  return null;
};
```

### 2. **Restaurant Level from Type**
Map restaurant type to level:
```javascript
const levelMap = {
  'shawarma': 'street',
  'pizza': 'casual',
  'burger': 'casual',
  'bistro': 'boutique',
};
```

### 3. **One-Click Enhancement**
For power users, offer "Auto-Enhance" button:
```javascript
const autoEnhance = () => {
  const options = {
    category: detectCategory(menuItem.name),
    subType: detectSubType(menuItem.name),
    serving: detectServing(menuItem.name),
    level: levelMap[restaurant.type] || 'casual',
    background: 'white',
  };
  
  imageEnhancementService.enhance(image, options, menuItem.id);
};
```

---

## Cost Information

**Display to user:**
```jsx
<button onClick={handleEnhance}>
  שפר תמונה
  <span className="text-xs">(1 קרדיט)</span>
</button>
```

**Before enhancement:**
```javascript
const credits = await getCredits();
if (credits < 1) {
  alert('אין מספיק קרדיטים. נותרו: ' + credits);
  return;
}
```

---

## Testing

### Mock Mode (Development)
In `.env`:
```
AI_IMAGE_ENHANCEMENT_PROVIDER=mock
```

Mock returns instant copy of original (no API calls, no cost).

### Stability AI (Production)
In `.env`:
```
AI_IMAGE_ENHANCEMENT_PROVIDER=stability
STABILITY_API_KEY=sk-...
```

Real img2img enhancement (~8 seconds).

---

**Ready to integrate!** 🚀
