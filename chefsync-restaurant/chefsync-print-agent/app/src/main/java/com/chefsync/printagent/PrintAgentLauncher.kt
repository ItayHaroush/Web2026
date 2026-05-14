package com.chefsync.printagent

import android.content.Context
import android.content.Intent
import android.os.Build

object PrintAgentLauncher {
    fun startIfConfigured(context: Context) {
        if (!AgentConfigStore.isConfigured(context)) return
        val appCtx = context.applicationContext
        val intent = Intent(appCtx, PrintAgentService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            appCtx.startForegroundService(intent)
        } else {
            appCtx.startService(intent)
        }
    }
}
