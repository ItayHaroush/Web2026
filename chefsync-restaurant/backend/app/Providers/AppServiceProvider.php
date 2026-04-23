<?php

namespace App\Providers;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Observers\SeoCacheObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // ניקוי SEO cache בעדכון מסעדה/קטגוריה/פריט תפריט
        Restaurant::observe(SeoCacheObserver::class);
        Category::observe(SeoCacheObserver::class);
        MenuItem::observe(SeoCacheObserver::class);
    }
}
