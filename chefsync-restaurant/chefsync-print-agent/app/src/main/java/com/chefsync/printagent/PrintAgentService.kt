package com.chefsync.printagent

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.*

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
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pollInterval = MIN_POLL_INTERVAL
    private var lastJobReceivedAt = System.currentTimeMillis()

    // ── Cached config (in-memory; persisted to AgentConfigStore on every heartbeat) ──
    @Volatile private var cachedPrinterIp: String? = null
    @Volatile private var cachedPrinterPort: Int = 9100
    @Volatile private var cachedProbeTimeoutMs: Int = 1500
    @Volatile private var cachedHeartbeatIntervalMs: Long = DEFAULT_HEARTBEAT_INTERVAL
    @Volatile private var lastPrinterProbeOk: Boolean? = null
    @Volatile private var lastPrinterProbeError: String? = null

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
                val probe = PrinterBridge.probe(
                    cachedPrinterIp,
                    cachedPrinterPort,
                    cachedProbeTimeoutMs
                )
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
                ackJob(authHeader, job.id, "failed", "No target IP configured")
                continue
            }

            updateNotification("מדפיס הזמנה #${job.order_id ?: job.id}...")

            val result = withContext(Dispatchers.IO) {
                val suffix = job.escpos_binary_suffix?.let { b64 ->
                    try {
                        Base64.decode(b64, Base64.DEFAULT)
                    } catch (_: Exception) {
                        null
                    }
                }
                PrinterBridge.print(ip, port, job.text, suffix, job.double_height ?: true, codepageId = job.codepage_id ?: 15)
            }

            ackJob(
                authHeader,
                job.id,
                if (result.success) "done" else "failed",
                result.errorMessage
            )

            if (result.success) {
                lastPrinterProbeOk = true
                lastPrinterProbeError = null
            } else {
                lastPrinterProbeOk = false
                lastPrinterProbeError = result.errorMessage
            }
            updateStatusNotification()
        }
    }

    private suspend fun ackJob(authHeader: String, jobId: Long, status: String, errorMsg: String?) {
        try {
            ApiClient.get().ackJob(authHeader, jobId, AckRequest(status, errorMsg))
        } catch (e: Exception) {
            Log.e(TAG, "ACK failed for job $jobId: ${e.message}")
        }
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
