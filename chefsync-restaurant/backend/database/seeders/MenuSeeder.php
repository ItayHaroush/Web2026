<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;
use App\Models\MenuItem;

class MenuSeeder extends Seeder
{
    public function run(): void
    {
        $restaurantId = 1; // Pizza Palace
        $tenantId = 'pizza-palace';

        // קטגוריות
        $categories = [
            ['name' => 'פיצות', 'icon' => '🍕', 'sort_order' => 1],
            ['name' => 'משקאות', 'icon' => '🥤', 'sort_order' => 2],
            ['name' => 'תוספות', 'icon' => '🧀', 'sort_order' => 3],
        ];

        foreach ($categories as $catData) {
            $category = Category::updateOrCreate(
                ['restaurant_id' => $restaurantId, 'name' => $catData['name']],
                [
                    'tenant_id' => $tenantId,
                    'icon' => $catData['icon'],
                    'sort_order' => $catData['sort_order'],
                    'is_active' => true,
                ]
            );

            // פריטים לפי קטגוריה
            if ($catData['name'] === 'פיצות') {
                MenuItem::updateOrCreate(
                    ['restaurant_id' => $restaurantId, 'name' => 'פיצה מרגריטה'],
                    [
                        'tenant_id' => $tenantId,
                        'category_id' => $category->id,
                        'description' => 'רוטב עגבניות, מוצרלה, בזיליקום',
                        'price' => 45.00,
                        'image_url' => 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400&h=300&fit=crop',
                        'is_available' => true,
                    ]
                );

                MenuItem::updateOrCreate(
                    ['restaurant_id' => $restaurantId, 'name' => 'פיצה ברנד'],
                    [
                        'tenant_id' => $tenantId,
                        'category_id' => $category->id,
                        'description' => 'רוטב עגבניות, מוצרלה, פלפלים, בצל, זיתים',
                        'price' => 52.00,
                        'image_url' => 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop',
                        'is_available' => true,
                    ]
                );
            } elseif ($catData['name'] === 'משקאות') {
                MenuItem::updateOrCreate(
                    ['restaurant_id' => $restaurantId, 'name' => 'קולה'],
                    [
                        'tenant_id' => $tenantId,
                        'category_id' => $category->id,
                        'description' => 'משקה קל 330 מ"ל',
                        'price' => 10.00,
                        'image_url' => 'https://images.unsplash.com/photo-1554866585-acbb2f46b34c?w=400&h=300&fit=crop',
                        'is_available' => true,
                    ]
                );

                MenuItem::updateOrCreate(
                    ['restaurant_id' => $restaurantId, 'name' => 'מים'],
                    [
                        'tenant_id' => $tenantId,
                        'category_id' => $category->id,
                        'description' => 'בקבוק מים 500 מ"ל',
                        'price' => 8.00,
                        'image_url' => 'https://images.unsplash.com/photo-1559056199-641a0ac8b3f7?w=400&h=300&fit=crop',
                        'is_available' => true,
                    ]
                );
            }
        }

        $this->command->info('Menu seeded successfully for Pizza Palace!');
    }
}
