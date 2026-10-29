package io.github.kirishvijay.effort

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZonedDateTime

// Two evening pings: 6pm when the Taxman's in (and on Sunday, the raid lobby), and an 8:30pm last call if you
// haven't fought him yet. The phone books them itself, so they work without the internet. Android forgets an
// app's alarms when the app is updated or the phone restarts, so they're booked again then, and every time
// the app opens.
object Reminders {
    private const val CHANNEL = "evening"
    private const val OPEN = "open"
    private const val LAST = "last"

    fun enabled(c: Context) = Sync.prefs(c).getBoolean("reminders", false)
    fun canNotify(c: Context) = Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun enable(c: Context, on: Boolean) {
        Sync.prefs(c).edit().putBoolean("reminders", on).apply()
        if (on) schedule(c) else listOf(OPEN, LAST).forEach { c.getSystemService(AlarmManager::class.java).cancel(pending(c, it)) }
    }

    // The game tells the app when today's fight is done, so the last call stays quiet.
    fun taxDone(c: Context, day: String) = Sync.prefs(c).edit().putString("taxDone", day).apply()

    // The next 6pm and 8:30pm on this phone's clock. Inexact on purpose (no special alarm permission needed);
    // they land within a minute or so.
    fun schedule(c: Context) {
        if (!enabled(c)) return
        book(c, OPEN, 18, 0)
        book(c, LAST, 20, 30)
    }

    private fun book(c: Context, kind: String, hour: Int, minute: Int) {
        val now = ZonedDateTime.now()
        var at = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
        if (!at.isAfter(now)) at = at.plusDays(1)
        c.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toInstant().toEpochMilli(), pending(c, kind))
    }

    private fun pending(c: Context, kind: String) =
        PendingIntent.getBroadcast(c, if (kind == LAST) 3 else 1, Intent(c, ReminderReceiver::class.java).putExtra("kind", kind),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    fun show(c: Context, kind: String = OPEN, test: Boolean = false) {
        if (!canNotify(c)) return
        if (kind == LAST && Sync.prefs(c).getString("taxDone", null) == LocalDate.now().toString()) return
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Evening reminders", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "When the Taxman's in (6pm to 9pm), a last call at 8:30pm, and the Sunday raid lobby"
        })
        val sunday = LocalDate.now().dayOfWeek == DayOfWeek.SUNDAY
        val (title, body) = when {
            test -> "Notifications are on" to "You'll get a ping at 6pm when the Taxman's in, and a last call at 8:30 if you haven't fought him."
            kind == LAST -> "Last call: the Taxman goes at 9" to "You haven't fought him yet. Five minutes to stop him taking his cut of today."
            sunday -> "Raid lobby's open till 9pm" to "4 or more of you, everyone ready, one boss. The Taxman's in till 9 too."
            else -> "The Taxman's in" to "He's here till 9pm. Five minutes to stop him taking his cut of today's steps."
        }
        val open = PendingIntent.getActivity(
            c, 2, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat)
            .setColor(0xFFFFC83D.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        nm.notify(if (test) 2 else 1, n)
    }
}

// Fires at 6pm and 8:30pm (shows the ping and books the next), and after a restart or an update (rebooks them).
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, intent: Intent) {
        if (!Reminders.enabled(c)) return
        if (intent.action == null) Reminders.show(c, intent.getStringExtra("kind") ?: "open")
        Reminders.schedule(c)
    }
}
