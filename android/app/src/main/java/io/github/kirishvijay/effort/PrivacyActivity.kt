package io.github.kirishvijay.effort

import android.os.Bundle
import androidx.activity.ComponentActivity

// What Health Connect shows when someone taps "why does this app want my data?".
class PrivacyActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            Ui.screen(
                this,
                Ui.title(this, "Your data"),
                Ui.body(
                    this,
                    "Effort reads two things, only once you allow them: your step count (from Health Connect) and how " +
                        "many minutes you spend in short-video apps like TikTok, Instagram and YouTube (from Android's usage " +
                        "access). It sends daily totals to your Effort account, which your squad sees in the game. It doesn't " +
                        "read anything else, and nothing is shared outside the game.\n\nTo stop it, turn the permission off " +
                        "in Health Connect or Settings → Usage access, or uninstall the app.",
                ),
                Ui.button(this, "OK", Ui.Style.Secondary) { finish() },
            ),
        )
    }
}
