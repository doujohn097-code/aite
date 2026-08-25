package com.aite.app

import android.webkit.JavascriptInterface

class AiteUpdateBridge(private val host: MainActivity) {
  @JavascriptInterface
  fun versionCode(): Int = BuildConfig.VERSION_CODE

  @JavascriptInterface
  fun versionName(): String = BuildConfig.VERSION_NAME

  @JavascriptInterface
  fun install(url: String) {
    host.enqueueApkInstall(url)
  }

  @JavascriptInterface
  fun saveMedia(url: String, filename: String) {
    host.enqueueMediaDownload(url, filename)
  }
}
