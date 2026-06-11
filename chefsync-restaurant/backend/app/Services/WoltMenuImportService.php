<?php

namespace App\Services;

use App\Models\Category;
use App\Models\City;
use App\Models\DeliveryZone;
use App\Models\MenuItemAddon;
use App\Models\MenuItemAddonGroup;
use App\Models\MenuItem;
use App\Models\RestaurantAddon;
use App\Models\RestaurantAddonGroup;
use App\Models\Restaurant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class WoltMenuImportService
{
    public function previewFromUrl(string $woltUrl): array
    {
        $slug = $this->extractSlug($woltUrl);
        $payload = $this->fetchMenuData($slug, $woltUrl);
        $mapped = $this->mapMenu($payload);

        if (empty($mapped['categories'])) {
            throw new \RuntimeException('לא נמצאו קטגוריות תקינות בתפריט וולט');
        }

        return [
            'slug' => $slug,
            'restaurant_meta' => $mapped['restaurant_meta'] ?? [],
            'categories' => $mapped['categories'],
            'summary' => [
                'categories_count' => count($mapped['categories']),
                'items_count' => collect($mapped['categories'])->sum(fn ($cat) => count($cat['items'] ?? [])),
                'addon_groups_count' => collect($mapped['categories'])->sum(function ($cat) {
                    return collect($cat['items'] ?? [])->sum(fn ($item) => count($item['option_groups'] ?? []));
                }),
            ],
        ];
    }

    public function importFromEditedCategoriesForRestaurant(Restaurant $restaurant, array $categories, array $restaurantMeta = []): array
    {
        $normalizedCategories = $this->normalizeCategoriesInput($categories);

        if (empty($normalizedCategories)) {
            throw new \RuntimeException('לא נמצאו קטגוריות תקינות לייבוא');
        }

        $normalizedRestaurantMeta = $this->normalizeRestaurantMetaInput($restaurantMeta);

        return $this->persistMenu($restaurant, $normalizedCategories, $normalizedRestaurantMeta);
    }

    /**
     * נירמול טיוטת ייבוא (קטגוריות + מטא) שהגיעה מהלקוח — בלי כתיבה ל-DB.
     * משמש לשמירת בקשת ייבוא ממתינה לאישור סופר-אדמין.
     */
    public function normalizeDraft(array $categories, array $restaurantMeta = []): array
    {
        return [
            'categories' => $this->normalizeCategoriesInput($categories),
            'restaurant_meta' => $this->normalizeRestaurantMetaInput($restaurantMeta),
        ];
    }

    public function importFromUrlForRestaurant(Restaurant $restaurant, string $woltUrl): array
    {
        $slug = $this->extractSlug($woltUrl);
        $payload = $this->fetchMenuData($slug, $woltUrl);
        $mapped = $this->mapMenu($payload);

        if (empty($mapped['categories'])) {
            throw new \RuntimeException('לא נמצאו קטגוריות תקינות בתפריט וולט');
        }

        $result = $this->persistMenu(
            $restaurant,
            $mapped['categories'],
            $this->normalizeRestaurantMetaInput($mapped['restaurant_meta'] ?? [])
        );
        $result['slug'] = $slug;

        return $result;
    }

    public function extractSlug(string $urlOrSlug): string
    {
        $value = trim($urlOrSlug);
        if ($value === '') {
            throw new \InvalidArgumentException('חסר לינק וולט');
        }

        if (preg_match('#^https?://#i', $value) === 1) {
            $path = (string) parse_url($value, PHP_URL_PATH);
            $path = trim($path, '/');
            if ($path === '') {
                throw new \InvalidArgumentException('לינק וולט לא תקין');
            }

            $segments = array_values(array_filter(explode('/', $path)));
            $restaurantIndex = array_search('restaurant', $segments, true);

            if ($restaurantIndex !== false && isset($segments[$restaurantIndex + 1])) {
                return $this->sanitizeSlug($segments[$restaurantIndex + 1]);
            }

            return $this->sanitizeSlug(end($segments) ?: '');
        }

        return $this->sanitizeSlug($value);
    }

    private function sanitizeSlug(string $slug): string
    {
        $slug = trim($slug);
        $slug = preg_replace('/[?#].*$/', '', $slug) ?? $slug;

        if ($slug === '' || !preg_match('/^[a-z0-9-]+$/i', $slug)) {
            throw new \InvalidArgumentException('לא ניתן לחלץ slug תקין מלינק וולט');
        }

        return strtolower($slug);
    }

    private function fetchMenuData(string $slug, ?string $woltUrl = null): array
    {
        $url = "https://restaurant-api.wolt.com/v4/venues/slug/{$slug}/menu/data";

        $response = Http::timeout(20)
            ->retry(2, 300)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept-Language' => 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            ])
            ->acceptJson()
            ->get($url);

        if (!$response->ok()) {
            throw new \RuntimeException('משיכת תפריט מוולט נכשלה');
        }

        $json = $response->json();
        if (is_array($json)) {
            return $json;
        }

        $body = trim((string) $response->body());
        if ($body === '') {
            $fallback = $this->fetchMenuFromVenuePageHydration($slug, $woltUrl);
            if (!empty($fallback)) {
                return $fallback;
            }

            throw new \RuntimeException('תגובה ריקה מוולט');
        }

        $decoded = json_decode($body, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }

        throw new \RuntimeException('תגובה לא תקינה מוולט');
    }

    private function fetchMenuFromVenuePageHydration(string $slug, ?string $woltUrl = null): array
    {
        $pageUrl = $this->resolveVenuePageUrl($slug, $woltUrl);

        $response = Http::timeout(20)
            ->retry(2, 300)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept-Language' => 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            ])
            ->get($pageUrl);

        if (! $response->ok()) {
            return [];
        }

        $html = (string) $response->body();
        if ($html === '') {
            return [];
        }

        $queryStateJson = $this->extractQueryStateJson($html);
        if (!is_string($queryStateJson) || $queryStateJson === '') {
            return [];
        }

        $dehydrated = json_decode(trim($queryStateJson), true);
        if (!is_array($dehydrated)) {
            return [];
        }

        $queries = $dehydrated['queries'] ?? [];
        if (!is_array($queries)) {
            return [];
        }

        $hydrationRestaurantMeta = $this->extractRestaurantMetaFromHydrationQueries($queries);

        foreach ($queries as $query) {
            if (!is_array($query)) {
                continue;
            }

            $queryKey = $query['queryKey'] ?? null;
            if (!is_array($queryKey)) {
                continue;
            }

            $firstKey = (string) ($queryKey[0] ?? '');
            $isVenueAssortment = $firstKey === 'venue-assortment';
            $isVenueMenu = str_contains($firstKey, 'venue') && str_contains($firstKey, 'menu');

            if (! $isVenueAssortment && ! $isVenueMenu) {
                continue;
            }

            $stateData = $query['state']['data'] ?? null;
            if (is_array($stateData) && !empty($stateData)) {
                if (!empty($hydrationRestaurantMeta)) {
                    $stateData['__restaurant_meta'] = $hydrationRestaurantMeta;
                }

                return $stateData;
            }
        }

        return [];
    }

    private function extractQueryStateJson(string $html): ?string
    {
        $classPos = stripos($html, 'query-state');
        if ($classPos === false) {
            return null;
        }

        $scriptOpenPos = strripos(substr($html, 0, $classPos), '<script');
        if ($scriptOpenPos === false) {
            return null;
        }

        $tagEndPos = strpos($html, '>', $scriptOpenPos);
        if ($tagEndPos === false) {
            return null;
        }

        $scriptClosePos = stripos($html, '</script>', $tagEndPos);
        if ($scriptClosePos === false || $scriptClosePos <= $tagEndPos) {
            return null;
        }

        return substr($html, $tagEndPos + 1, $scriptClosePos - $tagEndPos - 1);
    }

    private function resolveVenuePageUrl(string $slug, ?string $woltUrl = null): string
    {
        if (is_string($woltUrl) && preg_match('#^https?://#i', trim($woltUrl)) === 1) {
            $parts = parse_url(trim($woltUrl));
            $host = $parts['host'] ?? 'wolt.com';
            $path = trim((string) ($parts['path'] ?? ''), '/');

            if ($path !== '') {
                return 'https://' . $host . '/' . $path;
            }
        }

        return "https://wolt.com/he/isr/restaurant/{$slug}";
    }

    private function mapMenu(array $payload): array
    {
        $restaurantMeta = $this->extractRestaurantMeta($payload);

        $optionsById = [];
        foreach (($payload['options'] ?? []) as $optionGroup) {
            if (!is_array($optionGroup)) {
                continue;
            }
            $optionId = (string) ($optionGroup['id'] ?? '');
            if ($optionId !== '') {
                $optionsById[$optionId] = $optionGroup;
            }
        }

        if ($this->looksLikeNormalizedCategoryListing($payload)) {
            $mapped = $this->mapNormalizedCategoryListing($payload);
            $mapped['restaurant_meta'] = $restaurantMeta;

            return $mapped;
        }

        $categories = [];
        $this->collectCategories($payload, $categories);

        // Normalize and merge categories with same name.
        $merged = [];
        foreach ($categories as $category) {
            $name = trim((string) ($category['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $key = mb_strtolower($name);
            if (!isset($merged[$key])) {
                $merged[$key] = [
                    'name' => $name,
                    'items' => [],
                ];
            }

            foreach (($category['items'] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $itemName = trim((string) ($item['name'] ?? ''));
                $itemPrice = $item['price'] ?? null;
                if ($itemName === '' || $itemPrice === null) {
                    continue;
                }

                $merged[$key]['items'][] = [
                    'wolt_external_id' => (string) ($item['id'] ?? ''),
                    'name' => $itemName,
                    'description' => $item['description'] ?? null,
                    'price' => $this->normalizePrice($itemPrice),
                    'image_url' => $this->extractImageUrl($item),
                    'option_groups' => $this->mapItemOptionGroups($item, $optionsById),
                ];
            }
        }

        // Remove empty categories and duplicate items by name + price.
        $final = [];
        foreach ($merged as $category) {
            $seen = [];
            $items = [];
            foreach ($category['items'] as $item) {
                $dedupKey = mb_strtolower($item['name']) . '|' . number_format((float) $item['price'], 2, '.', '');
                if (isset($seen[$dedupKey])) {
                    continue;
                }
                $seen[$dedupKey] = true;
                $items[] = $item;
            }

            if (!empty($items)) {
                $final[] = [
                    'name' => $category['name'],
                    'items' => $items,
                ];
            }
        }

        return [
            'categories' => $final,
            'restaurant_meta' => $restaurantMeta,
        ];
    }

    private function looksLikeNormalizedCategoryListing(array $payload): bool
    {
        return isset($payload['categories'], $payload['items'])
            && is_array($payload['categories'])
            && is_array($payload['items']);
    }

    private function mapNormalizedCategoryListing(array $payload): array
    {
        $itemsById = [];
        foreach (($payload['items'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $id = (string) ($item['id'] ?? '');
            if ($id !== '') {
                $itemsById[$id] = $item;
            }
        }

        $optionsById = [];
        foreach (($payload['options'] ?? []) as $optionGroup) {
            if (!is_array($optionGroup)) {
                continue;
            }
            $optionId = (string) ($optionGroup['id'] ?? '');
            if ($optionId !== '') {
                $optionsById[$optionId] = $optionGroup;
            }
        }

        $final = [];
        foreach (($payload['categories'] ?? []) as $category) {
            if (!is_array($category)) {
                continue;
            }

            $categoryName = trim((string) ($category['name'] ?? ''));
            if ($categoryName === '') {
                continue;
            }

            $items = [];
            foreach (($category['item_ids'] ?? []) as $itemId) {
                $id = (string) $itemId;
                if ($id === '' || !isset($itemsById[$id])) {
                    continue;
                }

                $item = $itemsById[$id];
                $itemName = trim((string) ($item['name'] ?? ''));
                $itemPrice = $item['price'] ?? null;
                if ($itemName === '' || !is_numeric($itemPrice)) {
                    continue;
                }

                $items[] = [
                    'wolt_external_id' => (string) ($item['id'] ?? ''),
                    'name' => $itemName,
                    'description' => $item['description'] ?? null,
                    'price' => $this->normalizePrice($itemPrice),
                    'image_url' => $this->extractImageUrl($item),
                    'option_groups' => $this->mapItemOptionGroups($item, $optionsById),
                ];
            }

            if (!empty($items)) {
                $final[] = [
                    'name' => $categoryName,
                    'items' => $items,
                ];
            }
        }

        return ['categories' => $final];
    }

    private function mapItemOptionGroups(array $item, array $optionsById): array
    {
        $optionRefs = $item['options'] ?? [];
        if (!is_array($optionRefs) || empty($optionRefs)) {
            return [];
        }

        $groups = [];
        foreach ($optionRefs as $index => $optionRef) {
            if (!is_array($optionRef)) {
                continue;
            }

            $optionGroupId = (string) ($optionRef['option_id'] ?? $optionRef['id'] ?? '');
            $template = $optionsById[$optionGroupId] ?? null;
            if (!is_array($template)) {
                // Fallback by name when ID mapping differs between reference and options payload.
                $refName = trim((string) ($optionRef['name'] ?? ''));
                if ($refName !== '') {
                    foreach ($optionsById as $candidate) {
                        if (trim((string) ($candidate['name'] ?? '')) === $refName) {
                            $template = $candidate;
                            $optionGroupId = (string) ($candidate['id'] ?? $optionGroupId);
                            break;
                        }
                    }
                }
            }

            $groupName = trim((string) ($optionRef['name'] ?? ($template['name'] ?? '')));
            if ($groupName === '') {
                continue;
            }

            $range = $optionRef['multi_choice_config']['total_range']
                ?? $template['multi_choice_config']['total_range']
                ?? [];

            $minSelections = isset($range['min']) && is_numeric($range['min']) ? max(0, (int) $range['min']) : 0;
            $maxSelections = isset($range['max']) && is_numeric($range['max']) ? max(0, (int) $range['max']) : null;
            if ($maxSelections === 0) {
                $maxSelections = null;
            }

            $values = $template['values'] ?? $optionRef['values'] ?? [];
            if (!is_array($values)) {
                $values = [];
            }

            $defaultValueId = (string) ($template['default_value'] ?? $optionRef['default_value'] ?? '');
            $addons = [];
            foreach ($values as $valueIndex => $value) {
                if (!is_array($value)) {
                    continue;
                }

                $addonName = trim((string) ($value['name'] ?? ''));
                if ($addonName === '') {
                    continue;
                }

                $addonPriceRaw = $value['price'] ?? 0;
                $addonPrice = is_numeric($addonPriceRaw)
                    ? $this->normalizePrice($addonPriceRaw)
                    : 0;

                $addonId = (string) ($value['id'] ?? '');
                $addons[] = [
                    'wolt_option_id' => $addonId !== '' ? $addonId : null,
                    'name' => $addonName,
                    'price_delta' => $addonPrice,
                    'is_default' => $defaultValueId !== '' && $addonId === $defaultValueId,
                    'sort_order' => $valueIndex,
                ];
            }

            if (empty($addons)) {
                continue;
            }

            $groups[] = [
                'wolt_option_group_id' => $optionGroupId !== '' ? $optionGroupId : null,
                'name' => $groupName,
                'selection_type' => $maxSelections !== null && $maxSelections <= 1 ? 'single' : 'multiple',
                'min_selections' => $minSelections,
                'max_selections' => $maxSelections,
                'is_required' => $minSelections > 0,
                'sort_order' => $index,
                'addons' => $addons,
            ];
        }

        return $groups;
    }

    private function collectCategories(mixed $node, array &$out): void
    {
        if (is_array($node)) {
            if ($this->isAssociative($node)) {
                $categoryName = $this->pickName($node);
                $itemsArray = $this->pickItemsArray($node);

                if ($categoryName !== null && is_array($itemsArray)) {
                    $items = [];
                    foreach ($itemsArray as $rawItem) {
                        if (!is_array($rawItem)) {
                            continue;
                        }

                        $name = $this->pickName($rawItem);
                        $price = $this->pickPrice($rawItem);
                        if ($name === null || $price === null) {
                            continue;
                        }

                        $items[] = [
                            'name' => $name,
                            'description' => $this->pickDescription($rawItem),
                            'price' => $price,
                            'image_url' => $this->extractImageUrl($rawItem),
                        ];
                    }

                    if (!empty($items)) {
                        $out[] = [
                            'name' => $categoryName,
                            'items' => $items,
                        ];
                    }
                }

                foreach ($node as $value) {
                    if (is_array($value)) {
                        $this->collectCategories($value, $out);
                    }
                }

                return;
            }

            foreach ($node as $value) {
                if (is_array($value)) {
                    $this->collectCategories($value, $out);
                }
            }
        }
    }

    private function pickItemsArray(array $node): ?array
    {
        foreach (['items', 'menu_items', 'children', 'subsections', 'entries'] as $key) {
            if (isset($node[$key]) && is_array($node[$key])) {
                return $node[$key];
            }
        }

        return null;
    }

    private function pickName(array $node): ?string
    {
        foreach (['name', 'title', 'display_name'] as $key) {
            if (isset($node[$key]) && is_string($node[$key])) {
                $value = trim($node[$key]);
                if ($value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    private function pickDescription(array $node): ?string
    {
        foreach (['description', 'subtitle', 'details'] as $key) {
            if (isset($node[$key]) && is_string($node[$key])) {
                $value = trim($node[$key]);
                if ($value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    private function pickPrice(array $node): int|float|null
    {
        foreach (['price', 'baseprice', 'base_price', 'amount', 'final_price'] as $key) {
            if (!array_key_exists($key, $node)) {
                continue;
            }

            $value = $node[$key];
            if (is_numeric($value)) {
                return $value + 0;
            }

            if (is_array($value) && isset($value['amount']) && is_numeric($value['amount'])) {
                return $value['amount'] + 0;
            }
        }

        return null;
    }

    private function extractImageUrl(array $node): ?string
    {
        if (isset($node['images']) && is_array($node['images']) && !empty($node['images'])) {
            foreach ($node['images'] as $image) {
                if (is_array($image) && isset($image['url']) && is_string($image['url']) && trim($image['url']) !== '') {
                    return trim($image['url']);
                }
            }
        }

        foreach (['image_url', 'image', 'photo', 'thumbnail'] as $key) {
            if (!isset($node[$key])) {
                continue;
            }

            $value = $node[$key];
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }

            if (is_array($value)) {
                foreach (['url', 'src'] as $nestedKey) {
                    if (isset($value[$nestedKey]) && is_string($value[$nestedKey]) && trim($value[$nestedKey]) !== '') {
                        return trim($value[$nestedKey]);
                    }
                }
            }
        }

        return null;
    }

    private function normalizePrice(int|float|string $raw): float
    {
        $value = (float) $raw;

        // Wolt בדרך כלל מחזיר מחיר באגורות.
        if ((float) ((int) $value) === $value && $value >= 100) {
            return round($value / 100, 2);
        }

        return round($value, 2);
    }

    private function normalizeCategoriesInput(array $categories): array
    {
        $result = [];

        foreach ($categories as $category) {
            if (!is_array($category)) {
                continue;
            }

            $categoryName = trim((string) ($category['name'] ?? ''));
            if ($categoryName === '') {
                continue;
            }

            $normalizedItems = [];
            foreach (($category['items'] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $name = trim((string) ($item['name'] ?? ''));
                $rawPrice = $item['price'] ?? null;
                if ($name === '' || !is_numeric($rawPrice)) {
                    continue;
                }

                $price = round((float) $rawPrice, 2);
                if ($price < 0) {
                    continue;
                }

                $description = trim((string) ($item['description'] ?? ''));
                $imageUrl = trim((string) ($item['image_url'] ?? ''));

                $normalizedItems[] = [
                    'wolt_external_id' => trim((string) ($item['wolt_external_id'] ?? '')) ?: null,
                    'name' => $name,
                    'description' => $description !== '' ? $description : null,
                    'price' => $price,
                    'image_url' => $imageUrl !== '' ? $imageUrl : null,
                    'option_groups' => $this->normalizeOptionGroupsInput($item['option_groups'] ?? []),
                ];
            }

            if (!empty($normalizedItems)) {
                $result[] = [
                    'name' => $categoryName,
                    'items' => $normalizedItems,
                ];
            }
        }

        return $result;
    }

    private function normalizeOptionGroupsInput(mixed $optionGroups): array
    {
        if (!is_array($optionGroups)) {
            return [];
        }

        $groups = [];
        foreach ($optionGroups as $groupIndex => $group) {
            if (!is_array($group)) {
                continue;
            }

            $groupName = trim((string) ($group['name'] ?? ''));
            if ($groupName === '') {
                continue;
            }

            $addons = [];
            foreach (($group['addons'] ?? []) as $addonIndex => $addon) {
                if (!is_array($addon)) {
                    continue;
                }

                $addonName = trim((string) ($addon['name'] ?? ''));
                if ($addonName === '') {
                    continue;
                }

                $priceRaw = $addon['price_delta'] ?? 0;
                $priceDelta = is_numeric($priceRaw) ? round((float) $priceRaw, 2) : 0;

                $addons[] = [
                    'wolt_option_id' => trim((string) ($addon['wolt_option_id'] ?? '')) ?: null,
                    'name' => $addonName,
                    'price_delta' => $priceDelta,
                    'is_default' => (bool) ($addon['is_default'] ?? false),
                    'sort_order' => isset($addon['sort_order']) && is_numeric($addon['sort_order']) ? (int) $addon['sort_order'] : $addonIndex,
                ];
            }

            if (empty($addons)) {
                continue;
            }

            $maxSelections = null;
            if (array_key_exists('max_selections', $group) && $group['max_selections'] !== null && $group['max_selections'] !== '') {
                if (is_numeric($group['max_selections'])) {
                    $parsedMax = (int) $group['max_selections'];
                    $maxSelections = $parsedMax > 0 ? $parsedMax : null;
                }
            }

            $minSelections = isset($group['min_selections']) && is_numeric($group['min_selections'])
                ? max(0, (int) $group['min_selections'])
                : 0;

            $selectionType = $group['selection_type'] ?? null;
            if (!in_array($selectionType, ['single', 'multiple'], true)) {
                $selectionType = $maxSelections !== null && $maxSelections <= 1 ? 'single' : 'multiple';
            }

            $groups[] = [
                'wolt_option_group_id' => trim((string) ($group['wolt_option_group_id'] ?? '')) ?: null,
                'name' => $groupName,
                'selection_type' => $selectionType,
                'min_selections' => $minSelections,
                'max_selections' => $maxSelections,
                'is_required' => (bool) ($group['is_required'] ?? ($minSelections > 0)),
                'sort_order' => isset($group['sort_order']) && is_numeric($group['sort_order']) ? (int) $group['sort_order'] : $groupIndex,
                'addons' => $addons,
            ];
        }

        return $groups;
    }

    private function normalizeRestaurantMetaInput(mixed $restaurantMeta): array
    {
        if (!is_array($restaurantMeta)) {
            return [];
        }

        $name = trim((string) ($restaurantMeta['name'] ?? ''));
        $heroImageUrl = trim((string) ($restaurantMeta['hero_image_url'] ?? ''));
        $logoUrl = trim((string) ($restaurantMeta['logo_url'] ?? ''));
        $phone = trim((string) ($restaurantMeta['phone'] ?? ''));
        $email = trim((string) ($restaurantMeta['email'] ?? ''));
        $address = trim((string) ($restaurantMeta['address'] ?? ''));
        $city = trim((string) ($restaurantMeta['city'] ?? ''));
        $description = trim((string) ($restaurantMeta['description'] ?? ''));
        $kosherType = trim((string) ($restaurantMeta['kosher_type'] ?? ''));
        $kashrutText = trim((string) ($restaurantMeta['kashrut_text'] ?? ''));
        $kosherNotes = trim((string) ($restaurantMeta['kosher_notes'] ?? ''));
        $kashrutLevel = trim((string) ($restaurantMeta['kashrut_level'] ?? ''));

        $operatingDays = is_array($restaurantMeta['operating_days'] ?? null)
            ? ($restaurantMeta['operating_days'] ?? [])
            : [];
        $operatingHours = is_array($restaurantMeta['operating_hours'] ?? null)
            ? ($restaurantMeta['operating_hours'] ?? [])
            : [];

        $deliveryZones = [];
        if (is_array($restaurantMeta['delivery_zones'] ?? null)) {
            foreach ($restaurantMeta['delivery_zones'] as $zone) {
                if (!is_array($zone)) {
                    continue;
                }

                $zoneName = trim((string) ($zone['name'] ?? ''));
                if ($zoneName === '') {
                    continue;
                }

                $deliveryZones[] = [
                    'name' => $zoneName,
                    'fee' => isset($zone['fee']) && is_numeric($zone['fee']) ? round((float) $zone['fee'], 2) : null,
                    'min_order' => isset($zone['min_order']) && is_numeric($zone['min_order']) ? round((float) $zone['min_order'], 2) : null,
                    'max_distance_km' => isset($zone['max_distance_km']) && is_numeric($zone['max_distance_km']) ? round((float) $zone['max_distance_km'], 2) : null,
                    'raw' => is_array($zone['raw'] ?? null) ? $zone['raw'] : null,
                ];
            }
        }

        return array_filter([
            'name' => $name !== '' ? $name : null,
            'hero_image_url' => $heroImageUrl !== '' ? $heroImageUrl : null,
            'logo_url' => $logoUrl !== '' ? $logoUrl : null,
            'phone' => $phone !== '' ? $phone : null,
            'email' => $email !== '' ? $email : null,
            'address' => $address !== '' ? $address : null,
            'city' => $city !== '' ? $city : null,
            'description' => $description !== '' ? $description : null,
            'kosher_type' => $kosherType !== '' ? $kosherType : null,
            'kashrut_text' => $kashrutText !== '' ? $kashrutText : null,
            'kosher_notes' => $kosherNotes !== '' ? $kosherNotes : null,
            'kashrut_level' => $kashrutLevel !== '' ? $kashrutLevel : null,
            'operating_days' => !empty($operatingDays) ? $operatingDays : null,
            'operating_hours' => !empty($operatingHours) ? $operatingHours : null,
            'delivery_zones' => !empty($deliveryZones) ? $deliveryZones : null,
        ], fn ($value) => $value !== null);
    }

    private function extractRestaurantMeta(array $payload): array
    {
        $prefilledMeta = is_array($payload['__restaurant_meta'] ?? null) ? $payload['__restaurant_meta'] : [];

        $venueNodes = $this->collectVenueCandidates($payload);
        $allNodes = array_merge([$payload], $venueNodes);

        // שם המסעדה — רק מצמתי venue (לא מכל ה-payload, כדי לא לתפוס שם של קטגוריה/מוצר)
        $venueName = $this->pickVenueName($venueNodes);

        // וולט בדרך כלל מחזירה תמונת הירו/באנר של המסעדה — לא לוגו.
        $heroImageUrl = $this->pickFirstHeroImageUrlFromNodes($allNodes);
        $logoUrl = $this->pickFirstLogoUrlFromNodes($allNodes);
        $phone = $this->pickFirstStringByKeysFromNodes($allNodes, [
            'phone', 'phone_number', 'phoneNumber', 'contact_phone', 'mobile_phone',
        ]);
        if ($phone !== null) {
            $phone = PhoneValidationService::formatIsraeliForDisplay($phone);
        }
        $email = $this->pickFirstStringByKeysFromNodes($allNodes, [
            'email', 'contact_email', 'support_email',
        ]);
        $address = $this->pickFirstStringByKeysFromNodes($allNodes, [
            'address', 'street_address', 'streetAddress', 'location_text',
        ]);
        $city = $this->pickFirstStringByKeysFromNodes($allNodes, [
            'city', 'city_name', 'cityName',
        ]);
        $description = $this->pickFirstStringByKeysFromNodes($allNodes, [
            'description', 'short_description', 'subtitle',
        ]);
        $kosherBadge = $this->pickFirstStringByKeysFromNodes($allNodes, [
            'kosher', 'kashrut', 'kosher_type', 'dietary_info', 'dietary_label', 'dietary_labels',
        ]);
        $kashrutText = $this->pickFirstStringByKeysFromNodes($allNodes, [
            'kashrut_text', 'kosher_text', 'kosher_notes', 'certification', 'certifications',
        ]);

        $hoursSource = $this->pickFirstArrayByKeysFromNodes($allNodes, [
            'opening_times', 'opening_hours', 'openinghours', 'openingTimes', 'openingHours', 'hours', 'business_hours',
        ]);
        $operating = $this->normalizeOperatingSchedule($hoursSource);

        if (empty($operating['days']) && empty($operating['hours'])) {
            $weeklyHours = $this->pickFirstArrayByKeysFromNodes($allNodes, [
                'weekly_schedule', 'weekly_hours', 'schedule', 'businessHours',
            ]);
            $operating = $this->normalizeOperatingSchedule($weeklyHours);
        }

        $deliverySource = $this->pickFirstArrayByKeysFromNodes($allNodes, [
            'delivery_areas', 'delivery_zones', 'delivery_specs', 'delivery_info',
        ]);
        $deliveryZones = $this->normalizeDeliveryZones($deliverySource);

        $detectedMeta = array_filter([
            'name' => $venueName,
            'hero_image_url' => $heroImageUrl,
            'logo_url' => $logoUrl,
            'phone' => $phone,
            'email' => $email,
            'address' => $address,
            'city' => $city,
            'description' => $description,
            'kosher_type' => $kosherBadge,
            'kashrut_text' => $kashrutText,
            'operating_days' => !empty($operating['days']) ? $operating['days'] : null,
            'operating_hours' => !empty($operating['hours']) ? $operating['hours'] : null,
            'delivery_zones' => !empty($deliveryZones) ? $deliveryZones : null,
        ], fn ($value) => $value !== null && $value !== '');

        return $this->mergeRestaurantMeta($prefilledMeta, $detectedMeta);
    }

    private function extractRestaurantMetaFromHydrationQueries(array $queries): array
    {
        $merged = [];

        foreach ($queries as $query) {
            if (!is_array($query)) {
                continue;
            }

            $stateData = $query['state']['data'] ?? null;
            if (!is_array($stateData) || empty($stateData)) {
                continue;
            }

            $meta = $this->extractRestaurantMeta($stateData);
            if (empty($meta)) {
                continue;
            }

            $merged = $this->mergeRestaurantMeta($merged, $meta);
        }

        return $merged;
    }

    private function mergeRestaurantMeta(array $base, array $incoming): array
    {
        $result = $base;

        foreach (['name', 'hero_image_url', 'logo_url', 'phone', 'email', 'address', 'city', 'description', 'kosher_type', 'kashrut_text', 'kosher_notes', 'kashrut_level'] as $field) {
            $current = isset($result[$field]) && is_string($result[$field]) ? trim($result[$field]) : '';
            $next = isset($incoming[$field]) && is_string($incoming[$field]) ? trim($incoming[$field]) : '';

            if ($current === '' && $next !== '') {
                $result[$field] = $next;
            }
        }

        if (empty($result['operating_days']) && !empty($incoming['operating_days']) && is_array($incoming['operating_days'])) {
            $result['operating_days'] = $incoming['operating_days'];
        }

        if (empty($result['operating_hours']) && !empty($incoming['operating_hours']) && is_array($incoming['operating_hours'])) {
            $result['operating_hours'] = $incoming['operating_hours'];
        }

        $baseZones = isset($result['delivery_zones']) && is_array($result['delivery_zones'])
            ? $result['delivery_zones']
            : [];
        $incomingZones = isset($incoming['delivery_zones']) && is_array($incoming['delivery_zones'])
            ? $incoming['delivery_zones']
            : [];

        if (!empty($incomingZones)) {
            $indexed = [];
            foreach ($baseZones as $zone) {
                if (!is_array($zone)) {
                    continue;
                }
                $name = trim((string) ($zone['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                $indexed[mb_strtolower($name)] = $zone;
            }

            foreach ($incomingZones as $zone) {
                if (!is_array($zone)) {
                    continue;
                }
                $name = trim((string) ($zone['name'] ?? ''));
                if ($name === '') {
                    continue;
                }

                $key = mb_strtolower($name);
                if (!isset($indexed[$key])) {
                    $indexed[$key] = $zone;
                }
            }

            $result['delivery_zones'] = array_values($indexed);
        }

        return array_filter($result, fn ($value) => $value !== null && $value !== '' && $value !== []);
    }

    /**
     * שם המסעדה מצומת venue — תומך גם בפורמט תרגומים של וולט ([{lang, value}]).
     */
    private function pickVenueName(array $venueNodes): ?string
    {
        foreach ($venueNodes as $node) {
            if (!is_array($node)) {
                continue;
            }

            $value = $node['name'] ?? null;

            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }

            if (is_array($value)) {
                foreach ($value as $entry) {
                    if (is_array($entry) && isset($entry['value']) && is_string($entry['value']) && trim($entry['value']) !== '') {
                        return trim($entry['value']);
                    }
                }
            }
        }

        return null;
    }

    private function collectVenueCandidates(array $payload): array
    {
        $candidates = [];

        foreach (['venue', 'merchant', 'restaurant', 'venue_info', 'venue_static_data', 'metadata'] as $key) {
            if (isset($payload[$key]) && is_array($payload[$key])) {
                $candidates[] = $payload[$key];
            }
        }

        return $candidates;
    }

    private function pickFirstStringByKeysFromNodes(array $nodes, array $keys): ?string
    {
        foreach ($nodes as $node) {
            if (!is_array($node)) {
                continue;
            }

            $value = $this->findFirstByKeysRecursive($node, $keys);
            if (is_string($value)) {
                $trimmed = trim($value);
                if ($trimmed !== '') {
                    return $trimmed;
                }
            }
        }

        return null;
    }

    private function pickFirstArrayByKeysFromNodes(array $nodes, array $keys): ?array
    {
        foreach ($nodes as $node) {
            if (!is_array($node)) {
                continue;
            }

            $value = $this->findFirstByKeysRecursive($node, $keys);
            if (is_array($value) && !empty($value)) {
                return $value;
            }
        }

        return null;
    }

    private function pickFirstHeroImageUrlFromNodes(array $nodes): ?string
    {
        foreach ($nodes as $node) {
            if (!is_array($node)) {
                continue;
            }

            $image = $this->extractImageUrl($node);
            if (is_string($image) && trim($image) !== '') {
                return trim($image);
            }
        }

        return null;
    }

    private function pickFirstLogoUrlFromNodes(array $nodes): ?string
    {
        foreach ($nodes as $node) {
            if (!is_array($node)) {
                continue;
            }

            $logo = $this->findFirstByKeysRecursive($node, ['logo', 'logo_url', 'logoUrl', 'logo_image', 'logoImage', 'brand_image', 'brandImage']);
            if (is_string($logo) && trim($logo) !== '') {
                return trim($logo);
            }

            if (is_array($logo)) {
                $nested = $this->extractImageUrl($logo);
                if (is_string($nested) && trim($nested) !== '') {
                    return trim($nested);
                }
            }
        }

        return null;
    }

    private function findFirstByKeysRecursive(mixed $node, array $keys): mixed
    {
        if (!is_array($node)) {
            return null;
        }

        $normalizedLookup = [];
        foreach ($keys as $key) {
            $normalizedLookup[$this->normalizeLookupKey((string) $key)] = true;
        }

        foreach ($node as $nodeKey => $nodeValue) {
            if (!is_string($nodeKey)) {
                continue;
            }

            $normalizedNodeKey = $this->normalizeLookupKey($nodeKey);
            if (isset($normalizedLookup[$normalizedNodeKey])) {
                return $nodeValue;
            }
        }

        foreach ($node as $value) {
            if (!is_array($value)) {
                continue;
            }

            $found = $this->findFirstByKeysRecursive($value, $keys);
            if ($found !== null) {
                return $found;
            }
        }

        return null;
    }

    private function normalizeOperatingSchedule(?array $source): array
    {
        if (!is_array($source) || empty($source)) {
            return ['days' => [], 'hours' => []];
        }

        $dayMap = [
            'sunday' => 'ראשון',
            'monday' => 'שני',
            'tuesday' => 'שלישי',
            'wednesday' => 'רביעי',
            'thursday' => 'חמישי',
            'friday' => 'שישי',
            'saturday' => 'שבת',
            'sun' => 'ראשון',
            'mon' => 'שני',
            'tue' => 'שלישי',
            'wed' => 'רביעי',
            'thu' => 'חמישי',
            'fri' => 'שישי',
            'sat' => 'שבת',
            '0' => 'ראשון',
            '1' => 'שני',
            '2' => 'שלישי',
            '3' => 'רביעי',
            '4' => 'חמישי',
            '5' => 'שישי',
            '6' => 'שבת',
        ];

        $days = [];
        $overrides = [];

        $entries = $this->isAssociative($source) ? [$source] : $source;
        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            foreach ($entry as $key => $value) {
                $normalizedKey = strtolower(trim((string) $key));
                if (!isset($dayMap[$normalizedKey])) {
                    continue;
                }

                $dayName = $dayMap[$normalizedKey];
                if (is_array($value)) {
                    $open = $this->normalizeTime((string) ($value['open'] ?? $value['opens_at'] ?? ''));
                    $close = $this->normalizeTime((string) ($value['close'] ?? $value['closes_at'] ?? ''));
                    $closed = (bool) ($value['closed'] ?? false);

                    $days[$dayName] = !$closed;
                    if (!$closed && $open && $close) {
                        $overrides[$dayName] = ['open' => $open, 'close' => $close, 'closed' => false];
                    }
                } elseif (is_bool($value)) {
                    $days[$dayName] = $value;
                }
            }

            $dayRaw = (string) ($entry['day'] ?? $entry['weekday'] ?? $entry['day_of_week'] ?? '');
            $normalizedRawDay = strtolower(trim($dayRaw));
            if ($normalizedRawDay !== '' && isset($dayMap[$normalizedRawDay])) {
                $dayName = $dayMap[$normalizedRawDay];
                $open = $this->normalizeTime((string) ($entry['open'] ?? $entry['opens_at'] ?? ''));
                $close = $this->normalizeTime((string) ($entry['close'] ?? $entry['closes_at'] ?? ''));
                $closed = (bool) ($entry['closed'] ?? false);

                $days[$dayName] = !$closed;
                if (!$closed && $open && $close) {
                    $overrides[$dayName] = ['open' => $open, 'close' => $close, 'closed' => false];
                }
            }
        }

        if (empty($days) && empty($overrides)) {
            return ['days' => [], 'hours' => []];
        }

        $hours = [
            'default' => ['open' => '00:00', 'close' => '23:59'],
            'days' => $overrides,
        ];

        return [
            'days' => $days,
            'hours' => $hours,
        ];
    }

    private function normalizeDeliveryZones(?array $source): array
    {
        if (!is_array($source) || empty($source)) {
            return [];
        }

        $entries = $this->isAssociative($source) ? [$source] : $source;
        $zones = [];

        foreach ($entries as $index => $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $name = trim((string) ($entry['name'] ?? $entry['area_name'] ?? $entry['title'] ?? ''));
            if ($name === '') {
                $name = 'אזור משלוח ' . ($index + 1);
            }

            $feeRaw = $entry['fee'] ?? $entry['delivery_fee'] ?? $entry['price'] ?? null;
            $minOrderRaw = $entry['min_order'] ?? $entry['minimum_order'] ?? null;
            $maxDistanceRaw = $entry['max_distance_km'] ?? $entry['max_distance'] ?? null;

            $zones[] = [
                'name' => $name,
                'fee' => is_numeric($feeRaw) ? $this->normalizePrice($feeRaw) : null,
                'min_order' => is_numeric($minOrderRaw) ? $this->normalizePrice($minOrderRaw) : null,
                'max_distance_km' => is_numeric($maxDistanceRaw) ? round((float) $maxDistanceRaw, 2) : null,
                'raw' => $entry,
            ];
        }

        return $zones;
    }

    private function normalizeTime(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        if (preg_match('/^(\d{1,2}):(\d{2})/', $value, $matches) !== 1) {
            return null;
        }

        $hours = max(0, min(23, (int) $matches[1]));
        $minutes = max(0, min(59, (int) $matches[2]));

        return sprintf('%02d:%02d', $hours, $minutes);
    }

    private function persistMenu(Restaurant $restaurant, array $categories, array $restaurantMeta = []): array
    {
        return DB::transaction(function () use ($restaurant, $categories, $restaurantMeta) {
            $categoryCount = 0;
            $itemCount = 0;
            $categoryUpdatedCount = 0;
            $itemUpdatedCount = 0;
            $addonGroupCount = 0;
            $addonCount = 0;

            $restaurantUpdatedFields = [];
            if (!empty($restaurantMeta)) {
                $restaurantUpdatedFields = $this->persistRestaurantMeta($restaurant, $restaurantMeta);
            }

            foreach ($categories as $index => $categoryData) {
                $category = Category::where('restaurant_id', $restaurant->id)
                    ->where('tenant_id', $restaurant->tenant_id)
                    ->where('name', $categoryData['name'])
                    ->first();

                if ($category) {
                    $category->update([
                        'description' => null,
                        'sort_order' => $index,
                        'is_active' => true,
                    ]);
                    $categoryUpdatedCount++;
                } else {
                    $category = Category::create([
                        'restaurant_id' => $restaurant->id,
                        'tenant_id' => $restaurant->tenant_id,
                        'name' => $categoryData['name'],
                        'description' => null,
                        'sort_order' => $index,
                        'is_active' => true,
                    ]);
                    $categoryCount++;
                }

                foreach (($categoryData['items'] ?? []) as $itemIndex => $itemData) {
                    $price = isset($itemData['price']) ? (float) $itemData['price'] : null;
                    if ($price === null || $price < 0) {
                        continue;
                    }

                    $woltExternalId = $itemData['wolt_external_id'] ?? null;

                    $menuItemQuery = MenuItem::where('restaurant_id', $restaurant->id)
                        ->where('tenant_id', $restaurant->tenant_id)
                        ->where('category_id', $category->id);

                    $menuItem = null;
                    if (!empty($woltExternalId)) {
                        $menuItem = MenuItem::where('restaurant_id', $restaurant->id)
                            ->where('tenant_id', $restaurant->tenant_id)
                            ->where('wolt_external_id', $woltExternalId)
                            ->first();
                    }

                    if (!$menuItem) {
                        $menuItem = (clone $menuItemQuery)
                            ->where('name', $itemData['name'])
                            ->first();
                    }

                    $menuItemPayload = [
                        'restaurant_id' => $restaurant->id,
                        'category_id' => $category->id,
                        'tenant_id' => $restaurant->tenant_id,
                        'wolt_external_id' => $woltExternalId,
                        'name' => $itemData['name'],
                        'description' => $itemData['description'] ?? null,
                        'price' => $price,
                        'image_url' => $itemData['image_url'] ?? null,
                        'is_available' => true,
                        'is_active' => true,
                        // Use per-item addon groups for Wolt mapping (not restaurant shared groups).
                        'use_addons' => false,
                        'addons_group_scope' => null,
                        'max_addons' => null,
                        'sort_order' => $itemIndex,
                    ];

                    if ($menuItem) {
                        $menuItem->update($menuItemPayload);
                        $itemUpdatedCount++;
                    } else {
                        $menuItem = MenuItem::create($menuItemPayload);
                        $itemCount++;
                    }

                    // Rebuild Wolt option mapping to keep item linkage in sync on re-import.
                    $menuItem->addonGroups()->delete();
                    $restaurantGroupIdsForItem = [];

                    foreach (($itemData['option_groups'] ?? []) as $groupIndex => $groupData) {
                        if (!is_array($groupData)) {
                            continue;
                        }

                        $groupName = trim((string) ($groupData['name'] ?? ''));
                        if ($groupName === '') {
                            continue;
                        }

                        $restaurantGroup = $this->upsertRestaurantAddonGroup($restaurant, $groupData, $groupIndex);
                        $restaurantGroupIdsForItem[] = (int) $restaurantGroup->id;
                        $this->upsertRestaurantAddonsForGroup($restaurant, $restaurantGroup, $groupData);

                        $group = MenuItemAddonGroup::create([
                            'menu_item_id' => $menuItem->id,
                            'tenant_id' => $restaurant->tenant_id,
                            'wolt_option_group_id' => $groupData['wolt_option_group_id'] ?? null,
                            'name' => $groupName,
                            'selection_type' => in_array(($groupData['selection_type'] ?? null), ['single', 'multiple'], true)
                                ? $groupData['selection_type']
                                : 'multiple',
                            'min_selections' => max(0, (int) ($groupData['min_selections'] ?? 0)),
                            'max_selections' => isset($groupData['max_selections']) && $groupData['max_selections'] !== null
                                ? max(0, (int) $groupData['max_selections'])
                                : null,
                            'is_required' => (bool) ($groupData['is_required'] ?? false),
                            'is_active' => true,
                            'sort_order' => isset($groupData['sort_order']) ? (int) $groupData['sort_order'] : $groupIndex,
                        ]);
                        $addonGroupCount++;

                        foreach (($groupData['addons'] ?? []) as $addonIndex => $addonData) {
                            if (!is_array($addonData)) {
                                continue;
                            }

                            $addonName = trim((string) ($addonData['name'] ?? ''));
                            if ($addonName === '') {
                                continue;
                            }

                            $addonPrice = isset($addonData['price_delta']) && is_numeric($addonData['price_delta'])
                                ? round((float) $addonData['price_delta'], 2)
                                : 0;

                            MenuItemAddon::create([
                                'addon_group_id' => $group->id,
                                'menu_item_id' => $menuItem->id,
                                'tenant_id' => $restaurant->tenant_id,
                                'wolt_option_id' => $addonData['wolt_option_id'] ?? null,
                                'name' => $addonName,
                                'price_delta' => $addonPrice,
                                'is_default' => (bool) ($addonData['is_default'] ?? false),
                                'is_active' => true,
                                'sort_order' => isset($addonData['sort_order']) ? (int) $addonData['sort_order'] : $addonIndex,
                            ]);
                            $addonCount++;
                        }
                    }

                    if (!empty($restaurantGroupIdsForItem)) {
                        $menuItem->update([
                            'use_addons' => true,
                            'addons_group_scope' => json_encode(array_values(array_unique($restaurantGroupIdsForItem))),
                        ]);
                    }
                }
            }

            return [
                'categories_created' => $categoryCount,
                'categories_updated' => $categoryUpdatedCount,
                'items_created' => $itemCount,
                'items_updated' => $itemUpdatedCount,
                'addon_groups_created' => $addonGroupCount,
                'addons_created' => $addonCount,
                'restaurant_meta_updated_fields' => $restaurantUpdatedFields,
                'restaurant_delivery_zones_detected' => count($restaurantMeta['delivery_zones'] ?? []),
                'restaurant_delivery_zones_upserted' => $this->persistRestaurantDeliveryZones($restaurant, $restaurantMeta),
            ];
        });
    }

    private function upsertRestaurantAddonGroup(Restaurant $restaurant, array $groupData, int $groupIndex): RestaurantAddonGroup
    {
        $groupName = trim((string) ($groupData['name'] ?? ''));

        $payload = [
            'tenant_id' => $restaurant->tenant_id,
            'name' => $groupName,
            'selection_type' => in_array(($groupData['selection_type'] ?? null), ['single', 'multiple'], true)
                ? $groupData['selection_type']
                : 'multiple',
            'min_selections' => max(0, (int) ($groupData['min_selections'] ?? 0)),
            'max_selections' => isset($groupData['max_selections']) && $groupData['max_selections'] !== null
                ? max(0, (int) $groupData['max_selections'])
                : null,
            'is_required' => (bool) ($groupData['is_required'] ?? false),
            'is_active' => true,
            'sort_order' => isset($groupData['sort_order']) ? (int) $groupData['sort_order'] : $groupIndex,
        ];

        $existing = RestaurantAddonGroup::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('name', $groupName)
            ->first();

        if ($existing) {
            $existing->update($payload);
            return $existing->refresh();
        }

        return RestaurantAddonGroup::create([
            'restaurant_id' => $restaurant->id,
            ...$payload,
        ]);
    }

    private function upsertRestaurantAddonsForGroup(Restaurant $restaurant, RestaurantAddonGroup $group, array $groupData): void
    {
        foreach (($groupData['addons'] ?? []) as $addonIndex => $addonData) {
            if (!is_array($addonData)) {
                continue;
            }

            $addonName = trim((string) ($addonData['name'] ?? ''));
            if ($addonName === '') {
                continue;
            }

            $priceDelta = isset($addonData['price_delta']) && is_numeric($addonData['price_delta'])
                ? round((float) $addonData['price_delta'], 2)
                : 0;

            $payload = [
                'tenant_id' => $restaurant->tenant_id,
                'name' => $addonName,
                'price_delta' => $priceDelta,
                'selection_weight' => 1,
                'max_quantity' => 1,
                'is_active' => true,
                'sort_order' => isset($addonData['sort_order']) ? (int) $addonData['sort_order'] : $addonIndex,
            ];

            $existing = RestaurantAddon::withoutGlobalScopes()
                ->where('restaurant_id', $restaurant->id)
                ->where('addon_group_id', $group->id)
                ->where('name', $addonName)
                ->first();

            if ($existing) {
                $existing->update($payload);
                continue;
            }

            RestaurantAddon::create([
                'restaurant_id' => $restaurant->id,
                'addon_group_id' => $group->id,
                ...$payload,
            ]);
        }
    }

    private function persistRestaurantMeta(Restaurant $restaurant, array $restaurantMeta): array
    {
        $updates = [];

        foreach (['logo_url', 'phone', 'address', 'city', 'description', 'kosher_type', 'kashrut_text', 'kosher_notes', 'kashrut_level'] as $field) {
            if (!array_key_exists($field, $restaurantMeta)) {
                continue;
            }

            $value = $restaurantMeta[$field];
            if (is_string($value) && trim($value) !== '') {
                $updates[$field] = $field === 'phone'
                    ? PhoneValidationService::formatIsraeliForDisplay(trim($value))
                    : trim($value);
            }
        }

        if (isset($updates['city'])) {
            $updates = array_merge($updates, $this->resolveCityUpdates($restaurant, $updates['city']));
        }

        if (isset($restaurantMeta['operating_days']) && is_array($restaurantMeta['operating_days']) && !empty($restaurantMeta['operating_days'])) {
            $updates['operating_days'] = $restaurantMeta['operating_days'];
        }

        if (isset($restaurantMeta['operating_hours']) && is_array($restaurantMeta['operating_hours']) && !empty($restaurantMeta['operating_hours'])) {
            $updates['operating_hours'] = $restaurantMeta['operating_hours'];
        }

        // תמונת הירו מוולט נשמרת בשדות ההירו — לא בלוגו. לא דורסים תמונה שהועלתה ידנית (נתיב מקומי).
        $heroImageUrl = isset($restaurantMeta['hero_image_url']) && is_string($restaurantMeta['hero_image_url'])
            ? trim($restaurantMeta['hero_image_url'])
            : '';

        if ($heroImageUrl !== '') {
            foreach (['menu_hero_background_url', 'share_hero_background_url'] as $heroField) {
                $current = (string) ($restaurant->getRawOriginal($heroField) ?? '');
                if ($current === '' || str_contains($current, 'wolt.com')) {
                    $updates[$heroField] = $heroImageUrl;
                }
            }
        }

        if (empty($updates)) {
            return [];
        }

        $restaurant->update($updates);

        return array_keys($updates);
    }

    private function normalizeLookupKey(string $key): string
    {
        return strtolower(preg_replace('/[^a-z0-9]/i', '', $key) ?? $key);
    }

    /**
     * קישור העיר מוולט לטבלת הערים — כמו בהרשמת מסעדה:
     * עיר מאושרת ⇒ שם קנוני + קואורדינטות (אם חסרות למסעדה);
     * עיר לא מוכרת ⇒ חיפוש OSM ויצירת עיר ממתינה לאישור סופר־אדמין.
     */
    private function resolveCityUpdates(Restaurant $restaurant, string $inputCity): array
    {
        $inputCity = trim($inputCity);
        if ($inputCity === '') {
            return [];
        }

        $cityModel = City::where('approval_status', 'approved')
            ->where(function ($q) use ($inputCity) {
                $q->where('name', $inputCity)->orWhere('hebrew_name', $inputCity);
            })
            ->first();

        if (! $cityModel) {
            try {
                app(CitySearchService::class)->search($inputCity, 5);
            } catch (\Throwable $e) {
                // OSM לא זמין — ממשיכים ליצירת עיר ממתינה ידנית
            }

            $normalized = Str::lower($inputCity);
            $existing = City::where(function ($q) use ($inputCity, $normalized) {
                    $q->where('normalized_name', $normalized)
                        ->orWhere('name', $inputCity)
                        ->orWhere('hebrew_name', $inputCity);
                })
                ->first();

            if (! $existing) {
                City::create([
                    'name' => $inputCity,
                    'hebrew_name' => $inputCity,
                    'normalized_name' => $normalized,
                    'source' => 'wolt_import',
                    'approval_status' => 'pending',
                ]);
            } elseif ($existing->approval_status === 'approved') {
                $cityModel = $existing;
            }
        }

        if (! $cityModel) {
            return ['city' => $inputCity];
        }

        $updates = ['city' => $cityModel->hebrew_name ?: $cityModel->name];

        $hasCoordinates = $restaurant->latitude !== null && $restaurant->longitude !== null;
        if (! $hasCoordinates && $cityModel->latitude !== null && $cityModel->longitude !== null) {
            $updates['latitude'] = $cityModel->latitude;
            $updates['longitude'] = $cityModel->longitude;
        }

        return $updates;
    }

    private function persistRestaurantDeliveryZones(Restaurant $restaurant, array $restaurantMeta): int
    {
        $zones = $restaurantMeta['delivery_zones'] ?? [];
        if (!is_array($zones) || empty($zones)) {
            return 0;
        }

        $upserted = 0;
        foreach ($zones as $index => $zone) {
            if (!is_array($zone)) {
                continue;
            }

            $name = trim((string) ($zone['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $fixedFee = isset($zone['fee']) && is_numeric($zone['fee'])
                ? round((float) $zone['fee'], 2)
                : 0;

            $existing = DeliveryZone::where('restaurant_id', $restaurant->id)
                ->where('tenant_id', $restaurant->tenant_id)
                ->where('name', $name)
                ->first();

            $payload = [
                'pricing_type' => 'fixed',
                'fixed_fee' => $fixedFee,
                'is_active' => true,
                'sort_order' => $index,
            ];

            if ($existing) {
                $existing->update($payload);
            } else {
                DeliveryZone::create(array_merge($payload, [
                    'restaurant_id' => $restaurant->id,
                    'tenant_id' => $restaurant->tenant_id,
                    'name' => $name,
                ]));
            }

            $upserted++;
        }

        if ($upserted > 0 && !$restaurant->has_delivery) {
            $restaurant->update(['has_delivery' => true]);
        }

        return $upserted;
    }

    private function isAssociative(array $array): bool
    {
        if ($array === []) {
            return false;
        }

        return array_keys($array) !== range(0, count($array) - 1);
    }
}
