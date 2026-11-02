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
import java.time.LocalTime
import java.time.ZonedDateTime

// Two evening pings: 5pm, an hour before the Taxman's in (and on Sunday, the raid lobby), and 9pm if you missed
// him. The phone books them itself, so they work without the internet. A sleeping phone can deliver an alarm
// late, so each ping checks the clock first and stays quiet if its moment has passed. Android forgets an app's
// alarms when the app is updated or the phone restarts, so they're booked again then, and every time the app opens.
object Reminders {
    private const val CHANNEL = "evening"
    private const val SOON = "soon"
    private const val MISSED = "missed"

    fun enabled(c: Context) = Sync.prefs(c).getBoolean("reminders", false)
    fun canNotify(c: Context) = Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun enable(c: Context, on: Boolean) {
        Sync.prefs(c).edit().putBoolean("reminders", on).apply()
        if (on) schedule(c) else listOf(SOON, MISSED).forEach { c.getSystemService(AlarmManager::class.java).cancel(pending(c, it)) }
    }

    // The game tells the app when today's fight is done, so the 9pm ping stays quiet.
    fun taxDone(c: Context, day: String) = Sync.prefs(c).edit().putString("taxDone", day).apply()

    // The next 5pm and 9pm on this phone's clock. Inexact on purpose (no special alarm permission needed);
    // they usually land within a minute or so.
    fun schedule(c: Context) {
        if (!enabled(c)) return
        book(c, SOON, 17, 0)
        book(c, MISSED, 21, 0)
    }

    private fun book(c: Context, kind: String, hour: Int, minute: Int) {
        val now = ZonedDateTime.now()
        var at = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
        if (!at.isAfter(now)) at = at.plusDays(1)
        c.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toInstant().toEpochMilli(), pending(c, kind))
    }

    private fun pending(c: Context, kind: String) =
        PendingIntent.getBroadcast(c, if (kind == MISSED) 3 else 1, Intent(c, ReminderReceiver::class.java).putExtra("kind", kind),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    fun show(c: Context, kind: String = SOON, test: Boolean = false) {
        if (!canNotify(c)) return
        // Late alarms stay quiet: the 5pm one only before the Taxman leaves at 9, the 9pm one only that evening.
        val hour = LocalTime.now().hour
        if (!test && kind == SOON && hour !in 17..20) return
        if (!test && kind == MISSED && hour !in 21..23) return
        if (kind == MISSED && Sync.prefs(c).getString("taxDone", null) == LocalDate.now().toString()) return
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Evening reminders", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "5pm before the Taxman's in (6pm to 9pm), and 9pm if you missed him"
        })
        val sunday = LocalDate.now().dayOfWeek == DayOfWeek.SUNDAY
        val (title, body) = when {
            test -> "Notifications are on" to "A ping at 5pm before the Taxman's in, and at 9pm if you miss him."
            kind == MISSED -> "You missed the Taxman" to "He took his cut of today's Efforts."
            sunday -> "Raid and Taxman at 6pm" to "Lobby's open 6pm to 9pm."
            hour >= 18 -> "The Taxman's in till 9pm" to "Five minutes to stop him taking his cut."
            else -> "The Taxman's in at 6pm" to "He's here 6pm to 9pm."
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

    // A squad chat message that mentions you. Its own channel, so people can quieten chat and keep the Taxman.
    fun chat(c: Context, id: Long, title: String, text: String) {
        if (!canNotify(c)) return
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("chat", "Chat mentions", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "When someone in your squad @mentions you or @everyone"
        })
        val open = PendingIntent.getActivity(
            c, 4, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(c, "chat")
            .setSmallIcon(R.drawable.ic_stat)
            .setColor(0xFFFFC83D.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        nm.notify(1000 + (id % 100000).toInt(), n)
    }
}

// Fires at 5pm and 9pm (shows the ping and books the next), and after a restart or an update (rebooks them).
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, intent: Intent) {
        if (!Reminders.enabled(c)) return
        if (intent.action == null) Reminders.show(c, intent.getStringExtra("kind") ?: "soon")
        Reminders.schedule(c)
    }
}
