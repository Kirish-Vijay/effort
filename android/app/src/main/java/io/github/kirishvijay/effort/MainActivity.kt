package io.github.kirishvijay.effort

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.json.JSONObject

// The whole game, in the app: the same Effort the website runs, plus what only an app can do on
// Android: read steps, read short-video screen time, and ping at 6:45pm. The game talks to the app
// through window.EffortAndroid, and the app tells the game what's connected via window.onEffortNative.
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private var health = "none"     // ok | update (Health Connect needs installing) | none
    private var stepsOn = false
    private var lastError: String? = null
    private val credentials by lazy { CredentialManager.create(this) }

    private val askSteps: ActivityResultLauncher<Set<String>> =
        registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted: Set<String> ->
            stepsOn = Sync.STEPS in granted
            sync()
        }
    private val askNotify: ActivityResultLauncher<String> =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok: Boolean ->
            if (ok) { Reminders.enable(this, true); Reminders.show(this, test = true) }
            pushStatus()
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this).apply {
            setBackgroundColor(Ui.BG)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            addJavascriptInterface(Bridge(), "EffortAndroid")
            webChromeClient = WebChromeClient() // the game's confirm() and prompt() boxes
            webViewClient = object : WebViewClient() {
                // The game stays in the app; anything else (calendar links, Health Connect's Play page) opens outside it.
                override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                    val u = req.url
                    if (u.host == Uri.parse(Sync.APP_URL).host && u.path.orEmpty().startsWith("/effort") && !u.path.orEmpty().endsWith(".ics")) return false
                    openOutside(u)
                    return true
                }
            }
            setDownloadListener { url, _, _, _, _ -> openOutside(Uri.parse(url)) }
        }
        setContentView(web)
        web.loadUrl(startUrl(intent) ?: Sync.APP_URL)
        // Back closes sheets and steps back through the game; at the top it leaves the app.
        onBackPressedDispatcher.addCallback(this) {
            web.evaluateJavascript("window.effortBack ? window.effortBack() : false") { handled -> if (handled != "true") moveTaskToBack(true) }
        }
    }

    // effort://connect?t=TOKEN signs in (from the website's "Open in the app"); effort://join?g=CODE joins a squad.
    private fun startUrl(intent: Intent?): String? {
        val d = intent?.data?.takeIf { it.scheme == "effort" } ?: return null
        val t = d.getQueryParameter("t")?.takeIf { it.matches(Regex("[A-Za-z0-9]{10,64}")) }
        val g = d.getQueryParameter("g")?.takeIf { it.matches(Regex("[A-Za-z0-9]{4,12}")) }
        return when {
            t != null -> "${Sync.APP_URL}?me=$t"
            g != null -> "${Sync.APP_URL}?g=$g"
            else -> null
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        startUrl(intent)?.let { web.loadUrl(it) }
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        // Coming back from Settings or Health Connect: see what's now allowed, and sync.
        sync()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    private fun openOutside(u: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (e: Exception) { /* nothing can open it */ }
    }

    private fun sync() {
        lifecycleScope.launch {
            health = when (HealthConnectClient.getSdkStatus(this@MainActivity)) {
                HealthConnectClient.SDK_AVAILABLE -> "ok"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update"
                else -> "none"
            }
            stepsOn = health == "ok" && Sync.stepsAllowed(this@MainActivity)
            pushStatus()
            if (Sync.token(this@MainActivity) == null || !(stepsOn || Sync.scrollAllowed(this@MainActivity))) return@launch
            Sync.schedule(this@MainActivity)
            lastError = try { Sync.run(this@MainActivity); null } catch (e: Exception) { e.message }
            pushStatus()
        }
    }

    private fun status(): String {
        val p = Sync.prefs(this)
        return JSONObject()
            .put("health", health).put("steps", stepsOn).put("scroll", Sync.scrollAllowed(this))
            .put("reminders", Reminders.enabled(this) && Reminders.canNotify(this))
            .put("syncedAt", p.getLong("syncedAt", 0)).put("todaySteps", p.getLong("syncedSteps", -1))
            .put("error", lastError ?: JSONObject.NULL)
            .put("version", packageManager.getPackageInfo(packageName, 0).versionName)
            .toString()
    }

    private fun pushStatus() = runOnUiThread {
        web.evaluateJavascript("window.onEffortNative && window.onEffortNative(${status()})", null)
    }

    // What the game can ask the app to do. These run off the main thread, so each hops back onto it.
    inner class Bridge {
        @JavascriptInterface fun status(): String = this@MainActivity.status()

        // The game hands over the signed-in player's token, so the background sync knows whose steps these are.
        @JavascriptInterface fun setToken(t: String?) = runOnUiThread {
            val changed = t != Sync.token(this@MainActivity)
            Sync.setToken(this@MainActivity, t)
            if (changed && !t.isNullOrBlank()) sync()
        }

        @JavascriptInterface fun connectSteps() = runOnUiThread {
            when (health) {
                "ok" -> askSteps.launch(Sync.PERMISSIONS)
                "update" -> openOutside(Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding"))
            }
        }

        @JavascriptInterface fun connectScroll() = runOnUiThread { Sync.openScrollSettings(this@MainActivity) }

        @JavascriptInterface fun reminders(on: Boolean) = runOnUiThread {
            if (!on) { Reminders.enable(this@MainActivity, false); pushStatus() }
            else if (Build.VERSION.SDK_INT >= 33 && !Reminders.canNotify(this@MainActivity)) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
            else { Reminders.enable(this@MainActivity, true); Reminders.show(this@MainActivity, test = true); pushStatus() }
        }

        @JavascriptInterface fun testReminder() = runOnUiThread { Reminders.show(this@MainActivity, test = true) }

        @JavascriptInterface fun syncNow() = runOnUiThread { sync() }

        // Passkeys need Android 9+. The game passes WebAuthn options JSON; the answer goes back to
        // window.onEffortPasskey(id, ok, json-or-reason).
        @JavascriptInterface fun passkeysAvailable(): Boolean = Build.VERSION.SDK_INT >= 28

        @JavascriptInterface fun passkey(kind: String, requestJson: String, id: String) = runOnUiThread {
            lifecycleScope.launch {
                val (ok, out) = try {
                    if (kind == "create") {
                        val r = credentials.createCredential(this@MainActivity, CreatePublicKeyCredentialRequest(requestJson)) as CreatePublicKeyCredentialResponse
                        true to r.registrationResponseJson
                    } else {
                        val r = credentials.getCredential(this@MainActivity, GetCredentialRequest(listOf(GetPublicKeyCredentialOption(requestJson))))
                        true to (r.credential as PublicKeyCredential).authenticationResponseJson
                    }
                } catch (e: CreateCredentialCancellationException) { false to "cancelled" }
                catch (e: GetCredentialCancellationException) { false to "cancelled" }
                catch (e: NoCredentialException) { false to "none" }
                catch (e: Exception) { false to (e.message ?: "failed") }
                web.evaluateJavascript("window.onEffortPasskey && window.onEffortPasskey(${JSONObject.quote(id)}, $ok, ${JSONObject.quote(out)})", null)
            }
        }
    }
}
