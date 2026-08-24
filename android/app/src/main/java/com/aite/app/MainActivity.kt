package com.aite.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.addCallback
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient

class MainActivity : BridgeActivity() {
  private var isOfflineLaunched = false
  private var webViewConfigured = false
  private var networkCallback: ConnectivityManager.NetworkCallback? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    onBackPressedDispatcher.addCallback(this) {
      val webView = bridge?.webView
      if (webView?.canGoBack() == true) webView.goBack() else finish()
    }

    requestNativePermissions()

    if (!hasNetwork()) {
      launchOffline()
      return
    }

    handlePushIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handlePushIntent(intent)
  }

  override fun onStart() {
    super.onStart()
    if (webViewConfigured) return

    val webView = bridge?.webView ?: return
    configureWebView(webView)
    registerNetworkCallback()
    webViewConfigured = true
  }

  override fun onResume() {
    super.onResume()
    if (hasNetwork() && isOfflineLaunched) isOfflineLaunched = false
  }

  override fun onDestroy() {
    unregisterNetworkCallback()
    super.onDestroy()
  }

  private fun requestNativePermissions() {
    // الكاميرا والميكروفون يطلبهما BridgeWebChromeClient عند استعمال الميزة
    // فعليًا. طلبهما عند تشغيل التطبيق كان يدفع المستخدم لرفضهما قبل معرفة
    // السبب، ثم يفشل getUserMedia داخل WebView.
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(
        this,
        Manifest.permission.POST_NOTIFICATIONS
      ) != PackageManager.PERMISSION_GRANTED
    ) {
      requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2207)
    }
  }

  private fun configureWebView(webView: WebView) {
    val activeBridge = bridge ?: return
    val settings = webView.settings
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.databaseEnabled = true
    settings.loadsImagesAutomatically = true
    settings.allowContentAccess = true
    settings.allowFileAccess = true
    settings.javaScriptCanOpenWindowsAutomatically = true
    settings.mediaPlaybackRequiresUserGesture = false
    settings.loadWithOverviewMode = true
    settings.useWideViewPort = true
    settings.cacheMode = WebSettings.LOAD_DEFAULT
    settings.setSupportZoom(false)
    settings.builtInZoomControls = false
    settings.displayZoomControls = false
    settings.textZoom = 100
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      settings.safeBrowsingEnabled = true
      webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true)
    }

    webView.overScrollMode = View.OVER_SCROLL_NEVER
    webView.isHorizontalScrollBarEnabled = false
    webView.isVerticalScrollBarEnabled = false
    webView.isLongClickable = false
    webView.isHapticFeedbackEnabled = false
    webView.setBackgroundColor(0xFF000000.toInt())

    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

    webView.setWebViewClient(object : BridgeWebViewClient(activeBridge) {
      override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        injectRuntimeTweaks(view)
      }

      override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError
      ) {
        if (request.isForMainFrame && (!hasNetwork() || isNetworkError(error.errorCode))) {
          launchOffline()
          return
        }
        super.onReceivedError(view, request, error)
      }

      override fun onReceivedHttpError(
        view: WebView,
        request: WebResourceRequest,
        errorResponse: WebResourceResponse
      ) {
        if (request.isForMainFrame && !hasNetwork()) {
          launchOffline()
          return
        }
        super.onReceivedHttpError(view, request, errorResponse)
      }

      override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest
      ): Boolean {
        val uri = request.url ?: return false
        val scheme = uri.scheme.orEmpty().lowercase()
        if (scheme in setOf("http", "https")) return false

        if (scheme == "aite" && uri.host == "settings") {
          startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
              data = Uri.parse("package:$packageName")
            }
          )
          return true
        }

        return try {
          startActivity(Intent(Intent.ACTION_VIEW, uri))
          true
        } catch (_: ActivityNotFoundException) {
          false
        }
      }

      override fun onRenderProcessGone(
        view: WebView,
        detail: RenderProcessGoneDetail
      ): Boolean {
        recreate()
        return true
      }
    })
  }

  private fun injectRuntimeTweaks(webView: WebView) {
    val script = """
      (function() {
        if (window.__aiteNativeTweaksApplied) return;
        window.__aiteNativeTweaksApplied = true;

        var style = document.getElementById('aite-native-tweaks');
        if (!style) {
          style = document.createElement('style');
          style.id = 'aite-native-tweaks';
          style.textContent = `
            html, body, * { -webkit-tap-highlight-color: transparent !important; }
            *:not(input):not(textarea):not([contenteditable="true"]) {
              -webkit-user-select: none !important;
              user-select: none !important;
              -webkit-touch-callout: none !important;
            }
            input, textarea, [contenteditable="true"] {
              -webkit-user-select: text !important;
              user-select: text !important;
            }
          `;
          (document.head || document.documentElement).appendChild(style);
        }

        document.addEventListener('contextmenu', function(event) {
          var t = event.target;
          var editable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
          if (!editable) event.preventDefault();
        }, true);

        document.addEventListener('selectstart', function(event) {
          var t = event.target;
          var editable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
          if (!editable) event.preventDefault();
        }, true);
      })();
    """.trimIndent()

    webView.evaluateJavascript(script, null)
  }

  private fun handlePushIntent(intent: Intent?) {
    val pushUrl = intent?.getStringExtra("pushUrl")?.trim().orEmpty()
    if (pushUrl.isEmpty()) return

    intent?.removeExtra("pushUrl")
    val target = if (pushUrl.startsWith("http")) {
      pushUrl
    } else {
      "https://aite-app-one.vercel.app" + if (pushUrl.startsWith('/')) pushUrl else "/$pushUrl"
    }

    val webView = bridge?.webView ?: return
    webView.post { webView.loadUrl(target) }
  }

  private fun launchOffline() {
    if (isOfflineLaunched) return
    isOfflineLaunched = true

    startActivity(
      Intent(this, OfflineActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
      }
    )
    finish()
  }

  private fun registerNetworkCallback() {
    val connectivityManager =
      getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return

    val request = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()

    networkCallback = object : ConnectivityManager.NetworkCallback() {
      override fun onLost(network: Network) {
        runOnUiThread {
          if (!hasNetwork()) launchOffline()
        }
      }
    }

    try {
      connectivityManager.registerNetworkCallback(request, networkCallback!!)
    } catch (_: Exception) {
    }
  }

  private fun unregisterNetworkCallback() {
    val callback = networkCallback ?: return
    val connectivityManager =
      getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return

    try {
      connectivityManager.unregisterNetworkCallback(callback)
    } catch (_: Exception) {
    }
    networkCallback = null
  }

  private fun hasNetwork(): Boolean {
    val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    val capabilities = manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
    return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
      capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
      capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
      capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  private fun isNetworkError(code: Int): Boolean {
    return code == WebViewClient.ERROR_HOST_LOOKUP ||
      code == WebViewClient.ERROR_CONNECT ||
      code == WebViewClient.ERROR_TIMEOUT ||
      code == WebViewClient.ERROR_IO ||
      code == WebViewClient.ERROR_UNKNOWN
  }
}
