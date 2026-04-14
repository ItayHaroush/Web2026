<?php

namespace App\Services;

use App\Models\PaymentTerminal;
use App\Models\Restaurant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * אינטגרציה Z-Credit — PinPad דרך CommitFullTransaction.
 *
 * פרטי מסוף אמיתיים מוגדרים **לכל מסעדה** (שדות `restaurants` / טבלת `payment_terminals`).
 * משתני `ZCREDIT_*` ב-.env — אופציונליים (למשל סביבת פיתוח); בזרימת POS/קיוסק לא נופלים ל-.env
 * כשמשתמשים ב־`forRestaurant` / `forPaymentTerminal` (רק DB).
 *
 * `ZCREDIT_MOCK=true` — חיוב/החזר מדומים בלי HTTP (עד חיבור מסופון אמיתי).
 *
 * @see docs/zcredit-pinpad-testing.md
 */
class ZCreditService
{
    private string $apiUrl = 'https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CommitFullTransaction';

    private string $refundUrl = 'https://pci.zcredit.co.il/ZCreditWS/api/Transaction/RefundTransaction';

    private string $terminalNumber;

    private string $terminalPassword;

    private string $pinpadId;

    /** כש־false: לא משתמשים ב־config('services.zcredit.terminal_*') — רק ערכים מפורשים (מסעדה/מסוף) */
    private bool $allowEnvFallback;

    public function __construct(
        ?string $terminalNumber = null,
        ?string $terminalPassword = null,
        ?string $pinpadId = null,
        bool $allowEnvFallback = true
    ) {
        $this->allowEnvFallback = $allowEnvFallback;

        if ($allowEnvFallback) {
            $this->terminalNumber = (string) ($terminalNumber ?? config('services.zcredit.terminal_number') ?? '');
            $this->terminalPassword = (string) ($terminalPassword ?? config('services.zcredit.terminal_password') ?? '');
            $raw = (string) ($pinpadId ?? config('services.zcredit.pinpad_id') ?? '');
        } else {
            $this->terminalNumber = (string) ($terminalNumber ?? '');
            $this->terminalPassword = (string) ($terminalPassword ?? '');
            $raw = (string) ($pinpadId ?? '');
        }

        $this->pinpadId = $raw === '' ? '' : (preg_match('/^PINPAD/i', $raw) ? $raw : ('PINPAD' . trim($raw)));
    }

    public static function forRestaurant(Restaurant $restaurant): self
    {
        return new self(
            $restaurant->zcredit_terminal_number,
            $restaurant->zcredit_terminal_password,
            $restaurant->zcredit_pinpad_id,
            false
        );
    }

    public static function forPaymentTerminal(PaymentTerminal $terminal): self
    {
        return new self(
            $terminal->zcredit_terminal_number,
            $terminal->zcredit_terminal_password,
            $terminal->zcredit_pinpad_id,
            false
        );
    }

    public function isMockMode(): bool
    {
        return (bool) config('services.zcredit.mock');
    }

    /**
     * מספר מסוף + סיסמה + PinPad (Track2) — כולם נדרשים לעסקה אמיתית.
     */
    public function hasTerminalCredentials(): bool
    {
        return $this->terminalNumber !== ''
            && $this->terminalPassword !== ''
            && $this->pinpadId !== '';
    }

    /**
     * חיוב כרטיס אשראי דרך PinPad
     *
     * @param float $amount סכום העסקה בשקלים
     * @param string|null $uniqueId מזהה ייחודי למניעת חיוב כפול (לדוגמה: order_123)
     * @return array ['success' => bool, 'data' => [...]]
     */
    public function chargePinPad(float $amount, ?string $uniqueId = null): array
    {
        if ($this->isMockMode()) {
            Log::info('[ZCredit] Mock charge (no HTTP)', ['amount' => $amount, 'uniqueId' => $uniqueId]);

            return $this->mockChargeSuccess($amount, $uniqueId);
        }

        if (!$this->hasTerminalCredentials()) {
            return [
                'success' => false,
                'data' => [
                    'return_code' => 'NO_TERMINAL',
                    'error_message' => 'לא הוגדר מסוף Z-Credit. יש להגדיר ב"הגדרות תשלום" או להפעיל ZCREDIT_MOCK לבדיקות.',
                    'full_response' => ['local_error' => true],
                ],
            ];
        }

        $amountInAgorot = (int) round($amount * 100);

        $payload = [
            'TerminalNumber' => $this->terminalNumber,
            'Password' => $this->terminalPassword,
            'TransactionSum' => $amountInAgorot,
            'CreditType' => 1,
            'NumOfPayments' => 1,
            'Currency' => 'ILS',
            'Track2' => $this->pinpadId,
        ];

        if ($uniqueId) {
            $payload['TransactionUniqueID'] = $uniqueId;
        }

        $payloadForLog = $payload;
        $payloadForLog['Password'] = '***';
        Log::info('[ZCredit] Payload sent', $payloadForLog);

        try {
            $response = Http::timeout(90)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($this->apiUrl, $payload);

            $data = $response->json();
            $bodyPreview = is_string($response->body()) ? substr($response->body(), 0, 500) : '';

            $d = is_array($data) ? $data : [];

            Log::info('[ZCredit] Transaction response', [
                'amount' => $amount,
                'amount_agorot' => $amountInAgorot,
                'terminal' => $this->terminalNumber,
                'Track2_sent' => $this->pinpadId,
                'ReturnCode' => $d['ReturnCode'] ?? null,
                'ReturnMessage' => $d['ReturnMessage'] ?? ($d['ErrorMessage'] ?? null),
                'HasError' => $d['HasError'] ?? null,
            ]);

            if ($response->successful() && is_array($data) && isset($data['HasError']) && !$data['HasError']) {
                return [
                    'success' => true,
                    'data' => [
                        'transaction_id' => $data['ReferenceNumber'] ?? $data['TransactionID'] ?? null,
                        'approval_code' => $data['AuthNum'] ?? $data['ApprovalNumber'] ?? null,
                        'voucher_number' => $data['VoucherNumber'] ?? null,
                        'return_code' => $data['ReturnCode'] ?? null,
                        'return_message' => $data['ReturnMessage'] ?? null,
                        'card_last4' => $data['Card4Digits'] ?? $data['Last4Digits'] ?? null,
                        'card_brand' => $data['CardName'] ?? $data['CardBrand'] ?? null,
                        'full_response' => $data,
                    ],
                ];
            }

            $fail = is_array($data) ? $data : [];

            return [
                'success' => false,
                'data' => [
                    'return_code' => $fail['ReturnCode'] ?? null,
                    'return_message' => $fail['ReturnMessage'] ?? ($fail['ErrorMessage'] ?? 'העסקה נדחתה'),
                    'error_message' => $fail['ErrorMessage'] ?? $fail['ReturnMessage'] ?? 'שגיאה לא ידועה',
                    'full_response' => is_array($data) ? $data : ['non_json_body' => $bodyPreview ?? ''],
                ],
            ];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('[ZCredit] Connection timeout', ['error' => $e->getMessage()]);

            return [
                'success' => false,
                'data' => [
                    'return_code' => 'TIMEOUT',
                    'error_message' => 'תם הזמן לתקשורת עם ה-PinPad. נסו שוב.',
                ],
            ];
        }
    }

    private function mockChargeSuccess(float $amount, ?string $uniqueId): array
    {
        $tid = 'MOCK_' . ($uniqueId ? preg_replace('/\W+/', '_', $uniqueId) : 'chg') . '_' . uniqid();

        return [
            'success' => true,
            'data' => [
                'transaction_id' => $tid,
                'approval_code' => 'MOCK',
                'voucher_number' => null,
                'return_code' => 0,
                'return_message' => 'Mock transaction',
                'card_last4' => '0000',
                'card_brand' => 'MOCK',
                'full_response' => [
                    'mock' => true,
                    'amount' => $amount,
                    'TransactionUniqueID' => $uniqueId,
                ],
            ],
        ];
    }

    /**
     * ביטול / החזר עסקה
     *
     * @param string $referenceNumber מזהה העסקה המקורית מ-ZCredit
     * @param float|null $amount סכום להחזר בשקלים (null = מלא)
     * @return array ['success' => bool, 'data' => [...]]
     */
    public function refundTransaction(string $referenceNumber, ?float $amount = null): array
    {
        if ($this->isMockMode() || str_starts_with($referenceNumber, 'MOCK_') || str_starts_with($referenceNumber, 'LOCAL-DEMO-')) {
            Log::info('[ZCredit] Mock refund', ['reference' => $referenceNumber, 'amount' => $amount]);

            return [
                'success' => true,
                'data' => [
                    'reference_number' => $referenceNumber,
                    'return_code' => 0,
                    'return_message' => 'Mock refund',
                    'full_response' => ['mock' => true],
                ],
            ];
        }

        if (!$this->hasTerminalCredentials()) {
            return [
                'success' => false,
                'data' => [
                    'return_code' => 'NO_TERMINAL',
                    'error_message' => 'לא הוגדר מסוף Z-Credit להחזר.',
                ],
            ];
        }

        $payload = [
            'TerminalNumber' => $this->terminalNumber,
            'Password' => $this->terminalPassword,
            'TransactionIdToCancelOrRefund' => $referenceNumber,
        ];

        if ($amount !== null) {
            $payload['TransactionSum'] = (int) round($amount * 100);
        }

        try {
            $response = Http::timeout(30)
                ->post($this->refundUrl, $payload);

            $data = $response->json();

            Log::info('[ZCredit] Refund response', [
                'reference' => $referenceNumber,
                'amount' => $amount,
                'ReturnCode' => $data['ReturnCode'] ?? null,
                'ReturnMessage' => $data['ReturnMessage'] ?? ($data['ErrorMessage'] ?? null),
                'HasError' => $data['HasError'] ?? null,
            ]);

            if ($response->successful() && isset($data['HasError']) && !$data['HasError']) {
                return [
                    'success' => true,
                    'data' => [
                        'reference_number' => $data['ReferenceNumber'] ?? null,
                        'return_code' => $data['ReturnCode'] ?? null,
                        'return_message' => $data['ReturnMessage'] ?? null,
                        'full_response' => $data,
                    ],
                ];
            }

            return [
                'success' => false,
                'data' => [
                    'return_code' => $data['ReturnCode'] ?? null,
                    'error_message' => $data['ReturnMessage'] ?? 'שגיאה בביטול העסקה',
                    'full_response' => $data,
                ],
            ];
        } catch (\Exception $e) {
            Log::error('[ZCredit] Refund error', ['error' => $e->getMessage()]);

            return [
                'success' => false,
                'data' => [
                    'return_code' => 'ERROR',
                    'error_message' => 'שגיאה בתקשורת עם שרת התשלומים',
                ],
            ];
        }
    }
}
