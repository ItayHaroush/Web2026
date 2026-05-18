package com.chefsync.printagent

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * מאחסן URL וטוקן מכשיר ב-EncryptedSharedPreferences.
 * מבצע מיגרציה חד-פעמית מ-agent_config (רגיל) אם קיים.
 */
object AgentConfigStore {
    private const val LEGACY_PREFS_NAME = "agent_config"
    private const val ENCRYPTED_PREFS_NAME = "agent_config_secure"

    const val KEY_SERVER_URL = "server_url"
    const val KEY_DEVICE_TOKEN = "device_token"

    // ── Cached config from server (refreshed on each heartbeat) ──────────────
    // נשמר מקומית כדי שגם בלי רשת נוכל להמשיך לסקור את המדפסת,
    // ושאם השרת ישנה IP — נתעדכן אוטומטית.
    const val KEY_PRINTER_IP = "printer_ip"
    const val KEY_PRINTER_PORT = "printer_port"
    const val KEY_CODEPAGE_ID = "codepage_id"
    const val KEY_ROLE = "role"
    const val KEY_RESTAURANT_ID = "restaurant_id"
    const val KEY_HEARTBEAT_INTERVAL_SECONDS = "heartbeat_interval_seconds"
    const val KEY_PROBE_TIMEOUT_MS = "probe_timeout_ms"

    fun prefs(context: Context): SharedPreferences {
        val app = context.applicationContext
        val encrypted = openEncrypted(app)
        migrateFromLegacyIfNeeded(app, encrypted)
        return encrypted
    }

    private fun openEncrypted(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            context,
            ENCRYPTED_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun migrateFromLegacyIfNeeded(context: Context, encrypted: SharedPreferences) {
        if (encrypted.getString(KEY_DEVICE_TOKEN, null) != null) return

        val legacy = context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
        val url = legacy.getString(KEY_SERVER_URL, null)?.takeIf { it.isNotBlank() }
        val token = legacy.getString(KEY_DEVICE_TOKEN, null)?.takeIf { it.isNotBlank() }
        if (url == null || token == null) return

        encrypted.edit()
            .putString(KEY_SERVER_URL, url)
            .putString(KEY_DEVICE_TOKEN, token)
            .apply()
        legacy.edit().clear().apply()
    }

    fun clear(context: Context) {
        val app = context.applicationContext
        openEncrypted(app).edit().clear().apply()
        app.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
    }

    fun isConfigured(context: Context): Boolean {
        val p = prefs(context)
        return !p.getString(KEY_SERVER_URL, null).isNullOrBlank() &&
            !p.getString(KEY_DEVICE_TOKEN, null).isNullOrBlank()
    }
}
