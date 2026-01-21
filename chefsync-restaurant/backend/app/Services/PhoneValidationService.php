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

        if (!$phoneUtil->isValidNumberForRegion($number, self::REGION_IL)) {
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
}
