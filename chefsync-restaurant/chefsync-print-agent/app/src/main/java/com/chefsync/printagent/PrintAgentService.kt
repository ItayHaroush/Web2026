package com.chefsync.printagent

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class PrintAgentService : Service() {
    companion object {
        private const val TAG = "PrintAgentService"
        private const val CHANNEL_ID = "print_agent_channel"
        private const val NOTIFICATION_ID = 1
        private const val MIN_POLL_INTERVAL = 3000L
        private const val MAX_POLL_INTERVAL = 10000L
        private const val BACKOFF_THRESHOLD = 30000L
        private const val DEFAULT_HEARTBEAT_INTERVAL = 30000L
        private const val OFFLINE_RETRY_INTERVAL = 5000L
        private const val AGENT_VERSION = "1.2.0"

        // Retry policy: attempt 1 immediate, then 5s / 10s / 15s / 20s before attempts 2..5.
        private val RETRY_DELAYS_MS = longArrayOf(0L, 5000L, 10000L, 15000L, 20000L)
        private const val MAX_PRINT_ATTEMPTS = 5
        // A lost ACK leaves the server job stuck in "printing" — retry the ACK a few times.
        private const val ACK_MAX_RETRIES = 3
        private const val ACK_RETRY_DELAY_MS = 2000L

        // Auto Recovery: after 3 consecutive print failures, scan the LAN for the printer's
        // (possibly changed) IP and report a suggestion to the server.
        private const val AUTO_RECOVERY_FAILURE_THRESHOLD = 3
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pollInterval = MIN_POLL_INTERVAL
    private var lastJobReceivedAt = System.currentTimeMillis()

    // Concurrent Prints = 1: serialize printing and keep the heartbeat probe off the
    // printer socket while a job is in flight.
    private val printMutex = Mutex()
    @Volatile private var isPrinting = false

    // ── Cached config (in-memory; persisted to AgentConfigStore on every heartbeat) ──
    @Volatile private var cachedPrinterIp: String? = null
    @Volatile private var cachedPrinterPort: Int = 9100
    @Volatile private var cachedProbeTimeoutMs: Int = 1500
    @Volatile private var cachedHeartbeatIntervalMs: Long = DEFAULT_HEARTBEAT_INTERVAL
    @Volatile private var lastPrinterProbeOk: Boolean? = null
    @Volatile private var lastPrinterProbeError: String? = null

    // ── Auto Recovery state ──────────────────────────────────────────────────
    @Volatile private var consecutivePrintFailures = 0
    @Volatile private var isAutoRecovering = false
    @Volatile private var autoRecoverySuggestedIp: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("ChefSync Print Agent — מאתחל..."))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = AgentConfigStore.prefs(this)
        val serverUrl = prefs.getString(AgentConfigStore.KEY_SERVER_URL, null)
        val deviceToken = prefs.getString(AgentConfigStore.KEY_DEVICE_TOKEN, null)

        if (serverUrl == null || deviceToken == null) {
            Log.e(TAG, "Missing configuration, stopping service")
            stopSelf()
            return START_NOT_STICKY
        }

        // טעינת תצורה מקומית (מהפעם הקודמת) — מאפשרת בדיקת מדפסת גם בלי רשת
        cachedPrinterIp = prefs.getString(AgentConfigStore.KEY_PRINTER_IP, null)
        cachedPrinterPort = prefs.getInt(AgentConfigStore.KEY_PRINTER_PORT, 9100)
        cachedProbeTimeoutMs = prefs.getInt(AgentConfigStore.KEY_PROBE_TIMEOUT_MS, 1500)
        cachedHeartbeatIntervalMs = prefs.getInt(
            AgentConfigStore.KEY_HEARTBEAT_INTERVAL_SECONDS,
            (DEFAULT_HEARTBEAT_INTERVAL / 1000).toInt()
        ) * 1000L

        ApiClient.init(serverUrl)
        val authHeader = "Bearer $deviceToken"

        startPollingLoop(authHeader)
        startHeartbeatLoop(authHeader)

        return START_STICKY
    }

    private fun startPollingLoop(authHeader: String) {
        scope.launch {
            while (isActive) {
                try {
                    val response = ApiClient.get().getJobs(authHeader)
                    if (response.isSuccessful) {
                        val jobs = response.body()?.jobs ?: emptyList()
                        if (jobs.isNotEmpty()) {
                            lastJobReceivedAt = System.currentTimeMillis()
                            pollInterval = MIN_POLL_INTERVAL
                            processJobs(jobs, authHeader)
                        } else {
                            adjustBackoff()
                        }
                    } else {
                        Log.w(TAG, "Poll failed: ${response.code()}")
                        adjustBackoff()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Poll error: ${e.message}")
                    adjustBackoff()
                }
                delay(pollInterval)
            }
        }
    }

    /**
     * לולאת heartbeat: בכל מחזור —
     *   1) סוקר את המדפסת ב-TCP (אם יש IP)
     *   2) שולח לשרת מצב מלא: {bridge_online, printer_connected, printer_last_error}
     *   3) מקבל בחזרה תצורה מעודכנת (printer_ip/port/codepage) ושומר מקומית
     *
     * אם השרת לא זמין — אנחנו מקצרים את המרווח עד 5ש' כדי להחזיר את עצמנו online מהר.
     */
    private fun startHeartbeatLoop(authHeader: String) {
        scope.launch {
            while (isActive) {
                // Skip the TCP probe while printing — only one socket to the printer at a time.
                val probe = if (isPrinting) {
                    PrinterBridge.ProbeResult(success = lastPrinterProbeOk ?: true, errorMessage = lastPrinterProbeError)
                } else {
                    PrinterBridge.probe(
                        cachedPrinterIp,
                        cachedPrinterPort,
                        cachedProbeTimeoutMs
                    )
                }
                lastPrinterProbeOk = probe.success
                lastPrinterProbeError = probe.errorMessage

                updateStatusNotification()

                var nextDelay = cachedHeartbeatIntervalMs

                try {
                    val response = ApiClient.get().heartbeat(
                        authHeader,
                        HeartbeatRequest(
                            bridge_online = true,
                            printer_connected = probe.success,
                            printer_last_error = if (probe.success) null else probe.errorMessage,
                            agent_version = AGENT_VERSION,
                        )
                    )

                    if (response.isSuccessful) {
                        response.body()?.config?.let { applyServerConfig(it) }
                    } else {
                        Log.w(TAG, "Heartbeat HTTP ${response.code()}")
                        nextDelay = OFFLINE_RETRY_INTERVAL
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat error: ${e.message}")
                    nextDelay = OFFLINE_RETRY_INTERVAL
                }

                delay(nextDelay)
            }
        }
    }

    private fun applyServerConfig(config: AgentConfigResponse) {
        val prefs = AgentConfigStore.prefs(this)
        val editor = prefs.edit()

        config.printer_ip?.let {
            cachedPrinterIp = it
            editor.putString(AgentConfigStore.KEY_PRINTER_IP, it)
        }
        config.printer_port?.let {
            cachedPrinterPort = it
            editor.putInt(AgentConfigStore.KEY_PRINTER_PORT, it)
        }
        config.codepage_id?.let { editor.putInt(AgentConfigStore.KEY_CODEPAGE_ID, it) }
        config.role?.let { editor.putString(AgentConfigStore.KEY_ROLE, it) }
        config.restaurant_id?.let { editor.putLong(AgentConfigStore.KEY_RESTAURANT_ID, it) }
        config.printer_probe_timeout_ms?.let {
            cachedProbeTimeoutMs = it
            editor.putInt(AgentConfigStore.KEY_PROBE_TIMEOUT_MS, it)
        }
        config.heartbeat_interval_seconds?.let {
            cachedHeartbeatIntervalMs = it * 1000L
            editor.putInt(AgentConfigStore.KEY_HEARTBEAT_INTERVAL_SECONDS, it)
        }

        editor.apply()
    }

    private suspend fun processJobs(jobs: List<PrintJobData>, authHeader: String) {
        for (job in jobs) {
            val ip = job.target_ip
            val port = job.target_port ?: 9100

            if (ip.isNullOrBlank()) {
                ackJob(authHeader, job.id, "failed", "No target IP configured", retryCount = 0)
                continue
            }

            updateNotification("מדפיס הזמנה #${job.order_id ?: job.id}...")

            // Only one print at a time (Concurrent Prints = 1).
            val attempt = printMutex.withLock {
                isPrinting = true
                try {
                    printJobWithRetry(job, ip, port)
                } finally {
                    isPrinting = false
                }
            }

            val result = attempt.result
            val ackStatus = if (result.success) "done" else "failed"
            val ackMessage = buildAckMessage(result)
            ackJob(
                authHeader,
                job.id,
                ackStatus,
                ackMessage,
                result.statusVerified,
                result.statusCode,
                result.statusDetail,
                retryCount = attempt.attempts,
                printDurationMs = attempt.durationMs,
                printerIp = ip,
            )

            if (result.success) {
                lastPrinterProbeOk = true
                lastPrinterProbeError = null
                consecutivePrintFailures = 0
                autoRecoverySuggestedIp = null
            } else {
                lastPrinterProbeOk = false
                lastPrinterProbeError = result.errorMessage
                consecutivePrintFailures++
                if (consecutivePrintFailures >= AUTO_RECOVERY_FAILURE_THRESHOLD) {
                    triggerAutoRecovery(authHeader)
                }
            }
            updateStatusNotification()
        }
    }

    /**
     * Auto Recovery: לאחר 3 כשלונות רצופים — סורק את הרשת לאיתור IP חדש של המדפסת.
     * אם נמצא מועמד שונה מה-IP הנוכחי — מדווח לשרת כ"הצעת מעבר" (apply=false),
     * והשרת מתריע לסופר-אדמין. לא מחיל אוטומטית — ההחלפה דורשת אישור מנהל.
     */
    private fun triggerAutoRecovery(authHeader: String) {
        if (isAutoRecovering) return
        isAutoRecovering = true
        scope.launch {
            try {
                updateNotification("מחפש מדפסת חלופית ברשת...")
                val results = PrinterDiscovery.discover(this@PrintAgentService)
                if (results.isEmpty()) {
                    Log.w(TAG, "Auto-recovery: no printers found on LAN")
                    return@launch
                }

                val current = cachedPrinterIp
                val candidate = results.firstOrNull { it.ip != current } ?: results.first()

                // Avoid re-reporting the same suggestion during one failure streak.
                if (candidate.ip == autoRecoverySuggestedIp) return@launch
                autoRecoverySuggestedIp = candidate.ip

                try {
                    ApiClient.get().setPrinterIp(
                        authHeader,
                        PrinterIpRequest(
                            printer_ip = candidate.ip,
                            source = "auto_recovery",
                            candidates = results.map { it.ip },
                            apply = false,
                        ),
                    )
                    Log.i(TAG, "Auto-recovery: suggested ${candidate.ip} (current=$current)")
                } catch (e: Exception) {
                    Log.e(TAG, "Auto-recovery report failed: ${e.message}")
                }
            } finally {
                isAutoRecovering = false
                updateStatusNotification()
            }
        }
    }

    /**
     * מנסה להדפיס עד 5 פעמים עם השהיות 0/5/10/15/20 שניות. עוצר מיד עם הצלחה.
     * כל ניסיון פותח socket חדש (Open→Print→Flush→Close). מחזיר את התוצאה,
     * מספר הניסיונות בפועל ומשך הניסיון המכריע.
     */
    private suspend fun printJobWithRetry(job: PrintJobData, ip: String, port: Int): PrintAttempt {
        var lastResult = PrinterBridge.PrintResult(success = false, errorMessage = "not attempted")
        var durationMs = 0L
        var attemptsMade = 0

        val suffix = job.escpos_binary_suffix?.let { b64 ->
            try { Base64.decode(b64, Base64.DEFAULT) } catch (_: Exception) { null }
        }

        for (i in 0 until MAX_PRINT_ATTEMPTS) {
            if (i > 0) {
                updateNotification("ניסיון ${i + 1}/$MAX_PRINT_ATTEMPTS — הזמנה #${job.order_id ?: job.id}...")
                delay(RETRY_DELAYS_MS[i])
            }
            attemptsMade = i + 1

            val start = System.currentTimeMillis()
            lastResult = withContext(Dispatchers.IO) {
                PrinterBridge.print(ip, port, job.text, suffix, job.double_height ?: true, codepageId = job.codepage_id ?: 15)
            }
            durationMs = System.currentTimeMillis() - start

            if (lastResult.success) break
            Log.w(TAG, "Print attempt $attemptsMade/$MAX_PRINT_ATTEMPTS failed for job ${job.id}: ${lastResult.errorMessage}")
        }

        return PrintAttempt(lastResult, attemptsMade, durationMs)
    }

    private data class PrintAttempt(
        val result: PrinterBridge.PrintResult,
        val attempts: Int,
        val durationMs: Long,
    )

    private fun buildAckMessage(result: PrinterBridge.PrintResult): String? {
        if (!result.success) return result.errorMessage
        if (result.statusCode == "paper_low") {
            return "הודפס — אזהרה: נייר עומד להיגמר"
        }
        if (!result.statusVerified) {
            return "הודפס — לא אומת סטטוס מדפסת (ייתכן שהמדפסת לא תומכת בבדיקה)"
        }
        return null
    }

    private suspend fun ackJob(
        authHeader: String,
        jobId: Long,
        status: String,
        errorMsg: String?,
        statusVerified: Boolean = false,
        statusCode: String? = null,
        statusDetail: String? = null,
        retryCount: Int? = null,
        printDurationMs: Long? = null,
        printerIp: String? = null,
    ) {
        val body = AckRequest(
            status = status,
            error_message = errorMsg,
            printer_status_verified = statusVerified,
            printer_status = statusCode,
            printer_status_detail = statusDetail,
            retry_count = retryCount,
            print_duration_ms = printDurationMs,
            printer_ip = printerIp,
        )

        for (attempt in 1..ACK_MAX_RETRIES) {
            try {
                val response = ApiClient.get().ackJob(authHeader, jobId, body)
                if (response.isSuccessful) return
                Log.w(TAG, "ACK HTTP ${response.code()} for job $jobId (attempt $attempt/$ACK_MAX_RETRIES)")
            } catch (e: Exception) {
                Log.e(TAG, "ACK failed for job $jobId (attempt $attempt/$ACK_MAX_RETRIES): ${e.message}")
            }
            if (attempt < ACK_MAX_RETRIES) delay(ACK_RETRY_DELAY_MS)
        }
        Log.e(TAG, "ACK permanently failed for job $jobId — server will recover via stale-job timeout")
    }

    private fun adjustBackoff() {
        val elapsed = System.currentTimeMillis() - lastJobReceivedAt
        pollInterval = if (elapsed > BACKOFF_THRESHOLD) MAX_POLL_INTERVAL else MIN_POLL_INTERVAL
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.channel_description)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, SetupActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("ChefSync Print Agent")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun updateStatusNotification() {
        val ip = cachedPrinterIp
        val text = when {
            ip.isNullOrBlank() -> "ממתין להגדרת מדפסת..."
            lastPrinterProbeOk == true -> "מחובר ✓ ($ip)"
            lastPrinterProbeOk == false -> "מדפסת לא מגיבה — $ip (${lastPrinterProbeError ?: "timeout"})"
            else -> "פעיל"
        }
        updateNotification(text)
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
