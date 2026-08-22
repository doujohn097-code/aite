package com.aite.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/**
 * خدمة إشعارات Aite الاحترافية - بنمط انستغرام:
 * - صورة المرسل تظهر دائرية (Large Icon)
 * - شعار Aite يظهر كبادج صغير بجانبها (Small Icon)
 * - الضغط على الإشعار يفتح الصفحة المطلوبة داخل التطبيق
 */
public class AiteFirebaseMessagingService extends FirebaseMessagingService {

  private static final String CHANNEL_ID = "aite_social";

  @Override
  public void onNewToken(@NonNull String token) {
    super.onNewToken(token);
    // تمرير التوكن لإضافة Capacitor حتى يُحفظ في حساب المستخدم
    PushNotificationsPlugin.onNewToken(token);
  }

  @Override
  public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
    super.onMessageReceived(remoteMessage);

    Map<String, String> data = remoteMessage.getData();

    String title = data.get("title");
    String body = data.get("body");
    if (title == null && remoteMessage.getNotification() != null)
      title = remoteMessage.getNotification().getTitle();
    if (body == null && remoteMessage.getNotification() != null)
      body = remoteMessage.getNotification().getBody();
    if (title == null) title = "Aite";
    if (body == null) body = "";

    String url = data.get("url") != null ? data.get("url") : "/notifications";
    String tag = data.get("tag") != null ? data.get("tag") : "aite";
    String image = data.get("image");

    createChannel();

    // فتح التطبيق على الصفحة المطلوبة عند الضغط
    Intent intent = new Intent(this, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    intent.putExtra("pushUrl", url);
    PendingIntent pendingIntent = PendingIntent.getActivity(
        this,
        tag.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_aite) // بادج شعار Aite
        .setColor(Color.parseColor("#1D9BF0"))
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_SOCIAL)
        .setDefaults(Notification.DEFAULT_ALL)
        .setContentIntent(pendingIntent);

    // صورة المرسل الدائرية - مثل انستغرام
    if (image != null && !image.isEmpty()) {
      Bitmap avatar = downloadBitmap(image);
      if (avatar != null) {
        builder.setLargeIcon(circleCrop(avatar));
      }
    }

    NotificationManager manager =
        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager != null) {
      manager.notify(tag, 0, builder.build());
    }
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
          CHANNEL_ID,
          "التفاعلات والرسائل",
          NotificationManager.IMPORTANCE_HIGH
      );
      channel.setDescription("إشعارات الرسائل والإعجابات والمتابعين");
      channel.enableLights(true);
      channel.enableVibration(true);
      channel.setShowBadge(true);
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      NotificationManager manager =
          (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (manager != null) manager.createNotificationChannel(channel);
    }
  }

  /** تحميل صورة المرسل من الرابط (يعمل على خيط خلفي) */
  private Bitmap downloadBitmap(String urlString) {
    HttpURLConnection connection = null;
    try {
      URL url = new URL(urlString);
      connection = (HttpURLConnection) url.openConnection();
      connection.setConnectTimeout(8000);
      connection.setReadTimeout(8000);
      connection.setDoInput(true);
      connection.connect();
      try (InputStream input = connection.getInputStream()) {
        Bitmap bitmap = BitmapFactory.decodeStream(input);
        if (bitmap == null) return null;
        // تصغير لحجم مناسب للإشعار
        int size = Math.min(256, Math.min(bitmap.getWidth(), bitmap.getHeight()));
        return Bitmap.createScaledBitmap(bitmap, size, size, true);
      }
    } catch (Exception e) {
      return null;
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  /** قص الصورة بشكل دائري - مثل صور انستغرام */
  private Bitmap circleCrop(Bitmap source) {
    try {
      int size = Math.min(source.getWidth(), source.getHeight());
      Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(output);
      Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
      paint.setColor(Color.WHITE);
      canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
      paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
      Rect rect = new Rect(
          (source.getWidth() - size) / 2,
          (source.getHeight() - size) / 2,
          (source.getWidth() + size) / 2,
          (source.getHeight() + size) / 2
      );
      canvas.drawBitmap(source, rect, new Rect(0, 0, size, size), paint);
      return output;
    } catch (Exception e) {
      return source;
    }
  }
}
