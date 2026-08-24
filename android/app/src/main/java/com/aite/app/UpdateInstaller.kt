package com.aite.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object UpdateInstaller {
  private val io = Executors.newSingleThreadExecutor()

  fun start(activity: MainActivity, rawUrl: String) {
    val url = sanitize(rawUrl) ?: run {
      activity.runOnUiThread {
        Toast.makeText(activity, "رابط التحديث غير صالح", Toast.LENGTH_SHORT).show()
      }
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      !activity.packageManager.canRequestPackageInstalls()
    ) {
      activity.startActivity(
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
          data = Uri.parse("package:${activity.packageName}")
        }
      )
      activity.runOnUiThread {
        Toast.makeText(
          activity,
          "فعّل تثبيت التطبيقات ثم اضغط تحديث مرة أخرى",
          Toast.LENGTH_LONG
        ).show()
      }
      return
    }

    activity.runOnUiThread {
      Toast.makeText(activity, "جارٍ تنزيل التحديث…", Toast.LENGTH_SHORT).show()
    }

    io.execute {
      try {
        val file = download(activity, url)
        activity.runOnUiThread { launchInstaller(activity, file) }
      } catch (_: Exception) {
        activity.runOnUiThread {
          Toast.makeText(activity, "تعذر تنزيل التحديث", Toast.LENGTH_LONG).show()
        }
      }
    }
  }

  private fun sanitize(raw: String): URL? {
    return try {
      val url = URL(raw.trim())
      val host = url.host.orEmpty().lowercase()
      if (url.protocol != "https") return null
      if (host.isBlank() || host == "localhost" || host.startsWith("127.") ||
        host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")
      ) return null
      if (!url.path.lowercase().endsWith(".apk") && !raw.lowercase().contains(".apk"))
        return null
      url
    } catch (_: Exception) {
      null
    }
  }

  private fun download(activity: MainActivity, url: URL): File {
    val dir = File(activity.cacheDir, "updates").apply { mkdirs() }
    val file = File(dir, "aite-update.apk")
    if (file.exists()) file.delete()

    val connection = (url.openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = true
      connectTimeout = 20_000
      readTimeout = 60_000
      requestMethod = "GET"
    }
    try {
      if (connection.responseCode !in 200..299)
        throw IllegalStateException("http_${connection.responseCode}")
      connection.inputStream.use { input ->
        file.outputStream().use { output -> input.copyTo(output) }
      }
    } finally {
      connection.disconnect()
    }
    if (file.length() < 50_000) throw IllegalStateException("apk_too_small")
    return file
  }

  private fun launchInstaller(activity: MainActivity, file: File) {
    val uri = FileProvider.getUriForFile(
      activity,
      "${activity.packageName}.fileprovider",
      file
    )
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    activity.startActivity(intent)
  }
}
