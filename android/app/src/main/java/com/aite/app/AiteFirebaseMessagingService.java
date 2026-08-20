package com.aite.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

public class AiteFirebaseMessagingService extends FirebaseMessagingService {

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        MainActivity.TokenStore.save(this, token);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();

        String title = firstNonEmpty(
                data.get("title"),
                message.getNotification() != null ? message.getNotification().getTitle() : null,
                getString(R.string.app_name));
        String body = firstNonEmpty(
                data.get("body"),
                message.getNotification() != null ? message.getNotification().getBody() : null,
                "");
        String url = data.get("url");
        String image = data.get("image");
        String channel = NotificationHelper.CHANNEL_MESSAGES.equals(data.get("channel"))
                ? NotificationHelper.CHANNEL_MESSAGES
                : NotificationHelper.CHANNEL_GENERAL;
        String tag = data.get("tag");

        showNotification(title, body, url, image, channel, tag);
    }

    private void showNotification(String title, String body, String url, String image,
                                  String channel, String tag) {
        NotificationHelper.ensureChannels(this);

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (url != null && !url.isEmpty()) {
            String full = url.startsWith("http")
                    ? url
                    : "https://aite-app-one.vercel.app" + (url.startsWith("/") ? url : "/" + url);
            intent.putExtra("url", full);
            intent.setData(Uri.parse(full));
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channel)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setColor(Color.BLACK)
                .setDefaults(Notification.DEFAULT_ALL);

        Bitmap picture = loadBitmap(image);
        if (picture != null) {
            builder.setStyle(new NotificationCompat.BigPictureStyle()
                    .bigPicture(picture)
                    .setSummaryText(body));
            builder.setLargeIcon(picture);
        }

        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        int id = tag != null ? tag.hashCode() : (int) System.currentTimeMillis();
        manager.notify(tag, id, builder.build());
    }

    private Bitmap loadBitmap(String url) {
        if (url == null || !url.startsWith("http")) return null;
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setDoInput(true);
            connection.connect();
            InputStream input = connection.getInputStream();
            return BitmapFactory.decodeStream(input);
        } catch (Exception e) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.isEmpty()) return value;
        }
        return "";
    }
}
