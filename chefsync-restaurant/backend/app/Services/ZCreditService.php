<?php

namespace App\Services;

use App\Models\Restaurant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ZCreditService
{
    // #region agent log
    private static function agentDebugLog(string $location, string $message, array $data, string $hypothesisId = 'A'): void
    {
        try {
            $path = dirname(base_path()) . DIRECTORY_SEPARATOR . '.cursor' . DIRECTORY_SEPARATOR . 'debug-38053a.log';
            $line = json_encode([
                'sessionId' => '38053a',
                'timestamp' => (int) round(microtime(true) * 1000),
                'location' => $location,
                'message' => $message,
                'hypothesisId' => $hypothesisId,
                'data' => $data,
            ], JSON_UNESCAPED_UNICODE) . "\n";
            file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
        } catch (\Throwable $e) {
            // ignore
        }
    }
    // #endregion

    private string $apiUrl = 'https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CommitFullTransaction';
    private string $refundUrl = 'https://pci.zcredit.co.il/ZCreditWS/api/Transaction/RefundTransaction';

    private string $terminalNumber;
    private string $terminalPassword;
    private string $pinpadId;

    public function __construct(
        ?string $terminalNumber = null,
        ?string $terminalPassword = null,
        ?string $pinpadId = null
    ) {
        $this->terminalNumber  = $terminalNumber  ?? config('services.zcredit.terminal_number');
        $this->terminalPassword = $terminalPassword ?? config('services.zcredit.terminal_password');
        $raw = (string) ($pinpadId ?? config('services.zcredit.pinpad_id', '11002'));
        // שמירת הערך המלא ל־Track2 – חייב להכיל PINPAD (למשל PINPAD11002)
        $this->pinpadId = preg_match('/^PINPAD/i', $raw) ? $raw : ('PINPAD' . trim($raw));
    }

    /**
     * Factory: יצירת שירות ZCredit עם credentials של מסעדה ספציפית.
     * אם למסעדה אין הגדרות ZCredit, נופל חזרה ל-config הגלובלי.
     */
    public static function forRestaurant(Restaurant $restaurant): self
    {
        return new self(
            $restaurant->zcredit_terminal_number,
            $restaurant->zcredit_terminal_password,
            $restaurant->zcredit_pinpad_id
        );
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
        $amountInAgorot = (int) round($amount * 100);

        $payload = [
            'TerminalNumber'   => $this->terminalNumber,
            'Password'         => $this->terminalPassword,
            'TransactionSum'   => $amountInAgorot,
            'CreditType'       => 1,
            'NumOfPayments'    => 1,  // בתיעוד: NumOfPayments (לא NumberOfPayments)
            'Currency'         => 'ILS',
            'Track2'           => $this->pinpadId,
        ];

        if ($uniqueId) {
            $payload['TransactionUniqueID'] = $uniqueId;
        }

        $payloadForLog = $payload;
        $payloadForLog['Password'] = '***';
        Log::info('[ZCredit] Payload sent', $payloadForLog);

        self::agentDebugLog('ZCreditService::chargePinPad', 'request', [
            'terminal_len' => strlen((string) $this->terminalNumber),
            'terminal_empty' => $this->terminalNumber === '' || $this->terminalNumber === null,
            'pinpad_id' => $this->pinpadId,
            'amount_agorot' => $amountInAgorot,
            'uniqueId' => $uniqueId,
        ], 'C');

        try {
            $response = Http::timeout(90)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($this->apiUrl, $payload);

            $data = $response->json();
            $bodyPreview = is_string($response->body()) ? substr($response->body(), 0, 500) : '';

            $d = is_array($data) ? $data : [];
            self::agentDebugLog('ZCreditService::chargePinPad', 'response_raw', [
                'http_status' => $response->status(),
                'json_ok' => is_array($data),
                'has_error_raw' => $d['HasError'] ?? null,
                'has_error_type' => array_key_exists('HasError', $d) ? gettype($d['HasError']) : 'missing',
                'return_code' => $d['ReturnCode'] ?? null,
                'return_message_snip' => isset($d['ReturnMessage']) ? substr((string) $d['ReturnMessage'], 0, 120) : null,
                'error_message_snip' => isset($d['ErrorMessage']) ? substr((string) $d['ErrorMessage'], 0, 120) : null,
                'body_preview_if_not_json' => is_array($data) ? null : $bodyPreview,
            ], 'A');

            Log::info('[ZCredit] Transaction response', [
                'amount' => $amount,
                'amount_agorot' => $amountInAgorot,
                'terminal' => $this->terminalNumber,
                'Track2_sent' => $this->pinpadId,
                'ReturnCode' => $d['ReturnCode'] ?? null,
                'HasError' => $d['HasError'] ?? null,
            ]);

            if ($response->successful() && is_array($data) && isset($data['HasError']) && !$data['HasError']) {
                return [
                    'success' => true,
                    'data' => [
                        'transaction_id'  => $data['ReferenceNumber'] ?? $data['TransactionID'] ?? null,
                        'approval_code'   => $data['AuthNum'] ?? $data['ApprovalNumber'] ?? null,
                        'voucher_number'  => $data['VoucherNumber'] ?? null,
                        'return_code'     => $data['ReturnCode'] ?? null,
                        'return_message'  => $data['ReturnMessage'] ?? null,
                        'card_last4'      => $data['Card4Digits'] ?? $data['Last4Digits'] ?? null,
                        'card_brand'      => $data['CardName'] ?? $data['CardBrand'] ?? null,
                        'full_response'   => $data,
                    ],
                ];
            }

            // Transaction declined or error
            self::agentDebugLog('ZCreditService::chargePinPad', 'declined_branch', [
                'http_ok' => $response->successful(),
                'has_error_key' => array_key_exists('HasError', is_array($data) ? $data : []),
                'has_error_val' => is_array($data) ? ($data['HasError'] ?? null) : null,
            ], 'B');

            $fail = is_array($data) ? $data : [];
            return [
                'success' => false,
                'data' => [
                    'return_code'    => $fail['ReturnCode'] ?? null,
                    'return_message' => $fail['ReturnMessage'] ?? ($fail['ErrorMessage'] ?? 'העסקה נדחתה'),
                    'error_message'  => $fail['ErrorMessage'] ?? $fail['ReturnMessage'] ?? 'שגיאה לא ידועה',
                    'full_response'  => is_array($data) ? $data : ['non_json_body' => $bodyPreview ?? ''],
                ],
            ];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            self::agentDebugLog('ZCreditService::chargePinPad', 'connection_exception', [
                'error' => substr($e->getMessage(), 0, 200),
            ], 'E');
            Log::error('[ZCredit] Connection timeout', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'data' => [
                    'return_code'   => 'TIMEOUT',
                    'error_message' => 'תם הזמן לתקשורת עם ה-PinPad. נסו שוב.',
                ],
            ];
        }
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
        $payload = [
            'TerminalNumber'                 => $this->terminalNumber,
            'Password'                       => $this->terminalPassword,
            'TransactionIdToCancelOrRefund'  => $referenceNumber,
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
                'amount'    => $amount,
                'ReturnCode' => $data['ReturnCode'] ?? null,
                'HasError'   => $data['HasError'] ?? null,
            ]);

            if ($response->successful() && isset($data['HasError']) && !$data['HasError']) {
                return [
                    'success' => true,
                    'data' => [
                        'reference_number' => $data['ReferenceNumber'] ?? null,
                        'return_code'      => $data['ReturnCode'] ?? null,
                        'return_message'   => $data['ReturnMessage'] ?? null,
                        'full_response'    => $data,
                    ],
                ];
            }

            return [
                'success' => false,
                'data' => [
                    'return_code'   => $data['ReturnCode'] ?? null,
                    'error_message' => $data['ReturnMessage'] ?? 'שגיאה בביטול העסקה',
                    'full_response' => $data,
                ],
            ];
        } catch (\Exception $e) {
            Log::error('[ZCredit] Refund error', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'data' => [
                    'return_code'   => 'ERROR',
                    'error_message' => 'שגיאה בתקשורת עם שרת התשלומים',
                ],
            ];
        }
    }
}
