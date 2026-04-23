<?php

namespace App\Console\Commands;

use App\Models\MonitoringAlert;
use App\Models\Restaurant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * seo:audit — מריץ PageSpeed Insights על טופ-N מסעדות ומתעד ציוני SEO/Performance.
 *
 * שימוש:
 *   php artisan seo:audit
 *   php artisan seo:audit --limit=30 --strategy=mobile --threshold=60
 *
 * דורש מפתח API: PAGESPEED_API_KEY ב-.env (מ-Google Cloud Console, Free tier זמין).
 */
class SeoAudit extends Command
{
    protected $signature = 'seo:audit
        {--limit=20 : כמה מסעדות לבדוק}
        {--strategy=mobile : mobile|desktop}
        {--threshold=50 : סף תחתון — מתחתיו נוצרת התראה}
        {--dry-run : הצג בלבד, בלי שליחה ל-PageSpeed ובלי התראות}';

    protected $description = 'בודק ביצועי SEO של דפי המסעדות עם PageSpeed Insights';

    private const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

    public function handle(): int
    {
        $limit = (int) $this->option('limit');
        $strategy = $this->option('strategy') === 'desktop' ? 'desktop' : 'mobile';
        $threshold = (int) $this->option('threshold');
        $dryRun = (bool) $this->option('dry-run');

        $frontend = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://www.takeeat.co.il')), '/');

        $restaurants = Restaurant::withoutGlobalScope('tenant')
            ->where('is_approved', true)
            ->where(function ($q) {
                $q->where('is_demo', false)->orWhereNull('is_demo');
            })
            ->whereIn('subscription_status', ['active', 'trial'])
            ->whereNotNull('tenant_id')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get(['id', 'tenant_id', 'slug', 'name']);

        if ($restaurants->isEmpty()) {
            $this->warn('לא נמצאו מסעדות מתאימות לבדיקת SEO.');
            return self::SUCCESS;
        }

        $apiKey = env('PAGESPEED_API_KEY');
        if (!$apiKey && !$dryRun) {
            $this->error('חסר PAGESPEED_API_KEY ב-.env. קבל מפתח מ-Google Cloud Console, או הרץ עם --dry-run.');
            return self::FAILURE;
        }

        $this->info(sprintf('בודק SEO עבור %d מסעדות (%s)...', $restaurants->count(), $strategy));

        $alerts = 0;
        foreach ($restaurants as $restaurant) {
            $slug = $restaurant->slug ?: $restaurant->tenant_id;
            $url = $frontend . '/r/' . rawurlencode($slug);

            if ($dryRun) {
                $this->line(sprintf('[DRY] %s — %s', $restaurant->name, $url));
                continue;
            }

            try {
                $response = Http::timeout(60)->get(self::PSI_ENDPOINT, [
                    'url' => $url,
                    'strategy' => $strategy,
                    'category' => ['performance', 'seo', 'accessibility', 'best-practices'],
                    'key' => $apiKey,
                ]);

                if (!$response->ok()) {
                    $this->error(sprintf('%s: HTTP %d', $restaurant->name, $response->status()));
                    continue;
                }

                $data = $response->json();
                $scores = $this->extractScores($data);

                $this->line(sprintf(
                    '%s — performance: %d, seo: %d, a11y: %d, best-practices: %d',
                    $restaurant->name,
                    $scores['performance'],
                    $scores['seo'],
                    $scores['accessibility'],
                    $scores['best_practices']
                ));

                $worst = min($scores['performance'], $scores['seo']);
                if ($worst < $threshold) {
                    $alerts++;
                    $this->recordAlert($restaurant, $url, $scores, $threshold, $strategy);
                }
            } catch (\Throwable $e) {
                Log::warning('seo:audit failed for restaurant', [
                    'restaurant_id' => $restaurant->id,
                    'url' => $url,
                    'error' => $e->getMessage(),
                ]);
                $this->error(sprintf('%s: %s', $restaurant->name, $e->getMessage()));
            }

            usleep(500_000);
        }

        $this->info(sprintf('הסתיים. %d התראות נוצרו.', $alerts));
        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{performance:int, seo:int, accessibility:int, best_practices:int}
     */
    protected function extractScores(array $data): array
    {
        $categories = data_get($data, 'lighthouseResult.categories', []);

        return [
            'performance'     => (int) round(((float) data_get($categories, 'performance.score', 0)) * 100),
            'seo'             => (int) round(((float) data_get($categories, 'seo.score', 0)) * 100),
            'accessibility'   => (int) round(((float) data_get($categories, 'accessibility.score', 0)) * 100),
            'best_practices'  => (int) round(((float) data_get($categories, 'best-practices.score', 0)) * 100),
        ];
    }

    /**
     * @param  array<string, int>  $scores
     */
    protected function recordAlert(Restaurant $restaurant, string $url, array $scores, int $threshold, string $strategy): void
    {
        MonitoringAlert::withoutGlobalScope('tenant')->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'alert_type' => 'seo_audit_low_score',
            'severity' => $scores['performance'] < ($threshold - 20) ? 'high' : 'medium',
            'title' => sprintf('ציון SEO/Performance נמוך — %s', $restaurant->name),
            'body' => sprintf(
                'URL: %s | performance=%d, seo=%d, a11y=%d, best-practices=%d (סף=%d, strategy=%s)',
                $url,
                $scores['performance'],
                $scores['seo'],
                $scores['accessibility'],
                $scores['best_practices'],
                $threshold,
                $strategy
            ),
            'metadata' => [
                'url' => $url,
                'scores' => $scores,
                'threshold' => $threshold,
                'strategy' => $strategy,
            ],
            'is_read' => false,
        ]);
    }
}
