package com.chefsync.printagent

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*

class SetupActivity : AppCompatActivity() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("agent_config", Context.MODE_PRIVATE)
        val existingToken = prefs.getString("device_token", null)
        val existingUrl = prefs.getString("server_url", null)

        if (existingToken != null && existingUrl != null) {
            startAgentService()
            showStatusView(existingUrl)
            return
        }

        showSetupView(prefs)
    }

    private fun showSetupView(prefs: android.content.SharedPreferences) {
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
            setText(prefs.getString("server_url", ""))
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
                            .putString("server_url", url)
                            .putString("device_token", token)
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

        val disconnectBtn = Button(this).apply {
            text = "Disconnect & Reset"
        }

        disconnectBtn.setOnClickListener {
            stopService(Intent(this@SetupActivity, PrintAgentService::class.java))
            getSharedPreferences("agent_config", Context.MODE_PRIVATE)
                .edit().clear().apply()
            showSetupView(getSharedPreferences("agent_config", Context.MODE_PRIVATE))
        }

        layout.addView(title)
        layout.addView(status)
        layout.addView(serverInfo)
        layout.addView(disconnectBtn)

        setContentView(layout)
    }

    private fun startAgentService() {
        val intent = Intent(this, PrintAgentService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
