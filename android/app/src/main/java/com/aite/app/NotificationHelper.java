package com.aite.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;

public final class NotificationHelper {

    public static final String CHANNEL_MESSAGES = "messages";
    public static final String CHANNEL_GENERAL = "general";

    private NotificationHelper() {
    }

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        AudioAttributes audio = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        NotificationChannel messages = new NotificationChannel(
                CHANNEL_MESSAGES,
                context.getString(R.string.channel_messages_name),
                NotificationManager.IMPORTANCE_HIGH);
        messages.setDescription(context.getString(R.string.channel_messages_desc));
        messages.enableVibration(true);
        messages.setShowBadge(true);
        messages.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audio);

        NotificationChannel general = new NotificationChannel(
                CHANNEL_GENERAL,
                context.getString(R.string.channel_general_name),
                NotificationManager.IMPORTANCE_DEFAULT);
        general.setDescription(context.getString(R.string.channel_general_desc));

        manager.createNotificationChannel(messages);
        manager.createNotificationChannel(general);
    }
}
