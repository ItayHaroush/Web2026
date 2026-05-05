<?php

namespace App\Services;

/**
 * חישוב תוספות לפי סדר הבחירה: יחידת מחיר אחת מהתוספת הראשונה עם delta חיובי פטורה.
 */
final class AddonPricingService
{
    /**
     * @param  array<int, array<string, mixed>>  $orderedLines  כל שורה: unit_delta (או price), quantity אופציונלי (ברירת מחדל 1)
     */
    public static function sumBilledFromOrderedLines(array $orderedLines): float
    {
        $total = 0.0;
        $freeCredit = 0.0;
        $freeInitialized = false;

        foreach ($orderedLines as $line) {
            $delta = round((float) ($line['unit_delta'] ?? $line['price'] ?? 0), 2);
            $qty = max(1, (int) ($line['quantity'] ?? $line['qty'] ?? 1));
            $isHalf = (bool) ($line['is_half'] ?? false);

            // אתחול קרדיט חופשי: תוספת מלאה אחת — עבור חצי פיצה הקרדיט הוא 2× המחיר (= מנה שלמה)
            if (! $freeInitialized && $delta > 0.0) {
                $freeCredit = $isHalf ? round($delta * 2, 2) : $delta;
                $freeInitialized = true;
            }

            $lineTotal = round($delta * $qty, 2);

            if ($freeCredit > 0.0 && $delta > 0.0) {
                $discount = min($freeCredit, $lineTotal);
                $lineTotal = round(max(0.0, $lineTotal - $discount), 2);
                $freeCredit = round(max(0.0, $freeCredit - $discount), 2);
            }

            $total = round($total + $lineTotal, 2);
        }

        return $total;
    }

    /**
     * סיכום מלא ללא פטור (לקבוצות שלא מוגדרות עם תוספת ראשונה חינם).
     *
     * @param  array<int, array<string, mixed>>  $orderedLines
     */
    public static function sumFullCatalogLines(array $orderedLines): float
    {
        $total = 0.0;

        foreach ($orderedLines as $line) {
            $delta = round((float) ($line['unit_delta'] ?? $line['price'] ?? 0), 2);
            $qty = max(1, (int) ($line['quantity'] ?? $line['qty'] ?? 1));
            $total = round($total + round($delta * $qty, 2), 2);
        }

        return $total;
    }

    /**
     * תוספות POS: מחיר ליחידה תחת price; קיבוץ לפי addon_group_id / group_id.
     * קבוצת `_legacy` ללא מזהה — תמיד חיוב מלא (תאימות לאחור).
     */
    public static function sumFromPosAddonPayload(?array $addons): float
    {
        if ($addons === null || $addons === []) {
            return 0.0;
        }

        /** @var array<string, array{apply_first_free: bool, lines: array<int, array<string, mixed>>}> $buckets */
        $buckets = [];

        foreach ($addons as $a) {
            if (! is_array($a)) {
                continue;
            }

            $gid = isset($a['addon_group_id'])
                ? 'g_' . (string) $a['addon_group_id']
                : (isset($a['group_id']) ? 'g_' . (string) $a['group_id'] : '_legacy');

            if (! isset($buckets[$gid])) {
                $buckets[$gid] = [
                    'apply_first_free' => false,
                    'lines' => [],
                ];
            }

            $buckets[$gid]['apply_first_free'] = $buckets[$gid]['apply_first_free']
                || (bool) ($a['first_addon_unit_free'] ?? false);

            $halfPlacements = ['right', 'left', 'right_half', 'left_half'];
            $buckets[$gid]['lines'][] = [
                'unit_delta' => self::effectivePosAddonPrice(
                    (float) ($a['price'] ?? 0),
                    $a['placement'] ?? null
                ),
                'is_half' => isset($a['placement']) && in_array($a['placement'], $halfPlacements, true),
                'quantity' => max(1, (int) ($a['quantity'] ?? $a['qty'] ?? 1)),
            ];
        }

        $total = 0.0;

        foreach ($buckets as $bucket) {
            $total += $bucket['apply_first_free']
                ? self::sumBilledFromOrderedLines($bucket['lines'])
                : self::sumFullCatalogLines($bucket['lines']);
            $total = round($total, 2);
        }

        return round($total, 2);
    }

    /**
     * מחשב מחיר אפקטיבי לתוספת POS: חצי מחיר כאשר placement הוא חצי פיצה.
     */
    private static function effectivePosAddonPrice(float $price, ?string $placement): float
    {
        $halfPlacements = ['right', 'left', 'right_half', 'left_half'];
        if ($placement !== null && in_array($placement, $halfPlacements, true)) {
            return (float) ceil($price / 2);
        }
        return $price;
    }
}
