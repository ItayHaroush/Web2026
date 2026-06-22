<?php

namespace App\Console\Commands;

use App\Models\Restaurant;
use App\Models\RestaurantDomain;
use App\Services\HostTenantResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestCustomDomainLocal extends Command
{
    protected $signature = 'domains:test-local
        {--base-url= : API base URL, e.g. http://localhost:8002/api}
        {--tenant=pizza-palace : Tenant for seeded test domain}
        {--domain=pizza-abc.co.il : Custom domain used in local tests}
        {--seed : Activate test domain in DB (simulates Activate Domain)}
        {--cleanup : Remove seeded test domain from DB}
        {--frontend-port=5173 : Vite dev port for optional browser-host check}';

    protected $description = 'Full local checklist: custom domain routing, host security, platform hosts, optional seed';

    private int $passed = 0;

    private int $failed = 0;

    private int $warned = 0;

    public function handle(HostTenantResolver $resolver): int
    {
        $domain = strtolower(trim($this->option('domain')));
        $tenant = trim($this->option('tenant'));
        $baseUrl = rtrim($this->resolveBaseUrl(), '/');

        $this->info('TakeEat — Custom Domain Local Test');
        $this->line(str_repeat('─', 52));
        $this->line("API:    {$baseUrl}");
        $this->line("Domain: {$domain}");
        $this->line("Tenant: {$tenant}");
        $this->newLine();

        if ($this->option('cleanup')) {
            return $this->cleanupTestDomain($domain) ? self::SUCCESS : self::FAILURE;
        }

        if ($this->option('seed')) {
            if (!$this->seedTestDomain($domain, $tenant)) {
                return self::FAILURE;
            }
            $this->newLine();
        }

        $this->section('1. Config — platform hosts');
        $hosts = config('domain_services.platform_hosts', []);
        $this->assert(in_array('localhost', $hosts, true), 'PLATFORM_HOSTS includes localhost');
        $this->assert(in_array('127.0.0.1', $hosts, true), 'PLATFORM_HOSTS includes 127.0.0.1');

        $this->section('2. Resolver — HostTenantResolver');
        $this->assert($resolver->isPlatformHost('localhost'), 'localhost is platform');
        $this->assert($resolver->isPlatformHost('127.0.0.1'), '127.0.0.1 is platform');
        $this->assert($resolver->isPlatformHost('takeeat.co.il'), 'takeeat.co.il is platform');
        $this->assert(!$resolver->resolveRestaurantByHost('totally-fake-' . time() . '.co.il'), 'unknown host → null (no fallback)');

        $this->section('3. API — GET /public/resolve-host');
        $this->httpJson("{$baseUrl}/public/resolve-host?host=localhost", 200, function ($json) {
            return ($json['success'] ?? false) && ($json['data']['platform'] ?? false) === true;
        }, 'localhost → platform:true');

        $this->httpStatus("{$baseUrl}/public/resolve-host?host=unknown-fake-domain-xyz.co.il", 404, 'unknown domain → 404');

        $seeded = $resolver->resolveRestaurantByHost($domain);
        if ($seeded) {
            $this->httpJson("{$baseUrl}/public/resolve-host?host=" . urlencode($domain), 200, function ($json) use ($tenant) {
                return ($json['data']['tenant_id'] ?? '') === $tenant;
            }, "{$domain} → tenant_id={$tenant}");
        } else {
            $this->warnCheck("{$domain} not in DB — skip resolve-host active test (run with --seed)");
        }

        $this->section('4. API — tenant routes + Host header security');
        $this->httpJson("{$baseUrl}/menu", 200, fn ($json) => ($json['success'] ?? false) === true, 'menu + Host:localhost + X-Tenant-ID', [
            'X-Tenant-ID' => $tenant,
            'Host' => 'localhost',
        ]);

        $this->httpJson("{$baseUrl}/menu", 200, fn ($json) => ($json['success'] ?? false) === true, 'menu + Host:127.0.0.1 + X-Tenant-ID', [
            'X-Tenant-ID' => $tenant,
            'Host' => '127.0.0.1',
        ]);

        $this->httpStatus("{$baseUrl}/menu", 404, 'menu + unknown Host (no tenant header) → 404', [
            'Host' => 'unknown-fake-domain-xyz.co.il',
        ]);

        if ($seeded) {
            $this->httpJson("{$baseUrl}/menu", 200, fn ($json) => ($json['success'] ?? false) === true, "menu + Host:{$domain} (host routing)", [
                'Host' => $domain,
            ]);
        }

        $this->section('5. Local machine — /etc/hosts & Vite');
        $this->checkEtcHosts($domain);
        $this->checkViteAllowedHosts();

        $frontendPort = (int) $this->option('frontend-port');
        if ($seeded && $frontendPort > 0) {
            $this->section('6. Frontend dev server (optional)');
            $this->checkFrontendHost($domain, $frontendPort);
        }

        $this->newLine();
        $this->line(str_repeat('─', 52));
        $this->info("Passed: {$this->passed}  Failed: {$this->failed}  Warnings: {$this->warned}");

        if (!$seeded) {
            $this->newLine();
            $this->comment('Tip: run with --seed to activate test domain, then open:');
            $this->line("  http://{$domain}:{$frontendPort}");
        }

        return $this->failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function resolveBaseUrl(): string
    {
        $explicit = trim((string) $this->option('base-url'));
        if ($explicit !== '') {
            return $explicit;
        }

        $appUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');

        return str_ends_with($appUrl, '/api') ? $appUrl : "{$appUrl}/api";
    }

    private function seedTestDomain(string $domain, string $tenant): bool
    {
        $restaurant = Restaurant::withoutGlobalScopes()->where('tenant_id', $tenant)->first();
        if (!$restaurant) {
            $this->error("Restaurant tenant \"{$tenant}\" not found.");

            return false;
        }

        RestaurantDomain::updateOrCreate(
            ['domain' => $domain],
            [
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'domain_type' => RestaurantDomain::TYPE_PRIMARY,
                'ssl_status' => 'active',
                'health_status' => RestaurantDomain::HEALTH_HEALTHY,
                'health_checked_at' => now(),
                'connected_at' => now(),
                'is_active' => true,
                'deleted_at' => null,
            ]
        );

        $restaurant->update([
            'custom_domain' => $domain,
            'custom_domain_connected_at' => now(),
            'custom_domain_ssl_status' => 'active',
        ]);

        $this->info("Seeded active domain {$domain} → {$tenant} (restaurant #{$restaurant->id})");

        return true;
    }

    private function cleanupTestDomain(string $domain): bool
    {
        $rows = RestaurantDomain::where('domain', $domain)->get();
        foreach ($rows as $row) {
            $row->delete();
        }

        Restaurant::withoutGlobalScopes()
            ->where('custom_domain', $domain)
            ->update([
                'custom_domain' => null,
                'custom_domain_connected_at' => null,
                'custom_domain_ssl_status' => null,
            ]);

        $this->info("Removed test domain {$domain} from DB.");

        return true;
    }

    private function section(string $title): void
    {
        $this->newLine();
        $this->comment($title);
    }

    private function assert(bool $ok, string $label): void
    {
        if ($ok) {
            $this->passed++;
            $this->line("  <fg=green>✓</> {$label}");
        } else {
            $this->failed++;
            $this->line("  <fg=red>✗</> {$label}");
        }
    }

    private function warnCheck(string $label): void
    {
        $this->warned++;
        $this->line("  <fg=yellow>!</> {$label}");
    }

    private function httpStatus(string $url, int $expected, string $label, array $headers = []): void
    {
        try {
            $response = Http::timeout(8)->withHeaders($headers)->get($url);
            $this->assert($response->status() === $expected, "{$label} (HTTP {$response->status()})");
        } catch (\Throwable $e) {
            $this->failed++;
            $this->line("  <fg=red>✗</> {$label} — {$e->getMessage()}");
        }
    }

    private function httpJson(string $url, int $expectedStatus, callable $validator, string $label, array $headers = []): void
    {
        try {
            $response = Http::timeout(8)->withHeaders($headers)->get($url);
            $ok = $response->status() === $expectedStatus && $validator($response->json());
            $this->assert($ok, "{$label} (HTTP {$response->status()})");
        } catch (\Throwable $e) {
            $this->failed++;
            $this->line("  <fg=red>✗</> {$label} — {$e->getMessage()}");
        }
    }

    private function checkEtcHosts(string $domain): void
    {
        $paths = ['/etc/hosts', '/private/etc/hosts'];
        $found = false;

        foreach ($paths as $path) {
            if (!is_readable($path)) {
                continue;
            }
            $content = file_get_contents($path) ?: '';
            if (preg_match('/^\s*127\.0\.0\.1\s+.*\b' . preg_quote($domain, '/') . '\b/im', $content)) {
                $found = true;
                break;
            }
        }

        if ($found) {
            $this->assert(true, "/etc/hosts maps {$domain} → 127.0.0.1");
        } else {
            $this->warnCheck("/etc/hosts missing: 127.0.0.1 {$domain}");
            $this->line('       sudo sh -c \'echo "127.0.0.1 ' . $domain . '" >> /etc/hosts\'');
        }
    }

    private function checkViteAllowedHosts(): void
    {
        $configPath = base_path('../frontend/vite.config.js');
        if (!is_readable($configPath)) {
            $this->warnCheck('frontend/vite.config.js not found');

            return;
        }

        $content = file_get_contents($configPath) ?: '';
        $ok = str_contains($content, 'allowedHosts');

        if ($ok) {
            $this->assert(true, 'vite.config.js configures server.allowedHosts');
        } else {
            $this->failed++;
            $this->line('  <fg=red>✗</> vite.config.js missing server.allowedHosts (custom Host blocked by Vite 7)');
        }
    }

    private function checkFrontendHost(string $domain, int $port): void
    {
        if (!$this->isPortListening('127.0.0.1', $port)) {
            $this->warnCheck("פורט {$port} לא פעיל — Vite לא רץ");
            $this->line('       1) בטרמינל נפרד: ./start.sh');
            $this->line("       2) הרץ שוב: ./scripts/test-custom-domain-local.sh --seed");
            $this->line("       3) פתח: http://{$domain}:{$port}");

            return;
        }

        $this->assert(true, "Vite listening on 127.0.0.1:{$port}");

        $localUrl = "http://127.0.0.1:{$port}/";
        $customUrl = "http://{$domain}:{$port}/";

        try {
            $local = Http::timeout(5)->withHeaders(['Accept' => 'text/html'])->get($localUrl);
            if (!$local->successful()) {
                $this->warnCheck("localhost Vite returned HTTP {$local->status()}");

                return;
            }
        } catch (\Throwable $e) {
            $this->warnCheck("127.0.0.1:{$port} open but HTTP failed — {$e->getMessage()}");

            return;
        }

        try {
            $response = Http::timeout(5)
                ->withHeaders(['Accept' => 'text/html'])
                ->get($customUrl);

            if ($response->successful() && (str_contains($response->body(), 'root') || str_contains($response->body(), 'id="root"'))) {
                $this->assert(true, "Vite serves custom Host {$domain}:{$port}");
            } elseif ($response->status() === 403) {
                $this->failed++;
                $this->line("  <fg=red>✗</> Vite blocked Host {$domain} (403) — check allowedHosts in vite.config.js");
            } else {
                $this->warnCheck("{$customUrl} returned HTTP {$response->status()}");
            }
        } catch (\Throwable $e) {
            $this->failed++;
            $this->line("  <fg=red>✗</> {$customUrl} — {$e->getMessage()}");
            $this->line('       ודא ש-vite.config.js כולל server.host + allowedHosts, ו-restart ל-start.sh');
        }
    }

    private function isPortListening(string $host, int $port): bool
    {
        $socket = @fsockopen($host, $port, $errno, $errstr, 1);
        if ($socket === false) {
            return false;
        }

        fclose($socket);

        return true;
    }
}
