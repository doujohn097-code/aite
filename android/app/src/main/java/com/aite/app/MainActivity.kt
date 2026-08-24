package com.aite.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.addCallback
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient
import org.json.JSONObject

class MainActivity : BridgeActivity() {
  private var webViewConfigured = false
  private var restoredThisSession = false
  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private var offlineOverlay: View? = null
  private var lastGoodUrl: String = ORIGIN

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    lastGoodUrl = prefs().getString(KEY_LAST_URL, ORIGIN) ?: ORIGIN
    onBackPressedDispatcher.addCallback(this) { handleBack() }
    requestNativePermissions()
    handlePushIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handlePushIntent(intent)
  }

  override fun onStart() {
    super.onStart()
    if (webViewConfigured) return
    val webView = bridge?.webView ?: return
    configureWebView(webView)
    registerNetworkCallback()
    webViewConfigured = true
    if (!hasNetwork()) showOfflineOverlay()
  }

  override fun onPause() {
    bridge?.webView?.onPause()
    persistCurrentUrl()
    CookieManager.getInstance().flush()
    super.onPause()
  }

  override fun onResume() {
    super.onResume()
    val webView = bridge?.webView
    webView?.onResume()
    if (hasNetwork()) {
      hideOfflineOverlay()
      recoverIfNeeded(webView)
    } else {
      showOfflineOverlay()
    }
  }

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    persistCurrentUrl()
    bridge?.webView?.saveState(outState)
  }

  override fun onDestroy() {
    unregisterNetworkCallback()
    super.onDestroy()
  }

  private fun handleBack() {
    val webView = bridge?.webView
    if (webView != null && canGoBackInApp(webView)) {
      webView.goBack()
      webView.postDelayed({
        if (!isAllowedUrl(webView.url)) loadAliveUrl(lastGoodUrl)
      }, 80)
      return
    }
    moveTaskToBack(true)
  }

  private fun canGoBackInApp(webView: WebView): Boolean {
    if (!webView.canGoBack()) return false
    val history = webView.copyBackForwardList()
    val previousIndex = history.currentIndex - 1
    if (previousIndex < 0) return false
    val previous = history.getItemAtIndex(previousIndex) ?: return false
    return isAllowedUrl(previous.url)
  }

  private fun requestNativePermissions() {
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
    WebView.setWebContentsDebuggingEnabled(false)

    val settings = webView.settings
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.databaseEnabled = true
    settings.loadsImagesAutomatically = true
    settings.allowContentAccess = false
    settings.allowFileAccess = false
    settings.allowFileAccessFromFileURLs = false
    settings.allowUniversalAccessFromFileURLs = false
    settings.javaScriptCanOpenWindowsAutomatically = false
    settings.mediaPlaybackRequiresUserGesture = false
    settings.loadWithOverviewMode = true
    settings.useWideViewPort = true
    settings.cacheMode = WebSettings.LOAD_DEFAULT
    settings.setSupportZoom(false)
    settings.builtInZoomControls = false
    settings.displayZoomControls = false
    settings.textZoom = 100
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      settings.safeBrowsingEnabled = true
      webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
    }

    webView.overScrollMode = View.OVER_SCROLL_NEVER
    webView.isHorizontalScrollBarEnabled = false
    webView.isVerticalScrollBarEnabled = false
    webView.isLongClickable = false
    webView.isHapticFeedbackEnabled = false
    webView.setBackgroundColor(0xFF000000.toInt())

    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)

    webView.setWebViewClient(object : BridgeWebViewClient(activeBridge) {
      override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        if (isAllowedUrl(url)) {
          lastGoodUrl = url
          persistUrl(url)
          injectRuntimeTweaks(view)
          maybeRestoreLastPath(view, url)
        } else if (hasNetwork()) {
          loadAliveUrl(lastGoodUrl)
        }
      }

      override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError
      ) {
        if (request.isForMainFrame && (!hasNetwork() || isNetworkError(error.errorCode))) {
          showOfflineOverlay()
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
          showOfflineOverlay()
          return
        }
        super.onReceivedHttpError(view, request, errorResponse)
      }

      override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest
      ): Boolean {
        val uri = request.url ?: return true
        val scheme = uri.scheme.orEmpty().lowercase()
        if (scheme == "aite" && uri.host == "settings") {
          startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
              data = Uri.parse("package:$packageName")
            }
          )
          return true
        }
        if (scheme in setOf("http", "https")) {
          return if (isAllowedHost(uri.host)) false else {
            openExternal(uri)
            true
          }
        }
        return try {
          startActivity(Intent(Intent.ACTION_VIEW, uri))
          true
        } catch (_: ActivityNotFoundException) {
          true
        }
      }

      override fun onRenderProcessGone(
        view: WebView,
        detail: RenderProcessGoneDetail
      ): Boolean {
        if (hasNetwork()) loadAliveUrl(lastGoodUrl) else showOfflineOverlay()
        return true
      }
    })
  }

  private fun maybeRestoreLastPath(webView: WebView, currentUrl: String) {
    if (restoredThisSession) return
    val saved = prefs().getString(KEY_LAST_URL, null) ?: return
    if (!isAllowedUrl(saved)) return
    val currentPath = Uri.parse(currentUrl).path.orEmpty()
    val savedPath = Uri.parse(saved).path.orEmpty()
    val isEntry = currentPath.isEmpty() || currentPath == "/" || currentPath == "/home"
    if (isEntry && savedPath.isNotEmpty() && savedPath != currentPath && savedPath != "/") {
      restoredThisSession = true
      webView.post { loadAliveUrl(saved) }
    } else {
      restoredThisSession = true
    }
  }

  private fun injectRuntimeTweaks(webView: WebView) {
    val script = """
      (function() {
        if (!window.__aiteNativeTweaksApplied) {
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
        }
        window.__aiteAlive = true;
        try { sessionStorage.setItem('aite:splash-shown', '1'); } catch (e) {}
        if (document.visibilityState === 'visible') {
          window.dispatchEvent(new CustomEvent('aite:resume'));
        }
      })();
    """.trimIndent()
    webView.evaluateJavascript(script, null)
  }

  private fun recoverIfNeeded(webView: WebView?) {
    if (webView == null) return
    if (!isAllowedUrl(webView.url)) {
      loadAliveUrl(lastGoodUrl)
      return
    }
    webView.evaluateJavascript(
      "(function(){try{if(!document.body||!document.body.childElementCount)return 'dead';return 'ok';}catch(e){return 'dead';}})()"
    ) { result ->
      if (result != null && result.contains("dead") && hasNetwork()) {
        loadAliveUrl(webView.url ?: lastGoodUrl)
      } else {
        webView.evaluateJavascript(
          "window.dispatchEvent(new CustomEvent('aite:resume'));",
          null
        )
      }
    }
  }

  private fun handlePushIntent(intent: Intent?) {
    val pushUrl = intent?.getStringExtra("pushUrl")?.trim().orEmpty()
    if (pushUrl.isEmpty()) return
    intent?.removeExtra("pushUrl")
    val target = normalizePushUrl(pushUrl) ?: return
    val webView = bridge?.webView
    if (webView == null) {
      lastGoodUrl = target
      persistUrl(target)
      return
    }
    webView.post {
      val path = Uri.parse(target).encodedPath.orEmpty().ifEmpty { "/" }
      val query = Uri.parse(target).encodedQuery
      val internal = if (query.isNullOrBlank()) path else "$path?$query"
      webView.evaluateJavascript(
        "(function(){try{if(window.__aiteNavigate){window.__aiteNavigate(${
          JSONObject.quote(internal)
        });return 'ok';}}catch(e){} return 'no';})()"
      ) { result ->
        if (result == null || result.contains("no")) loadAliveUrl(target)
      }
    }
  }

  private fun normalizePushUrl(raw: String): String? {
    val candidate = if (raw.startsWith("http")) raw else {
      val path = if (raw.startsWith("/")) raw else "/$raw"
      ORIGIN + path
    }
    return if (isAllowedUrl(candidate)) candidate else null
  }

  private fun loadAliveUrl(url: String) {
    val target = if (isAllowedUrl(url)) url else ORIGIN
    lastGoodUrl = target
    persistUrl(target)
    bridge?.webView?.loadUrl(target)
  }

  private fun persistCurrentUrl() {
    val current = bridge?.webView?.url
    if (isAllowedUrl(current)) persistUrl(current!!)
  }

  private fun persistUrl(url: String) {
    prefs().edit().putString(KEY_LAST_URL, url).apply()
  }

  private fun prefs() = getSharedPreferences("aite.secure", Context.MODE_PRIVATE)

  private fun showOfflineOverlay() {
    if (offlineOverlay != null) return
    val overlay = buildOfflineOverlay()
    offlineOverlay = overlay
    findViewById<ViewGroup>(android.R.id.content).addView(
      overlay,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    )
  }

  private fun hideOfflineOverlay() {
    val overlay = offlineOverlay ?: return
    (overlay.parent as? ViewGroup)?.removeView(overlay)
    offlineOverlay = null
  }

  private fun buildOfflineOverlay(): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(24), dp(24), dp(24), dp(24))
      setBackgroundColor(Color.BLACK)
      isClickable = true
      isFocusable = true
    }
    root.addView(TextView(this).apply {
      text = "لا يوجد اتصال بالإنترنت"
      textSize = 22f
      setTextColor(Color.WHITE)
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      gravity = Gravity.CENTER
    })
    root.addView(TextView(this).apply {
      text = "الجلسة محفوظة. ستعود إلى نفس الصفحة عند عودة الإنترنت."
      textSize = 15f
      setTextColor(Color.rgb(180, 190, 205))
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(12) }
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
      setOnClickListener {
        if (hasNetwork()) {
          hideOfflineOverlay()
          recoverIfNeeded(bridge?.webView)
        }
      }
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(28) }
    })
    return root
  }

  private fun registerNetworkCallback() {
    val connectivityManager =
      getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
    val request = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()
    networkCallback = object : ConnectivityManager.NetworkCallback() {
      override fun onLost(network: Network) {
        runOnUiThread { if (!hasNetwork()) showOfflineOverlay() }
      }
      override fun onAvailable(network: Network) {
        runOnUiThread {
          if (hasNetwork()) {
            hideOfflineOverlay()
            recoverIfNeeded(bridge?.webView)
          }
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

  private fun openExternal(uri: Uri) {
    try {
      startActivity(Intent(Intent.ACTION_VIEW, uri))
    } catch (_: ActivityNotFoundException) {
    }
  }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()

  companion object {
    const val HOST = "aite-app-one.vercel.app"
    const val ORIGIN = "https://aite-app-one.vercel.app"
    private const val KEY_LAST_URL = "last_url"

    fun isAllowedHost(host: String?): Boolean {
      val value = host.orEmpty().lowercase()
      return value == HOST || value.endsWith(".$HOST")
    }

    fun isAllowedUrl(url: String?): Boolean {
      if (url.isNullOrBlank()) return false
      return try {
        val uri = Uri.parse(url)
        uri.scheme.equals("https", true) && isAllowedHost(uri.host)
      } catch (_: Exception) {
        false
      }
    }
  }
}
