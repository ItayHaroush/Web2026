<?php

namespace App\Observers;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Services\SeoRenderer;

/**
 * Observer אחיד שמנקה את ה-SEO cache של מסעדה ספציפית
 * בכל פעם שמשהו שמשפיע על תוכן ה-SEO שלה משתנה.
 */
class SeoCacheObserver
{
    public function saved($model): void
    {
        $this->forgetForModel($model);
    }

    public function deleted($model): void
    {
        $this->forgetForModel($model);
    }

    protected function forgetForModel($model): void
    {
        $restaurantId = null;

        if ($model instanceof Restaurant) {
            $restaurantId = $model->id;
        } elseif ($model instanceof MenuItem || $model instanceof Category) {
            $restaurantId = $model->restaurant_id;
        }

        if (!$restaurantId) {
            return;
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);
        if (!$restaurant) {
            return;
        }

        SeoRenderer::forgetRestaurant($restaurant);
    }
}
