package io.github.kirishvijay.effort

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

// The few views this app needs, in Effort's look: navy, outlined chunky buttons, gold for the main action.
object Ui {
    const val BG = 0xFF0C1431.toInt()
    const val PANEL = 0xFF1D2A5E.toInt()
    const val INK = 0xFF0A0F26.toInt()
    const val TEXT = 0xFFF3F5FF.toInt()
    const val MUTED = 0xFFB4BFE8.toInt()
    const val GOLD = 0xFFFFC83D.toInt()
    const val GREEN = 0xFF4FD67F.toInt()
    const val RED = 0xFFFF9AA3.toInt()

    enum class Style(val fill: Int, val text: Int) { Primary(GOLD, 0xFF3A2400.toInt()), Go(GREEN, 0xFF0D3A1D.toInt()), Secondary(0xFF3A4B8C.toInt(), TEXT) }

    private fun Context.dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    fun screen(c: Context, vararg children: View): View {
        val col = LinearLayout(c).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(c.dp(24), c.dp(56), c.dp(24), c.dp(32))
            children.forEach { addView(it) }
        }
        return ScrollView(c).apply { setBackgroundColor(BG); isFillViewport = true; addView(col) }
    }

    fun title(c: Context, text: String) = TextView(c).apply {
        this.text = text
        setTextColor(TEXT); textSize = 30f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
        setShadowLayer(1f, 0f, c.dp(3).toFloat(), INK)
        layoutParams = spaced(c, 8)
    }

    fun body(c: Context, text: String, color: Int = MUTED) = TextView(c).apply {
        this.text = text
        setTextColor(color); textSize = 16f; gravity = Gravity.CENTER; setLineSpacing(0f, 1.2f)
        layoutParams = spaced(c, 12)
    }

    fun big(c: Context, text: String) = TextView(c).apply {
        this.text = text
        setTextColor(GOLD); textSize = 44f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
        layoutParams = spaced(c, 4)
    }

    fun button(c: Context, text: String, style: Style, onClick: () -> Unit) = TextView(c).apply {
        this.text = text
        setTextColor(style.text); textSize = 19f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
        minHeight = c.dp(58)
        setPadding(c.dp(18), c.dp(14), c.dp(18), c.dp(14))
        background = GradientDrawable().apply { cornerRadius = c.dp(16).toFloat(); setColor(style.fill); setStroke(c.dp(2), INK) }
        elevation = c.dp(3).toFloat()
        isClickable = true; isFocusable = true
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = c.dp(16) }
    }

    // A rounded card behind a few lines, for the "connected" state.
    fun card(c: Context, vararg children: View) = LinearLayout(c).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setPadding(c.dp(18), c.dp(18), c.dp(18), c.dp(18))
        background = GradientDrawable().apply { cornerRadius = c.dp(20).toFloat(); setColor(PANEL); setStroke(c.dp(2), INK) }
        children.forEach { addView(it) }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = c.dp(20) }
    }

    private fun spaced(c: Context, top: Int) =
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = c.dp(top) }

}
