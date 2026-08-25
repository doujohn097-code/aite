package com.aite.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

class OfflineActivity : Activity() {
  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private val handler = Handler(Looper.getMainLooper())
  private var isTransitioning = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(buildContent())
    registerNetworkCallback()
  }

  override fun onDestroy() {
    super.onDestroy()
    val connectivityManager =
      getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    networkCallback?.let {
      try {
        connectivityManager?.unregisterNetworkCallback(it)
      } catch (_: Exception) {
      }
    }
    handler.removeCallbacksAndMessages(null)
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    finishAffinity()
  }

  private fun buildContent(): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(24), dp(24), dp(24), dp(24))
      setBackgroundColor(Color.BLACK)
    }

    val brandRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val iconMark = ImageView(this).apply {
      setImageResource(R.mipmap.ic_launcher)
      scaleType = ImageView.ScaleType.CENTER_CROP
      layoutParams = LinearLayout.LayoutParams(dp(64), dp(64))
      background = GradientDrawable().apply {
        setColor(Color.WHITE)
        cornerRadius = dp(18).toFloat()
      }
      setPadding(dp(6), dp(6), dp(6), dp(6))
      clipToOutline = true
    }
    brandRow.addView(iconMark)

    val divider = View(this).apply {
      setBackgroundColor(Color.argb(180, 255, 255, 255))
      layoutParams = LinearLayout.LayoutParams(dp(1), dp(64)).apply {
        setMargins(dp(28), 0, dp(28), 0)
      }
    }
    brandRow.addView(divider)

    val brandTextCol = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.START
    }

    brandTextCol.addView(TextView(this).apply {
      text = "Aite"
      textSize = 34f
      setTextColor(Color.WHITE)
      typeface = Typeface.create("sans-serif-black", Typeface.BOLD)
      letterSpacing = 0.05f
    })

    brandTextCol.addView(TextView(this).apply {
      text = "from Salem Ahmed"
      textSize = 18f
      setTextColor(Color.WHITE)
      typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
      letterSpacing = 0.12f
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(2) }
    })

    brandRow.addView(brandTextCol)
    root.addView(brandRow)

    root.addView(View(this).apply {
      setBackgroundColor(Color.argb(30, 255, 255, 255))
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(1)
      ).apply { setMargins(0, dp(36), 0, dp(36)) }
    })

    root.addView(ImageView(this).apply {
      setImageResource(R.drawable.ic_offline)
      alpha = 0.92f
      layoutParams = LinearLayout.LayoutParams(dp(64), dp(64))
    })

    root.addView(TextView(this).apply {
      text = "لا يوجد اتصال بالإنترنت"
      textSize = 22f
      setTextColor(Color.WHITE)
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(18) }
    })

    root.addView(TextView(this).apply {
      text = "أنت غير متصل حالياً\nتحقق من اتصالك بالإنترنت وحاول مجدداً للوصول إلى Aite"
      textSize = 15f
      setTextColor(Color.rgb(180, 190, 205))
      gravity = Gravity.CENTER
      setLineSpacing(dp(4).toFloat(), 1f)
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dp(12)
        setMargins(dp(16), topMargin, dp(16), 0)
      }
    })

    root.addView(TextView(this).apply {
      text = "إعادة المحاولة"
      textSize = 16f
      setTextColor(Color.BLACK)
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(dp(32), dp(14), dp(32), dp(14))
      background = GradientDrawable().apply {
        setColor(Color.WHITE)
        cornerRadius = dp(28).toFloat()
      }
      setOnClickListener { attemptReconnect() }
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(28) }
    })

    root.addView(TextView(this).apply {
      text = "سيتم إعادة الاتصال تلقائياً عند عودة الإنترنت"
      textSize = 12f
      setTextColor(Color.argb(120, 255, 255, 255))
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(16) }
    })

    return root
  }

  private fun attemptReconnect() {
    if (isTransitioning) return

    if (hasNetwork()) {
      isTransitioning = true
      startActivity(Intent(this, MainActivity::class.java))
      finish()
      return
    }

    findViewById<View>(android.R.id.content)?.let { rootView ->
      rootView.animate().translationX(dp(6).toFloat()).setDuration(60)
        .withEndAction {
          rootView.animate().translationX((-dp(6)).toFloat()).setDuration(60)
            .withEndAction {
              rootView.animate().translationX(0f).setDuration(60).start()
            }.start()
        }.start()
    }
  }

  private fun registerNetworkCallback() {
    val connectivityManager =
      getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return

    val request = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()

    networkCallback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        handler.postDelayed({
          runOnUiThread {
            if (!isTransitioning && hasNetwork()) attemptReconnect()
          }
        }, 1000)
      }
    }

    try {
      connectivityManager.registerNetworkCallback(request, networkCallback!!)
    } catch (_: Exception) {
    }
  }

  private fun hasNetwork(): Boolean {
    val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    val capabilities = manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
    return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
      capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
      capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
      capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()
}
