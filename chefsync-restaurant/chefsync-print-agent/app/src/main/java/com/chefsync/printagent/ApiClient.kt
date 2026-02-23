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
    val created_at: String?
)

data class AckRequest(
    val status: String,
    val error_message: String? = null
)

data class SimpleResponse(
    val success: Boolean,
    val server_time: String? = null
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
    suspend fun heartbeat(@Header("Authorization") auth: String): Response<SimpleResponse>
}

object ApiClient {
    private var api: AgentApi? = null
    private var baseUrl: String = ""

    fun init(serverUrl: String) {
        baseUrl = serverUrl.trimEnd('/')

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
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
