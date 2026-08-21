package com.aite.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;

/** Fully native offline experience. It never loads the website's fallback page. */
public class OfflineActivity extends Activity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setPadding(dp(28), dp(28), dp(28), dp(28));
    root.setBackgroundColor(Color.rgb(8, 11, 18));

    TextView icon = new TextView(this);
    icon.setText("◌");
    icon.setTextSize(54);
    icon.setTextColor(Color.WHITE);
    icon.setGravity(Gravity.CENTER);
    GradientDrawable iconBg = new GradientDrawable();
    iconBg.setColor(Color.rgb(31, 41, 55));
    iconBg.setCornerRadius(dp(26));
    icon.setBackground(iconBg);
    root.addView(icon, new LinearLayout.LayoutParams(dp(92), dp(92)));

    TextView title = text("لا يوجد اتصال بالإنترنت", 23, Color.WHITE);
    LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-2, -2);
    titleParams.topMargin = dp(24);
    root.addView(title, titleParams);

    TextView description = text("تحقق من الشبكة ثم أعد المحاولة للوصول إلى Aite.", 15, Color.rgb(180, 190, 205));
    description.setGravity(Gravity.CENTER);
    LinearLayout.LayoutParams descriptionParams = new LinearLayout.LayoutParams(-1, -2);
    descriptionParams.topMargin = dp(10);
    root.addView(description, descriptionParams);

    TextView retry = text("إعادة المحاولة", 16, Color.rgb(8, 11, 18));
    retry.setGravity(Gravity.CENTER);
    retry.setPadding(dp(24), dp(12), dp(24), dp(12));
    GradientDrawable retryBg = new GradientDrawable();
    retryBg.setColor(Color.WHITE);
    retryBg.setCornerRadius(dp(28));
    retry.setBackground(retryBg);
    retry.setOnClickListener(v -> {
      if (hasNetwork()) {
        startActivity(new Intent(this, MainActivity.class));
        finish();
      }
    });
    LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(-2, -2);
    retryParams.topMargin = dp(26);
    root.addView(retry, retryParams);
    setContentView(root);
  }

  private TextView text(String value, int size, int color) {
    TextView text = new TextView(this);
    text.setText(value);
    text.setTextSize(size);
    text.setTextColor(color);
    text.setGravity(Gravity.CENTER);
    return text;
  }
  private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
  private boolean hasNetwork() {
    ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
    if (manager == null) return false;
    NetworkCapabilities caps = manager.getNetworkCapabilities(manager.getActiveNetwork());
    return caps != null && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
  }
}
