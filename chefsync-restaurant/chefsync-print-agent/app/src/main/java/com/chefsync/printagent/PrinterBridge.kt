package com.chefsync.printagent

import android.util.Log
import java.io.OutputStream
import java.net.Socket
import java.nio.charset.Charset

object PrinterBridge {
    private const val TAG = "PrinterBridge"

    private val ESC_INIT = byteArrayOf(0x1B, 0x40)

    /**
     * SNBC BTP-S80: Hebrew CP table 10 (ESC t 0x0A) + CP862. LTR printer → RTL prep before encode.
     */
    private val ESC_HEBREW_TABLE = byteArrayOf(0x1B, 0x74, 0x0A)
    private val ESC_CHAR_SPACING_0 = byteArrayOf(0x1B, 0x20, 0x00)
    /** כפול גובה בלבד — רוחב רגיל, תואם line_width בלי שבירת שורות */
    private val ESC_DOUBLE_HEIGHT = byteArrayOf(0x1B, 0x21, 0x10)
    private val ESC_FONT_NORMAL = byteArrayOf(0x1B, 0x21, 0x00)

    private val cp862: Charset = Charset.forName("IBM862")
    /** GS V 1 — חיתוך חלקי (Epson-תואם); 0 = מלא */
    private val ESC_CUT = byteArrayOf(0x1D, 0x56, 0x01)
    private val FEED = "\n\n\n\n".toByteArray()

    private val hebrewInWord = Regex("[\\u0590-\\u05FF]")

    data class PrintResult(
        val success: Boolean,
        val errorMessage: String? = null,
    )

    fun print(ip: String, port: Int, payload: String, timeoutMs: Int = 5000): PrintResult {
        return try {
            val socket = Socket()
            socket.connect(java.net.InetSocketAddress(ip, port), timeoutMs)
            socket.soTimeout = timeoutMs

            val out: OutputStream = socket.getOutputStream()
            val prepared = prepareThermalRtlPayload(payload)

            out.write(ESC_INIT)
            out.write(ESC_HEBREW_TABLE)
            out.write(ESC_CHAR_SPACING_0)
            out.write(ESC_DOUBLE_HEIGHT)
            out.write(prepared.toByteArray(cp862))
            out.write(ESC_FONT_NORMAL)
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

    private fun prepareThermalRtlPayload(text: String): String =
        text
            .replace("\r\n", "\n")
            .replace("\r", "\n")
            .lines()
            .joinToString("\n") { smartReverseHebrewLine(it) }

    private fun smartReverseHebrewLine(line: String): String {
        if (line.isEmpty()) {
            return line
        }
        val leadMatch = Regex("^(\\s*)(.*)$", RegexOption.DOT_MATCHES_ALL).find(line) ?: return line
        val leading = leadMatch.groupValues[1]
        val rest = leadMatch.groupValues[2]
        if (rest.isEmpty() || !rest.contains(hebrewInWord)) {
            return line
        }
        val words = rest.split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) {
            return line
        }
        val mapped =
            words.map { raw ->
                val word = transformPriceShekelToken(raw)
                if (word.contains(hebrewInWord) && !shouldSkipCharReverseForToken(word)) {
                    word.reversed()
                } else {
                    word
                }
            }
        return leading + mapped.reversed().joinToString(" ")
    }

    private fun transformPriceShekelToken(word: String): String {
        Regex("^([\\d.,]+)\\s*ש\"ח$").find(word)?.let {
            return "${it.groupValues[1]} ${"ש\"ח".reversed()}"
        }
        Regex("^([\\d.,]+)ש\"ח$").find(word)?.let {
            return "${it.groupValues[1]} ${"ש\"ח".reversed()}"
        }
        Regex("^ש\"ח\\s*([\\d.,]+)$").find(word)?.let {
            return "${it.groupValues[1]} ${"ש\"ח".reversed()}"
        }
        Regex("^ש\"ח([\\d.,]+)$").find(word)?.let {
            return "${it.groupValues[1]} ${"ש\"ח".reversed()}"
        }
        return word
    }

    private fun shouldSkipCharReverseForToken(word: String): Boolean {
        if (word.matches(Regex("^\\d+([.,]\\d+)?$"))) return true
        if (word.matches(Regex("^#\\d+$"))) return true
        if (word.matches(Regex("^\\d+x$", RegexOption.IGNORE_CASE))) return true
        if (word.matches(Regex("^₪\\s*\\d+([.,]\\d+)?$"))) return true
        if (word.matches(Regex("^[\\d.,]+\\s+.+$")) && word.contains(hebrewInWord)) return true
        return false
    }
}
