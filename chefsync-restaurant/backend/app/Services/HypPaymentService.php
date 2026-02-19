<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * HypPaymentService (B2B)
 *
 * שכבת שירות לחיוב מנויי מסעדות דרך HYP.
 * משתמש ב-Masof של הפלטפורמה (מ-config) — לא של המסעדה.
 */
class HypPaymentService
{
    private string $baseUrl;
    private string $masof;
    private string $passp;
    private string $apiKey;
    private string $coin;
    private string $referer;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('payment.hyp.base_url', 'https://pay.hyp.co.il/p/'), '/');
        $this->masof = config('payment.hyp.masof', '');
        $this->passp = config('payment.hyp.passp', '');
        $this->apiKey = config('payment.hyp.api_key', '');
        $this->coin = config('payment.hyp.coin', '1');
        $this->referer = config('payment.hyp.referer_url', 'https://api.chefsync.co.il');
    }

    /**
     * Feature flag אוטומטי: האם HYP מוגדר?
     */
    public function isConfigured(): bool
    {
        return !empty($this->masof) && !empty($this->passp) && !empty($this->apiKey);
    }

    /**
     * בונה URL לדף תשלום HYP (Pay Protocol)
     * הלקוח יופנה לדף זה, ואחרי תשלום HYP יעביר redirect
     */
    public function generatePaymentUrl(array $params): string
    {
        $query = [
            'action'   => 'pay',
            'Masof'    => $this->masof,
            'Amount'   => $params['amount'],
            'Info'     => $params['info'] ?? '',
            'Coin'     => $this->coin,
            'Tash'     => $params['tash'] ?? '1',
            'PageLang' => 'HEB',
            'UTF8'     => 'True',
            'UTF8out'  => 'True',
            'MoreData' => 'True',
            'Sign'     => 'True',
            'Fild1'    => $params['fild1'] ?? '',
            'Fild2'    => $params['fild2'] ?? '',
            'Fild3'    => $params['fild3'] ?? '',
        ];

        if (!empty($params['success_url'])) {
            $query['SuccessUrl'] = $params['success_url'];
        }
        if (!empty($params['error_url'])) {
            $query['ErrorUrl'] = $params['error_url'];
        }
        if (!empty($params['client_name'])) {
            $query['ClientName'] = $params['client_name'];
        }
        if (!empty($params['client_lname'])) {
            $query['ClientLName'] = $params['client_lname'];
        }
        if (!empty($params['email'])) {
            $query['email'] = $params['email'];
        }
        if (!empty($params['phone'])) {
            $query['cell'] = $params['phone'];
        }
        if (!empty($params['user_id'])) {
            $query['UserId'] = $params['user_id'];
        }

        return $this->baseUrl . '?' . http_build_query($query);
    }

    /**
     * קבלת טוקן מעסקה קיימת (לחיובים חוזרים)
     */
    public function getToken(string $transactionId): array
    {
        $query = [
            'action'  => 'getToken',
            'Masof'   => $this->masof,
            'TransId' => $transactionId,
            'PassP'   => $this->passp,
        ];

        try {
            $response = Http::timeout(30)
                ->withHeaders(['Referer' => $this->referer])
                ->get($this->baseUrl, $query);
            $result = $this->parseResponse($response->body());

            if (($result['CCode'] ?? '') === '0' && !empty($result['Token'])) {
                return [
                    'success' => true,
                    'token'   => $result['Token'],
                    'tmonth'  => $result['Tmonth'] ?? '',
                    'tyear'   => $result['Tyear'] ?? '',
                    'l4digit' => $result['L4digit'] ?? '',
                    'error'   => null,
                ];
            }

            return [
                'success' => false,
                'token'   => null,
                'error'   => $result['ErrMsg'] ?? 'Failed to get token',
            ];
        } catch (\Exception $e) {
            Log::error('HYP getToken failed', ['error' => $e->getMessage(), 'trans_id' => $transactionId]);
            return ['success' => false, 'token' => null, 'error' => $e->getMessage()];
        }
    }

    /**
     * חיוב server-to-server דרך Soft Protocol (חיוב חוזר עם טוקן)
     */
    public function chargeSoft(float $amount, string $token, string $expiry, string $description, array $clientInfo = []): array
    {
        // expiry format: MMYY or YYMM - HYP expects Tmonth (MM) and Tyear (YYYY)
        $tmonth = substr($expiry, 0, 2);
        $tyear = substr($expiry, 2, 4);

        // If tyear is 2 digits, prepend 20
        if (strlen($tyear) === 2) {
            $tyear = '20' . $tyear;
        }

        $query = [
            'action'     => 'soft',
            'Masof'      => $this->masof,
            'PassP'      => $this->passp,
            'Amount'     => number_format($amount, 2, '.', ''),
            'CC'         => $token,
            'Tmonth'     => $tmonth,
            'Tyear'      => $tyear,
            'Info'       => $description,
            'Coin'       => $this->coin,
            'UTF8'       => 'True',
            'UTF8out'    => 'True',
        ];

        if (!empty($clientInfo['name'])) {
            $query['ClientName'] = $clientInfo['name'];
        }
        if (!empty($clientInfo['user_id'])) {
            $query['UserId'] = $clientInfo['user_id'];
        }

        try {
            $response = Http::timeout(30)
                ->withHeaders(['Referer' => $this->referer])
                ->get($this->baseUrl, $query);
            $result = $this->parseResponse($response->body());

            $ccode = (int) ($result['CCode'] ?? -1);

            if ($ccode === 0) {
                return [
                    'success'        => true,
                    'transaction_id' => $result['Id'] ?? '',
                    'ccode'          => $ccode,
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
            Log::error('HYP chargeSoft failed', ['error' => $e->getMessage(), 'amount' => $amount]);
            return ['success' => false, 'transaction_id' => '', 'ccode' => -1, 'error' => $e->getMessage()];
        }
    }

    /**
     * זיכוי/החזר
     */
    public function refund(string $transactionId, float $amount): array
    {
        $query = [
            'action'  => 'zikoyAPI',
            'Masof'   => $this->masof,
            'PassP'   => $this->passp,
            'TransId' => $transactionId,
            'Amount'  => number_format($amount, 2, '.', ''),
        ];

        try {
            $response = Http::timeout(30)
                ->withHeaders(['Referer' => $this->referer])
                ->get($this->baseUrl, $query);
            $result = $this->parseResponse($response->body());

            $ccode = (int) ($result['CCode'] ?? -1);

            return [
                'success' => $ccode === 0 || $ccode === 33,
                'ccode'   => $ccode,
                'error'   => $ccode === 0 || $ccode === 33 ? null : ($result['ErrMsg'] ?? "CCode: {$ccode}"),
            ];
        } catch (\Exception $e) {
            Log::error('HYP refund failed', ['error' => $e->getMessage(), 'trans_id' => $transactionId]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * אימות עסקה (APISign VERIFY)
     */
    public function verifyTransaction(array $responseParams): array
    {
        if (empty($this->apiKey)) {
            // אם אין API key, דלג על אימות
            return ['success' => true, 'verified' => false, 'reason' => 'no_api_key'];
        }

        $query = [
            'action' => 'APISign',
            'What'   => 'VERIFY',
            'Masof'  => $this->masof,
            'KEY'    => $this->apiKey,
            'PassP'  => $this->passp,
            'Id'     => $responseParams['Id'] ?? '',
            'CCode'  => $responseParams['CCode'] ?? '',
            'Amount' => $responseParams['Amount'] ?? '',
        ];

        try {
            $response = Http::timeout(15)
                ->withHeaders(['Referer' => $this->referer])
                ->get($this->baseUrl, $query);
            $result = $this->parseResponse($response->body());

            return [
                'success'  => ($result['CCode'] ?? '') === '0',
                'verified' => true,
                'error'    => ($result['CCode'] ?? '') === '0' ? null : ($result['ErrMsg'] ?? 'Verification failed'),
            ];
        } catch (\Exception $e) {
            Log::error('HYP verifyTransaction failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'verified' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * שליפת רשימת עסקאות מ-HYP (getTransList)
     * לצורך reconciliation — מחפש עסקאות שאושרו ב-HYP אבל לא חזרו ב-redirect
     */
    public function getTransList(string $fromDate, string $toDate, ?string $fild1 = null): array
    {
        $query = [
            'action'   => 'getTransList',
            'Masof'    => $this->masof,
            'PassP'    => $this->passp,
            'FromDate' => $fromDate, // DD/MM/YYYY
            'ToDate'   => $toDate,   // DD/MM/YYYY
            'UTF8'     => 'True',
            'UTF8out'  => 'True',
        ];

        if ($fild1) {
            $query['Fild1'] = $fild1;
        }

        try {
            $response = Http::timeout(30)
                ->withHeaders(['Referer' => $this->referer])
                ->get($this->baseUrl, $query);
            $body = $response->body();

            // HYP מחזיר רשימת עסקאות מופרדות ב-newline, כל שורה = query string
            $transactions = [];
            $lines = array_filter(explode("\n", $body));

            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line)) continue;

                $parsed = [];
                parse_str($line, $parsed);

                // שורה ראשונה עשויה להיות סטטוס כללי
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
            Log::error('HYP getTransList failed', ['error' => $e->getMessage()]);
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
            'order'          => $request->query('Order', ''),
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
     * קריאה ל-HYP APISign לקבלת חתימה server-to-server (KEY + PassP + Referer)
     */
    public function getSignature(array $payParams): array
    {
        $signParams = [
            'action'  => 'APISign',
            'What'    => 'SIGN',
            'KEY'     => $this->apiKey,
            'PassP'   => $this->passp,
            'Masof'   => $this->masof,
            'Amount'  => $payParams['Amount'],
            'Order'   => $payParams['Order'] ?? '',
            'Info'    => $payParams['Info'] ?? '',
            'Sign'    => 'True',
            'UTF8'    => 'True',
            'UTF8out' => 'True',
            'UserId'  => $payParams['UserId'] ?? '000000000',
            'tmp'     => $payParams['tmp'] ?? '5',
        ];

        if (!empty($payParams['Coin'])) {
            $signParams['Coin'] = $payParams['Coin'];
        }
        if (!empty($payParams['Tash'])) {
            $signParams['Tash'] = $payParams['Tash'];
        }
        if (!empty($payParams['ClientName'])) {
            $signParams['ClientName'] = $payParams['ClientName'];
        }

        try {
            $signUrl = rtrim($this->baseUrl, '/') . '/';

            $response = Http::timeout(15)
                ->withHeaders(['Referer' => $this->referer])
                ->get($signUrl, $signParams);

            $body = $response->body();

            Log::info('HYP B2B APISign response', [
                'http_status'  => $response->status(),
                'body_preview' => substr($body, 0, 300),
            ]);

            $result = [];
            parse_str($body, $result);

            if (!empty($result['signature'])) {
                return [
                    'success'   => true,
                    'signature' => $result['signature'],
                    'error'     => null,
                ];
            }

            $ccode = $result['CCode'] ?? null;
            $errMsg = $result['ErrMsg'] ?? 'No signature returned';

            return [
                'success'   => false,
                'signature' => null,
                'error'     => "CCode={$ccode}: {$errMsg}",
            ];
        } catch (\Exception $e) {
            return [
                'success'   => false,
                'signature' => null,
                'error'     => $e->getMessage(),
            ];
        }
    }

    public function getMasof(): string
    {
        return $this->masof;
    }

    public function getPassp(): string
    {
        return $this->passp;
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    public function getCoin(): string
    {
        return $this->coin;
    }

    /**
     * מנתח תגובת HYP (query string format)
     */
    private function parseResponse(string $body): array
    {
        $result = [];
        parse_str($body, $result);

        // HYP sometimes returns with & delimiters
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
