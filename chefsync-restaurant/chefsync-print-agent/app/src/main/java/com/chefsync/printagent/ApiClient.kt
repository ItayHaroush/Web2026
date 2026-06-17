package com.chefsync.printagent

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.util.concurrent.TimeUnit

data class JobsResponse(
    val success: Boolean,
    val jobs: List<PrintJobData>
)

data class PrintJobData(
    val id: Long,
    val role: String?,
    val order_id: Long?,
    val type: String?,
    val text: String,
    val target_ip: String?,
    val target_port: Int?,
    val created_at: String?,
    val escpos_binary_suffix: String? = null,
    val double_height: Boolean? = null,
    val codepage_id: Int? = null,
)

data class AckRequest(
    val status: String,
    val error_message: String? = null,
    /** true = המדפסת החזירה סטטוס ESC/POS אחרי ההדפסה */
    val printer_status_verified: Boolean? = null,
    /** ok | paper_out | paper_low | offline | error | unknown */
    val printer_status: String? = null,
    val printer_status_detail: String? = null,
    /** מספר הניסיונות שבוצעו בפועל (1..5) */
    val retry_count: Int? = null,
    /** משך ההדפסה המכריעה במילישניות */
    val print_duration_ms: Long? = null,
    /** ה-IP שאליו הודפס בפועל */
    val printer_ip: String? = null,
)

/**
 * מצב הסוכן שנשלח עם כל heartbeat.
 * השרת משתמש בזה כדי להחליט: 🟢 / ⚠️ / 🔴
 */
data class HeartbeatRequest(
    val bridge_online: Boolean = true,
    val printer_connected: Boolean? = null,
    val printer_last_error: String? = null,
    val agent_version: String? = null,
)

/**
 * תצורה שהשרת מחזיר עם כל heartbeat — מאפשרת לסוכן להישאר מסונכרן
 * גם אם המנהל שינה IP/פורט במסעדה.
 */
data class AgentConfigResponse(
    val restaurant_id: Long?,
    val role: String?,
    val printer_ip: String?,
    val printer_port: Int?,
    val codepage_id: Int?,
    val is_active: Boolean?,
    val heartbeat_interval_seconds: Int?,
    val printer_probe_timeout_ms: Int?,
)

data class HeartbeatResponse(
    val success: Boolean,
    val server_time: String? = null,
    val config: AgentConfigResponse? = null,
)

data class SimpleResponse(
    val success: Boolean,
    val server_time: String? = null
)

/** בחירת/הצעת IP חדש למדפסת. source: discovery_manual | auto_recovery */
data class PrinterIpRequest(
    val printer_ip: String,
    val source: String? = null,
    /** כל המועמדים שנמצאו בסריקה (לצורך תיעוד / הצעת מעבר) */
    val candidates: List<String>? = null,
    /** true = להחיל מיד; false = רק להציע (auto-recovery) */
    val apply: Boolean = true,
)

interface AgentApi {
    @GET("api/agent/jobs")
    suspend fun getJobs(@Header("Authorization") auth: String): Response<JobsResponse>

    @POST("api/agent/jobs/{id}/ack")
    suspend fun ackJob(
        @Header("Authorization") auth: String,
        @Path("id") jobId: Long,
        @Body body: AckRequest
    ): Response<SimpleResponse>

    @POST("api/agent/heartbeat")
    suspend fun heartbeat(
        @Header("Authorization") auth: String,
        @Body body: HeartbeatRequest = HeartbeatRequest(),
    ): Response<HeartbeatResponse>

    @POST("api/agent/printer-ip")
    suspend fun setPrinterIp(
        @Header("Authorization") auth: String,
        @Body body: PrinterIpRequest,
    ): Response<SimpleResponse>
}

object ApiClient {
    private var api: AgentApi? = null
    private var baseUrl: String = ""

    fun init(serverUrl: String) {
        baseUrl = serverUrl.trimEnd('/')

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .addInterceptor(logging)
            .build()

        api = Retrofit.Builder()
            .baseUrl("$baseUrl/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AgentApi::class.java)
    }

    fun get(): AgentApi = api ?: throw IllegalStateException("ApiClient not initialized")
}
