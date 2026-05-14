package com.chefsync.printagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * מפעיל מחדש את סוכן ההדפסה אחרי אתחול המכשיר (הגדרות נשמרות ב-AgentConfigStore).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        PrintAgentLauncher.startIfConfigured(context)
    }
}
