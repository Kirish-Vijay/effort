package io.github.kirishvijay.effort

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import java.time.LocalDate

// Today's steps, live, while the app is open. Health Connect is the count that matters (it merges the phone,
// a watch and whatever else), but the apps that feed it only write every few minutes. Between those writes
// the phone's own step counter carries the number on from Health Connect's last total. Whenever Health
// Connect catches up with it (or passes it, say with a watch on), its number takes over again.
class Live(private val c: Context, private val onSteps: (Long) -> Unit) : SensorEventListener {
    private val sensors = c.getSystemService(SensorManager::class.java)
    private val counter = sensors?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private var day = LocalDate.now()
    private var health = -1L        // Health Connect's total at the anchor
    private var counterAt = -1f     // the phone's counter at the anchor (it counts since the phone started)
    private var counterNow = -1f
    var steps = -1L; private set

    fun allowed() = Build.VERSION.SDK_INT < 29 ||
        c.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
    fun hasCounter() = counter != null

    private var listening = false
    fun start() { if (!listening && counter != null && allowed()) listening = sensors?.registerListener(this, counter, SensorManager.SENSOR_DELAY_NORMAL) == true }
    fun stop() { sensors?.unregisterListener(this); listening = false }

    // A fresh total for today from Health Connect.
    fun health(total: Long) {
        newDay()
        if (total >= estimate()) { health = total; counterAt = counterNow }
        publish()
    }

    override fun onSensorChanged(e: SensorEvent) {
        counterNow = e.values[0]
        // The phone restarted (its counter went back to zero): carry on from where the estimate had got to.
        if (counterAt >= 0 && counterNow < counterAt) { health = maxOf(health, steps); counterAt = counterNow }
        if (counterAt < 0 && health >= 0) counterAt = counterNow
        publish()
    }

    override fun onAccuracyChanged(s: Sensor?, accuracy: Int) {}

    private fun estimate(): Long =
        if (health < 0) -1 else health + if (counterAt >= 0 && counterNow >= counterAt) (counterNow - counterAt).toLong() else 0

    private fun newDay() {
        val d = LocalDate.now()
        if (d != day) { day = d; health = -1; counterAt = -1f; steps = -1 }
    }

    private fun publish() {
        newDay()
        val e = estimate()
        if (e >= 0 && e > steps) { steps = e; onSteps(e) }
    }
}
