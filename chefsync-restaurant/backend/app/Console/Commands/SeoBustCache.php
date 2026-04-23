<?php

namespace App\Console\Commands;

use App\Services\SeoRenderer;
use Illuminate\Console\Command;

/**
 * אחרי deploy לפרונט (Vite) — מנקה מטמון שלד + דפי SEO.
 */
class SeoBustCache extends Command
{
    protected $signature = 'seo:bust-cache {--all : אחר כך להריץ cache:clear מלא}';

    protected $description = 'מאפס מטמון SeoRenderer (שלד index + /r/ + menu + hub) — להריץ אחרי deploy ל-Vercel';

    public function handle(): int
    {
        SeoRenderer::bustAfterFrontendDeploy();
        $this->info('Seo cache busted: shell, share, menu, hub (בסיס).');

        if ($this->option('all')) {
            $this->call('cache:clear');
            $this->info('Application cache cleared.');
        } else {
            $this->comment('טיפ: אם יש hub /restaurants?city=— הרץ: php artisan seo:bust-cache --all');
        }

        return self::SUCCESS;
    }
}
