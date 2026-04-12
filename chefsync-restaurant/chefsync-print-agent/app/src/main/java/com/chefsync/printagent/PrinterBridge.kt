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

    private const val MARKER_BIG   = "{{BIG}}"
    private const val MARKER_NOBIG = "{{/BIG}}"
    private const val MARKER_CENTER   = "{{CENTER}}"
    private const val MARKER_NOCENTER = "{{/CENTER}}"
    private const val MARKER_BOLD   = "{{BOLD}}"
    private const val MARKER_NOBOLD = "{{/BOLD}}"

    private val ALL_MARKERS = setOf(MARKER_BIG, MARKER_NOBIG, MARKER_CENTER, MARKER_NOCENTER, MARKER_BOLD, MARKER_NOBOLD)

    data class PrintResult(
        val success: Boolean,
        val errorMessage: String? = null,
    )

    fun print(ip: String, port: Int, payload: String, binarySuffix: ByteArray? = null, doubleHeight: Boolean = true, lineWidth: Int = 42, timeoutMs: Int = 5000): PrintResult {
        return try {
            val socket = Socket()
            socket.connect(java.net.InetSocketAddress(ip, port), timeoutMs)
            socket.soTimeout = timeoutMs

            val out: OutputStream = socket.getOutputStream()
            val hasMarkers = ALL_MARKERS.any { payload.contains(it) }
            val prepared = prepareThermalRtlPayload(payload, lineWidth)

            out.write(ESC_INIT)
            out.write(ESC_HEBREW_TABLE)
            out.write(ESC_CHAR_SPACING_0)

            if (hasMarkers) {
                // Selective mode: process inline markers per line
                writeWithInlineMarkers(out, prepared)
            } else {
                // Legacy mode: global double-height flag
                if (doubleHeight) {
                    out.write(ESC_DOUBLE_HEIGHT)
                }
                out.write(prepared.toByteArray(cp862))
                out.write(ESC_FONT_NORMAL)
            }
            if (binarySuffix != null && binarySuffix.isNotEmpty()) {
                out.write(binarySuffix)
            }
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

    private fun prepareThermalRtlPayload(text: String, lineWidth: Int): String =
        text
            .replace("\r\n", "\n")
            .replace("\r", "\n")
            .lines()
            .joinToString("\n") {
                if (it.trim() in ALL_MARKERS) it
                else centerIfNeeded(smartReverseHebrewLine(it), lineWidth)
            }

    /** ESC a 1 — center alignment */
    private val ESC_ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 0x01)
    /** ESC a 0 — left alignment */
    private val ESC_ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0x00)
    /** ESC E 1 — bold on */
    private val ESC_BOLD_ON = byteArrayOf(0x1B, 0x45, 0x01)
    /** ESC E 0 — bold off */
    private val ESC_BOLD_OFF = byteArrayOf(0x1B, 0x45, 0x00)

    /**
     * Process {{BIG}}, {{/BIG}}, {{CENTER}}, {{/CENTER}}, {{BOLD}}, {{/BOLD}} markers per line.
     * Marker lines are consumed — they switch the ESC mode for subsequent lines.
     */
    private fun writeWithInlineMarkers(out: OutputStream, text: String) {
        var isBig = false
        for (line in text.split("\n")) {
            val trimmed = line.trim()
            when (trimmed) {
                MARKER_BIG -> {
                    isBig = true
                    continue
                }
                MARKER_NOBIG -> {
                    isBig = false
                    out.write(ESC_FONT_NORMAL)
                    continue
                }
                MARKER_CENTER -> {
                    out.write(ESC_ALIGN_CENTER)
                    continue
                }
                MARKER_NOCENTER -> {
                    out.write(ESC_ALIGN_LEFT)
                    continue
                }
                MARKER_BOLD -> {
                    out.write(ESC_BOLD_ON)
                    continue
                }
                MARKER_NOBOLD -> {
                    out.write(ESC_BOLD_OFF)
                    continue
                }
            }
            out.write(if (isBig) ESC_DOUBLE_HEIGHT else ESC_FONT_NORMAL)
            out.write((line + "\n").toByteArray(cp862))
        }
        out.write(ESC_FONT_NORMAL)
        out.write(ESC_ALIGN_LEFT)
        out.write(ESC_BOLD_OFF)
    }

    /**
     * Center lines that have no leading spaces but contain Hebrew.
     * Lines already pre-centered (starting with spaces via centerText) are preserved.
     */
    private fun centerIfNeeded(line: String, lineWidth: Int): String {
        if (line.isEmpty() || lineWidth <= 0) return line
        // Already has leading spaces (pre-centered) — preserve
        if (line.startsWith(" ")) return line
        // Full-width or wider — no centering needed
        if (line.length >= lineWidth) return line
        // Only center lines containing Hebrew
        if (!line.contains(hebrewInWord)) return line
        val pad = (lineWidth - line.length) / 2
        return " ".repeat(pad) + line
    }

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
