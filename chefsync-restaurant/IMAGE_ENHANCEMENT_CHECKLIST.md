# ✅ Implementation Checklist - Rule-Based Image Enhancement

## Phase 1: Backend Configuration ✅ DONE

- [x] Created `config/ai.php` with `prompt_rules` section
- [x] Added all rule tables:
  - [x] Base (positive + negative)
  - [x] Categories (drink/food)
  - [x] SubTypes (soda, cola, beer, shawarma, pizza, burger, falafel)
  - [x] Serving styles (glass, bottle, pita, baguette, plate, bowl)
  - [x] Restaurant levels (street, casual, boutique, premium)
  - [x] Backgrounds (kitchen, table, dark, white)
- [x] Updated `image_enhancement` config:
  - [x] Changed `cost_credits` from 3 to 1
  - [x] Changed `variations_count` from 3 to 1
  - [x] Added `provider` = 'stability'
  - [x] Added Stability AI configuration section
- [x] Updated `.env.example` with:
  - [x] `STABILITY_API_KEY`
  - [x] `STABILITY_API_URL`

---

## Phase 2: Backend Service Layer ✅ DONE

- [x] Updated `ImageEnhancementService.php`:
  - [x] Changed `enhance()` signature to accept `array $options`
  - [x] Rewrote `buildPrompt()` as rule-based system:
    - [x] Returns `['positive' => string, 'negative' => string, 'strength' => float]`
    - [x] Assembles prompt from rules config
    - [x] Extracts strength from subType
  - [x] Rewrote `generateVariations()` to use Stability AI:
    - [x] Accepts `array $promptData` instead of `string $prompt`
    - [x] Routes to `generateWithStabilityAI()` instead of OpenAI
  - [x] Created `generateWithStabilityAI()` method:
    - [x] Loads original image from storage
    - [x] Calls Stability AI img2img endpoint
    - [x] Sends positive + negative prompts + strength
    - [x] Saves enhanced image to storage
    - [x] Returns `[['url' => ..., 'path' => ...]]` format
  - [x] Updated `generateMockVariations()` to return 1 variation (not 3)
  - [x] Removed `generateWithOpenAI()` (not needed)
  - [x] Removed `downloadAndSaveImage()` (not needed)
  - [x] Removed `validateOptions()` (validation moved to controller)

---

## Phase 3: Backend Controller ✅ DONE

- [x] Updated `AiImageController.php`:
  - [x] Changed validation rules to accept:
    - [x] `category` (nullable, in:drink,food)
    - [x] `subType` (nullable, in:soda,cola,beer,shawarma,pizza,burger,falafel)
    - [x] `serving` (nullable, in:glass,bottle,pita,baguette,plate,bowl)
    - [x] `level` (nullable, in:street,casual,boutique,premium)
    - [x] `background` (nullable, in:kitchen,table,dark,white)
  - [x] Build `$options` array with defaults
  - [x] Pass `$options` to `$service->enhance()`

---

## Phase 4: Database Migration ✅ DONE

- [x] Updated `2026_01_30_014547_create_ai_image_enhancements_table.php`:
  - [x] Changed default `cost_credits` from 3 to 1
  - [x] Changed default `ai_provider` to 'stability'
  - [x] Comment updated to reflect stability/mock (not openai)

---

## Phase 5: Documentation ✅ DONE

- [x] Created `PROMPT_RULES_SYSTEM.md`:
  - [x] Explained rule-based approach
  - [x] Full rule tables with examples
  - [x] Technical implementation details
  - [x] How to add new rules
- [x] Created `FRONTEND_IMAGE_ENHANCEMENT_GUIDE.md`:
  - [x] API request format
  - [x] React component example
  - [x] Service layer code
  - [x] Smart defaults and auto-detection
  - [x] UI/UX tips

---

## Phase 6: Frontend Updates (TODO)

### 6.1 Update imageEnhancementService.js
- [ ] Change `enhance()` method to accept `options` object instead of `background` and `angle`
- [ ] Update FormData to append new fields: `category`, `subType`, `serving`, `level`, `background`

### 6.2 Update AiImageEnhancer.jsx Component
- [ ] Replace old options (marble/wood/clean, top/side/hands) with new rule-based options
- [ ] Add Category selector (drink/food)
- [ ] Add SubType selector (conditional on category)
- [ ] Add Serving selector (conditional on category)
- [ ] Add Level selector (street/casual/boutique/premium)
- [ ] Add Background selector (kitchen/table/dark/white)
- [ ] Update button text: "צור 3 וריאציות (3 קרדיטים)" → "שפר תמונה (1 קרדיט)"
- [ ] Update loading text: "מייצר 3 וריאציות..." → "משפר תמונה..."
- [ ] Update step 3 UI: Show 1 enhanced image (not 3 variations grid)

### 6.3 Smart Auto-Detection (Optional Enhancement)
- [ ] Create `detectOptions()` helper function:
  - [ ] Detect `category` from menuItem name (drink keywords vs food)
  - [ ] Detect `subType` from menuItem name (שווארמה, פיצה, קולה, etc.)
  - [ ] Detect `serving` from menuItem name (פיתה, כוס, בקבוק, etc.)
  - [ ] Map restaurant type to `level` (bistro → boutique, shawarma → street)
- [ ] Add "זיהוי אוטומטי" button to pre-fill options

### 6.4 Update AdminMenu.jsx Integration
- [ ] Verify AiImageEnhancer component receives correct props
- [ ] Pass restaurant type for smart level detection

---

## Phase 7: Environment Setup (TODO - Before Testing)

### 7.1 Local Development
- [ ] Add to `.env`:
  ```
  AI_IMAGE_ENHANCEMENT_PROVIDER=mock
  ```
- [ ] Test with mock mode (instant copy of original)

### 7.2 Production (Staging First)
- [ ] Sign up for Stability AI account: https://platform.stability.ai/account/keys
- [ ] Generate API key
- [ ] Add to `.env`:
  ```
  STABILITY_API_KEY=sk-...
  STABILITY_API_URL=https://api.stability.ai/v2beta/stable-image/generate/sd3
  ```
- [ ] Update `config/ai.php`:
  ```
  'image_enhancement' => [
      'provider' => 'stability', // Change from 'mock'
  ]
  ```

---

## Phase 8: Testing (TODO)

### 8.1 Backend Testing
- [ ] Test rule assembly:
  ```php
  $service = new ImageEnhancementService($restaurant);
  $prompt = $service->buildPrompt([
      'category' => 'food',
      'subType' => 'shawarma',
      'serving' => 'pita',
      'level' => 'street',
      'background' => 'table'
  ]);
  
  // Expected positive: professional food photography, realistic, high detail, natural lighting, 45 degree angle, dish, sandwich, bowl, grilled meat, sliced shawarma, pita bread, street food style, authentic, simple, wooden table
  // Expected negative: cartoon, illustration, fake food, text, logo, watermark, drink, glass, burger, steak, baguette, plate
  // Expected strength: 0.40
  ```

- [ ] Test mock mode:
  ```bash
  php artisan tinker
  $restaurant = Restaurant::first();
  $service = new ImageEnhancementService($restaurant);
  $image = UploadedFile::fake()->image('test.jpg');
  $enhancement = $service->enhance($image, ['category' => 'food']);
  // Should return 1 variation instantly
  ```

- [ ] Test Stability AI integration (requires API key):
  ```bash
  # Upload real image
  # Check logs: storage/logs/laravel.log
  # Look for: "🚀 Calling Stability AI SD3 (img2img)"
  # Verify enhanced image saved: storage/app/public/ai-images/variations/
  ```

### 8.2 Frontend Testing
- [ ] Test category switching (drink ↔ food)
- [ ] Verify subType options update when category changes
- [ ] Verify serving options update when category changes
- [ ] Test "שפר תמונה" button (1 credit cost display)
- [ ] Verify only 1 enhanced image shown (not 3-grid)
- [ ] Test image selection and final save

### 8.3 Integration Testing
- [ ] Upload original falafel image
- [ ] Select options: category=food, subType=falafel, serving=pita, level=street, background=table
- [ ] Click "שפר תמונה"
- [ ] Verify enhanced image shows SAME falafel (not new random falafel)
- [ ] Verify only lighting/background/sharpness improved
- [ ] Check credits deducted: 1 credit (not 3)
- [ ] Check processing time: < 15 seconds (avoid timeout)

---

## Phase 9: Deployment (TODO)

### 9.1 Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Migration run successfully: `php artisan migrate`
- [ ] Config cached: `php artisan config:cache`
- [ ] `.env` updated with `STABILITY_API_KEY`
- [ ] Frontend built: `npm run build`

### 9.2 Deployment Steps
- [ ] Deploy backend changes to production
- [ ] Run migrations on production DB
- [ ] Deploy frontend changes
- [ ] Monitor logs for errors: `tail -f storage/logs/laravel.log`
- [ ] Test with real restaurant account

### 9.3 Rollback Plan (If Issues)
- [ ] Change provider back to 'mock': `AI_IMAGE_ENHANCEMENT_PROVIDER=mock`
- [ ] Revert frontend to old UI (3 variations)
- [ ] Restore old `enhance()` signature if needed

---

## Phase 10: Monitoring & Optimization (TODO)

### 10.1 Performance Monitoring
- [ ] Track average enhancement time (target: < 10s)
- [ ] Monitor Stability AI API response times
- [ ] Check for timeout errors (504 Gateway Timeout)
- [ ] Monitor credit consumption rate

### 10.2 Cost Tracking
- [ ] Verify 1 credit charged per enhancement (not 3)
- [ ] Calculate cost per enhancement: $0.04 USD
- [ ] Compare with old cost: $0.24 USD (saved 83%)

### 10.3 Quality Assurance
- [ ] Test with different subTypes (shawarma, pizza, burger, falafel)
- [ ] Verify strength parameter works (0.25 for soda, 0.40 for food)
- [ ] Check negative prompts prevent unwanted elements (no text/logos)
- [ ] Ensure original dish appearance preserved

---

## Future Enhancements (Optional)

### Batch Enhancement
- [ ] Allow multiple images at once
- [ ] Queue system for async processing (avoid blocking UI)

### Advanced Rules
- [ ] Add seasonal rules (summer/winter backgrounds)
- [ ] Add time-of-day rules (breakfast/lunch/dinner lighting)
- [ ] Add cuisine-specific rules (italian/asian/mediterranean)

### AI Provider Fallback
- [ ] If Stability AI fails, try DALL-E 3 as fallback (even if text-to-image)
- [ ] Automatic provider switching based on availability

### Analytics
- [ ] Track which subTypes are most popular
- [ ] A/B test different strength values
- [ ] Measure user satisfaction (which variations selected most)

---

## Summary

**Backend:** ✅ Complete (rule-based system implemented)  
**Frontend:** ⏳ Pending (update UI + service to use new options)  
**Testing:** ⏳ Pending (requires STABILITY_API_KEY)  
**Deployment:** ⏳ Pending (after testing)

**Next Step:** Update Frontend component to use new rule-based options.

---

**Status:** Ready for Frontend integration! 🚀
