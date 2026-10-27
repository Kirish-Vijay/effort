package io.github.kirishvijay.effort

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.format.DateUtils
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

// One screen. Effort's web app opens it with effort://connect?t=TOKEN; the player taps Connect steps,
// Health Connect asks, and from then on it syncs every 15 minutes by itself.
class MainActivity : ComponentActivity() {
    private var syncing = false
    private var lastError: String? = null

    private val askPermission: ActivityResultLauncher<Set<String>> = registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted: Set<String> ->
        if (StepSync.STEPS in granted) { StepSync.schedule(this); syncNow() } else render()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        takeToken(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        takeToken(intent)
    }

    override fun onResume() {
        super.onResume()
        // Every time it's opened, sync straight away if it can.
        lifecycleScope.launch { if (StepSync.token(this@MainActivity) != null && hasPermission()) syncNow() else render() }
    }

    private fun takeToken(intent: Intent?) {
        val t = intent?.data?.takeIf { it.scheme == "effort" }?.getQueryParameter("t")
        if (!t.isNullOrBlank() && t.matches(Regex("[A-Za-z0-9]{10,64}"))) StepSync.setToken(this, t)
    }

    private suspend fun hasPermission() =
        HealthConnectClient.getSdkStatus(this) == HealthConnectClient.SDK_AVAILABLE &&
            StepSync.STEPS in HealthConnectClient.getOrCreate(this).permissionController.getGrantedPermissions()

    private fun syncNow() {
        if (syncing) return
        syncing = true; lastError = null; render()
        lifecycleScope.launch {
            try { StepSync.run(this@MainActivity) } catch (e: Exception) { lastError = e.message ?: "Couldn't sync" }
            syncing = false
            render()
        }
    }

    private fun openEffort() = startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(StepSync.APP_URL)))

    private fun render() {
        lifecycleScope.launch { show() }
    }

    private suspend fun show() {
        val c = this@MainActivity
        val status = HealthConnectClient.getSdkStatus(c)
        val view = when {
            status == HealthConnectClient.SDK_UNAVAILABLE -> Ui.screen(
                c, Ui.title(c, "Not on this phone"),
                Ui.body(c, "This phone doesn't have Health Connect, which is how Android shares steps. You can still type your steps into Effort each day."),
                Ui.button(c, "Open Effort", Ui.Style.Secondary) { openEffort() },
            )
            status == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> Ui.screen(
                c, Ui.title(c, "One more app"),
                Ui.body(c, "Android shares steps through Google's Health Connect. Install it (it's free), then come back here."),
                Ui.button(c, "Get Health Connect", Ui.Style.Primary) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding")).setPackage("com.android.vending"))
                },
            )
            StepSync.token(c) == null -> Ui.screen(
                c, Ui.title(c, "Effort Steps"),
                Ui.body(c, "Open Effort, go to Me → Steps and tap Connect steps. That brings you back here, signed in."),
                Ui.button(c, "Open Effort", Ui.Style.Primary) { openEffort() },
            )
            !hasPermission() -> Ui.screen(
                c, Ui.title(c, "Connect your steps"),
                Ui.body(c, "One tap and Effort counts your steps by itself. It only reads your step count, nothing else."),
                Ui.button(c, "Connect steps", Ui.Style.Primary) { askPermission.launch(StepSync.PERMISSIONS) },
                Ui.body(c, "Samsung Health? Also turn on Samsung Health → Settings → Health Connect."),
            )
            else -> {
                val (at, steps) = StepSync.lastSync(c)
                Ui.screen(
                    c, Ui.title(c, "You're connected"),
                    Ui.card(
                        c,
                        Ui.body(c, "Steps today"),
                        Ui.big(c, if (steps >= 0) "%,d".format(steps) else "…"),
                        Ui.body(c, when {
                            syncing -> "Syncing…"
                            lastError != null -> lastError!!
                            at > 0 -> "Synced " + DateUtils.getRelativeTimeSpanString(at, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS)
                            else -> "Not synced yet"
                        }, if (lastError != null) Ui.RED else Ui.MUTED),
                    ),
                    Ui.body(c, "It syncs every 15 minutes by itself, and whenever you open this. You can close it."),
                    Ui.button(c, "Back to Effort", Ui.Style.Go) { openEffort() },
                    Ui.button(c, "Sync now", Ui.Style.Secondary) { syncNow() },
                )
            }
        }
        setContentView(view)
    }
}
