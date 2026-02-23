package com.chefsync.printagent

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
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
        private const val HEARTBEAT_INTERVAL = 30000L
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pollInterval = MIN_POLL_INTERVAL
    private var lastJobReceivedAt = System.currentTimeMillis()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("ChefSync Print Agent — פעיל"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences("agent_config", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", null)
        val deviceToken = prefs.getString("device_token", null)

        if (serverUrl == null || deviceToken == null) {
            Log.e(TAG, "Missing configuration, stopping service")
            stopSelf()
            return START_NOT_STICKY
        }

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

    private fun startHeartbeatLoop(authHeader: String) {
        scope.launch {
            while (isActive) {
                try {
                    ApiClient.get().heartbeat(authHeader)
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat error: ${e.message}")
                }
                delay(HEARTBEAT_INTERVAL)
            }
        }
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
                PrinterBridge.print(ip, port, job.text)
            }

            ackJob(
                authHeader,
                job.id,
                if (result.success) "done" else "failed",
                result.errorMessage
            )

            if (result.success) {
                updateNotification("ChefSync Print Agent — פעיל")
            } else {
                updateNotification("שגיאה: ${result.errorMessage}")
            }
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
            .setSmallIcon(android.R.drawable.ic_menu_print)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
