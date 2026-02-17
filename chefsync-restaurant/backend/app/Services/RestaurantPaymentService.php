<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentSession;
use App\Models\Restaurant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * RestaurantPaymentService (B2C)
 *
 * שכבת שירות לחיוב לקוחות על הזמנות דרך HYP.
 * משתמש ב-Masof של המסעדה (מ-DB) — לא של הפלטפורמה.
 */
class RestaurantPaymentService
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('payment.hyp.base_url', 'https://pay.hyp.co.il/p/'), '/');
    }

    /**
     * האם המסעדה מוכנה לקבל תשלומי אשראי
     */
    public function isRestaurantReady(Restaurant $restaurant): bool
    {
        return $restaurant->hyp_terminal_verified
            && !empty($restaurant->hyp_terminal_id)
            && !empty($restaurant->hyp_terminal_password)
            && !empty($restaurant->hyp_api_key)
            && config('payment.credit_card_enabled');
    }

    /**
     * בונה URL להפניית הלקוח לעמוד redirect פנימי.
     * ה-controller (HypOrderRedirectController) אחראי על:
     * - קריאת APISign server-to-server לקבלת חתימה
     * - הפנייה לעמוד תשלום HYP עם כל הפרמטרים + signature
     */
    public function generateOrderPaymentUrl(Restaurant $restaurant, Order $order, PaymentSession $session): string
    {
        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');

        // ה-frontend יעשה redirect ל-URL הזה; ה-controller בצד שרת יבנה form ויבצע POST ל-HYP
        return "{$backendUrl}/pay/hyp/order/{$session->session_token}";
    }

    /**
     * אימות credentials של מסוף — שולח APISign SIGN עם סכום קטן
     * אימות: KEY + PassP
     * HYP מחזיר signature אם credentials תקינים, או CCode 901-903 אם לא
     */
    public function verifyCredentials(Restaurant $restaurant): array
    {
        $query = [
            'action'  => 'APISign',
            'What'    => 'SIGN',
            'KEY'     => $restaurant->hyp_api_key,
            'PassP'   => $restaurant->hyp_terminal_password,
            'Masof'   => $restaurant->hyp_terminal_id,
            'Amount'  => '0.01',
            'Order'   => 'verify-' . time(),
            'Info'    => 'Terminal verification',
            'Sign'    => 'True',
            'UTF8'    => 'True',
            'UTF8out' => 'True',
            'UserId'  => '000000000',
        ];

        $referer = config('payment.hyp.referer_url', 'https://api.chefsync.co.il');

        try {
            $response = Http::timeout(15)
                ->withHeaders(['Referer' => $referer])
                ->get($this->baseUrl, $query);

            $result = $this->parseResponse($response->body());

            if (!empty($result['signature'])) {
                return [
                    'valid' => true,
                    'ccode' => 0,
                    'error' => null,
                ];
            }

            $ccode = (int) ($result['CCode'] ?? -1);
            $masofValid = !in_array($ccode, [901, 902, 903]);

            return [
                'valid'  => $masofValid,
                'ccode'  => $ccode,
                'error'  => $masofValid ? null : ($result['ErrMsg'] ?? "CCode: {$ccode}"),
            ];
        } catch (\Exception $e) {
            Log::error('RestaurantPaymentService verifyCredentials failed', ['error' => $e->getMessage()]);
            return ['valid' => false, 'ccode' => -1, 'error' => $e->getMessage()];
        }
    }

    /**
     * אימות עסקת הזמנה (APISign VERIFY)
     * אימות: KEY + PassP + Referer header
     */
    public function verifyOrderTransaction(Restaurant $restaurant, array $responseParams): array
    {
        $query = [
            'action' => 'APISign',
            'What'   => 'VERIFY',
            'KEY'    => $restaurant->hyp_api_key,
            'PassP'  => $restaurant->hyp_terminal_password,
            'Masof'  => $restaurant->hyp_terminal_id,
            'Id'     => $responseParams['Id'] ?? '',
            'CCode'  => $responseParams['CCode'] ?? '',
            'Amount' => $responseParams['Amount'] ?? '',
        ];

        $referer = config('payment.hyp.referer_url', 'https://api.chefsync.co.il');

        try {
            $response = Http::timeout(15)
                ->withHeaders(['Referer' => $referer])
                ->get($this->baseUrl, $query);

            $result = $this->parseResponse($response->body());

            return [
                'success'  => ($result['CCode'] ?? '') === '0',
                'verified' => true,
                'error'    => ($result['CCode'] ?? '') === '0' ? null : ($result['ErrMsg'] ?? 'Verification failed'),
            ];
        } catch (\Exception $e) {
            Log::error('RestaurantPaymentService verifyOrderTransaction failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'verified' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * חיוב server-to-server עם Masof של המסעדה (לאימות מסוף)
     */
    public function chargeSoft(Restaurant $restaurant, float $amount, string $token, string $tmonth, string $tyear, string $description = ''): array
    {
        $query = [
            'action'  => 'soft',
            'Masof'   => $restaurant->hyp_terminal_id,
            'PassP'   => $restaurant->hyp_terminal_password,
            'Amount'  => number_format($amount, 2, '.', ''),
            'CC'      => $token,
            'Tmonth'  => $tmonth,
            'Tyear'   => $tyear,
            'Info'    => $description,
            'Coin'    => '1',
            'UTF8'    => 'True',
            'UTF8out' => 'True',
        ];

        try {
            $response = Http::timeout(30)->get($this->baseUrl, $query);
            $result = $this->parseResponse($response->body());

            $ccode = (int) ($result['CCode'] ?? -1);

            if ($ccode === 0) {
                return [
                    'success'        => true,
                    'transaction_id' => $result['Id'] ?? '',
                    'ccode'          => $ccode,
                    'token'          => $result['Token'] ?? '',
                    'error'          => null,
                ];
            }

            return [
                'success'        => false,
                'transaction_id' => $result['Id'] ?? '',
                'ccode'          => $ccode,
                'error'          => $result['ErrMsg'] ?? "CCode: {$ccode}",
            ];
        } catch (\Exception $e) {
            Log::error('RestaurantPaymentService chargeSoft failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'transaction_id' => '', 'ccode' => -1, 'error' => $e->getMessage()];
        }
    }

    /**
     * זיכוי/החזר עם Masof של המסעדה
     */
    public function refundOrder(Restaurant $restaurant, string $transactionId, float $amount): array
    {
        $query = [
            'action'  => 'zikoyAPI',
            'Masof'   => $restaurant->hyp_terminal_id,
            'PassP'   => $restaurant->hyp_terminal_password,
            'TransId' => $transactionId,
            'Amount'  => number_format($amount, 2, '.', ''),
        ];

        try {
            $response = Http::timeout(30)->get($this->baseUrl, $query);
            $result = $this->parseResponse($response->body());

            $ccode = (int) ($result['CCode'] ?? -1);

            return [
                'success' => $ccode === 0 || $ccode === 33,
                'ccode'   => $ccode,
                'error'   => $ccode === 0 || $ccode === 33 ? null : ($result['ErrMsg'] ?? "CCode: {$ccode}"),
            ];
        } catch (\Exception $e) {
            Log::error('RestaurantPaymentService refundOrder failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * שליפת רשימת עסקאות מ-HYP עם Masof של המסעדה (getTransList)
     * לצורך reconciliation — מחפש עסקאות שאושרו ב-HYP אבל לא חזרו ב-redirect
     */
    public function getTransList(Restaurant $restaurant, string $fromDate, string $toDate, ?string $fild1 = null): array
    {
        $query = [
            'action'   => 'getTransList',
            'Masof'    => $restaurant->hyp_terminal_id,
            'PassP'    => $restaurant->hyp_terminal_password,
            'FromDate' => $fromDate, // DD/MM/YYYY
            'ToDate'   => $toDate,   // DD/MM/YYYY
            'UTF8'     => 'True',
            'UTF8out'  => 'True',
        ];

        if ($fild1) {
            $query['Fild1'] = $fild1;
        }

        try {
            $response = Http::timeout(30)->get($this->baseUrl, $query);
            $body = $response->body();

            $transactions = [];
            $lines = array_filter(explode("\n", $body));

            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line)) continue;

                $parsed = [];
                parse_str($line, $parsed);

                if (isset($parsed['CCode']) && (int) $parsed['CCode'] !== 0 && empty($parsed['Id'])) {
                    return [
                        'success'      => false,
                        'transactions' => [],
                        'error'        => $parsed['ErrMsg'] ?? "CCode: {$parsed['CCode']}",
                    ];
                }

                if (!empty($parsed['Id'])) {
                    $transactions[] = $parsed;
                }
            }

            return [
                'success'      => true,
                'transactions' => $transactions,
                'error'        => null,
            ];
        } catch (\Exception $e) {
            Log::error('RestaurantPaymentService getTransList failed', [
                'restaurant_id' => $restaurant->id,
                'error'         => $e->getMessage(),
            ]);
            return ['success' => false, 'transactions' => [], 'error' => $e->getMessage()];
        }
    }

    /**
     * מנתח query params מ-redirect חזרה מ-HYP
     */
    public function parseRedirectParams(Request $request): array
    {
        $ccode = (int) $request->query('CCode', -1);

        return [
            'success'        => $ccode === 0,
            'transaction_id' => $request->query('Id', ''),
            'ccode'          => $ccode,
            'amount'         => $request->query('Amount', ''),
            'acode'          => $request->query('ACode', ''),
            'fild1'          => $request->query('Fild1', ''),
            'fild2'          => $request->query('Fild2', ''),
            'fild3'          => $request->query('Fild3', ''),
            'l4digit'        => $request->query('L4digit', ''),
            'tmonth'         => $request->query('Tmonth', ''),
            'tyear'          => $request->query('Tyear', ''),
            'token'          => $request->query('Token', ''),
            'brand'          => $request->query('Brand', ''),
            'errMsg'         => $request->query('ErrMsg', ''),
        ];
    }

    /**
     * מנתח תגובת HYP (query string format)
     */
    private function parseResponse(string $body): array
    {
        $result = [];
        parse_str($body, $result);

        if (empty($result) && str_contains($body, '=')) {
            foreach (explode('&', $body) as $pair) {
                $parts = explode('=', $pair, 2);
                if (count($parts) === 2) {
                    $result[urldecode($parts[0])] = urldecode($parts[1]);
                }
            }
        }

        return $result;
    }
}
