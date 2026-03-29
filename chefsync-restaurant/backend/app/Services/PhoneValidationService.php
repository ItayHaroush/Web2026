<?php

namespace App\Services;

use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\PhoneNumberType;
use libphonenumber\PhoneNumberUtil;

class PhoneValidationService
{
    private const REGION_IL = 'IL';

    public static function normalizeIsraeliMobileE164(string $raw): ?string
    {
        $phoneUtil = PhoneNumberUtil::getInstance();
        try {
            $number = $phoneUtil->parse($raw, self::REGION_IL);
        } catch (NumberParseException $e) {
            return null;
        }

        if (! $phoneUtil->isValidNumberForRegion($number, self::REGION_IL)) {
            return null;
        }

        $type = $phoneUtil->getNumberType($number);
        if ($type !== PhoneNumberType::MOBILE) {
            return null;
        }

        return $phoneUtil->format($number, PhoneNumberFormat::E164);
    }

    public static function isValidIsraeliMobile(string $raw): bool
    {
        return self::normalizeIsraeliMobileE164($raw) !== null;
    }

    /**
     * תצוגה להדפסה / מסך: ללא +972, בפורמט לאומי (למשל 050-123-4567).
     * אם אין פרסור תקין — ניסיון להסיר 972 ולעצב 05x.
     */
    public static function formatIsraeliForDisplay(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '' || $raw === '0000000000') {
            return $raw;
        }

        $phoneUtil = PhoneNumberUtil::getInstance();
        try {
            $number = $phoneUtil->parse($raw, self::REGION_IL);
            if ($phoneUtil->isValidNumberForRegion($number, self::REGION_IL)) {
                return $phoneUtil->format($number, PhoneNumberFormat::NATIONAL);
            }
        } catch (NumberParseException $e) {
            // fallback below
        }

        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '') {
            return $raw;
        }

        if (str_starts_with($digits, '972') && strlen($digits) >= 11) {
            $digits = '0'.substr($digits, 3);
        }

        if (strlen($digits) === 10 && str_starts_with($digits, '05')) {
            return substr($digits, 0, 3).'-'.substr($digits, 3);
        }

        if (strlen($digits) === 9 && str_starts_with($digits, '0')) {
            return substr($digits, 0, 2).'-'.substr($digits, 2);
        }

        return $raw;
    }
}
