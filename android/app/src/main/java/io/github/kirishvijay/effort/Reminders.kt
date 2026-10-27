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

// The 6:45pm ping, 15 minutes before the Taxman (and on Sunday, the raid). The phone schedules it
// itself, so it works without the internet and survives restarts.
object Reminders {
    private const val CHANNEL = "evening"

    fun enabled(c: Context) = Sync.prefs(c).getBoolean("reminders", false)
    fun canNotify(c: Context) = Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun enable(c: Context, on: Boolean) {
        Sync.prefs(c).edit().putBoolean("reminders", on).apply()
        if (on) schedule(c) else c.getSystemService(AlarmManager::class.java).cancel(pending(c))
    }

    // Next 6:45pm on this phone's clock. Inexact on purpose (no special alarm permission needed); it lands within a minute or so.
    fun schedule(c: Context) {
        val now = ZonedDateTime.now()
        var at = now.withHour(18).withMinute(45).withSecond(0).withNano(0)
        if (!at.isAfter(now)) at = at.plusDays(1)
        c.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toInstant().toEpochMilli(), pending(c))
    }

    private fun pending(c: Context) =
        PendingIntent.getBroadcast(c, 1, Intent(c, ReminderReceiver::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    fun show(c: Context, test: Boolean = false) {
        if (!canNotify(c)) return
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "7pm reminders", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "A ping 15 minutes before the Taxman and the Sunday raid"
        })
        val sunday = LocalDate.now().dayOfWeek == DayOfWeek.SUNDAY
        val (title, body) = when {
            test -> "Notifications are on" to "You'll get a ping at 6:45pm before the Taxman, and before the raid on Sunday."
            sunday -> "Raid at 7" to "15 minutes, the whole squad, one boss. The Taxman's open too."
            else -> "The Taxman's coming at 7" to "Five minutes to stop him taking his cut. Get your steps in."
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
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        nm.notify(if (test) 2 else 1, n)
    }
}

// Fires at 6:45pm (shows the ping and books tomorrow's) and after the phone restarts (rebooks it).
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, intent: Intent) {
        if (!Reminders.enabled(c)) return
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) Reminders.show(c)
        Reminders.schedule(c)
    }
}
