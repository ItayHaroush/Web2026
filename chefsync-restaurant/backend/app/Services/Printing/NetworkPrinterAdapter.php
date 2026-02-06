<?php

namespace App\Services\Printing;

use Illuminate\Support\Facades\Log;

class NetworkPrinterAdapter implements PrinterAdapter
{
    /**
     * שליחת ESC/POS דרך TCP socket
     */
    public function print(string $payload, array $config): bool
    {
        $ip = $config['ip_address'] ?? null;
        $port = $config['port'] ?? 9100;
        $timeout = $config['timeout'] ?? 5;

        if (!$ip) {
            Log::error('NetworkPrinterAdapter: Missing IP address');
            return false;
        }

        $socket = @fsockopen($ip, $port, $errno, $errstr, $timeout);

        if (!$socket) {
            Log::error("NetworkPrinterAdapter: Connection failed to {$ip}:{$port}", [
                'errno' => $errno,
                'errstr' => $errstr,
            ]);
            return false;
        }

        try {
            // ESC/POS: Initialize printer
            fwrite($socket, "\x1B\x40");

            // ESC/POS: Select Hebrew codepage (CP862)
            fwrite($socket, "\x1B\x74\x24");

            // שליחת הנתונים
            fwrite($socket, $payload);

            // ESC/POS: Feed and cut
            fwrite($socket, "\n\n\n\n");
            fwrite($socket, "\x1D\x56\x00"); // Full cut

            fclose($socket);
            return true;
        } catch (\Exception $e) {
            Log::error("NetworkPrinterAdapter: Print failed to {$ip}:{$port}", [
                'error' => $e->getMessage(),
            ]);

            if (is_resource($socket)) {
                fclose($socket);
            }

            return false;
        }
    }

    /**
     * בדיקת חיבור למדפסת
     */
    public function isAvailable(array $config): bool
    {
        $ip = $config['ip_address'] ?? null;
        $port = $config['port'] ?? 9100;

        if (!$ip) {
            return false;
        }

        $socket = @fsockopen($ip, $port, $errno, $errstr, 2);

        if ($socket) {
            fclose($socket);
            return true;
        }

        return false;
    }
}
