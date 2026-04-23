<?php

namespace App\Services;

use App\Http\Controllers\SuperAdminSettingsController;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Restaurant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * מעבד SEO — טוען את שלד ה-HTML של ה-SPA (Vite build),
 * מזריק meta tags, Open Graph ו-JSON-LD ייחודיים לכל מסעדה
 * ומחזיר HTML מוכן שמתאים גם לבני אדם וגם ל-crawlers.
 */
class SeoRenderer
{
    public const CACHE_TTL_SECONDS = 600;

    public const CACHE_PREFIX = 'seo:restaurant:';

    /** מפתח cache לשלד index.html (חייב להתאים ל־hashes של /assets ב-Vercel) */
    public const SHELL_CACHE_KEY = 'seo:shell:html';

    /** TTL קצר יותר מדפי מסעדה — אחרי deploy לפרונט חייבים hashes מעודכנים */
    public const SHELL_CACHE_TTL_SECONDS = 120;

    /**
     * רנדור ציבורי לדף שיתוף מסעדה (/r/{slug})
     */
    public function renderSharePage(Restaurant $restaurant): string
    {
        $cacheKey = self::CACHE_PREFIX . 'share:' . $restaurant->id;

        return Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($restaurant) {
            return $this->buildHtml($restaurant, $this->buildShareMeta($restaurant));
        });
    }

    /**
     * רנדור ציבורי לעמוד התפריט (/{tenantId}/menu)
     */
    public function renderMenuPage(Restaurant $restaurant): string
    {
        $cacheKey = self::CACHE_PREFIX . 'menu:' . $restaurant->id;

        return Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($restaurant) {
            return $this->buildHtml($restaurant, $this->buildMenuMeta($restaurant));
        });
    }

    /**
     * מנקה את כל ה-SEO cache של מסעדה ספציפית
     */
    public static function forgetRestaurant(Restaurant $restaurant): void
    {
        Cache::forget(self::CACHE_PREFIX . 'share:' . $restaurant->id);
        Cache::forget(self::CACHE_PREFIX . 'menu:' . $restaurant->id);
        // דפי hub תלויים ברשימת המסעדות, לכן מוצאים גם אותם מהמטמון
        Cache::forget(self::CACHE_PREFIX . 'hub:list');
        Cache::forget(self::CACHE_PREFIX . 'hub:new');
    }

    /**
     * מנקה את ה-SEO cache של עמוד ה-landing. קורא כש-pricing_tiers מתעדכן.
     */
    public static function forgetLanding(): void
    {
        Cache::forget(self::CACHE_PREFIX . 'hub:landing');
    }

    /**
     * מנקה מטמון שלד + כל ה-HTML שכבר הורנדר (כולל /r/ ו-/{tenant}/menu), כי הוא מוטבע בו נתיבי /assets/ מה-build.
     * להריץ אחרי **כל** deploy לפרונט (Vite משנה hashes). אם לא — דף שיתוף יחזיר script ישן ו-Vercel יגיש index.html בטעות (MIME error, דף לבן).
     * ל- hub עם ?city= המפתח מורכב — במקרה קיצון: php artisan cache:clear
     */
    public static function bustAfterFrontendDeploy(): void
    {
        Cache::forget(self::SHELL_CACHE_KEY);
        Restaurant::withoutGlobalScope('tenant')
            ->pluck('id')
            ->each(function ($id) {
                Cache::forget(self::CACHE_PREFIX . 'share:' . $id);
                Cache::forget(self::CACHE_PREFIX . 'menu:' . $id);
            });
        foreach (['hub:list', 'hub:new', 'hub:about', 'hub:landing'] as $hub) {
            Cache::forget(self::CACHE_PREFIX . $hub);
        }
    }

    /** @deprecated use bustAfterFrontendDeploy() */
    public static function forgetShell(): void
    {
        self::bustAfterFrontendDeploy();
    }

    /**
     * רנדור hub עמוד רשימת המסעדות (/restaurants)
     *
     * @param iterable<int, Restaurant> $restaurants
     */
    public function renderRestaurantsList(iterable $restaurants, ?string $cityFilter = null): string
    {
        $cacheKey = self::CACHE_PREFIX . 'hub:list' . ($cityFilter ? ':city:' . md5($cityFilter) : '');

        return Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($restaurants, $cityFilter) {
            return $this->buildHubHtml($this->buildRestaurantsListMeta($restaurants, $cityFilter));
        });
    }

    /**
     * רנדור hub עמוד מסעדות חדשות (/restaurants/new)
     *
     * @param iterable<int, Restaurant> $restaurants
     */
    public function renderNewRestaurants(iterable $restaurants): string
    {
        $cacheKey = self::CACHE_PREFIX . 'hub:new';

        return Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($restaurants) {
            return $this->buildHubHtml($this->buildNewRestaurantsMeta($restaurants));
        });
    }

    /**
     * רנדור דף "איך זה עובד" / About (/about)
     */
    public function renderAbout(): string
    {
        $cacheKey = self::CACHE_PREFIX . 'hub:about';

        return Cache::remember($cacheKey, self::CACHE_TTL_SECONDS * 6, function () {
            return $this->buildHubHtml($this->buildAboutMeta());
        });
    }

    /**
     * רנדור דף נחיתה B2B (/landing) — ממוקד בבעלי מסעדות.
     * כולל SoftwareApplication + Service JSON-LD.
     */
    public function renderLandingPage(): string
    {
        $cacheKey = self::CACHE_PREFIX . 'hub:landing';

        return Cache::remember($cacheKey, self::CACHE_TTL_SECONDS * 6, function () {
            return $this->buildHubHtml($this->buildLandingMeta());
        });
    }

    /**
     * בניית מטא-דאטה למטא-תגיות של דף שיתוף
     *
     * @return array<string, mixed>
     */
    protected function buildShareMeta(Restaurant $restaurant): array
    {
        $url = $this->frontendUrl() . '/r/' . rawurlencode($restaurant->slug ?: $restaurant->tenant_id);
        $title = $this->truncate(($restaurant->name ?? '') . ' — הזמינו אונליין | TakeEat', 65);
        $description = $this->buildDescription($restaurant, 'share');
        $image = $this->resolveLogo($restaurant);

        return [
            'url' => $url,
            'title' => $title,
            'description' => $description,
            'image' => $image,
            'keywords' => $this->buildKeywords($restaurant),
            'robots' => $restaurant->is_approved ? 'index, follow' : 'noindex, nofollow',
            'jsonLd' => $this->buildRestaurantJsonLd($restaurant, $url, $image),
        ];
    }

    /**
     * בניית מטא-דאטה לעמוד תפריט — מוסיף את רשימת פריטי התפריט ל-JSON-LD
     *
     * @return array<string, mixed>
     */
    protected function buildMenuMeta(Restaurant $restaurant): array
    {
        $url = $this->frontendUrl() . '/' . rawurlencode($restaurant->tenant_id) . '/menu';
        $title = $this->truncate('תפריט ' . ($restaurant->name ?? '') . ' | TakeEat', 65);
        $description = $this->buildDescription($restaurant, 'menu');
        $image = $this->resolveLogo($restaurant);

        $baseJsonLd = $this->buildRestaurantJsonLd($restaurant, $url, $image);
        $baseJsonLd['hasMenu'] = $this->buildMenuJsonLd($restaurant);

        return [
            'url' => $url,
            'title' => $title,
            'description' => $description,
            'image' => $image,
            'keywords' => $this->buildKeywords($restaurant),
            'robots' => $restaurant->is_approved ? 'index, follow' : 'noindex, nofollow',
            'jsonLd' => $baseJsonLd,
        ];
    }

    /**
     * @param array<string, mixed> $meta
     */
    protected function buildHtml(Restaurant $restaurant, array $meta): string
    {
        $shell = $this->loadShell();

        // נחליף קודם את החלק של ה-<head> — עדיף להשתמש בביטוי רגולרי פשוט
        // ולא ב-DOMDocument, שמצריך הזזת encoding בעברית ועלול להרוס סקריפטים.
        $metaBlock = $this->renderMetaBlock($meta);

        // מסיר meta/og/twitter/title/description קיימים שיתנגשו עם הדינמיים שלנו.
        $patternsToStrip = [
            '/<title>.*?<\/title>/us',
            '/<meta\s+name=["\']description["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']keywords["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']robots["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:title["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:description["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:secure_url["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:width["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:height["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:type["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:alt["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:url["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:type["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']twitter:title["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']twitter:description["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']twitter:image["\'][^>]*>\s*/ius',
            '/<link\s+rel=["\']canonical["\'][^>]*>\s*/ius',
        ];

        $html = preg_replace($patternsToStrip, '', $shell) ?? $shell;

        // מזריקים את כל הבלוק החדש בתוך ה-<head> (לפני תגית הסיום).
        $html = preg_replace(
            '/<\/head>/i',
            $metaBlock . "\n</head>",
            $html,
            1
        ) ?? $html;

        return $html;
    }

    /**
     * בונה את בלוק ה-HTML שמוזרק ל-<head>
     *
     * @param array<string, mixed> $meta
     */
    protected function renderMetaBlock(array $meta): string
    {
        $title = e($meta['title']);
        $description = e($meta['description']);
        $url = e($meta['url']);
        $image = $meta['image'] ? e($meta['image']) : '';
        $keywords = e($meta['keywords']);
        $robots = e($meta['robots']);

        $jsonLdJson = json_encode(
            $meta['jsonLd'],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
        );

        $imageTags = '';
        if ($image) {
            $imageTags = <<<HTML
    <meta property="og:image" content="{$image}" />
    <meta property="og:image:secure_url" content="{$image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta name="twitter:image" content="{$image}" />
HTML;
        }

        return <<<HTML
    <!-- SEO: Dynamic meta injected by Laravel SeoRenderer -->
    <title>{$title}</title>
    <meta name="description" content="{$description}" />
    <meta name="keywords" content="{$keywords}" />
    <meta name="robots" content="{$robots}" />
    <link rel="canonical" href="{$url}" />
    <meta property="og:type" content="restaurant.restaurant" />
    <meta property="og:site_name" content="TakeEat" />
    <meta property="og:title" content="{$title}" />
    <meta property="og:description" content="{$description}" />
    <meta property="og:url" content="{$url}" />
    <meta property="og:locale" content="he_IL" />
{$imageTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{$title}" />
    <meta name="twitter:description" content="{$description}" />
    <script type="application/ld+json">
{$jsonLdJson}
    </script>
    <!-- /SEO -->
HTML;
    }

    /**
     * JSON-LD בסיסי של Restaurant (schema.org)
     *
     * @return array<string, mixed>
     */
    protected function buildRestaurantJsonLd(Restaurant $restaurant, string $url, ?string $image): array
    {
        $address = array_filter([
            '@type' => 'PostalAddress',
            'streetAddress' => $restaurant->address ?: null,
            'addressLocality' => $restaurant->city ?: null,
            'addressCountry' => 'IL',
        ]);

        $geo = null;
        if ($restaurant->latitude && $restaurant->longitude) {
            $geo = [
                '@type' => 'GeoCoordinates',
                'latitude' => (float) $restaurant->latitude,
                'longitude' => (float) $restaurant->longitude,
            ];
        }

        $openingHours = $this->buildOpeningHours($restaurant);

        $data = array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'Restaurant',
            '@id' => $url . '#restaurant',
            'name' => $restaurant->name,
            'url' => $url,
            'image' => $image,
            'telephone' => $restaurant->phone ?: null,
            'servesCuisine' => $restaurant->cuisine_type ?: null,
            'priceRange' => '₪₪',
            'description' => $this->buildDescription($restaurant, 'share'),
            'address' => count($address) > 1 ? $address : null,
            'geo' => $geo,
            'openingHoursSpecification' => $openingHours ?: null,
            'hasMap' => $geo
                ? sprintf('https://www.google.com/maps/search/?api=1&query=%F,%F', $geo['latitude'], $geo['longitude'])
                : null,
            'acceptsReservations' => false,
        ], fn ($v) => $v !== null && $v !== '');

        return $data;
    }

    /**
     * JSON-LD Menu: קטגוריות + פריטים
     *
     * @return array<string, mixed>
     */
    protected function buildMenuJsonLd(Restaurant $restaurant): array
    {
        $categories = Category::withoutGlobalScope('tenant')
            ->where('restaurant_id', $restaurant->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->limit(50)
            ->get(['id', 'name', 'description']);

        $sections = [];
        foreach ($categories as $category) {
            $items = MenuItem::withoutGlobalScope('tenant')
                ->where('restaurant_id', $restaurant->id)
                ->where('category_id', $category->id)
                ->where('is_active', true)
                ->where('is_available', true)
                ->limit(30)
                ->get(['id', 'name', 'description', 'price', 'image_url']);

            if ($items->isEmpty()) {
                continue;
            }

            $menuItems = [];
            foreach ($items as $item) {
                $entry = array_filter([
                    '@type' => 'MenuItem',
                    'name' => $item->name,
                    'description' => $item->description ? $this->truncate(strip_tags($item->description), 300) : null,
                    'image' => $item->image_url ?: null,
                    'offers' => $item->price > 0 ? [
                        '@type' => 'Offer',
                        'price' => (string) $item->price,
                        'priceCurrency' => 'ILS',
                    ] : null,
                ], fn ($v) => $v !== null && $v !== '');

                $menuItems[] = $entry;
            }

            $sections[] = array_filter([
                '@type' => 'MenuSection',
                'name' => $category->name,
                'description' => $category->description ?: null,
                'hasMenuItem' => $menuItems,
            ], fn ($v) => $v !== null && $v !== '' && $v !== []);
        }

        return [
            '@type' => 'Menu',
            'name' => 'תפריט ' . $restaurant->name,
            'hasMenuSection' => $sections,
        ];
    }

    /**
     * ממיר operating_hours ל-OpeningHoursSpecification של schema.org
     *
     * @return array<int, array<string, mixed>>
     */
    protected function buildOpeningHours(Restaurant $restaurant): array
    {
        $hours = $restaurant->operating_hours ?? [];
        $days = $restaurant->operating_days ?? [];

        if (!is_array($hours) || empty($hours)) {
            return [];
        }

        $dayMap = [
            'sunday' => 'Sunday',
            'monday' => 'Monday',
            'tuesday' => 'Tuesday',
            'wednesday' => 'Wednesday',
            'thursday' => 'Thursday',
            'friday' => 'Friday',
            'saturday' => 'Saturday',
        ];

        $spec = [];
        foreach ($dayMap as $key => $label) {
            if (isset($days[$key]) && $days[$key] === false) {
                continue;
            }

            $dayHours = $hours[$key] ?? null;
            if (!is_array($dayHours) || empty($dayHours['open']) || empty($dayHours['close'])) {
                continue;
            }

            $spec[] = [
                '@type' => 'OpeningHoursSpecification',
                'dayOfWeek' => 'https://schema.org/' . $label,
                'opens' => $dayHours['open'],
                'closes' => $dayHours['close'],
            ];
        }

        return $spec;
    }

    protected function buildDescription(Restaurant $restaurant, string $context = 'share'): string
    {
        $pieces = [];

        if ($restaurant->description) {
            $pieces[] = trim(strip_tags($restaurant->description));
        } else {
            $pieces[] = $context === 'menu'
                ? 'התפריט המלא של ' . ($restaurant->name ?: 'המסעדה')
                : ($restaurant->name ?: 'מסעדה') . ' — הזמינו אונליין ובקלות';
        }

        if ($restaurant->cuisine_type) {
            $pieces[] = 'מטבח ' . $restaurant->cuisine_type;
        }

        if ($restaurant->city) {
            $pieces[] = $restaurant->city;
        }

        $pieces[] = 'הזמנה אונליין, משלוח ואיסוף עצמי דרך TakeEat';

        return $this->truncate(implode(' · ', array_filter($pieces)), 158);
    }

    protected function buildKeywords(Restaurant $restaurant): string
    {
        $kw = array_filter([
            $restaurant->name,
            $restaurant->cuisine_type,
            $restaurant->city,
            'הזמנה אונליין',
            'משלוח אוכל',
            'תפריט',
            'TakeEat',
        ]);

        return implode(', ', array_unique($kw));
    }

    protected function resolveLogo(Restaurant $restaurant): ?string
    {
        $logo = $restaurant->logo_url;
        if (!$logo) {
            return $this->frontendUrl() . '/icons/chefsync-logo-v2-512.png';
        }

        if (is_string($logo) && (str_starts_with($logo, 'http://') || str_starts_with($logo, 'https://'))) {
            return $logo;
        }

        return rtrim($this->frontendUrl(), '/') . '/' . ltrim($logo, '/');
    }

    protected function truncate(string $text, int $maxLength): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
        if (mb_strlen($text) <= $maxLength) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $maxLength - 1)) . '…';
    }

    protected function frontendUrl(): string
    {
        return rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://www.takeeat.co.il')), '/');
    }

    // =========================================================================
    //  Hub pages — /restaurants, /restaurants/new, /about
    // =========================================================================

    /**
     * בניית meta + JSON-LD ל-/restaurants
     *
     * @param iterable<int, Restaurant> $restaurants
     * @return array<string, mixed>
     */
    protected function buildRestaurantsListMeta(iterable $restaurants, ?string $cityFilter = null): array
    {
        $frontend = $this->frontendUrl();
        $url = $frontend . '/restaurants' . ($cityFilter ? '?city=' . rawurlencode($cityFilter) : '');
        $image = $frontend . '/icons/chefsync-logo-v2-512.png';

        $title = $cityFilter
            ? $this->truncate("מסעדות ב{$cityFilter} · הזמנת אוכל אונליין | TakeEat", 65)
            : 'כל המסעדות ב-TakeEat · הזמנת אוכל אונליין בישראל | טייק איט';

        $description = $cityFilter
            ? "רשימת כל המסעדות ב{$cityFilter} שזמינות להזמנת אוכל אונליין דרך TakeEat — משלוח מהיר, איסוף עצמי, תפריט מלא ותשלום מאובטח."
            : 'רשימת כל המסעדות הזמינות להזמנת אוכל אונליין דרך TakeEat. מגוון מטבחים, ערים וסגנונות — משלוח מהיר, איסוף עצמי ותפריט דיגיטלי מלא. הזמינו ישירות מהמסעדה.';

        $keywords = 'מסעדות, מסעדות בישראל, רשימת מסעדות, הזמנת אוכל, משלוח אוכל, איסוף עצמי, תפריט אונליין, TakeEat, טייק איט';
        if ($cityFilter) {
            $keywords = "מסעדות ב{$cityFilter}, הזמנת אוכל ב{$cityFilter}, משלוח אוכל ב{$cityFilter}, " . $keywords;
        }

        return [
            'url' => $url,
            'title' => $title,
            'description' => $this->truncate($description, 160),
            'image' => $image,
            'keywords' => $keywords,
            'robots' => 'index, follow, max-snippet:-1, max-image-preview:large',
            'ogType' => 'website',
            'jsonLd' => [
                $this->buildItemListJsonLd($restaurants, $url, $cityFilter ? "מסעדות ב{$cityFilter}" : 'כל המסעדות ב-TakeEat'),
                $this->buildBreadcrumbJsonLd([
                    ['name' => 'דף הבית', 'url' => $frontend . '/'],
                    ['name' => $cityFilter ? "מסעדות ב{$cityFilter}" : 'מסעדות', 'url' => $url],
                ]),
            ],
        ];
    }

    /**
     * @param iterable<int, Restaurant> $restaurants
     * @return array<string, mixed>
     */
    protected function buildNewRestaurantsMeta(iterable $restaurants): array
    {
        $frontend = $this->frontendUrl();
        $url = $frontend . '/restaurants/new';
        $image = $frontend . '/icons/chefsync-logo-v2-512.png';

        return [
            'url' => $url,
            'title' => 'מסעדות חדשות ב-TakeEat · הזמנת אוכל מהמסעדות החדשות בישראל',
            'description' => $this->truncate('המסעדות החדשות שהצטרפו ל-TakeEat לאחרונה. גלו מקומות חדשים ומטבחים מגוונים — הזמנת אוכל אונליין, משלוח מהיר ואיסוף עצמי. הזמינו ישירות מהמסעדה.', 160),
            'image' => $image,
            'keywords' => 'מסעדות חדשות, מסעדות חדשות בישראל, מסעדה חדשה, פתיחה, TakeEat, טייק איט, הזמנת אוכל, משלוח אוכל',
            'robots' => 'index, follow, max-snippet:-1, max-image-preview:large',
            'ogType' => 'website',
            'jsonLd' => [
                $this->buildItemListJsonLd($restaurants, $url, 'מסעדות חדשות ב-TakeEat'),
                $this->buildBreadcrumbJsonLd([
                    ['name' => 'דף הבית', 'url' => $frontend . '/'],
                    ['name' => 'מסעדות', 'url' => $frontend . '/restaurants'],
                    ['name' => 'חדשות', 'url' => $url],
                ]),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildAboutMeta(): array
    {
        $frontend = $this->frontendUrl();
        $url = $frontend . '/about';
        $image = $frontend . '/icons/chefsync-logo-v2-512.png';

        return [
            'url' => $url,
            'title' => 'איך זה עובד · מה זה TakeEat? | טייק איט',
            'description' => $this->truncate('TakeEat (טייק איט) היא פלטפורמה ישראלית להזמנת אוכל ישירות מהמסעדה — ללא עמלות מוגזמות. גלו איך זה עובד: משלוח מהיר, איסוף עצמי, תפריט דיגיטלי מלא ותשלום מאובטח.', 160),
            'image' => $image,
            'keywords' => 'מה זה TakeEat, איך זה עובד, הזמנת אוכל ללא עמלות, ישירות מהמסעדה, טייק איט, ChefSync, מערכת הזמנות למסעדה',
            'robots' => 'index, follow, max-snippet:-1, max-image-preview:large',
            'ogType' => 'website',
            'jsonLd' => [
                [
                    '@context' => 'https://schema.org',
                    '@type' => 'AboutPage',
                    '@id' => $url . '#about',
                    'url' => $url,
                    'name' => 'איך זה עובד · TakeEat',
                    'description' => 'TakeEat היא פלטפורמה ישראלית להזמנת אוכל ישירות מהמסעדה.',
                    'inLanguage' => 'he-IL',
                    'isPartOf' => ['@id' => $frontend . '/#website'],
                    'about' => ['@id' => $frontend . '/#organization'],
                ],
                $this->buildFaqJsonLd(),
                $this->buildBreadcrumbJsonLd([
                    ['name' => 'דף הבית', 'url' => $frontend . '/'],
                    ['name' => 'איך זה עובד', 'url' => $url],
                ]),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildLandingMeta(): array
    {
        $frontend = $this->frontendUrl();
        $url = $frontend . '/landing';
        $image = $frontend . '/icons/chefsync-logo-v2-512.png';

        // שליפת מחירי החבילות מה-SystemSetting (ניתן לעדכון ע"י סופר-אדמין)
        $pricing = $this->loadPricingTiers();
        $monthlyPrices = [];
        $tierOffers = [];

        foreach ($pricing as $tierKey => $tier) {
            $monthly = (float) ($tier['monthly'] ?? 0);
            $yearly = (float) ($tier['yearly'] ?? 0);
            $label = (string) ($tier['label'] ?? $tierKey);

            // Enterprise (0) לא נכלל בטווח המחירים — מוצג כ"מותאם אישית"
            if ($monthly <= 0) {
                continue;
            }

            $monthlyPrices[] = $monthly;

            $tierOffers[] = [
                '@type' => 'Offer',
                '@id' => $url . '#offer-' . $tierKey,
                'name' => $label,
                'category' => $tierKey,
                'priceCurrency' => 'ILS',
                'price' => (string) (int) $monthly,
                'priceSpecification' => array_values(array_filter([
                    [
                        '@type' => 'UnitPriceSpecification',
                        'price' => (string) (int) $monthly,
                        'priceCurrency' => 'ILS',
                        'unitCode' => 'MON',
                        'name' => 'מנוי חודשי',
                    ],
                    $yearly > 0 ? [
                        '@type' => 'UnitPriceSpecification',
                        'price' => (string) (int) $yearly,
                        'priceCurrency' => 'ILS',
                        'unitCode' => 'ANN',
                        'name' => 'מנוי שנתי',
                    ] : null,
                ])),
                'availability' => 'https://schema.org/InStock',
                'url' => $url,
                'seller' => ['@id' => $frontend . '/#organization'],
                'description' => isset($tier['features']) && is_array($tier['features'])
                    ? implode(' · ', array_slice($tier['features'], 0, 6))
                    : null,
            ];
        }

        // AggregateOffer: Google יציג "החל מ-X₪" בתוצאות
        $lowPrice = $monthlyPrices ? min($monthlyPrices) : null;
        $highPrice = $monthlyPrices ? max($monthlyPrices) : null;

        $aggregateOffer = $lowPrice !== null
            ? [
                '@type' => 'AggregateOffer',
                'priceCurrency' => 'ILS',
                'lowPrice' => (string) (int) $lowPrice,
                'highPrice' => (string) (int) $highPrice,
                'offerCount' => count($tierOffers),
                'offers' => $tierOffers,
            ]
            : null;

        $descriptionPriceHint = $lowPrice !== null
            ? sprintf(' החל מ-%d₪ לחודש.', (int) $lowPrice)
            : '';

        return [
            'url' => $url,
            'title' => 'מערכת הזמנות למסעדה · ללא עמלות על הזמנה | TakeEat',
            'description' => $this->truncate('TakeEat — מערכת הזמנות מלאה למסעדה: תפריט דיגיטלי, ניהול הזמנות, סליקה, משלוחים ודוחות. דמי מנוי חודשיים קבועים, ללא עמלה על כל הזמנה.' . $descriptionPriceHint, 160),
            'image' => $image,
            'keywords' => 'מערכת הזמנות למסעדה, מערכת ניהול מסעדה, תפריט דיגיטלי למסעדה, מערכת תפריט אונליין, סליקה למסעדה, מסעדה דיגיטלית, ניהול הזמנות מסעדה, אתר הזמנות למסעדה, חלופה לאפליקציות משלוחים, מסעדה ללא עמלות, POS למסעדה, TakeEat, טייק איט, ChefSync',
            'robots' => 'index, follow, max-snippet:-1, max-image-preview:large',
            'ogType' => 'website',
            'jsonLd' => array_values(array_filter([
                [
                    '@context' => 'https://schema.org',
                    '@type' => 'SoftwareApplication',
                    '@id' => $url . '#software',
                    'name' => 'TakeEat',
                    'alternateName' => ['טייק איט', 'ChefSync'],
                    'applicationCategory' => 'BusinessApplication',
                    'applicationSubCategory' => 'Restaurant Management Software',
                    'operatingSystem' => 'Web, iOS, Android',
                    'url' => $url,
                    'image' => $image,
                    'description' => 'מערכת הזמנות ותפריט דיגיטלי למסעדות — ניהול הזמנות, סליקה, משלוחים ודוחות. ללא עמלה על כל הזמנה, רק דמי מנוי חודשיים קבועים.',
                    'offers' => $aggregateOffer,
                    'featureList' => [
                        'תפריט דיגיטלי מלא עם קטגוריות ותמונות',
                        'ניהול הזמנות בזמן אמת',
                        'סליקה מאובטחת דרך HYP',
                        'חשבוניות אוטומטיות',
                        'ניהול משלוחים ואיסוף עצמי',
                        'דוחות מכירות וסטטיסטיקות',
                        'דומיין דיגיטלי ייעודי למסעדה',
                        'עמוד שיתוף למסעדה ברשתות חברתיות',
                    ],
                    'inLanguage' => 'he-IL',
                    'provider' => ['@id' => $frontend . '/#organization'],
                ],
                [
                    '@context' => 'https://schema.org',
                    '@type' => 'Service',
                    '@id' => $url . '#service',
                    'name' => 'מערכת הזמנות למסעדה',
                    'serviceType' => 'Restaurant Ordering Platform',
                    'url' => $url,
                    'provider' => ['@id' => $frontend . '/#organization'],
                    'areaServed' => ['@type' => 'Country', 'name' => 'Israel'],
                    'audience' => [
                        '@type' => 'BusinessAudience',
                        'audienceType' => 'Restaurant owners',
                    ],
                    'description' => 'פלטפורמה מלאה להזמנת אוכל אונליין עבור מסעדות: תפריט דיגיטלי, ניהול הזמנות, סליקה ומשלוחים. ללא עמלה על כל הזמנה.',
                    'offers' => $aggregateOffer,
                ],
                $this->buildBreadcrumbJsonLd([
                    ['name' => 'דף הבית', 'url' => $frontend . '/'],
                    ['name' => 'לבעלי מסעדות', 'url' => $url],
                ]),
            ])),
        ];
    }

    /**
     * טעינה בטוחה של מחירי החבילות. אם SuperAdminSettingsController לא זמין
     * (טעינה מוקדמת / טסט) — מחזיר מערך ריק.
     *
     * @return array<string, array<string, mixed>>
     */
    protected function loadPricingTiers(): array
    {
        try {
            if (class_exists(SuperAdminSettingsController::class)) {
                $tiers = SuperAdminSettingsController::getPricingArray();
                return is_array($tiers) ? $tiers : [];
            }
        } catch (\Throwable $e) {
            Log::warning('SeoRenderer: failed to load pricing tiers', [
                'error' => $e->getMessage(),
            ]);
        }

        return [];
    }

    /**
     * @param iterable<int, Restaurant> $restaurants
     * @return array<string, mixed>
     */
    protected function buildItemListJsonLd(iterable $restaurants, string $pageUrl, string $listName): array
    {
        $items = [];
        $position = 1;
        foreach ($restaurants as $restaurant) {
            $slug = $restaurant->slug ?: $restaurant->tenant_id;
            if (!$slug) {
                continue;
            }

            $rUrl = $this->frontendUrl() . '/r/' . rawurlencode($slug);
            $items[] = [
                '@type' => 'ListItem',
                'position' => $position++,
                'url' => $rUrl,
                'item' => array_filter([
                    '@type' => 'Restaurant',
                    '@id' => $rUrl . '#restaurant',
                    'name' => $restaurant->name,
                    'url' => $rUrl,
                    'image' => $this->resolveLogo($restaurant),
                    'servesCuisine' => $restaurant->cuisine_type ?: null,
                    'address' => $restaurant->city
                        ? [
                            '@type' => 'PostalAddress',
                            'addressLocality' => $restaurant->city,
                            'addressCountry' => 'IL',
                        ]
                        : null,
                ], fn ($v) => $v !== null && $v !== ''),
            ];
        }

        return [
            '@context' => 'https://schema.org',
            '@type' => 'ItemList',
            '@id' => $pageUrl . '#itemlist',
            'name' => $listName,
            'url' => $pageUrl,
            'numberOfItems' => count($items),
            'itemListElement' => $items,
            'inLanguage' => 'he-IL',
        ];
    }

    /**
     * @param array<int, array{name: string, url: string}> $crumbs
     * @return array<string, mixed>
     */
    protected function buildBreadcrumbJsonLd(array $crumbs): array
    {
        $list = [];
        foreach ($crumbs as $i => $c) {
            $list[] = [
                '@type' => 'ListItem',
                'position' => $i + 1,
                'name' => $c['name'],
                'item' => $c['url'],
            ];
        }

        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => $list,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildFaqJsonLd(): array
    {
        $faqs = [
            [
                'q' => 'מה זה TakeEat?',
                'a' => 'TakeEat (טייק איט) היא פלטפורמה ישראלית שמאפשרת למסעדות למכור אוכל אונליין ישירות לסועדים, ללא עמלות מוגזמות של אפליקציות משלוחים. הסועדים מקבלים תפריט דיגיטלי מלא, משלוח או איסוף עצמי, ומעקב הזמנה בזמן אמת.',
            ],
            [
                'q' => 'כמה עולה להזמין ב-TakeEat?',
                'a' => 'המחירים ב-TakeEat הם המחירים המקוריים של המסעדה — ללא תוספות סמויות. דמי משלוח נקבעים על ידי המסעדה עצמה.',
            ],
            [
                'q' => 'אילו אמצעי תשלום נתמכים?',
                'a' => 'ניתן לשלם בכרטיס אשראי, ביט, Apple Pay ו-Google Pay. התשלום מאובטח ועובר דרך ספקי סליקה מורשים (HYP).',
            ],
            [
                'q' => 'האם אפשר להזמין במשלוח וגם באיסוף עצמי?',
                'a' => 'כן. כל מסעדה מגדירה אילו אפשרויות הגשה זמינות — משלוח, איסוף עצמי, או שתיהן.',
            ],
            [
                'q' => 'אני בעל מסעדה — איך נרשמים ל-TakeEat?',
                'a' => 'אפשר להירשם דרך עמוד הרשמת מסעדה באתר. ההרשמה כוללת הגדרת תפריט, חיבור ל-HYP לתשלומים וקבלת דומיין דיגיטלי למסעדה.',
            ],
        ];

        $mainEntity = [];
        foreach ($faqs as $faq) {
            $mainEntity[] = [
                '@type' => 'Question',
                'name' => $faq['q'],
                'acceptedAnswer' => [
                    '@type' => 'Answer',
                    'text' => $faq['a'],
                ],
            ];
        }

        return [
            '@context' => 'https://schema.org',
            '@type' => 'FAQPage',
            'mainEntity' => $mainEntity,
        ];
    }

    /**
     * בונה HTML עבור דף hub (ללא תלות במסעדה ספציפית)
     *
     * @param array<string, mixed> $meta
     */
    protected function buildHubHtml(array $meta): string
    {
        $shell = $this->loadShell();
        $metaBlock = $this->renderHubMetaBlock($meta);

        $patternsToStrip = [
            '/<title>.*?<\/title>/us',
            '/<meta\s+name=["\']description["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']keywords["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']robots["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:title["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:description["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:secure_url["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:width["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:height["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:type["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:image:alt["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:url["\'][^>]*>\s*/ius',
            '/<meta\s+property=["\']og:type["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']twitter:title["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']twitter:description["\'][^>]*>\s*/ius',
            '/<meta\s+name=["\']twitter:image["\'][^>]*>\s*/ius',
            '/<link\s+rel=["\']canonical["\'][^>]*>\s*/ius',
        ];

        $html = preg_replace($patternsToStrip, '', $shell) ?? $shell;

        $html = preg_replace(
            '/<\/head>/i',
            $metaBlock . "\n</head>",
            $html,
            1
        ) ?? $html;

        return $html;
    }

    /**
     * בלוק meta ייעודי לדפי hub — כולל תמיכה במספר JSON-LD blocks
     *
     * @param array<string, mixed> $meta
     */
    protected function renderHubMetaBlock(array $meta): string
    {
        $title = e($meta['title']);
        $description = e($meta['description']);
        $url = e($meta['url']);
        $image = $meta['image'] ? e($meta['image']) : '';
        $keywords = e($meta['keywords']);
        $robots = e($meta['robots']);
        $ogType = e($meta['ogType'] ?? 'website');

        $jsonLdList = $meta['jsonLd'] ?? [];
        if (!is_array($jsonLdList) || !isset($jsonLdList[0])) {
            $jsonLdList = $jsonLdList ? [$jsonLdList] : [];
        }

        $jsonLdBlocks = '';
        foreach ($jsonLdList as $jsonLd) {
            $encoded = json_encode(
                $jsonLd,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
            );
            $jsonLdBlocks .= "\n    <script type=\"application/ld+json\">\n{$encoded}\n    </script>";
        }

        $imageTags = '';
        if ($image) {
            $imageTags = <<<HTML
    <meta property="og:image" content="{$image}" />
    <meta property="og:image:secure_url" content="{$image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta name="twitter:image" content="{$image}" />
HTML;
        }

        return <<<HTML
    <!-- SEO: Hub page meta injected by Laravel SeoRenderer -->
    <title>{$title}</title>
    <meta name="description" content="{$description}" />
    <meta name="keywords" content="{$keywords}" />
    <meta name="robots" content="{$robots}" />
    <link rel="canonical" href="{$url}" />
    <meta property="og:type" content="{$ogType}" />
    <meta property="og:site_name" content="TakeEat" />
    <meta property="og:title" content="{$title}" />
    <meta property="og:description" content="{$description}" />
    <meta property="og:url" content="{$url}" />
    <meta property="og:locale" content="he_IL" />
{$imageTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{$title}" />
    <meta name="twitter:description" content="{$description}" />{$jsonLdBlocks}
    <!-- /SEO -->
HTML;
    }

    /**
     * טוען את שלד ה-HTML של ה-SPA.
     * סדר ניסיונות (חשוב ל-sync מול Vite):
     * 1. URL מרוחק לפי SEO_SHELL_URL — מומלץ: https://www.takeeat.co.il/index.html (אותו index כמו בפרוד)
     * 2. קובץ לוקאלי לפי SEO_SHELL_PATH / FRONTEND_INDEX_PATH / ../frontend/dist/index.html
     * 3. שלד מובנה מינימלי (fallback)
     *
     * המטמון קצר (SHELL_CACHE_TTL_SECONDS) כדי שלאחר deploy לפרונט לא יישארו hashes ישנים ב-/assets.
     */
    protected function loadShell(): string
    {
        return Cache::remember(self::SHELL_CACHE_KEY, self::SHELL_CACHE_TTL_SECONDS, function () {
            $url = env('SEO_SHELL_URL');
            if ($url && is_string($url)) {
                try {
                    $response = Http::timeout(8)
                        ->withHeaders(['Accept' => 'text/html'])
                        ->get($url);
                    if ($response->ok()) {
                        $content = $response->body();
                        if (stripos($content, '</head>') !== false && stripos($content, '/assets/') !== false) {
                            return $content;
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning('SeoRenderer: failed to fetch shell URL', [
                        'url' => $url,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $path = env('SEO_SHELL_PATH') ?: env('FRONTEND_INDEX_PATH');
            if ($path && is_string($path) && is_file($path) && is_readable($path)) {
                $content = @file_get_contents($path);
                if ($content && stripos($content, '</head>') !== false) {
                    return $content;
                }
            }

            $defaultPath = base_path('../frontend/dist/index.html');
            if (is_file($defaultPath) && is_readable($defaultPath)) {
                $content = @file_get_contents($defaultPath);
                if ($content && stripos($content, '</head>') !== false) {
                    return $content;
                }
            }

            Log::warning('SeoRenderer: using minimal fallback shell — set SEO_SHELL_URL for production');

            return $this->fallbackShell();
        });
    }

    /**
     * שלד מובנה מינימלי — עובד גם בלי הגישה לקובץ של Vite.
     * הדפדפן יקבל HTML תקין עם meta-tags, והסקריפט הראשי יטען דרך ה-CDN של הפרונטנד.
     */
    protected function fallbackShell(): string
    {
        $frontend = $this->frontendUrl();
        $gscToken = env('GOOGLE_SITE_VERIFICATION', '');
        $gscTag = $gscToken
            ? '<meta name="google-site-verification" content="' . e($gscToken) . '" />'
            : '';

        return <<<HTML
<!doctype html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1f2c38" />
    {$gscTag}
    <link rel="icon" type="image/png" href="{$frontend}/icons/chefsync-logo-v2-192.png" />
    <link rel="apple-touch-icon" href="{$frontend}/icons/chefsync-logo-v2-180.png" />
</head>
<body>
    <div id="root"></div>
    <noscript>כדי לצפות בתפריט ולהזמין, הפעל JavaScript בדפדפן.</noscript>
</body>
</html>
HTML;
    }
}
