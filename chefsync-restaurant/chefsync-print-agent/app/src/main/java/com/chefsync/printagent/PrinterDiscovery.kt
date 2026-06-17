package com.chefsync.printagent

import android.content.Context
import android.net.wifi.WifiManager
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.net.InetAddress
import java.net.NetworkInterface
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger

/**
 * סורק את רשת ה-LAN המקומית לאיתור מדפסות ESC/POS (פורט 9100 פתוח).
 * רץ על מכשיר הגשר עצמו — שנמצא באותה רשת כמו המדפסת.
 */
object PrinterDiscovery {
    private const val TAG = "PrinterDiscovery"
    const val DEFAULT_PORT = 9100
    private const val HOSTS_PER_SUBNET = 254
    private const val MAX_CONCURRENT = 40

    data class DiscoveredPrinter(
        val ip: String,
        val hostname: String?,
        val reachable: Boolean,
    )

    /**
     * מחזיר את בסיס תת-הרשת /24 (למשל "192.168.1.") או null אם לא ניתן לקבוע.
     * מעדיף enumeration של ממשקי הרשת (עובד גם ב-WiFi וגם ב-Ethernet).
     */
    fun localSubnetBase(context: Context): String? {
        try {
            for (nif in NetworkInterface.getNetworkInterfaces()) {
                if (!nif.isUp || nif.isLoopback) continue
                for (addr in nif.interfaceAddresses) {
                    val ip = addr.address ?: continue
                    if (ip.isLoopbackAddress) continue
                    val host = ip.hostAddress ?: continue
                    if (host.contains(":")) continue // IPv6
                    if (ip.isSiteLocalAddress) {
                        val lastDot = host.lastIndexOf('.')
                        if (lastDot > 0) return host.substring(0, lastDot + 1)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "NetworkInterface scan failed: ${e.message}")
        }

        // Fallback: WiFi DHCP info
        try {
            val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            @Suppress("DEPRECATION")
            val ipInt = wifi?.dhcpInfo?.ipAddress ?: 0
            if (ipInt != 0) {
                return String.format(
                    "%d.%d.%d.",
                    ipInt and 0xff,
                    ipInt shr 8 and 0xff,
                    ipInt shr 16 and 0xff,
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "WifiManager DHCP read failed: ${e.message}")
        }

        return null
    }

    /**
     * סורק את כל תת-הרשת בפורט הנתון. מחזיר את כל ההוסטים שמגיבים, ממוינים לפי IP.
     * @param onProgress callback עם (נסרקו, סה"כ) לעדכון מסך.
     */
    suspend fun discover(
        context: Context,
        port: Int = DEFAULT_PORT,
        timeoutMs: Int = 350,
        onProgress: ((scanned: Int, total: Int) -> Unit)? = null,
    ): List<DiscoveredPrinter> = withContext(Dispatchers.IO) {
        val base = localSubnetBase(context)
        if (base == null) {
            Log.w(TAG, "Could not determine local subnet")
            return@withContext emptyList()
        }

        val semaphore = Semaphore(MAX_CONCURRENT)
        val scanned = AtomicInteger(0)
        val found = CopyOnWriteArrayList<DiscoveredPrinter>()

        val jobs = (1..HOSTS_PER_SUBNET).map { host ->
            launch {
                semaphore.withPermit {
                    val ip = "$base$host"
                    val probe = PrinterBridge.probe(ip, port, timeoutMs)
                    if (probe.success) {
                        found.add(DiscoveredPrinter(ip, resolveHostname(ip), true))
                    }
                    onProgress?.invoke(scanned.incrementAndGet(), HOSTS_PER_SUBNET)
                }
            }
        }
        jobs.joinAll()

        found.sortedBy { it.ip.substringAfterLast('.').toIntOrNull() ?: 0 }
    }

    private fun resolveHostname(ip: String): String? {
        return try {
            val name = InetAddress.getByName(ip).canonicalHostName
            if (name.isNullOrBlank() || name == ip) null else name
        } catch (e: Exception) {
            null
        }
    }
}
