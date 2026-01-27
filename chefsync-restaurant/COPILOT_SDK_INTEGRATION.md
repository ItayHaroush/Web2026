# GitHub Copilot SDK Integration - TakeEat

## סקירה

מערכת TakeEat משלבת את GitHub Copilot SDK להוספת יכולות AI חכמות למנהלי מסעדות ולקוחות.

## פיצ'רים מיושמים

### ✅ 1. Description Generator (מחולל תיאורים)
**מיקום:** AdminMenu - טופס הוספה/עריכה של פריט תפריט

**פונקציונליות:**
- יצירת תיאורים מושכים לפריטי תפריט בעברית
- תמיכה באלרגנים, דיאטות (צמחוני/טבעוני)
- אפשרות ליצירה מחדש (regenerate)
- עריכה ידנית לפני שמירה

**טכנולוגיה:**
- Backend: `CopilotService.php` עם prompt engineering בעברית
- Frontend: `AiDescriptionGenerator.jsx` קומפוננטה
- API: `POST /admin/ai/generate-description`

### ✅ 2. Credits System (מערכת קרדיטים)
**מיקום:** AdminDashboard + Database

**תכונות:**
- 3 רמות: Free (20/חודש), Pro (300/חודש), Enterprise (ללא הגבלה)
- Rate limiting: 10 בקשות לדקה per tenant
- מחזור חיוב חודשי אוטומטי
- Audit logging מלא

**טבלאות:**
- `ai_credits` - מעקב קרדיטים per restaurant
- `ai_usage_logs` - לוג מפורט של כל שימוש

### ✅ 3. AI Usage Dashboard
**מיקום:** AdminDashboard

**מציג:**
- קרדיטים נותרים + אחוז שימוש
- Cache hit rate
- זמן תגובה ממוצע
- שימוש לפי feature
- התראות על קרדיטים נמוכים

**קומפוננטה:** `AiCreditsBadge.jsx`

---

## ארכיטקטורה

### Multi-Tenant Safety ✅
```
כל בקשה → tenant_id ב-context → Global Scopes → Cache per-tenant
```

**אכיפה:**
1. Middleware: `EnsureTenantId` בכל route
2. Service: `CopilotService` מקבל tenant בבנאי
3. Models: `AiCredit`, `AiUsageLog` עם foreign keys
4. Cache: Keys עם tenant prefix: `copilot:tenant:{id}:...`

### Caching Strategy ✅
```php
Key Format: copilot:tenant:{tenant_id}:feature:{hash}:v1
TTL: 7 days for descriptions, 1 hour for recommendations
Invalidation: Manual via cache_key tracking
```

**Cache Locations:**
- Laravel Cache (file/redis based on `CACHE_DRIVER`)
- Per feature configuration in `config/copilot.php`

### Rate Limiting ✅
```
Per Tenant Per Minute: 10 requests (configurable)
Per Tenant Per Month: Based on tier (20/300/unlimited)
```

**Implementation:**
- Tracked in `ai_credits.requests_this_minute`
- Resets every 60 seconds automatically
- 402 Payment Required on insufficient credits
- 429 Too Many Requests on rate limit

---

## קבצים נוצרו

### Backend
```
backend/
├── app/
│   ├── Http/Controllers/
│   │   └── AiController.php                    # AI endpoints
│   ├── Models/
│   │   ├── AiCredit.php                        # Credits model
│   │   └── AiUsageLog.php                      # Usage logs model
│   └── Services/
│       └── CopilotService.php                  # Main AI service
├── config/
│   └── copilot.php                             # Full configuration
├── database/migrations/
│   ├── 2026_01_23_142932_create_ai_usage_logs_table.php
│   └── 2026_01_23_142943_create_ai_credits_table.php
└── routes/
    └── api.php                                  # Added AI routes
```

### Frontend
```
frontend/
├── src/
│   ├── components/
│   │   ├── AiDescriptionGenerator.jsx          # Generator UI
│   │   └── AiCreditsBadge.jsx                  # Credits display
│   └── pages/admin/
│       ├── AdminMenu.jsx                        # Integrated generator
│       └── AdminDashboard.jsx                   # Integrated badge
└── package.json                                 # Added @github/copilot-sdk
```

---

## API Endpoints

### POST `/admin/ai/generate-description`
**Auth:** Required (Sanctum)  
**Middleware:** `tenant`, `CheckRestaurantAccess`

**Request:**
```json
{
  "name": "שניצל בלאפה",
  "price": 45,
  "category": "מנות עיקריות",
  "allergens": ["גלוטן"],
  "is_vegetarian": false,
  "is_vegan": false
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "תיאור נוצר בהצלחה",
  "data": {
    "description": "שניצל עסיסי בלאפה רכה...",
    "generated_at": "2026-01-23T14:30:00Z"
  }
}
```

**Response (No Credits):**
```json
{
  "success": false,
  "message": "אין מספיק קרדיטים. נותרו 0 קרדיטים החודש.",
  "error_code": "insufficient_credits"
}
```
**Status:** 402 Payment Required

### GET `/admin/ai/credits`
**Response:**
```json
{
  "success": true,
  "data": {
    "tier": "free",
    "monthly_limit": 20,
    "credits_used": 5,
    "credits_remaining": 15,
    "billing_cycle_start": "2026-01-01",
    "billing_cycle_end": "2026-01-31",
    "total_requests": 127
  }
}
```

### GET `/admin/ai/usage-stats`
**Query Params:** `?start_date=2026-01-01&end_date=2026-01-31`

**Response:**
```json
{
  "success": true,
  "data": {
    "total_requests": 45,
    "successful_requests": 43,
    "failed_requests": 2,
    "cached_requests": 12,
    "cache_hit_rate": 26.7,
    "total_credits_used": 33,
    "avg_response_time_ms": 1823,
    "by_feature": {
      "description_generator": {
        "count": 45,
        "success_rate": 95.6
      }
    }
  }
}
```

---

## Configuration

### Environment Variables

**Backend (.env):**
```bash
# Enable/Disable
COPILOT_ENABLED=true

# CLI Path (required)
COPILOT_CLI_PATH=/path/to/copilot

# Caching
COPILOT_CACHE_ENABLED=true
COPILOT_CACHE_TTL=86400

# Credits per tier
AI_FREE_TIER_CREDITS=20
AI_PRO_TIER_CREDITS=300

# Rate Limiting
AI_RATE_LIMIT_PER_MINUTE=10

# Logging
AI_LOG_USAGE=true
```

**Frontend (.env):**
```bash
VITE_COPILOT_ENABLED=true
VITE_COPILOT_CLI_PATH=/path/to/copilot
```

### Config File

**`backend/config/copilot.php`:**
- Feature toggles per AI capability
- Cost in credits per feature
- Cache TTL per feature
- Hebrew glossary for food terms
- Model configuration (GPT-4o default)

---

## Usage Examples

### Admin Adding Menu Item
```
1. Navigate to: /admin/menu
2. Click: "הוסף פריט חדש"
3. Fill: Name, Price, Category
4. Click: "צור תיאור חכם" (AI button)
5. Wait: ~2-3 seconds
6. Review: Generated Hebrew description
7. Edit: If needed
8. Save: Menu item with description
```

### Monitoring Credits
```
1. Navigate to: /admin/dashboard
2. View: AI Credits badge (purple section)
3. See: Remaining credits, usage %, stats
4. If low: "שדרג ל-Pro" button appears
```

---

## Hebrew Language Support

### Prompt Engineering
```php
$systemPrompt = "אתה כותב מקצועי שמתמחה ביצירת תיאורים מושכים...";
```

**Glossary (config):**
- שווארמה, לאפה, פיתה, בגט
- חומוס, טחינה, עמבה, חריף
- סלט ישראלי, כבש, עוף, בקר

**No Fallback:** כל התגובות בעברית בלבד

---

## Cost Management

### Current Implementation
- **Free Tier:** 20 descriptions/month
- **Pro Tier:** 300 descriptions/month
- **Cost per request:** 1 credit (configurable)
- **Cache savings:** Unlimited cached reads (0 credits)

### Optimization Tips
1. **Use cache:** Identical items = free
2. **Batch editing:** Edit before regenerate
3. **Monitor dashboard:** Watch cache hit rate
4. **Upgrade proactively:** Before hitting 0 credits

---

## Monitoring & Debugging

### Logs
**Laravel Log:**
```
[2026-01-23 14:30:00] local.INFO: AI Usage {
  "tenant_id": "pizza-palace",
  "feature": "description_generator",
  "status": "success",
  "cached": false,
  "response_time_ms": 1823
}
```

**Database:**
```sql
SELECT * FROM ai_usage_logs 
WHERE tenant_id = 'pizza-palace' 
ORDER BY created_at DESC LIMIT 10;
```

### Metrics to Watch
1. **Cache Hit Rate:** Target >60%
2. **Avg Response Time:** Target <3000ms
3. **Error Rate:** Target <5%
4. **Credits Burn Rate:** Monitor daily

---

## Roadmap (Not Implemented Yet)

### Priority 2: High Impact Features
- [ ] Menu Recommendations (customer-facing)
- [ ] Order Customization Assistant
- [ ] Admin Chatbot for order management

### Priority 3: Future Enhancements
- [ ] Voice/Chat Ordering
- [ ] Delivery Zone AI Optimizer
- [ ] Real-time Dashboard Insights

---

## Troubleshooting

### "פיצ'ר AI אינו זמין"
- Check: `COPILOT_ENABLED=true` in `.env`
- Run: `php artisan config:clear`

### "אין מספיק קרדיטים"
- Check: `ai_credits` table for tenant
- Manually reset: `php artisan tinker`
  ```php
  $credit = AiCredit::where('tenant_id', 'pizza-palace')->first();
  $credit->resetMonthlyCredits();
  ```

### "Copilot CLI not found"
- Verify path: `which copilot`
- Update `.env`: `COPILOT_CLI_PATH=/correct/path`

### Slow responses
- Check cache: `php artisan cache:clear`
- Monitor logs: `tail -f storage/logs/laravel.log`
- Check network: Copilot CLI requires internet

---

## Security Considerations

### Multi-Tenant Isolation ✅
- Tenant ID enforced in middleware
- Global scopes on models
- Cache keys include tenant ID
- Audit logs track all actions

### Rate Limiting ✅
- Per-tenant limits prevent abuse
- Per-user tracking available
- Graceful error messages

### Data Privacy ✅
- Prompts stored only if `APP_DEBUG=true`
- No customer personal data in prompts
- Audit logs for compliance

---

## Support & Contact

**Issues:** Create GitHub issue with:
- Tenant ID (sanitized)
- Error message
- `ai_usage_logs` entry ID
- Steps to reproduce

**Feature Requests:** Open discussion with use case

---

## License

Same as TakeEat main project (proprietary).

---

**Last Updated:** January 23, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready (Description Generator)
