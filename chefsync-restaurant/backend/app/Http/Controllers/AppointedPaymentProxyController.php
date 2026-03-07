<?php

namespace App\Http\Controllers;

use App\Services\HypPaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Proxy for Appointed.cloud payments.
 * Runs on chefsync server (authorized IP) — gets signature from HYP
 * and redirects user to HYP payment page.
 */
class AppointedPaymentProxyController extends Controller
{
    private string $secret = "appointed_hyp_bounce_2026";

    public function __construct(
        private HypPaymentService $hypService,
    ) {}

    /**
     * Step 1: API endpoint — appointed server calls this to get a signed payment URL
     * POST /appointed-pay/sign
     */
    public function sign(Request $request)
    {
        $sig = $request->input("sig", "");
        $payload = $request->input("payload", "");

        if (empty($sig) || empty($payload)) {
            return response()->json(["error" => "Missing parameters"], 400);
        }

        if (!hash_equals(hash_hmac("sha256", $payload, $this->secret), $sig)) {
            return response()->json(["error" => "Invalid signature"], 403);
        }

        $payParams = json_decode(base64_decode($payload), true);
        if (!$payParams || !is_array($payParams)) {
            return response()->json(["error" => "Invalid payload"], 400);
        }

        $signResult = $this->hypService->getSignature($payParams);

        if (!$signResult["success"]) {
            Log::error("[Appointed-Proxy] HYP APISign failed", ["error" => $signResult["error"]]);
            return response()->json(["error" => $signResult["error"]], 502);
        }

        $payParams["signature"] = $signResult["signature"];
        $payParams["action"] = "pay";
        $payParams["PassP"] = $this->hypService->getPassp();

        $payUrl = $this->hypService->getBaseUrl() . "?" . http_build_query($payParams);

        return response()->json([
            "success" => true,
            "payment_url" => $payUrl,
        ]);
    }

    /**
     * Step 2: Browser redirect — user lands here, sees spinner, then redirected to HYP
     * GET /appointed-pay/redirect?url=...&sig=...
     */
    public function redirect(Request $request)
    {
        $url = $request->query("url", "");
        $sig = $request->query("sig", "");

        if (empty($url) || empty($sig)) {
            return response("Missing parameters", 400);
        }

        if (!hash_equals(hash_hmac("sha256", $url, $this->secret), $sig)) {
            return response("Invalid signature", 403);
        }

        if (strpos($url, "https://pay.hyp.co.il/") !== 0) {
            return response("Invalid redirect target", 403);
        }

        return response()->view("hyp.order_redirect", ["paymentUrl" => $url]);
    }

    /**
     * Step 3: Generic HYP API proxy — appointed calls this for getToken, verifyTransaction, chargeSoft etc.
     * POST /appointed-pay/proxy
     */
    public function proxy(Request $request)
    {
        $sig = $request->input("sig", "");
        $payload = $request->input("payload", "");

        if (empty($sig) || empty($payload)) {
            return response()->json(["error" => "Missing parameters"], 400);
        }

        if (!hash_equals(hash_hmac("sha256", $payload, $this->secret), $sig)) {
            return response()->json(["error" => "Invalid signature"], 403);
        }

        $params = json_decode(base64_decode($payload), true);
        if (!$params || !is_array($params)) {
            return response()->json(["error" => "Invalid payload"], 400);
        }

        // Whitelist allowed HYP actions
        $action = $params['action'] ?? '';
        $allowed = ['getToken', 'APISign', 'soft', 'verify'];
        if (!in_array($action, $allowed)) {
            return response()->json(["error" => "Action not allowed: {$action}"], 403);
        }

        try {
            $baseUrl = $this->hypService->getBaseUrl();
            $referer = config('app.url', 'https://api.chefsync.co.il');

            $response = Http::timeout(20)
                ->withHeaders(['Referer' => $referer])
                ->get($baseUrl, $params);

            Log::info("[Appointed-Proxy] HYP API call", [
                "action" => $action,
                "http_status" => $response->status(),
                "body_preview" => substr($response->body(), 0, 200),
            ]);

            return response()->json([
                "success" => true,
                "response" => $response->body(),
            ]);
        } catch (\Exception $e) {
            Log::error("[Appointed-Proxy] HYP API call failed", [
                "action" => $action,
                "error" => $e->getMessage(),
            ]);
            return response()->json(["error" => $e->getMessage()], 502);
        }
    }
}
