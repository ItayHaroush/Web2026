<?php

namespace App\Services\Otp;

interface OtpProviderInterface
{
    public function sendOtp(string $phone, string $code): bool;

    public function verifyOtp(string $phone, string $code): bool;
}
