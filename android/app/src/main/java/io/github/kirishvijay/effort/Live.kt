package io.github.kirishvijay.effort

import android.content.Context
import java.time.LocalDate

// Today's steps, live, while the app is open: Health Connect's total, read every few seconds. Health Connect is the
// count that matters (it merges the phone, a watch and whatever else, the same total the phone's health app shows),
// so it's the only one used. The phone's raw step sensor used to fill the gaps between Health Connect's updates,
// but it counts a little more than Samsung Health or Fit do, so the app ran ahead of the phone and then dropped back.
// Within a day the number only goes up: a health app rewriting its records can briefly report less.
class Live(private val c: Context, private val onSteps: (Long) -> Unit) {
    private var day = LocalDate.now()
    var steps = -1L; private set

    // Kept so the screen code reads the same; there's no sensor to start or ask about any more.
    fun allowed() = true
    fun hasCounter() = false
    fun start() {}
    fun stop() {}

    // A fresh total for today from Health Connect.
    fun health(total: Long) {
        val d = LocalDate.now()
        if (d != day) { day = d; steps = -1 }
        if (total > steps) { steps = total; onSteps(total) }
    }
}
