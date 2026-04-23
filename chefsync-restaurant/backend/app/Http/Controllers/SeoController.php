<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Services\SeoRenderer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

/**
 * בקר SEO — אחראי על:
 *  - sitemap.xml דינמי
 *  - robots.txt דינמי
 *  - רינדור דפי /r/{slug} ו-/{tenantId}/menu עבור crawlers ומשתמשים
 *
 * כל הנתיבים האלה *חייבים* להיות מוגשים דרך Laravel ולא דרך שרת הסטטי של Vite,
 * אחרת meta tags ו-JSON-LD לא יוזרקו וגוגל יראה רק את שלד ה-SPA הגנרי.
 */
class SeoController extends Controller
{
    public function __construct(private readonly SeoRenderer $seoRenderer)
    {
    }

    /**
     * מחזיר את השלד של דף שיתוף המסעדה עם meta tags דינמיים.
     * URL: /r/{slug}
     */
    public function showShare(Request $request, string $slug): Response
    {
        $restaurant = Restaurant::withoutGlobalScope('tenant')
            ->where('slug', $slug)
            ->orWhere('tenant_id', $slug)
            ->first();

        if (!$restaurant) {
            return $this->notFound();
        }

        if ($this->isHiddenFromIndex($restaurant)) {
            return $this->notFound();
        }

        $html = $this->seoRenderer->renderSharePage($restaurant);

        return $this->htmlResponse($html, $restaurant->is_approved ? 200 : 200);
    }

    /**
     * מחזיר את השלד של דף תפריט המסעדה עם meta tags + JSON-LD של Menu.
     * URL: /{tenantId}/menu
     */
    public function showMenu(Request $request, string $tenantId): Response
    {
        $restaurant = Restaurant::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->orWhere('slug', $tenantId)
            ->first();

        if (!$restaurant) {
            return $this->notFound();
        }

        if ($this->isHiddenFromIndex($restaurant)) {
            return $this->notFound();
        }

        $html = $this->seoRenderer->renderMenuPage($restaurant);

        return $this->htmlResponse($html, 200);
    }

    /**
     * מציג את רשימת המסעדות (/restaurants) כדף Hub עם ItemList JSON-LD.
     * תומך בסינון לפי עיר: /restaurants?city=תל+אביב
     */
    public function showRestaurantsList(Request $request): Response
    {
        $cityFilter = trim((string) $request->query('city', ''));

        $query = Restaurant::withoutGlobalScope('tenant')
            ->where('is_approved', true)
            ->where(function ($q) {
                $q->where('is_demo', false)->orWhereNull('is_demo');
            })
            ->whereIn('subscription_status', ['active', 'trial'])
            ->whereNotNull('tenant_id')
            ->orderBy('name');

        if ($cityFilter !== '') {
            $query->where('city', $cityFilter);
        }

        $restaurants = $query->limit(200)->get([
            'id', 'name', 'slug', 'tenant_id', 'cuisine_type', 'city',
            'logo_url', 'address', 'phone',
        ]);

        $html = $this->seoRenderer->renderRestaurantsList($restaurants, $cityFilter !== '' ? $cityFilter : null);

        return $this->htmlResponse($html, 200);
    }

    /**
     * מציג את רשימת המסעדות החדשות שהצטרפו ב-30 הימים האחרונים (/restaurants/new)
     */
    public function showNewRestaurants(Request $request): Response
    {
        $since = Carbon::now()->subDays(30);

        $restaurants = Restaurant::withoutGlobalScope('tenant')
            ->where('is_approved', true)
            ->where(function ($q) {
                $q->where('is_demo', false)->orWhereNull('is_demo');
            })
            ->whereIn('subscription_status', ['active', 'trial'])
            ->whereNotNull('tenant_id')
            ->where('created_at', '>=', $since)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get([
                'id', 'name', 'slug', 'tenant_id', 'cuisine_type', 'city',
                'logo_url', 'address', 'phone', 'created_at',
            ]);

        $html = $this->seoRenderer->renderNewRestaurants($restaurants);

        return $this->htmlResponse($html, 200);
    }

    /**
     * מציג את דף "איך זה עובד" / About (/about) עם FAQPage JSON-LD
     */
    public function showAbout(Request $request): Response
    {
        $html = $this->seoRenderer->renderAbout();

        return $this->htmlResponse($html, 200);
    }

    /**
     * דף נחיתה B2B (/landing) — ממוקד לבעלי מסעדות.
     * מזריק SoftwareApplication + Service JSON-LD.
     */
    public function showLanding(Request $request): Response
    {
        $html = $this->seoRenderer->renderLandingPage();

        return $this->htmlResponse($html, 200);
    }

    /**
     * sitemap.xml דינמי — כולל את כל המסעדות המאושרות והלא-דמו שהמנוי שלהן פעיל.
     * URL: /sitemap.xml
     */
    public function sitemap(Request $request): Response
    {
        $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://www.takeeat.co.il')), '/');

        $restaurants = Restaurant::withoutGlobalScope('tenant')
            ->where('is_approved', true)
            ->where(function ($q) {
                $q->where('is_demo', false)->orWhereNull('is_demo');
            })
            ->whereIn('subscription_status', ['active', 'trial'])
            ->whereNotNull('tenant_id')
            ->orderBy('id')
            ->get(['id', 'slug', 'tenant_id', 'updated_at']);

        $xml = new \XMLWriter();
        $xml->openMemory();
        $xml->startDocument('1.0', 'UTF-8');
        $xml->setIndent(true);
        $xml->startElement('urlset');
        $xml->writeAttribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');

        $staticUrls = [
            ['loc' => $frontendUrl . '/', 'priority' => '1.0', 'changefreq' => 'daily'],
            ['loc' => $frontendUrl . '/restaurants', 'priority' => '0.9', 'changefreq' => 'daily'],
            ['loc' => $frontendUrl . '/restaurants/new', 'priority' => '0.7', 'changefreq' => 'daily'],
            ['loc' => $frontendUrl . '/landing', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['loc' => $frontendUrl . '/about', 'priority' => '0.6', 'changefreq' => 'monthly'],
            ['loc' => $frontendUrl . '/register-restaurant', 'priority' => '0.7', 'changefreq' => 'weekly'],
        ];

        foreach ($staticUrls as $entry) {
            $xml->startElement('url');
            $xml->writeElement('loc', $entry['loc']);
            $xml->writeElement('changefreq', $entry['changefreq']);
            $xml->writeElement('priority', $entry['priority']);
            $xml->endElement();
        }

        foreach ($restaurants as $restaurant) {
            $slug = $restaurant->slug ?: $restaurant->tenant_id;
            if (!$slug) {
                continue;
            }

            $lastmod = optional($restaurant->updated_at)->toAtomString();

            // /r/{slug}
            $xml->startElement('url');
            $xml->writeElement('loc', $frontendUrl . '/r/' . rawurlencode($slug));
            if ($lastmod) {
                $xml->writeElement('lastmod', $lastmod);
            }
            $xml->writeElement('changefreq', 'daily');
            $xml->writeElement('priority', '0.9');
            $xml->endElement();

            // /{tenantId}/menu
            if ($restaurant->tenant_id) {
                $xml->startElement('url');
                $xml->writeElement('loc', $frontendUrl . '/' . rawurlencode($restaurant->tenant_id) . '/menu');
                if ($lastmod) {
                    $xml->writeElement('lastmod', $lastmod);
                }
                $xml->writeElement('changefreq', 'daily');
                $xml->writeElement('priority', '0.8');
                $xml->endElement();
            }
        }

        $xml->endElement();
        $xml->endDocument();

        return response($xml->outputMemory(), 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
            'X-Robots-Tag' => 'noindex',
        ]);
    }

    /**
     * robots.txt דינמי — מצביע על sitemap העדכני ומסנן דפים פרטיים.
     * URL: /robots.txt
     */
    public function robots(Request $request): Response
    {
        $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://www.takeeat.co.il')), '/');

        $lines = [
            'User-agent: *',
            'Allow: /',
            'Disallow: /admin',
            'Disallow: /dashboard',
            'Disallow: /login',
            'Disallow: /register',
            'Disallow: /register-restaurant/success',
            'Disallow: /checkout',
            'Disallow: /*/cart',
            'Disallow: /*/order-status',
            'Disallow: /*/order-status/*',
            'Disallow: /preview',
            'Disallow: /api/',
            '',
            'User-agent: facebookexternalhit',
            'Allow: /',
            '',
            'User-agent: Twitterbot',
            'Allow: /',
            '',
            'User-agent: WhatsApp',
            'Allow: /',
            '',
            'Sitemap: ' . $frontendUrl . '/sitemap.xml',
            '',
        ];

        return response(implode("\n", $lines), 200, [
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * האם המסעדה לא צריכה להיות אינדוקסת (דמו/לא מאושרת/מנוי לא פעיל)?
     */
    protected function isHiddenFromIndex(Restaurant $restaurant): bool
    {
        if (!$restaurant->is_approved) {
            return true;
        }

        if ($restaurant->is_demo) {
            return true;
        }

        return false;
    }

    protected function htmlResponse(string $html, int $status = 200): Response
    {
        return response($html, $status, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'public, max-age=600, s-maxage=600',
            'Vary' => 'Accept-Encoding',
        ]);
    }

    protected function notFound(): Response
    {
        $frontend = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://www.takeeat.co.il')), '/');
        $html = <<<HTML
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>לא נמצא | TakeEat</title>
<link rel="canonical" href="{$frontend}/" />
</head>
<body>
<div id="root"></div>
<script>location.replace('{$frontend}/');</script>
</body>
</html>
HTML;

        return response($html, 404, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'X-Robots-Tag' => 'noindex',
        ]);
    }
}
