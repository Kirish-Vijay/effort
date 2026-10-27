package io.github.kirishvijay.effort

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.util.concurrent.TimeUnit

class Unlinked : IllegalStateException("This phone's link to your account has expired. Open Effort and tap Connect steps again")

// Reads today's and yesterday's step totals from Health Connect and sends them to the player's
// Effort account. Health Connect's aggregate counts phone and watch steps once, not twice.
object StepSync {
    const val APP_URL = "https://kirish-vijay.github.io/effort/"
    private const val LOG_URL = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort/log"
    private const val WORK = "effort-steps"
    val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND,
    )
    val STEPS = HealthPermission.getReadPermission(StepsRecord::class)

    private fun prefs(c: Context) = c.getSharedPreferences("effort", Context.MODE_PRIVATE)
    fun token(c: Context): String? = prefs(c).getString("token", null)
    fun setToken(c: Context, t: String) = prefs(c).edit().putString("token", t).apply()
    fun lastSync(c: Context): Pair<Long, Long> = prefs(c).getLong("syncedAt", 0) to prefs(c).getLong("syncedSteps", -1)

    // Every 15 minutes (Android's shortest), whenever there's a connection.
    fun schedule(c: Context) {
        val req = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req)
    }

    // Returns today's steps, or throws with a message worth showing.
    suspend fun run(c: Context): Long {
        val token = token(c) ?: throw IllegalStateException("Open Effort and tap Connect steps first")
        val client = HealthConnectClient.getOrCreate(c)
        val today = LocalDate.now()
        var todaySteps = 0L
        for (day in listOf(today.minusDays(1), today)) {
            val result = client.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(day.atStartOfDay(), day.plusDays(1).atStartOfDay()),
                ),
            )
            val steps = result[StepsRecord.COUNT_TOTAL] ?: 0L
            try {
                post(token, day.toString(), steps)
            } catch (e: Unlinked) {
                // The account this phone was linked to is gone: forget it, so the app asks to connect again.
                prefs(c).edit().remove("token").apply()
                throw e
            }
            if (day == today) todaySteps = steps
        }
        prefs(c).edit().putLong("syncedAt", System.currentTimeMillis()).putLong("syncedSteps", todaySteps).apply()
        return todaySteps
    }

    private suspend fun post(token: String, date: String, steps: Long) = withContext(Dispatchers.IO) {
        val conn = URL(LOG_URL).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().put("token", token).put("steps", steps).put("date", date).put("source", "android-app")
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = conn.responseCode
            if (code == 401) throw Unlinked()
            if (code !in 200..299) throw IllegalStateException("Effort's server said no ($code). Try again in a bit")
        } finally {
            conn.disconnect()
        }
    }
}
