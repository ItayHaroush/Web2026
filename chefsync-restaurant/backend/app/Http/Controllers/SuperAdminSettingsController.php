<?php

namespace App\Http\Controllers;

use App\Models\PolicyVersion;
use App\Models\SystemError;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class SuperAdminSettingsController extends Controller
{
    /**
     * Get all settings for a group
     */
    public function getSettings($group)
    {
        $validGroups = ['regional', 'billing', 'security', 'notifications'];

        if (! in_array($group, $validGroups)) {
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
            'label' => 'אתר הזמנות',
            'monthly' => 299,
            'yearly' => 2990,
            'ai_credits' => 1,
            'trial_ai_credits' => 1,
            'features' => ['אתר הזמנות', 'תפריט + מבצעים', 'משלוחים / איסוף', 'לינק + QR', 'דוח חודשי', 'טעימת AI', 'עד 50 הזמנות ראשונות'],
        ],
        'pro' => [
            'label' => 'ניהול חכם',
            'monthly' => 449,
            'yearly' => 4490,
            'ai_credits' => 500,
            'trial_ai_credits' => 50,
            'features' => ['הכל מהבסיס', 'הדפסה אוטומטית', 'דוחות יומיים + פילוחים', 'סוכן חכם מלא', 'ניהול עובדים', 'ללא הגבלת הזמנות'],
        ],
        'enterprise' => [
            'label' => 'מסעדה מלאה',
            'monthly' => 0,
            'yearly' => 0,
            'ai_credits' => 1000,
            'trial_ai_credits' => 100,
            'features' => ['קופה בענן', 'דוחות שעות עובדים', 'קיוסק', 'מסכי תצוגה ללא הגבלה', 'עד 5 מדפסות', 'עובדים ללא הגבלה', 'שליטה מלאה'],
            'contactOnly' => true,
        ],
    ];

    /**
     * Get pricing tiers (super admin)
     */
    public function getPricingTiers()
    {
        $tiers = SystemSetting::get('pricing_tiers');

        if (! $tiers || ! is_array($tiers)) {
            $tiers = self::$defaultPricing;
        } else {
            // Merge with defaults to ensure all tiers (including enterprise) exist
            $tiers = array_replace_recursive(self::$defaultPricing, $tiers);
        }

        return response()->json([
            'success' => true,
            'data' => $tiers,
        ]);
    }

    /**
     * Update pricing tiers (super admin)
     */
    public function updatePricingTiers(Request $request)
    {
        $validated = $request->validate([
            'tiers' => 'required|array',
            'tiers.basic' => 'required|array',
            'tiers.basic.label' => 'required|string|max:50',
            'tiers.basic.monthly' => 'required|numeric|min:0',
            'tiers.basic.yearly' => 'required|numeric|min:0',
            'tiers.basic.ai_credits' => 'required|integer|min:0',
            'tiers.basic.trial_ai_credits' => 'required|integer|min:0',
            'tiers.basic.features' => 'required|array',
            'tiers.basic.features.*' => 'string|max:100',
            'tiers.pro' => 'required|array',
            'tiers.pro.label' => 'required|string|max:50',
            'tiers.pro.monthly' => 'required|numeric|min:0',
            'tiers.pro.yearly' => 'required|numeric|min:0',
            'tiers.pro.ai_credits' => 'required|integer|min:0',
            'tiers.pro.trial_ai_credits' => 'required|integer|min:0',
            'tiers.pro.features' => 'required|array',
            'tiers.pro.features.*' => 'string|max:100',
            'tiers.enterprise' => 'sometimes|array',
            'tiers.enterprise.label' => 'sometimes|string|max:50',
            'tiers.enterprise.monthly' => 'sometimes|numeric|min:0',
            'tiers.enterprise.yearly' => 'sometimes|numeric|min:0',
            'tiers.enterprise.ai_credits' => 'sometimes|integer|min:0',
            'tiers.enterprise.trial_ai_credits' => 'sometimes|integer|min:0',
            'tiers.enterprise.features' => 'sometimes|array',
            'tiers.enterprise.features.*' => 'string|max:100',
            'tiers.enterprise.contactOnly' => 'sometimes|boolean',
        ]);

        SystemSetting::set(
            'pricing_tiers',
            $validated['tiers'],
            'json',
            'billing',
            'מחירי חבילות (basic/pro/enterprise)'
        );

        Log::info('Pricing tiers updated by super admin', [
            'user_id' => $request->user()->id,
            'tiers' => $validated['tiers'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'המחירים עודכנו בהצלחה',
            'data' => $validated['tiers'],
        ]);
    }

    /**
     * Public endpoint — pricing for registration page
     */
    public static function getPublicPricing()
    {
        $tiers = SystemSetting::get('pricing_tiers');

        if (! $tiers || ! is_array($tiers)) {
            $tiers = self::$defaultPricing;
        } else {
            $tiers = array_replace_recursive(self::$defaultPricing, $tiers);
        }

        return response()->json([
            'success' => true,
            'data' => $tiers,
        ]);
    }

    /**
     * Helper: get pricing array (for use in other controllers/services)
     */
    public static function getPricingArray(): array
    {
        $tiers = SystemSetting::get('pricing_tiers');

        if (! $tiers || ! is_array($tiers)) {
            return self::$defaultPricing;
        }

        // Merge with defaults to ensure all tiers (including enterprise) exist
        return array_replace_recursive(self::$defaultPricing, $tiers);
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

        if (! in_array($type, $validTypes)) {
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

        if (! in_array($type, $validTypes)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid policy type',
            ], 404);
        }

        $policy = PolicyVersion::getPublished($type);

        if (! $policy) {
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

            $tableCountRow = DB::selectOne(<<<'SQL'
                SELECT COUNT(*) as c
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ?
                  AND TABLE_TYPE = 'BASE TABLE'
            SQL, [$dbName]);
            $tableCount = (int) ($tableCountRow->c ?? 0);

            // Table sizes
            $tables = DB::select(<<<'SQL'
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
                    'table_count' => $tableCount,
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
     * Run database backup via mysqldump (requires MySQL client on the app server).
     */
    public function runBackup(Request $request)
    {
        try {
            Log::info('Database backup triggered by super admin', [
                'user_id' => $request->user()->id,
            ]);

            $connectionName = config('database.default');
            $connection = config("database.connections.{$connectionName}", []);
            $driver = $connection['driver'] ?? '';

            if (! in_array($driver, ['mysql', 'mariadb'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'גיבוי דרך mysqldump זמין רק עבור חיבור MySQL/MariaDB. השתמש בגיבוי של ספק ה-DB או ב-SQLite העתקת קובץ.',
                ], 422);
            }

            $dbName = $connection['database'] ?? '';
            $dbUser = $connection['username'] ?? '';
            $dbPass = (string) ($connection['password'] ?? '');
            $dbHost = $connection['host'] ?? '127.0.0.1';
            $dbPort = (string) ($connection['port'] ?? '3306');
            $dbSocket = $connection['unix_socket'] ?? '';

            if ($dbName === '') {
                return response()->json([
                    'success' => false,
                    'message' => 'שם בסיס הנתונים לא מוגדר.',
                ], 422);
            }

            $mysqldump = $this->resolveMysqldumpBinary();

            if ($mysqldump === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'לא נמצאה תוכנית mysqldump. התקן לקוח MySQL/MariaDB (למשל macOS: brew install mysql-client), או הוסף ב-.env את MYSQLDUMP_PATH עם נתיב מלא (לדוגמה /opt/homebrew/bin/mysqldump). שים לב: תהליך ה-PHP חייב לראות את הקובץ ב-PATH או בנתיב המפורש.',
                ], 500);
            }

            $timestamp = now()->format('Y-m-d_H-i-s');
            $safeBase = preg_replace('/[^a-zA-Z0-9._-]+/', '_', $dbName) ?: 'database';
            $backupPath = storage_path("app/backups/{$timestamp}_{$safeBase}.sql");

            if (! is_dir(storage_path('app/backups'))) {
                mkdir(storage_path('app/backups'), 0755, true);
            }

            $args = [$mysqldump];
            if ($dbSocket !== '') {
                $args[] = '--socket=' . $dbSocket;
            } else {
                $args[] = '-h';
                $args[] = $dbHost;
                $args[] = '-P';
                $args[] = $dbPort;
            }
            $args = array_merge($args, [
                '-u',
                $dbUser,
                '--password=' . $dbPass,
                '--single-transaction',
                '--quick',
                '--skip-lock-tables',
                $dbName,
            ]);

            $process = new Process($args);
            $process->setTimeout(3600);
            $process->run();

            $stderr = trim($process->getErrorOutput());
            $stdout = trim($process->getOutput());
            $combined = trim($stderr !== '' ? $stderr : $stdout);

            if (! $process->isSuccessful()) {
                Log::warning('mysqldump failed', [
                    'exit_code' => $process->getExitCode(),
                    'error' => $combined,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'גיבוי נכשל (mysqldump)',
                    'error' => $combined !== '' ? $combined : 'קוד יציאה: ' . $process->getExitCode(),
                ], 500);
            }

            if ($stdout === '') {
                return response()->json([
                    'success' => false,
                    'message' => 'גיבוי הושלם ללא פלט — בדוק הרשאות וחיבור לבסיס הנתונים.',
                    'error' => $stderr,
                ], 500);
            }

            if (! $this->isPlausibleMysqldumpOutput($stdout)) {
                Log::warning('mysqldump output rejected (not a valid SQL dump)', [
                    'excerpt' => mb_substr($stdout, 0, 200),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'הפלט אינו גיבוי SQL תקין (למשל שגיאת shell במקום mysqldump). התקן mysql-client והגדר MYSQLDUMP_PATH ב-.env.',
                    'error' => mb_substr($stdout, 0, 500),
                ], 500);
            }

            if (file_put_contents($backupPath, $stdout) === false) {
                return response()->json([
                    'success' => false,
                    'message' => 'לא ניתן לכתוב קובץ גיבוי ל-storage/app/backups',
                ], 500);
            }

            $fileSize = round(filesize($backupPath) / 1024 / 1024, 2);

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
     * True if stdout looks like mysqldump (not a shell error accidentally saved as .sql).
     */
    private function isPlausibleMysqldumpOutput(string $stdout): bool
    {
        $s = ltrim($stdout);
        if ($s === '') {
            return false;
        }

        if (preg_match('/command not found|not found$/mi', $s)) {
            return false;
        }

        if (preg_match('/^sh:\\s*\\S+:\\s*command not found/mi', $s)) {
            return false;
        }

        if (preg_match('/^--\s*(MySQL|MariaDB)\s+dump\b/mi', $s)) {
            return true;
        }

        if (str_contains($s, 'CREATE TABLE') || str_contains($s, '/*!40') || str_contains($s, 'LOCK TABLES `')) {
            return true;
        }

        return strlen($s) > 200 && str_starts_with($s, '--');
    }

    /**
     * Locate mysqldump: MYSQLDUMP_PATH, enriched PATH + sh, ExecutableFinder extra dirs, Cellar globs, fixed paths.
     */
    private function resolveMysqldumpBinary(): ?string
    {
        $candidates = [];

        $configured = config('database.mysqldump_path');
        if (is_string($configured) && $configured !== '') {
            $candidates[] = $configured;
        }

        $extraDirs = [
            '/opt/homebrew/bin',
            '/opt/homebrew/sbin',
            '/opt/homebrew/opt/mysql-client/bin',
            '/opt/homebrew/opt/mysql/bin',
            '/opt/homebrew/opt/mariadb/bin',
            '/usr/local/bin',
            '/usr/local/sbin',
            '/usr/local/mysql/bin',
            '/usr/bin',
            '/bin',
            '/usr/sbin',
            '/sbin',
        ];

        $finderPath = (new ExecutableFinder)->find('mysqldump', null, $extraDirs);
        if (is_string($finderPath) && $finderPath !== '') {
            $candidates[] = $finderPath;
        }

        if (PHP_OS_FAMILY !== 'Windows') {
            $pathEnv = getenv('PATH') ?: '/usr/bin:/bin';
            $enrichedPath = implode(':', array_unique(array_merge(
                $extraDirs,
                explode(PATH_SEPARATOR, $pathEnv)
            )));
            try {
                $probe = new Process(
                    ['sh', '-c', 'command -v mysqldump 2>/dev/null'],
                    null,
                    ['PATH' => $enrichedPath]
                );
                $probe->setTimeout(8);
                $probe->run();
                $line = trim($probe->getOutput());
                if ($line !== '' && str_contains($line, 'mysqldump')) {
                    $candidates[] = preg_split('/\s+/', $line, 2)[0];
                }
            } catch (\Throwable) {
                // ignore
            }
        }

        foreach (
            [
                '/opt/homebrew/Cellar/mysql-client/*/bin/mysqldump',
                '/opt/homebrew/Cellar/mysql/*/bin/mysqldump',
                '/opt/homebrew/Cellar/mariadb/*/bin/mysqldump',
                '/usr/local/Cellar/mysql-client/*/bin/mysqldump',
                '/usr/local/Cellar/mysql/*/bin/mysqldump',
            ] as $pattern
        ) {
            foreach (glob($pattern, GLOB_NOSORT) ?: [] as $p) {
                $candidates[] = $p;
            }
        }

        $candidates = array_merge($candidates, [
            '/opt/homebrew/bin/mysqldump',
            '/opt/homebrew/opt/mysql-client/bin/mysqldump',
            '/opt/homebrew/opt/mysql/bin/mysqldump',
            '/opt/homebrew/opt/mariadb/bin/mysqldump',
            '/usr/local/bin/mysqldump',
            '/usr/local/mysql/bin/mysqldump',
            '/usr/bin/mysqldump',
            '/bin/mysqldump',
        ]);

        foreach (array_unique(array_filter($candidates)) as $path) {
            if (! is_string($path) || $path === '') {
                continue;
            }
            if ($this->mysqldumpBinaryWorks($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * True if path is a runnable mysqldump (handles PHP-FPM PATH / is_executable edge cases).
     */
    private function mysqldumpBinaryWorks(string $path): bool
    {
        if (! is_file($path)) {
            return false;
        }

        if (PHP_OS_FAMILY === 'Windows') {
            return str_ends_with(strtolower($path), '.exe') || is_executable($path);
        }

        if (is_executable($path)) {
            return true;
        }

        try {
            $p = new Process([$path, '--version']);
            $p->setTimeout(10);
            $p->run();

            return $p->isSuccessful();
        } catch (\Throwable) {
            return false;
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

            $tables = DB::select(<<<'SQL'
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
     * Get SMTP status — uses the same Symfony transport Laravel resolves for the default mailer (incl. smtps/ssl on 465).
     */
    public function getSmtpStatus()
    {
        try {
            $host = config('mail.mailers.smtp.host');
            $port = config('mail.mailers.smtp.port');
            $encryption = config('mail.mailers.smtp.encryption');
            $configured = ! empty($host) && $host !== '127.0.0.1' && $host !== 'localhost';
            $driver = config('mail.default');

            $fromAddress = (string) config('mail.from.address', '');
            $fromDomain = null;
            if ($fromAddress !== '' && str_contains($fromAddress, '@')) {
                $fromDomain = strtolower(substr(strrchr($fromAddress, '@'), 1));
            }

            $encLower = $encryption ? strtolower((string) $encryption) : '';
            $tlsWarning = $configured && ($encLower === '' || $encLower === 'none');

            $connected = false;
            $connectionTest = 'smtp_socket';
            $connectionNote = null;
            $connectionError = null;

            if (in_array($driver, ['log', 'array'], true)) {
                $connectionTest = 'skipped';
                $connected = true;
                $connectionNote = 'מצב פיתוח: המייל נכתב ללוג/זיכרון בלבד — לא נשלח דרך SMTP.';
            } elseif ($driver !== 'smtp') {
                $connectionTest = 'not_applicable';
                $connected = true;
                $connectionNote = 'המיילר הפעיל אינו smtp — בדיקת חיבור לשרת SMTP אינה משקפת את שליחת הדוא״ל בפועל.';
            } elseif ($configured) {
                try {
                    $transport = app('mail.manager')->mailer()->getSymfonyTransport();
                    if ($transport instanceof EsmtpTransport) {
                        $transport->start();
                        $transport->stop();
                        $connected = true;
                    } else {
                        $connectionTest = 'not_applicable';
                        $connectionNote = 'Transport אינו SMTP — לא נבדק חיבור לשרת.';
                    }
                } catch (\Throwable $e) {
                    Log::debug('SMTP connection test failed', ['error' => $e->getMessage()]);
                    $connected = false;
                    $connectionError = $e->getMessage();
                }
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'driver' => $driver,
                    'host' => $host,
                    'port' => $port,
                    'encryption' => $encryption,
                    'from_address' => config('mail.from.address'),
                    'from_name' => config('mail.from.name'),
                    'configured' => $configured,
                    'connected' => $connected,
                    'connection_test' => $connectionTest,
                    'connection_note' => $connectionNote,
                    'connection_error' => $connectionError,
                    'bulk_delay_seconds' => (int) config('mail.bulk_delay_seconds', 2),
                    'deliverability' => [
                        'from_domain' => $fromDomain,
                        'tls_recommended' => ! $tlsWarning,
                        'tls_warning' => $tlsWarning,
                        'dns_reminder' => 'יש להגדיר ברשם ה-DNS של הדומיין שבכתובת השולח (From): SPF, DKIM ו-DMARC — לפי הנחיות Google לשולחים ל-Gmail.',
                        'ptr_reminder' => 'כתובת ה-IP שממנה יוצא SMTP צריכה PTR (reverse DNS) תקין — רלוונטי בעיקר לשרת VPS ייעודי.',
                        'google_sender_guidelines_url' => config('deliverability.google_sender_guidelines_url'),
                        'google_sender_faq_url' => config('deliverability.google_sender_faq_url'),
                        'postmaster_tools_url' => config('deliverability.postmaster_tools_url'),
                    ],
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
                $configured = ! empty(config('sms.providers.sms019.token'))
                    && ! empty(config('sms.providers.sms019.username'));
            } else {
                $configured = ! empty(config('sms.providers.twilio.sid'))
                    && ! empty(config('sms.providers.twilio.token'));
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

        $resolved = $request->query('resolved');
        if ($resolved === 'all') {
            // no filter
        } elseif ($resolved === null) {
            $query->where('resolved', false);
        } else {
            $query->where('resolved', filter_var($resolved, FILTER_VALIDATE_BOOLEAN));
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
