<?php

namespace App\Console\Commands;

use App\Models\DomainRequest;
use App\Models\RestaurantDomain;
use App\Services\VercelDomainService;
use Illuminate\Console\Command;

class SyncDomainStatus extends Command
{
    protected $signature = 'domains:sync-status {--domain= : Sync a single domain only}';

    protected $description = 'Sync DNS/SSL health from Vercel for pending and active restaurant domains';

    public function handle(VercelDomainService $vercel): int
    {
        if (!$vercel->isConfigured()) {
            $this->warn('Vercel not configured — skipping sync');

            return self::SUCCESS;
        }

        $single = $this->option('domain');

        $query = RestaurantDomain::query()
            ->whereIn('health_status', [
                RestaurantDomain::HEALTH_PENDING,
                RestaurantDomain::HEALTH_DNS_PENDING,
                RestaurantDomain::HEALTH_SSL_PENDING,
                RestaurantDomain::HEALTH_HEALTHY,
            ])
            ->when($single, fn ($q) => $q->where('domain', $single));

        $count = 0;
        $query->each(function (RestaurantDomain $rd) use ($vercel, &$count) {
            $status = $vercel->getDomainStatus($rd->domain);
            $health = $status['health_status'] ?? RestaurantDomain::HEALTH_ERROR;
            $sslStatus = $status['ssl_status'] ?? 'unknown';

            $rd->update([
                'health_status' => $health,
                'health_checked_at' => now(),
                'ssl_status' => $sslStatus,
                'vercel_domain_id' => $status['vercel_domain_id'] ?? $rd->vercel_domain_id,
            ]);

            if ($rd->is_active && $rd->domain_type === RestaurantDomain::TYPE_PRIMARY) {
                $rd->restaurant?->update([
                    'custom_domain_ssl_status' => $sslStatus,
                ]);
            }

            DomainRequest::where('id', $rd->domain_request_id)
                ->whereIn('status', [
                    DomainRequest::STATUS_AWAITING_DNS,
                    DomainRequest::STATUS_SSL_SETUP,
                    DomainRequest::STATUS_IN_PROGRESS,
                    DomainRequest::STATUS_PENDING,
                ])
                ->each(function (DomainRequest $dr) use ($health, $sslStatus, $status) {
                    $newStatus = match ($health) {
                        RestaurantDomain::HEALTH_DNS_PENDING => DomainRequest::STATUS_AWAITING_DNS,
                        RestaurantDomain::HEALTH_SSL_PENDING => DomainRequest::STATUS_SSL_SETUP,
                        default => null,
                    };
                    $updates = [
                        'ssl_status' => $sslStatus,
                        'dns_records' => $status['dns_records'] ?? $dr->dns_records,
                    ];
                    if ($newStatus !== null) {
                        $updates['status'] = $newStatus;
                    }
                    $dr->update($updates);
                });

            $this->line("{$rd->domain}: {$health} (ssl: {$sslStatus})");
            $count++;
        });

        $this->info("Synced {$count} domain(s)");

        return self::SUCCESS;
    }
}
