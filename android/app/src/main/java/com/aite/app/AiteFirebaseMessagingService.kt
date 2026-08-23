package com.aite.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.os.Build
import androidx.core.app.NotificationCompat
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URL

class AiteFirebaseMessagingService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    super.onNewToken(token)
    PushNotificationsPlugin.onNewToken(token)
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)

    val data = remoteMessage.data
    val title = data["title"] ?: remoteMessage.notification?.title ?: "Aite"
    val body = data["body"] ?: remoteMessage.notification?.body.orEmpty()
    val url = data["url"] ?: "/notifications"
    val tag = data["tag"] ?: "aite"
    val image = data["image"]

    createChannel()

    val intent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("pushUrl", url)
    }

    val pendingIntent = PendingIntent.getActivity(
      this,
      tag.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_aite)
      .setColor(Color.parseColor("#1D9BF0"))
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_SOCIAL)
      .setDefaults(Notification.DEFAULT_ALL)
      .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
      .setContentIntent(pendingIntent)

    if (!image.isNullOrBlank()) {
      downloadBitmap(image)?.let { builder.setLargeIcon(createInstagramStyleAvatar(it)) }
    }

    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
    manager?.notify(tag, 0, builder.build())
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "التفاعلات والرسائل",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "إشعارات الرسائل والإعجابات والمتابعين"
      enableLights(true)
      enableVibration(true)
      setShowBadge(true)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }

    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
    manager?.createNotificationChannel(channel)
  }

  private fun downloadBitmap(urlString: String): Bitmap? {
    var connection: HttpURLConnection? = null
    return try {
      connection = (URL(urlString).openConnection() as HttpURLConnection).apply {
        connectTimeout = 8_000
        readTimeout = 8_000
        doInput = true
        connect()
      }
      connection.inputStream.use { input ->
        BitmapFactory.decodeStream(input)?.let { bitmap ->
          val size = minOf(256, bitmap.width, bitmap.height)
          Bitmap.createScaledBitmap(bitmap, size, size, true)
        }
      }
    } catch (_: Exception) {
      null
    } finally {
      connection?.disconnect()
    }
  }

  private fun createInstagramStyleAvatar(source: Bitmap): Bitmap {
    val avatar = circleCrop(source)
    val output = avatar.copy(Bitmap.Config.ARGB_8888, true)
    val canvas = Canvas(output)

    val iconSource = BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)
      ?: return avatar

    val size = output.width
    val badgeSize = (size * 0.34f).toInt().coerceAtLeast(36)
    val badgeInset = (size * 0.04f).toInt().coerceAtLeast(4)
    val outerRadius = badgeSize / 2f
    val border = (badgeSize * 0.1f).coerceAtLeast(4f)
    val badgeCenterX = size - outerRadius - badgeInset
    val badgeCenterY = size - outerRadius - badgeInset

    val badgeBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
    }
    canvas.drawCircle(badgeCenterX, badgeCenterY, outerRadius, badgeBackgroundPaint)

    val badgeBitmap = circleCrop(
      Bitmap.createScaledBitmap(iconSource, badgeSize, badgeSize, true)
    )
    val innerSize = badgeSize - (border * 2f)
    val badgeLeft = badgeCenterX - innerSize / 2f
    val badgeTop = badgeCenterY - innerSize / 2f
    val badgeRect = Rect(
      badgeLeft.toInt(),
      badgeTop.toInt(),
      (badgeLeft + innerSize).toInt(),
      (badgeTop + innerSize).toInt()
    )
    canvas.drawBitmap(badgeBitmap, null, badgeRect, null)

    return output
  }

  private fun circleCrop(source: Bitmap): Bitmap {
    return try {
      val size = minOf(source.width, source.height)
      val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(output)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
      canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
      paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
      val rect = Rect(
        (source.width - size) / 2,
        (source.height - size) / 2,
        (source.width + size) / 2,
        (source.height + size) / 2
      )
      canvas.drawBitmap(source, rect, Rect(0, 0, size, size), paint)
      output
    } catch (_: Exception) {
      source
    }
  }

  companion object {
    private const val CHANNEL_ID = "aite_social"
  }
}
