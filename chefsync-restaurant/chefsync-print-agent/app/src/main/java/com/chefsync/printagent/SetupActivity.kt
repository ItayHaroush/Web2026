package com.chefsync.printagent

import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*

class SetupActivity : AppCompatActivity() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = AgentConfigStore.prefs(this)
        val existingToken = prefs.getString(AgentConfigStore.KEY_DEVICE_TOKEN, null)
        val existingUrl = prefs.getString(AgentConfigStore.KEY_SERVER_URL, null)

        if (existingToken != null && existingUrl != null) {
            startAgentService()
            showStatusView(existingUrl)
            return
        }

        showSetupView(prefs)
    }

    private fun showSetupView(prefs: android.content.SharedPreferences = AgentConfigStore.prefs(this)) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(64, 128, 64, 64)
        }

        val title = TextView(this).apply {
            text = "ChefSync Print Agent"
            textSize = 24f
            setPadding(0, 0, 0, 48)
        }

        val urlLabel = TextView(this).apply { text = "Server URL:" }
        val urlInput = EditText(this).apply {
            hint = "https://api.chefsync.co.il"
            setText(prefs.getString(AgentConfigStore.KEY_SERVER_URL, ""))
        }

        val tokenLabel = TextView(this).apply {
            text = "Device Token:"
            setPadding(0, 32, 0, 0)
        }
        val tokenInput = EditText(this).apply {
            hint = "Paste token from admin panel"
            isSingleLine = true
        }

        val statusText = TextView(this).apply {
            setPadding(0, 16, 0, 0)
        }

        val connectBtn = Button(this).apply {
            text = "Connect & Start"
            setPadding(0, 48, 0, 0)
        }

        connectBtn.setOnClickListener {
            val url = urlInput.text.toString().trim()
            val token = tokenInput.text.toString().trim()

            if (url.isEmpty() || token.isEmpty()) {
                statusText.text = "Please fill both fields"
                return@setOnClickListener
            }

            connectBtn.isEnabled = false
            statusText.text = "Verifying..."

            scope.launch {
                try {
                    ApiClient.init(url)
                    val response = ApiClient.get().heartbeat("Bearer $token")

                    if (response.isSuccessful) {
                        prefs.edit()
                            .putString(AgentConfigStore.KEY_SERVER_URL, url)
                            .putString(AgentConfigStore.KEY_DEVICE_TOKEN, token)
                            .apply()

                        statusText.text = "Connected! Starting agent..."
                        startAgentService()

                        delay(1000)
                        showStatusView(url)
                    } else {
                        statusText.text = "Error: ${response.code()} — check token"
                        connectBtn.isEnabled = true
                    }
                } catch (e: Exception) {
                    statusText.text = "Connection failed: ${e.message}"
                    connectBtn.isEnabled = true
                }
            }
        }

        layout.addView(title)
        layout.addView(urlLabel)
        layout.addView(urlInput)
        layout.addView(tokenLabel)
        layout.addView(tokenInput)
        layout.addView(statusText)
        layout.addView(connectBtn)

        setContentView(layout)
    }

    private fun showStatusView(serverUrl: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(64, 128, 64, 64)
        }

        val title = TextView(this).apply {
            text = "ChefSync Print Agent"
            textSize = 24f
            setPadding(0, 0, 0, 32)
        }

        val status = TextView(this).apply {
            text = "Agent is running"
            textSize = 18f
            setPadding(0, 0, 0, 16)
        }

        val serverInfo = TextView(this).apply {
            text = "Server: $serverUrl"
            setPadding(0, 0, 0, 48)
        }

        val discoverBtn = Button(this).apply {
            text = "\uD83D\uDD0D חפש מדפסות ברשת"
            setPadding(0, 0, 0, 24)
        }
        discoverBtn.setOnClickListener { showDiscoveryView(serverUrl) }

        val disconnectBtn = Button(this).apply {
            text = "Disconnect & Reset"
        }

        disconnectBtn.setOnClickListener {
            stopService(Intent(this@SetupActivity, PrintAgentService::class.java))
            AgentConfigStore.clear(this@SetupActivity)
            showSetupView(AgentConfigStore.prefs(this@SetupActivity))
        }

        layout.addView(title)
        layout.addView(status)
        layout.addView(serverInfo)
        layout.addView(discoverBtn)
        layout.addView(disconnectBtn)

        setContentView(layout)
    }

    /**
     * מסך גילוי מדפסות — סורק את ה-LAN בפורט 9100 ומציג IP / Hostname / Status.
     * בחירת מדפסת שומרת אותה מקומית ומדווחת לשרת.
     */
    private fun showDiscoveryView(serverUrl: String) {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(64, 128, 64, 64)
        }

        val title = TextView(this).apply {
            text = "\uD83D\uDD0D חפש מדפסות ברשת"
            textSize = 22f
            setPadding(0, 0, 0, 16)
        }

        val subtitle = TextView(this).apply {
            text = "סורק את הרשת המקומית לאיתור מדפסות (פורט 9100)"
            textSize = 13f
            setPadding(0, 0, 0, 24)
        }

        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = false
            max = 100
            progress = 0
            visibility = android.view.View.GONE
        }

        val statusText = TextView(this).apply {
            setPadding(0, 16, 0, 16)
        }

        val scanBtn = Button(this).apply { text = "התחל סריקה" }

        val resultsContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 24, 0, 0)
        }
        val scroll = ScrollView(this).apply {
            addView(resultsContainer)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f,
            )
        }

        val backBtn = Button(this).apply {
            text = "חזרה"
            setPadding(0, 24, 0, 0)
        }
        backBtn.setOnClickListener { showStatusView(serverUrl) }

        scanBtn.setOnClickListener {
            scanBtn.isEnabled = false
            resultsContainer.removeAllViews()
            progress.visibility = android.view.View.VISIBLE
            progress.progress = 0
            statusText.text = "סורק..."

            scope.launch {
                val results = PrinterDiscovery.discover(
                    this@SetupActivity,
                    onProgress = { scanned, total ->
                        runOnUiThread {
                            progress.progress = (scanned * 100 / total)
                        }
                    },
                )
                progress.visibility = android.view.View.GONE
                scanBtn.isEnabled = true

                if (results.isEmpty()) {
                    statusText.text = "לא נמצאו מדפסות ברשת. ודאו שהמכשיר מחובר לאותה רשת WiFi כמו המדפסת."
                    return@launch
                }

                statusText.text = "נמצאו ${results.size} מדפסות:"
                results.forEach { printer ->
                    resultsContainer.addView(buildPrinterRow(printer, serverUrl))
                }
            }
        }

        root.addView(title)
        root.addView(subtitle)
        root.addView(scanBtn)
        root.addView(progress)
        root.addView(statusText)
        root.addView(scroll)
        root.addView(backBtn)

        setContentView(root)
    }

    private fun buildPrinterRow(
        printer: PrinterDiscovery.DiscoveredPrinter,
        serverUrl: String,
    ): android.view.View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 24, 24, 24)
            isClickable = true
            setBackgroundColor(0xFFF3F4F6.toInt())
        }
        val params = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { setMargins(0, 0, 0, 16) }
        row.layoutParams = params

        val ipText = TextView(this).apply {
            text = printer.ip
            textSize = 18f
        }
        val hostText = TextView(this).apply {
            text = printer.hostname ?: "(ללא שם מארח)"
            textSize = 13f
        }
        val statusLine = TextView(this).apply {
            text = "✓ פורט ${PrinterDiscovery.DEFAULT_PORT} פתוח — לחצו לבחירה"
            textSize = 13f
            setTextColor(0xFF16A34A.toInt())
        }

        row.addView(ipText)
        row.addView(hostText)
        row.addView(statusLine)

        row.setOnClickListener { confirmSelectPrinter(printer, serverUrl) }
        return row
    }

    private fun confirmSelectPrinter(
        printer: PrinterDiscovery.DiscoveredPrinter,
        serverUrl: String,
    ) {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("בחירת מדפסת")
            .setMessage("להגדיר את ${printer.ip} כמדפסת של מכשיר זה?")
            .setPositiveButton("אישור") { _, _ -> selectPrinter(printer, serverUrl) }
            .setNegativeButton("ביטול", null)
            .show()
    }

    private fun selectPrinter(
        printer: PrinterDiscovery.DiscoveredPrinter,
        serverUrl: String,
    ) {
        val prefs = AgentConfigStore.prefs(this)
        prefs.edit()
            .putString(AgentConfigStore.KEY_PRINTER_IP, printer.ip)
            .putInt(AgentConfigStore.KEY_PRINTER_PORT, PrinterDiscovery.DEFAULT_PORT)
            .apply()

        val token = prefs.getString(AgentConfigStore.KEY_DEVICE_TOKEN, null)
        if (token == null) {
            Toast.makeText(this, "נשמר מקומית", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            try {
                ApiClient.init(serverUrl)
                val response = ApiClient.get().setPrinterIp(
                    "Bearer $token",
                    PrinterIpRequest(
                        printer_ip = printer.ip,
                        source = "discovery_manual",
                        apply = true,
                    ),
                )
                if (response.isSuccessful) {
                    Toast.makeText(this@SetupActivity, "המדפסת ${printer.ip} נשמרה", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@SetupActivity, "נשמר מקומית (שרת: ${response.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@SetupActivity, "נשמר מקומית (אין רשת)", Toast.LENGTH_SHORT).show()
            }
            showStatusView(serverUrl)
        }
    }

    private fun startAgentService() {
        PrintAgentLauncher.startIfConfigured(this)
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
