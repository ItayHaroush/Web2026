# Dual AI Provider System - Implementation Summary

## 📋 Overview

Implemented a dual AI provider architecture that separates **local development** (GitHub Copilot CLI) from **production** (OpenAI HTTP API), with a unified service interface.

### Business Logic
- **Local Development**: Use Copilot CLI (free, requires GitHub Copilot subscription)
- **Production**: Use OpenAI API (paid per token, no CLI required)
- **Testing**: Both providers support mock mode (no API costs)

### Security
- **Production Guard**: Copilot CLI is automatically blocked in production environment
- **No Fallback**: If OpenAI API fails in production, return clear error (no silent fallback to Copilot)

---

## 🏗️ Architecture

### Component Hierarchy

```
BaseAiService (abstract)
  ├── Static Methods: getCreditsStatus(), getUsageStats()
  └── Shared Methods: validateAccess(), logUsage()

AiService (unified interface)
  ├── Routes to → CopilotService (local)
  └── Routes to → OpenAiService (production)

Controllers
  ├── AiController → uses AiService
  └── ChatController → uses AiService
```

### Provider Selection Logic

```php
// In AiService constructor
$provider = config('ai.provider'); // 'copilot' or 'openai'

if ($provider === 'copilot' && app()->environment('production')) {
    throw new \Exception('Copilot CLI blocked in production');
}

return ($provider === 'openai') 
    ? new OpenAiService(...) 
    : new CopilotService(...);
```

---

## 📁 Files Created/Modified

### New Files
1. **`backend/app/Services/BaseAiService.php`**
   - Abstract base class with shared functionality
   - Static methods: `getCreditsStatus()`, `getUsageStats()`
   - Instance methods: `validateAccess()`, `logUsage()`

2. **`backend/app/Services/AiService.php`** (created earlier, now updated)
   - Unified AI service that routes to appropriate provider
   - Security: Blocks Copilot in production
   - Static methods delegate to `BaseAiService`

3. **`backend/app/Services/OpenAiService.php`** (created earlier, now enhanced)
   - Extends `BaseAiService`
   - HTTP-only OpenAI integration (no CLI)
   - Features:
     - Mock mode (`OPENAI_MOCK=true`)
     - Caching (2-day TTL for descriptions, 1-hour for insights)
     - Hebrew glossary support
     - Credit validation and usage logging
     - Production-focused error handling (no fallback)

### Modified Files

#### Backend
1. **`backend/app/Http/Controllers/AiController.php`**
   - Replaced all `new CopilotService()` → `new AiService()`
   - Replaced `CopilotService::getCreditsStatus()` → `AiService::getCreditsStatus()`
   - Removed `config('copilot.enabled')` checks (handled by AiService)

2. **`backend/app/Http/Controllers/ChatController.php`**
   - Replaced `use App\Services\CopilotService` → `use App\Services\AiService`
   - Updated super admin chat: `new AiService('super-admin', ...)`
   - Updated restaurant chat: `new AiService($tenantId, ...)`

3. **`backend/config/ai.php`**
   - Added unified AI configuration
   - Sections:
     - `provider`: 'copilot' or 'openai'
     - `copilot`: Local development config
     - `openai`: Production config (+ `mock` option)
     - `features`: Per-feature settings (cost, caching, TTL)
     - `credits`: Tier-based credit limits
     - `rate_limit`: Request throttling
     - `language`: Hebrew support + glossary

4. **`backend/.env`**
   - Added `AI_PROVIDER=copilot`
   - Added `OPENAI_MOCK=false`
   - Added detailed comments explaining:
     - When to use each provider
     - Security implications
     - Mock mode for testing

5. **`backend/.env.example`**
   - Updated with full AI provider configuration
   - Clear documentation for new developers
   - Security warnings and recommendations

---

## 🔧 Configuration

### Environment Variables

```bash
# Provider Selection
AI_PROVIDER=copilot              # Options: copilot | openai

# Copilot (Local Dev)
COPILOT_ENABLED=true
COPILOT_MODE=mock                # Options: mock | real
COPILOT_CLI_PATH="/path/to/copilot"

# OpenAI (Production)
OPENAI_API_KEY=sk-...            # Required for production
OPENAI_MODEL=gpt-4o-mini         # Cost-effective model
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MOCK=false                # Set to 'true' for testing

# Credits
AI_FREE_TIER_CREDITS=20
AI_BASIC_TIER_CREDITS=0
AI_PRO_TIER_CREDITS=500          # Pro trial: 50, Pro paid: 500
```

### Config File Structure

```php
// config/ai.php
return [
    'provider' => env('AI_PROVIDER', 'copilot'),
    
    'copilot' => [
        'enabled' => env('COPILOT_ENABLED', false),
        'mode' => env('COPILOT_MODE', 'mock'),
        'cli_path' => env('COPILOT_CLI_PATH', null),
    ],
    
    'openai' => [
        'api_key' => env('OPENAI_API_KEY', ''),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        'timeout' => env('OPENAI_TIMEOUT', 30),
        'mock' => env('OPENAI_MOCK', false),
    ],
    
    'features' => [
        'description_generator' => [
            'enabled' => true,
            'cost_credits' => 1,
            'cache_enabled' => true,
            'cache_ttl' => 172800, // 2 days
        ],
        // ...
    ],
];
```

---

## 🚀 Usage Examples

### 1. Generate Menu Description

```php
// Controller automatically uses correct provider
$ai = new AiService($tenantId, $restaurant, $user);
$result = $ai->generateDescription($menuItemData);

// Result structure (same for both providers)
[
    'description' => 'מנה טעימה...',
    'generated_at' => '2026-01-25T...',
    'provider' => 'openai', // or 'copilot'
    'model' => 'gpt-4o-mini' // or 'mock-gpt-4o-mini'
]
```

### 2. Restaurant Chat

```php
$ai = new AiService($tenantId, $restaurant, $user);
$response = $ai->chatWithRestaurant($message, $context, $preset);

// Response includes suggested actions
[
    'response' => 'התפריט שלך...',
    'suggested_actions' => [
        ['label' => '📋 עריכת תפריט', 'route' => '/admin/menu']
    ],
    'provider' => 'openai'
]
```

### 3. Check Credits (Static)

```php
$status = AiService::getCreditsStatus($restaurant);

// Works with any provider (delegates to BaseAiService)
[
    'tier' => 'pro',
    'monthly_limit' => 500,
    'credits_remaining' => 450,
    'credits_used' => 50,
    'billing_cycle_start' => '2026-01-01',
    'billing_cycle_end' => '2026-01-31'
]
```

---

## 🧪 Testing Strategy

### Local Development (Copilot Mock)

```bash
# .env
AI_PROVIDER=copilot
COPILOT_MODE=mock
```

**Behavior**: Returns hardcoded Hebrew responses, no external API calls, no costs.

### Local Development (Copilot Real)

```bash
# .env
AI_PROVIDER=copilot
COPILOT_MODE=real
COPILOT_CLI_PATH="/usr/local/bin/copilot"
```

**Behavior**: Calls actual Copilot CLI (requires GitHub Copilot subscription).

### Testing OpenAI Without Costs

```bash
# .env
AI_PROVIDER=openai
OPENAI_MOCK=true
```

**Behavior**: Returns mock OpenAI responses, no API calls, no costs.

### Production (OpenAI Real)

```bash
# .env (production)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MOCK=false
```

**Behavior**: Real OpenAI API calls, costs per token.

---

## 🔒 Security Features

### 1. Production Guard

```php
// AiService constructor
if ($this->provider === 'copilot' && app()->environment('production')) {
    Log::critical('SECURITY: Attempted Copilot CLI in production');
    throw new \Exception('Copilot CLI not allowed in production');
}
```

### 2. No Silent Fallback

```php
// OpenAiService::callOpenAi()
if ($response->failed()) {
    // ❌ NO fallback to Copilot
    throw new \Exception('OpenAI API לא זמין כרגע');
}
```

### 3. API Key Validation

```php
// OpenAiService constructor
if (!$this->mockMode && empty($this->apiKey)) {
    throw new \Exception('OPENAI_API_KEY required or enable OPENAI_MOCK=true');
}
```

---

## 📊 Feature Parity Matrix

| Feature | CopilotService | OpenAiService |
|---------|----------------|---------------|
| **Methods** |
| `generateDescription()` | ✅ | ✅ |
| `chatWithSuperAdmin()` | ✅ | ✅ |
| `chatWithRestaurant()` | ✅ | ✅ |
| `getDashboardInsights()` | ✅ | ✅ |
| `recommendPrice()` | ✅ | ✅ |
| `getRestaurantSuggestedActions()` | ✅ | ✅ |
| **Features** |
| Credit Validation | ✅ | ✅ (via BaseAiService) |
| Usage Logging | ✅ | ✅ (via BaseAiService) |
| Caching | ✅ (7 days) | ✅ (2 days) |
| Hebrew Glossary | ✅ | ✅ |
| Mock Mode | ✅ | ✅ |
| Dev Mode Bypass | ✅ | ✅ |
| Rate Limiting | ✅ | ✅ |

---

## 🔄 Cache Strategy

### Copilot (Local Dev)
- **TTL**: 7 days (long cache for dev consistency)
- **Purpose**: Avoid redundant CLI calls during development

### OpenAI (Production)
- **Description TTL**: 2 days (freshness vs. cost balance)
- **Insights TTL**: 1 hour (dynamic business data)
- **Price TTL**: 1 day (market changes)
- **Chat**: No caching (conversational, context-dependent)

---

## 🐛 Error Handling

### Insufficient Credits

```json
{
  "success": false,
  "message": "אין מספיק קרדיטים. נותרו 0 קרדיטים.",
  "error_code": "insufficient_credits"
}
```

### Rate Limit Exceeded

```json
{
  "success": false,
  "message": "חרגת ממגבלת השימוש לדקה. נסה שוב בעוד מעט.",
  "error_code": "rate_limit_exceeded"
}
```

### OpenAI API Down (Production)

```json
{
  "success": false,
  "message": "OpenAI API לא זמין כרגע. אנא נסה שוב מאוחר יותר.",
  "error_code": "generation_failed"
}
```

---

## 📈 Migration Path

### Phase 1: Development Testing ✅ DONE
- All Controllers use `AiService`
- Configuration unified in `config/ai.php`
- Mock modes tested (both providers)

### Phase 2: Production Deployment (Next)
1. **Setup OpenAI Account**
   - Create account at platform.openai.com
   - Generate API key
   - Add payment method

2. **Update Production .env**
   ```bash
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-proj-xxxxx
   OPENAI_MOCK=false
   ```

3. **Monitor Usage**
   - Check `ai_usage_logs` table
   - Monitor OpenAI dashboard for costs
   - Set budget alerts in OpenAI platform

4. **Gradual Rollout**
   - Start with `OPENAI_MOCK=true` in production
   - Test all AI features
   - Switch to `OPENAI_MOCK=false` when confident

---

## 💰 Cost Optimization

### 1. Use Cheaper Model
```bash
OPENAI_MODEL=gpt-4o-mini  # ~10x cheaper than gpt-4
```

### 2. Aggressive Caching
```php
'cache_ttl' => 172800, // 2 days for menu descriptions
```

### 3. Credit Limits
```php
'pro_tier' => 500, // Max 500 requests/month per restaurant
```

### 4. Mock Mode for Dev/Staging
```bash
# staging.env
OPENAI_MOCK=true  # No API costs in staging
```

---

## 🧩 Hebrew Language Support

### Glossary System

```php
// config/ai.php
'language' => [
    'default' => 'he',
    'rtl' => true,
    'glossary' => [
        'שווארמה' => 'shawarma',
        'פלאפל' => 'falafel',
        'חומוס' => 'hummus',
        'פיתה' => 'pita',
    ],
]
```

### Usage in Prompts

```php
// OpenAiService::buildRestaurantChatPrompt()
$prompt = "אתה עוזר AI ידידותי...\n\n";
$glossary = config('ai.language.glossary', []);

foreach ($glossary as $he => $en) {
    $prompt .= "- {$he} ({$en})\n";
}
```

---

## 🔍 Monitoring & Logging

### Usage Logs

```sql
SELECT 
    feature,
    provider,
    COUNT(*) as requests,
    SUM(credits_used) as total_credits,
    AVG(response_time_ms) as avg_time,
    SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hits
FROM ai_usage_logs
WHERE tenant_id = 'pizza-palace'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY feature, provider;
```

### Credits Monitoring

```sql
SELECT 
    r.name,
    r.tenant_id,
    c.tier,
    c.monthly_limit,
    c.credits_remaining,
    c.credits_used,
    c.total_requests
FROM restaurants r
JOIN ai_credits c ON r.id = c.restaurant_id
WHERE c.credits_remaining < 50
ORDER BY c.credits_remaining ASC;
```

---

## ⚠️ Known Limitations

### 1. CopilotService Still Exists
- Not removed (backward compatibility)
- Still used directly if someone bypasses AiService
- **Recommendation**: Add deprecation notice

### 2. Config Duplication
- Both `config/copilot.php` and `config/ai.php` exist
- CopilotService reads from `copilot.php`
- **Recommendation**: Migrate CopilotService to read from `ai.copilot.*`

### 3. No Multi-Provider Switching
- Cannot use both providers simultaneously
- Must restart app to switch providers
- **Future**: Runtime provider selection per request

---

## 🎯 Success Criteria

- ✅ **Unified Interface**: All controllers use `AiService`
- ✅ **Production Security**: Copilot blocked in production
- ✅ **No Fallback**: Clear errors instead of silent failures
- ✅ **Mock Support**: Both providers support mock mode
- ✅ **Feature Parity**: OpenAI has same methods as Copilot
- ✅ **Configuration**: Centralized in `config/ai.php`
- ✅ **Documentation**: `.env.example` has clear instructions

---

## 📚 References

- **OpenAI API Docs**: https://platform.openai.com/docs
- **OpenAI Models**: https://platform.openai.com/docs/models
- **Pricing**: https://openai.com/pricing
- **GitHub Copilot**: https://github.com/features/copilot

---

**Implementation Date**: 25 בינואר 2026  
**Status**: ✅ Complete - Ready for Production Testing  
**Next Steps**: Deploy to staging with `OPENAI_MOCK=true`, test all features, then switch to real API
