<?php

namespace App\Services;

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

    /**
     * טוען את שלד ה-HTML של ה-SPA.
     * סדר ניסיונות:
     * 1. קובץ לוקאלי לפי SEO_SHELL_PATH / FRONTEND_INDEX_PATH
     * 2. URL מרוחק לפי SEO_SHELL_URL (שלד נמשך + נשמר ב-cache ל-10 דקות)
     * 3. שלד מובנה מינימלי (fallback)
     */
    protected function loadShell(): string
    {
        $cacheKey = 'seo:shell:html';

        return Cache::remember($cacheKey, 600, function () {
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

            $url = env('SEO_SHELL_URL');
            if ($url) {
                try {
                    $response = Http::timeout(5)->get($url);
                    if ($response->ok()) {
                        $content = $response->body();
                        if (stripos($content, '</head>') !== false) {
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
