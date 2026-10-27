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
                    "Effort Steps reads one thing: your step count. It sends today's and yesterday's totals to your " +
                        "Effort account, which your squad sees on the weekly table. It doesn't read anything else, " +
                        "and nothing is shared with anyone outside the game.\n\nTo stop it, remove the permission in " +
                        "Health Connect or uninstall the app.",
                ),
                Ui.button(this, "OK", Ui.Style.Secondary) { finish() },
            ),
        )
    }
}
