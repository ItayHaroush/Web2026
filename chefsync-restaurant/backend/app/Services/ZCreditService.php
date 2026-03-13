<?php

namespace App\Services;

use App\Models\Restaurant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ZCreditService
{
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

        try {
            $response = Http::timeout(90)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($this->apiUrl, $payload);

            $data = $response->json();

            Log::info('[ZCredit] Transaction response', [
                'amount' => $amount,
                'amount_agorot' => $amountInAgorot,
                'terminal' => $this->terminalNumber,
                'Track2_sent' => $this->pinpadId,
                'ReturnCode' => $data['ReturnCode'] ?? null,
                'HasError' => $data['HasError'] ?? null,
            ]);

            if ($response->successful() && isset($data['HasError']) && !$data['HasError']) {
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
            return [
                'success' => false,
                'data' => [
                    'return_code'    => $data['ReturnCode'] ?? null,
                    'return_message' => $data['ReturnMessage'] ?? ($data['ErrorMessage'] ?? 'העסקה נדחתה'),
                    'error_message'  => $data['ErrorMessage'] ?? $data['ReturnMessage'] ?? 'שגיאה לא ידועה',
                    'full_response'  => $data,
                ],
            ];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
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
