<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use App\Models\PolicyVersion;
use App\Models\SystemError;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;

class SuperAdminSettingsController extends Controller
{
    /**
     * Get all settings for a group
     */
    public function getSettings($group)
    {
        $validGroups = ['regional', 'billing', 'security', 'notifications'];

        if (!in_array($group, $validGroups)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid settings group',
            ], 400);
        }

        $settings = SystemSetting::where('group', $group)->get();

        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Update settings (bulk)
     */
    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'nullable',
            'settings.*.type' => 'nullable|string|in:string,integer,boolean,json',
            'settings.*.group' => 'nullable|string|in:regional,billing,security,notifications',
            'settings.*.description' => 'nullable|string',
        ]);

        $updated = [];
        foreach ($validated['settings'] as $setting) {
            $type = $setting['type'] ?? 'string';
            $storeValue = $type === 'json' ? json_encode($setting['value']) : (string) ($setting['value'] ?? '');

            $record = SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                [
                    'value' => $storeValue,
                    'type' => $type,
                    'group' => $setting['group'] ?? 'general',
                    'description' => $setting['description'] ?? null,
                ]
            );
            $updated[] = $record;
        }

        return response()->json([
            'success' => true,
            'message' => 'ההגדרות עודכנו בהצלחה',
            'data' => $updated,
        ]);
    }

    // ==========================================
    // Pricing Tiers
    // ==========================================

    /**
     * Default pricing (fallback if no DB record)
     */
    private static array $defaultPricing = [
        'basic' => [
            'label'            => 'בייסיק',
            'monthly'          => 450,
            'yearly'           => 4500,
            'ai_credits'       => 0,
            'trial_ai_credits' => 0,
            'features'         => ['תפריט דיגיטלי', 'ניהול הזמנות', 'דוחות בסיסיים'],
        ],
        'pro' => [
            'label'            => 'פרו',
            'monthly'          => 600,
            'yearly'           => 5000,
            'ai_credits'       => 500,
            'trial_ai_credits' => 50,
            'features'         => ['תפריט דיגיטלי', 'ניהול הזמנות', 'דוחות מתקדמים', 'AI מתקדם', 'תמיכה מועדפת'],
        ],
    ];

    /**
     * Get pricing tiers (super admin)
     */
    public function getPricingTiers()
    {
        $tiers = SystemSetting::get('pricing_tiers');

        if (!$tiers || !is_array($tiers)) {
            $tiers = self::$defaultPricing;
        }

        return response()->json([
            'success' => true,
            'data'    => $tiers,
        ]);
    }

    /**
     * Update pricing tiers (super admin)
     */
    public function updatePricingTiers(Request $request)
    {
        $validated = $request->validate([
            'tiers'                        => 'required|array',
            'tiers.basic'                  => 'required|array',
            'tiers.basic.label'            => 'required|string|max:50',
            'tiers.basic.monthly'          => 'required|numeric|min:0',
            'tiers.basic.yearly'           => 'required|numeric|min:0',
            'tiers.basic.ai_credits'       => 'required|integer|min:0',
            'tiers.basic.trial_ai_credits' => 'required|integer|min:0',
            'tiers.basic.features'         => 'required|array',
            'tiers.basic.features.*'       => 'string|max:100',
            'tiers.pro'                    => 'required|array',
            'tiers.pro.label'              => 'required|string|max:50',
            'tiers.pro.monthly'            => 'required|numeric|min:0',
            'tiers.pro.yearly'             => 'required|numeric|min:0',
            'tiers.pro.ai_credits'         => 'required|integer|min:0',
            'tiers.pro.trial_ai_credits'   => 'required|integer|min:0',
            'tiers.pro.features'           => 'required|array',
            'tiers.pro.features.*'         => 'string|max:100',
        ]);

        SystemSetting::set(
            'pricing_tiers',
            $validated['tiers'],
            'json',
            'billing',
            'מחירי חבילות (basic/pro)'
        );

        Log::info('Pricing tiers updated by super admin', [
            'user_id' => $request->user()->id,
            'tiers'   => $validated['tiers'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'המחירים עודכנו בהצלחה',
            'data'    => $validated['tiers'],
        ]);
    }

    /**
     * Public endpoint — pricing for registration page
     */
    public static function getPublicPricing()
    {
        $tiers = SystemSetting::get('pricing_tiers');

        if (!$tiers || !is_array($tiers)) {
            $tiers = self::$defaultPricing;
        }

        return response()->json([
            'success' => true,
            'data'    => $tiers,
        ]);
    }

    /**
     * Helper: get pricing array (for use in other controllers/services)
     */
    public static function getPricingArray(): array
    {
        $tiers = SystemSetting::get('pricing_tiers');

        if (!$tiers || !is_array($tiers)) {
            return self::$defaultPricing;
        }

        return $tiers;
    }

    // ==========================================
    // Policy Versions
    // ==========================================

    /**
     * Get all versions of a policy type
     */
    public function getPolicies($type)
    {
        $validTypes = ['terms_end_user', 'terms_restaurant', 'privacy_policy', 'cookie_banner'];

        if (!in_array($type, $validTypes)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid policy type',
            ], 400);
        }

        $versions = PolicyVersion::ofType($type)
            ->with('creator:id,name')
            ->orderByDesc('version')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $versions,
        ]);
    }

    /**
     * Create a new policy version
     */
    public function createPolicyVersion(Request $request)
    {
        $validated = $request->validate([
            'policy_type' => 'required|string|in:terms_end_user,terms_restaurant,privacy_policy,cookie_banner',
            'content' => 'required|string',
        ]);

        $lastVersion = PolicyVersion::ofType($validated['policy_type'])
            ->max('version') ?? 0;

        $version = PolicyVersion::create([
            'policy_type' => $validated['policy_type'],
            'content' => $validated['content'],
            'version' => $lastVersion + 1,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'גרסה חדשה נוצרה',
            'data' => $version,
        ], 201);
    }

    /**
     * Publish a policy version
     */
    public function publishPolicy($id)
    {
        $version = PolicyVersion::findOrFail($id);

        // Unpublish all other versions of this type
        PolicyVersion::ofType($version->policy_type)
            ->where('id', '!=', $id)
            ->update(['is_published' => false]);

        $version->update([
            'is_published' => true,
            'published_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'המדיניות פורסמה בהצלחה',
            'data' => $version,
        ]);
    }

    /**
     * Public endpoint: Get the published version of a policy
     */
    public function getPublishedPolicy($type)
    {
        $validTypes = ['terms_end_user', 'terms_restaurant', 'privacy_policy', 'cookie_banner'];

        if (!in_array($type, $validTypes)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid policy type',
            ], 404);
        }

        $policy = PolicyVersion::getPublished($type);

        if (!$policy) {
            return response()->json([
                'success' => false,
                'message' => 'No published policy found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'content' => $policy->content,
                'version' => $policy->version,
                'published_at' => $policy->published_at,
            ],
        ]);
    }

    // ==========================================
    // Database Maintenance
    // ==========================================

    /**
     * Get database status info
     */
    public function getDatabaseStatus()
    {
        try {
            $dbName = DB::selectOne('SELECT DATABASE() as db')->db;

            // Table sizes
            $tables = DB::select(<<<SQL
                SELECT TABLE_NAME as table_name,
                       TABLE_ROWS as row_count,
                       ROUND(DATA_LENGTH / 1024 / 1024, 2) as data_size_mb,
                       ROUND(INDEX_LENGTH / 1024 / 1024, 2) as index_size_mb
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ?
                ORDER BY DATA_LENGTH DESC
                LIMIT 20
            SQL, [$dbName]);

            // Pending migrations
            $ranMigrations = DB::table('migrations')->pluck('migration')->toArray();

            // Queue jobs count
            $queueJobs = 0;
            try {
                $queueJobs = DB::table('jobs')->count();
            } catch (\Exception $e) {
                // jobs table might not exist
            }

            // Failed jobs
            $failedJobs = 0;
            try {
                $failedJobs = DB::table('failed_jobs')->count();
            } catch (\Exception $e) {
                // failed_jobs table might not exist
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'database_name' => $dbName,
                    'tables' => $tables,
                    'total_migrations' => count($ranMigrations),
                    'queue_pending' => $queueJobs,
                    'queue_failed' => $failedJobs,
                    'system_errors_unresolved' => SystemError::unresolved()->count(),
                    'system_errors_total' => SystemError::count(),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Database status error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בשליפת סטטוס: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Run database backup (triggers artisan command)
     */
    public function runBackup(Request $request)
    {
        try {
            Log::info('Database backup triggered by super admin', [
                'user_id' => $request->user()->id,
            ]);

            // Run mysqldump
            $dbName = config('database.connections.mysql.database');
            $dbUser = config('database.connections.mysql.username');
            $dbPass = config('database.connections.mysql.password');
            $dbHost = config('database.connections.mysql.host');
            $timestamp = now()->format('Y-m-d_H-i-s');
            $backupPath = storage_path("app/backups/{$timestamp}_{$dbName}.sql");

            // Ensure backup directory exists
            if (!is_dir(storage_path('app/backups'))) {
                mkdir(storage_path('app/backups'), 0755, true);
            }

            $command = sprintf(
                'mysqldump -h%s -u%s -p%s %s > %s 2>&1',
                escapeshellarg($dbHost),
                escapeshellarg($dbUser),
                escapeshellarg($dbPass),
                escapeshellarg($dbName),
                escapeshellarg($backupPath)
            );

            exec($command, $output, $returnVar);

            if ($returnVar !== 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'גיבוי נכשל',
                    'error' => implode("\n", $output),
                ], 500);
            }

            $fileSize = file_exists($backupPath) ? round(filesize($backupPath) / 1024 / 1024, 2) : 0;

            return response()->json([
                'success' => true,
                'message' => 'גיבוי בוצע בהצלחה',
                'data' => [
                    'file' => basename($backupPath),
                    'size_mb' => $fileSize,
                    'timestamp' => $timestamp,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Backup error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בגיבוי: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Clear old logs
     */
    public function clearOldLogs(Request $request)
    {
        $validated = $request->validate([
            'days' => 'required|integer|min:7|max:365',
            'tables' => 'required|array',
            'tables.*' => 'string|in:order_events,system_errors,ai_usage_logs',
        ]);

        $cutoff = now()->subDays($validated['days']);
        $results = [];

        foreach ($validated['tables'] as $table) {
            $deleted = DB::table($table)
                ->where('created_at', '<', $cutoff)
                ->delete();
            $results[$table] = $deleted;
        }

        Log::info('Logs cleared by super admin', [
            'user_id' => $request->user()->id,
            'days' => $validated['days'],
            'results' => $results,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'לוגים נוקו בהצלחה',
            'data' => $results,
        ]);
    }

    /**
     * Optimize database tables
     */
    public function optimizeTables()
    {
        try {
            $dbName = DB::selectOne('SELECT DATABASE() as db')->db;

            $tables = DB::select(<<<SQL
                SELECT TABLE_NAME as table_name
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ?
                AND TABLE_TYPE = 'BASE TABLE'
            SQL, [$dbName]);

            $optimized = [];
            foreach ($tables as $table) {
                DB::statement("OPTIMIZE TABLE `{$table->table_name}`");
                $optimized[] = $table->table_name;
            }

            return response()->json([
                'success' => true,
                'message' => 'טבלאות אופטימזו בהצלחה',
                'data' => [
                    'tables_optimized' => count($optimized),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה באופטימיזציה: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ==========================================
    // SMTP & SMS Status
    // ==========================================

    /**
     * Get SMTP status
     */
    public function getSmtpStatus()
    {
        try {
            $host = config('mail.mailers.smtp.host');
            $port = config('mail.mailers.smtp.port');
            $encryption = config('mail.mailers.smtp.encryption');
            $configured = !empty($host) && $host !== '127.0.0.1' && $host !== 'localhost';

            $connected = false;
            if ($configured) {
                try {
                    $transport = new \Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport(
                        $host,
                        (int) $port,
                        $encryption === 'tls',
                    );
                    $username = config('mail.mailers.smtp.username');
                    $password = config('mail.mailers.smtp.password');
                    if ($username && $password && $username !== 'null' && $password !== 'null') {
                        $transport->setUsername($username);
                        $transport->setPassword($password);
                    }
                    $transport->start();
                    $transport->stop();
                    $connected = true;
                } catch (\Exception $e) {
                    Log::debug('SMTP connection test failed', ['error' => $e->getMessage()]);
                }
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'driver' => config('mail.default'),
                    'host' => $host,
                    'port' => $port,
                    'encryption' => $encryption,
                    'from_address' => config('mail.from.address'),
                    'from_name' => config('mail.from.name'),
                    'configured' => $configured,
                    'connected' => $connected,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send a test email via SMTP
     */
    public function testSmtp(Request $request)
    {
        try {
            $host = config('mail.mailers.smtp.host');
            if (empty($host) || $host === '127.0.0.1' || $host === 'localhost') {
                return response()->json([
                    'success' => false,
                    'message' => 'שרת SMTP לא מוגדר. הגדר כתובת שרת תקינה.',
                ], 400);
            }

            if (config('mail.default') === 'log') {
                return response()->json([
                    'success' => false,
                    'message' => 'מנוע הדוא״ל מוגדר כ-log בלבד. יש לשנות MAIL_MAILER ל-smtp ב-.env',
                ], 400);
            }

            $toEmail = $request->user()->email ?? config('mail.from.address');

            Mail::raw('זוהי הודעת בדיקה ממערכת TakeEat. אם קיבלת הודעה זו, שרת ה-SMTP מוגדר ועובד כראוי.', function ($message) use ($toEmail) {
                $message->to($toEmail)
                    ->subject('בדיקת SMTP - TakeEat');
            });

            return response()->json([
                'success' => true,
                'message' => 'אימייל בדיקה נשלח בהצלחה ל-' . $toEmail,
            ]);
        } catch (\Exception $e) {
            Log::error('SMTP test failed', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'שליחת בדיקה נכשלה: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get SMS provider balance/status
     */
    public function getSmsBalance()
    {
        try {
            $pilotMode = filter_var(config('sms.pilot', false), FILTER_VALIDATE_BOOLEAN);
            $provider = $pilotMode ? 'twilio' : (string) config('sms.provider', 'twilio');

            $providerNames = [
                'twilio' => 'Twilio',
                'sms019' => '019 SMS',
                '019sms' => '019 SMS',
                '019' => '019 SMS',
            ];

            if (in_array($provider, ['sms019', '019sms', '019'])) {
                $configured = !empty(config('sms.providers.sms019.token'))
                    && !empty(config('sms.providers.sms019.username'));
            } else {
                $configured = !empty(config('sms.providers.twilio.sid'))
                    && !empty(config('sms.providers.twilio.token'));
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'provider' => $provider,
                    'provider_name' => $providerNames[$provider] ?? $provider,
                    'configured' => $configured,
                    'active' => $configured,
                    'pilot_mode' => $pilotMode,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    // ==========================================
    // Audit/System Errors
    // ==========================================

    /**
     * Get system errors (audit log)
     */
    public function getAuditLog(Request $request)
    {
        $query = SystemError::query();

        if ($request->has('severity')) {
            $query->where('severity', $request->severity);
        }

        if ($request->has('resolved')) {
            $query->where('resolved', filter_var($request->resolved, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->has('error_type')) {
            $query->where('error_type', $request->error_type);
        }

        if ($request->has('from')) {
            $query->where('created_at', '>=', $request->from);
        }

        if ($request->has('to')) {
            $query->where('created_at', '<=', $request->to);
        }

        $errors = $query->orderByDesc('created_at')->paginate(50);

        return response()->json([
            'success' => true,
            'data' => $errors,
        ]);
    }
}
