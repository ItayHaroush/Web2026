package com.chefsync.printagent

import android.util.Log
import java.io.OutputStream
import java.net.Socket

object PrinterBridge {
    private const val TAG = "PrinterBridge"

    // ESC/POS commands
    private val ESC_INIT = byteArrayOf(0x1B, 0x40)           // Initialize printer
    private val ESC_HEBREW_CP = byteArrayOf(0x1B, 0x74, 0x24) // Select CP862 (Hebrew)
    private val ESC_CUT = byteArrayOf(0x1D, 0x56, 0x00)       // Full cut
    private val FEED = "\n\n\n\n".toByteArray()

    data class PrintResult(
        val success: Boolean,
        val errorMessage: String? = null
    )

    fun print(ip: String, port: Int, payload: String, timeoutMs: Int = 5000): PrintResult {
        return try {
            val socket = Socket()
            socket.connect(java.net.InetSocketAddress(ip, port), timeoutMs)
            socket.soTimeout = timeoutMs

            val out: OutputStream = socket.getOutputStream()

            out.write(ESC_INIT)
            out.write(ESC_HEBREW_CP)
            out.write(payload.toByteArray(Charsets.UTF_8))
            out.write(FEED)
            out.write(ESC_CUT)
            out.flush()

            socket.close()
            Log.i(TAG, "Print successful to $ip:$port")
            PrintResult(success = true)
        } catch (e: Exception) {
            val msg = "Print failed to $ip:$port — ${e.message}"
            Log.e(TAG, msg, e)
            PrintResult(success = false, errorMessage = e.message ?: "Unknown error")
        }
    }
}
