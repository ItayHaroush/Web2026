<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SchemaCompare extends Command
{
    /**
     * השם והתיאור של הפקודה
     */
    protected $signature = 'schema:compare {--remote-url=} {--remote-token=} {--output=schema-report.json}';

    protected $description = 'השווה סכימת בסיס נתונים בין לוקאלי ופרודקשן. תוצאה: checksum, מיגרציות, הבדלים.';

    public function handle()
    {
        $this->info('🔍 בדיקת סכימת בסיס נתונים...');

        // שליפת סכימה לוקאלית
        $localSchema = $this->fetchLocalSchema();

        // שליפת סכימה רחוקה (אופציונלי)
        $remoteSchema = null;
        $remoteUrl = $this->option('remote-url');
        $remoteToken = $this->option('remote-token');

        if ($remoteUrl && $remoteToken) {
            $this->line('📡 שליפת סכימה מ-'. $remoteUrl .'...');
            $remoteSchema = $this->fetchRemoteSchema($remoteUrl, $remoteToken);
        }

        // השוואה
        $report = $this->generateReport($localSchema, $remoteSchema);

        // שמירה וצפייה
        $outputPath = $this->option('output');
        file_put_contents($outputPath, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $this->info('✅ דוח שמור ב- '. $outputPath);

        // הדפס סיכום
        $this->printSummary($report);
    }

    /**
     * שליפת סכימה לוקאלית
     */
    private function fetchLocalSchema()
    {
        $dbName = optional(collect(DB::select('SELECT DATABASE() as db'))->first())->db;
        $dbVersion = optional(collect(DB::select('SELECT VERSION() as v'))->first())->v;

        $migrations = collect(DB::table('migrations')->select('migration', 'batch')->orderBy('id')->get())
            ->map(fn($row) => ['migration' => $row->migration, 'batch' => (int)$row->batch])
            ->values();

        $columns = collect(DB::select(<<<SQL
            SELECT TABLE_NAME as table_name,
                   COLUMN_NAME as column_name,
                   COLUMN_TYPE as column_type,
                   IS_NULLABLE as is_nullable,
                   COLUMN_DEFAULT as column_default,
                   COLUMN_KEY as column_key,
                   EXTRA as extra
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ?
            ORDER BY TABLE_NAME, ORDINAL_POSITION
        SQL, [$dbName]))
            ->groupBy('table_name')
            ->map(fn($cols, $table) => $cols->map(fn($c) => [
                'column' => $c->column_name,
                'type' => $c->column_type,
                'nullable' => $c->is_nullable === 'YES',
                'key' => $c->column_key,
            ])->values());

        $checksum = sha1(json_encode(['migrations' => $migrations, 'columns' => $columns]));

        return [
            'source' => 'local',
            'app' => [
                'laravel' => app()->version(),
                'php' => PHP_VERSION,
                'env' => config('app.env'),
            ],
            'database' => [
                'name' => $dbName,
                'version' => $dbVersion,
            ],
            'migrations' => $migrations,
            'schema' => $columns,
            'checksum' => $checksum,
        ];
    }

    /**
     * שליפת סכימה מרחוקה דרך API
     */
    private function fetchRemoteSchema($url, $token)
    {
        try {
            $response = Http::timeout(30)
                ->withToken($token)
                ->get(rtrim($url, '/') . '/api/super-admin/schema-status');

            if ($response->failed()) {
                $this->error('❌ שגיאה בשליפה מרחוקה: ' . $response->status());
                return null;
            }

            $data = $response->json('data');
            return [
                'source' => 'remote',
                'app' => $data['app'] ?? [],
                'database' => $data['database'] ?? [],
                'migrations' => $data['migrations'] ?? [],
                'schema' => $data['schema'] ?? [],
                'checksum' => $data['checksum'] ?? null,
            ];
        } catch (\Throwable $e) {
            $this->error('❌ שגיאה: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * יצירת דוח השוואה
     */
    private function generateReport($local, $remote)
    {
        $report = [
            'timestamp' => now()->toIso8601String(),
            'local' => $local,
            'remote' => $remote,
            'comparison' => [],
        ];

        if ($remote) {
            $localChecksum = $local['checksum'];
            $remoteChecksum = $remote['checksum'];

            $report['comparison']['checksum_match'] = $localChecksum === $remoteChecksum;
            $report['comparison']['checksum_local'] = $localChecksum;
            $report['comparison']['checksum_remote'] = $remoteChecksum;

            // השוואת מיגרציות
            $localMigrations = collect($local['migrations'])->pluck('migration')->sort()->values();
            $remoteMigrations = collect($remote['migrations'])->pluck('migration')->sort()->values();

            $missing = $localMigrations->diff($remoteMigrations);
            $extra = $remoteMigrations->diff($localMigrations);

            if ($missing->count() > 0 || $extra->count() > 0) {
                $report['comparison']['migrations'] = [
                    'status' => 'MISMATCH',
                    'missing_on_remote' => $missing->values(),
                    'extra_on_remote' => $extra->values(),
                ];
            } else {
                $report['comparison']['migrations'] = ['status' => 'OK'];
            }

            // השוואת טבלאות
            $localTables = collect($local['schema'])->keys()->sort()->values();
            $remoteTables = collect($remote['schema'])->keys()->sort()->values();

            $missingTables = $localTables->diff($remoteTables);
            $extraTables = $remoteTables->diff($localTables);

            if ($missingTables->count() > 0 || $extraTables->count() > 0) {
                $report['comparison']['tables'] = [
                    'status' => 'MISMATCH',
                    'missing_on_remote' => $missingTables->values(),
                    'extra_on_remote' => $extraTables->values(),
                ];
            } else {
                $report['comparison']['tables'] = ['status' => 'OK'];
            }
        }

        return $report;
    }

    /**
     * הדפס סיכום לטרמינל
     */
    private function printSummary($report)
    {
        $this->line('');
        $this->line('📊 סיכום:');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        $this->line('🏠 לוקאלי:');
        $this->line('   DB: ' . ($report['local']['database']['name'] ?? 'N/A'));
        $this->line('   Version: ' . ($report['local']['database']['version'] ?? 'N/A'));
        $this->line('   Migrations: ' . count($report['local']['migrations']));

        if ($report['remote']) {
            $this->line('');
            $this->line('☁️  רחוק:');
            $this->line('   DB: ' . ($report['remote']['database']['name'] ?? 'N/A'));
            $this->line('   Version: ' . ($report['remote']['database']['version'] ?? 'N/A'));
            $this->line('   Migrations: ' . count($report['remote']['migrations']));

            $this->line('');
            $this->line('🔍 השוואה:');

            $comp = $report['comparison'];

            if ($comp['checksum_match']) {
                $this->info('   ✅ Checksum תואם - סכימה זהה!');
            } else {
                $this->error('   ❌ Checksum לא תואם!');
                $this->line('      Local:  ' . substr($comp['checksum_local'], 0, 16) . '...');
                $this->line('      Remote: ' . substr($comp['checksum_remote'], 0, 16) . '...');
            }

            if (isset($comp['migrations'])) {
                if ($comp['migrations']['status'] === 'OK') {
                    $this->info('   ✅ מיגרציות תואמות');
                } else {
                    $this->error('   ❌ מיגרציות שונות!');
                    if (count($comp['migrations']['missing_on_remote']) > 0) {
                        $this->line('      חסר בפרודקשן: ' . implode(', ', $comp['migrations']['missing_on_remote']));
                    }
                }
            }

            if (isset($comp['tables'])) {
                if ($comp['tables']['status'] === 'OK') {
                    $this->info('   ✅ טבלאות תואמות');
                } else {
                    $this->error('   ❌ טבלאות שונות!');
                    if (count($comp['tables']['missing_on_remote']) > 0) {
                        $this->line('      חסר בפרודקשן: ' . implode(', ', $comp['tables']['missing_on_remote']));
                    }
                }
            }
        }

        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line('');
    }
}
