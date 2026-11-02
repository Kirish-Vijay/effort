package io.github.kirishvijay.effort

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
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
import java.net.URLEncoder
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.TimeUnit

class Unlinked : IllegalStateException("Your account link expired. Sign in to Effort again")

// Sends the player's steps (from Health Connect) and short-video minutes (from Android's usage
// stats) to their Effort account: today's and yesterday's, so the last part of a day isn't lost.
object Sync {
    const val APP_URL = "https://effort-game.vercel.app/"
    private const val API = "https://nfsogyreyownlchwdnff.supabase.co/functions/v1/effort"
    private const val WORK = "effort-steps"
    val STEPS = HealthPermission.getReadPermission(StepsRecord::class)
    // Background reading lets the sync carry on with the app closed.
    val PERMISSIONS = setOf(STEPS, HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
    // Feed-scrolling apps: TikTok (two package names), Instagram, Snapchat, Facebook. Not YouTube: time there is
    // mostly watching, not scrolling.
    private val SCROLL_APPS = setOf(
        "com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.instagram.android",
        "com.snapchat.android", "com.facebook.katana",
    )

    fun prefs(c: Context) = c.getSharedPreferences("effort", Context.MODE_PRIVATE)
    fun token(c: Context): String? = prefs(c).getString("token", null)
    fun setToken(c: Context, t: String?) = prefs(c).edit().apply { if (t.isNullOrBlank()) remove("token") else putString("token", t) }.apply()

    // Every 15 minutes (Android's shortest), whenever there's a connection.
    fun schedule(c: Context) {
        val req = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req)
    }

    suspend fun stepsAllowed(c: Context) =
        HealthConnectClient.getSdkStatus(c) == HealthConnectClient.SDK_AVAILABLE &&
            STEPS in HealthConnectClient.getOrCreate(c).permissionController.getGrantedPermissions()

    fun scrollAllowed(c: Context): Boolean {
        val ops = c.getSystemService(AppOpsManager::class.java)
        val mode = if (Build.VERSION.SDK_INT >= 29) ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.packageName)
        else @Suppress("DEPRECATION") ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    // Usage access is a switch in Settings, not a pop-up. This opens Effort's own switch where the phone allows it.
    fun openScrollSettings(c: Context) {
        val own = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:" + c.packageName))
        try { c.startActivity(own) } catch (e: Exception) { c.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
    }

    // Syncs whatever it's allowed to. Returns today's steps (or -1 if steps aren't connected).
    suspend fun run(c: Context): Long {
        val token = token(c) ?: return -1
        val today = LocalDate.now()
        var todaySteps = -1L
        try {
            if (stepsAllowed(c)) {
                val client = HealthConnectClient.getOrCreate(c)
                for (day in listOf(today.minusDays(1), today)) {
                    // Health Connect's total, exactly: the server keeps the highest it's been sent for each day.
                    val steps = stepsOn(client, day)
                    log(token, day, steps)
                    if (day == today) todaySteps = steps
                }
            }
            if (scrollAllowed(c)) {
                // Yesterday first, then today, so today's call leaves the source marked as automatic.
                post("scroll_minutes", JSONObject().put("token", token).put("minutes", scrollMinutes(c, today.minusDays(1))).put("date", today.minusDays(1).toString()))
                get("scroll?t=${URLEncoder.encode(token, "UTF-8")}&minutes=${scrollMinutes(c, today)}")
            }
            try { chatPings(c, token) } catch (e: Unlinked) { throw e } catch (e: Exception) { /* next time */ }
        } catch (e: Unlinked) {
            setToken(c, null) // the account is gone: stop syncing until they sign in again
            throw e
        }
        prefs(c).edit().putLong("syncedAt", System.currentTimeMillis()).putLong("syncedSteps", todaySteps).apply()
        return todaySteps
    }

    private suspend fun stepsOn(client: HealthConnectClient, day: LocalDate): Long =
        client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(day.atStartOfDay(), day.plusDays(1).atStartOfDay())))[StepsRecord.COUNT_TOTAL] ?: 0L

    // Today's total in Health Connect, for the live count while the app's open.
    suspend fun todaySteps(c: Context): Long = stepsOn(HealthConnectClient.getOrCreate(c), LocalDate.now())

    // Sends today's live count (Health Connect's total while the app's open).
    suspend fun logToday(c: Context, steps: Long) {
        val token = token(c) ?: return
        log(token, LocalDate.now(), steps)
        prefs(c).edit().putLong("syncedAt", System.currentTimeMillis()).putLong("syncedSteps", steps).apply()
    }

    private suspend fun log(token: String, day: LocalDate, steps: Long) =
        post("log", JSONObject().put("token", token).put("steps", steps).put("date", day.toString()).put("source", "android-hc"))

    // Minutes the short-video apps were on screen during a day, from Android's own usage records.
    fun scrollMinutes(c: Context, day: LocalDate): Long {
        val usm = c.getSystemService(UsageStatsManager::class.java)
        val zone = ZoneId.systemDefault()
        val start = day.atStartOfDay(zone).toInstant().toEpochMilli()
        val end = minOf(day.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(), System.currentTimeMillis())
        val events = usm.queryEvents(start, end)
        val e = UsageEvents.Event()
        val openSince = HashMap<String, Long>()
        var total = 0L
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            if (e.packageName !in SCROLL_APPS) continue
            when (e.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> openSince.putIfAbsent(e.packageName, e.timeStamp)
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> openSince.remove(e.packageName)?.let { total += e.timeStamp - it }
            }
        }
        openSince.values.forEach { total += end - it } // still open
        return (total / 60000).coerceIn(0, 1440)
    }

    // Squad chat messages that @mention this player (or @everyone) since the last look, as notifications. The app has
    // no browser push, so it asks every 15 minutes with the background sync. The first time it only learns where the
    // chat's up to, so it never digs up old mentions.
    private suspend fun chatPings(c: Context, token: String) {
        val seen = prefs(c).getLong("chatSeen", 0)
        val r = postJson("chat_pings", JSONObject().put("token", token).put("after", seen))
        val pings = r.optJSONArray("pings")
        if (pings != null && Reminders.canNotify(c)) for (i in 0 until pings.length()) {
            val p = pings.getJSONObject(i)
            val title = if (p.optBoolean("all")) "${p.optString("from")} to everyone in ${r.optString("squad")}" else "${p.optString("from")} mentioned you"
            Reminders.chat(c, p.optLong("id"), title, p.optString("text"))
        }
        prefs(c).edit().putLong("chatSeen", r.optLong("latest", seen)).apply()
    }

    private suspend fun postJson(path: String, body: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val conn = URL("$API/$path").openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = conn.responseCode
            if (code == 401) throw Unlinked()
            if (code !in 200..299) throw IllegalStateException("Effort's server said no ($code)")
            JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        } finally {
            conn.disconnect()
        }
    }

    private suspend fun post(path: String, body: JSONObject) = send(path) { conn ->
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
    }

    private suspend fun get(path: String) = send(path) { it.requestMethod = "GET" }

    private suspend fun send(path: String, setup: (HttpURLConnection) -> Unit) = withContext(Dispatchers.IO) {
        val conn = URL("$API/$path").openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            setup(conn)
            val code = conn.responseCode
            if (code == 401) throw Unlinked()
            if (code !in 200..299) throw IllegalStateException("Effort's server said no ($code). It'll try again shortly")
        } finally {
            conn.disconnect()
        }
    }
}
