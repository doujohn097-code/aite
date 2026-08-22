package com.aite.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ImageView;
import android.graphics.drawable.GradientDrawable;

/**
 * صفحة عدم اتصال مخصصة ومرتبة - تظهر شعار التطبيق واسم Aite ورسالة عدم وجود إنترنت
 * تمنع تماماً ظهور صفحة المتصفح الافتراضية
 */
public class OfflineActivity extends Activity {
  private ConnectivityManager.NetworkCallback networkCallback;
  private Handler handler = new Handler(Looper.getMainLooper());
  private boolean isTransitioning = false;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // خلفية سوداء مطابقة لشاشة البداية
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setPadding(dp(24), dp(24), dp(24), dp(24));
    root.setBackgroundColor(Color.BLACK);

    // === قسم الشعار العلوي مطابق لـ SplashScreen ===
    LinearLayout brandRow = new LinearLayout(this);
    brandRow.setOrientation(LinearLayout.HORIZONTAL);
    brandRow.setGravity(Gravity.CENTER_VERTICAL);
    brandRow.setPadding(0, 0, 0, 0);

    // شعار Aite الأيقوني (يسار)
    ImageView iconMark = new ImageView(this);
    iconMark.setImageResource(R.mipmap.ic_launcher);
    iconMark.setScaleType(ImageView.ScaleType.CENTER_CROP);
    LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(64), dp(64));
    iconMark.setLayoutParams(iconParams);
    // خلفية بيضاء دائرية للأيقونة
    GradientDrawable iconBg = new GradientDrawable();
    iconBg.setColor(Color.WHITE);
    iconBg.setCornerRadius(dp(18));
    iconMark.setBackground(iconBg);
    iconMark.setPadding(dp(6), dp(6), dp(6), dp(6));
    iconMark.setClipToOutline(true);
    brandRow.addView(iconMark);

    // خط فاصل
    View divider = new View(this);
    divider.setBackgroundColor(Color.argb(180, 255, 255, 255));
    LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(dp(1), dp(64));
    dividerParams.setMargins(dp(28), 0, dp(28), 0);
    divider.setLayoutParams(dividerParams);
    brandRow.addView(divider);

    // شعار Aite النصي + from salem ahmed
    LinearLayout brandTextCol = new LinearLayout(this);
    brandTextCol.setOrientation(LinearLayout.VERTICAL);
    brandTextCol.setGravity(Gravity.START);

    TextView aiteText = new TextView(this);
    aiteText.setText("Aite");
    aiteText.setTextSize(34);
    aiteText.setTextColor(Color.WHITE);
    aiteText.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
    aiteText.setLetterSpacing(0.05f);
    brandTextCol.addView(aiteText);

    TextView fromText = new TextView(this);
    fromText.setText("from salem ahmed");
    fromText.setTextSize(14);
    fromText.setTextColor(Color.argb(230, 255, 255, 255));
    fromText.setTypeface(Typeface.create("sans-serif-light", Typeface.NORMAL));
    LinearLayout.LayoutParams fromParams = new LinearLayout.LayoutParams(-2, -2);
    fromParams.topMargin = dp(2);
    fromText.setLayoutParams(fromParams);
    brandTextCol.addView(fromText);

    brandRow.addView(brandTextCol);
    root.addView(brandRow);

    // === فاصل ===
    View sep = new View(this);
    sep.setBackgroundColor(Color.argb(30, 255, 255, 255));
    LinearLayout.LayoutParams sepParams = new LinearLayout.LayoutParams(-1, dp(1));
    sepParams.setMargins(0, dp(36), 0, dp(36));
    sep.setLayoutParams(sepParams);
    root.addView(sep);

    // === أيقونة عدم الاتصال ===
    TextView offlineEmoji = new TextView(this);
    offlineEmoji.setText("📡");
    offlineEmoji.setTextSize(42);
    offlineEmoji.setGravity(Gravity.CENTER);
    root.addView(offlineEmoji, new LinearLayout.LayoutParams(-2, -2));

    // === عنوان ===
    TextView title = new TextView(this);
    title.setText("لا يوجد اتصال بالإنترنت");
    title.setTextSize(22);
    title.setTextColor(Color.WHITE);
    title.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
    title.setGravity(Gravity.CENTER);
    LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-2, -2);
    titleParams.topMargin = dp(18);
    title.setLayoutParams(titleParams);
    root.addView(title);

    // === وصف ===
    TextView description = new TextView(this);
    description.setText("أنت غير متصل حالياً\nتحقق من اتصالك بالإنترنت وحاول مجدداً للوصول إلى Aite");
    description.setTextSize(15);
    description.setTextColor(Color.rgb(180, 190, 205));
    description.setGravity(Gravity.CENTER);
    description.setLineSpacing(dp(4), 1.0f);
    LinearLayout.LayoutParams descParams = new LinearLayout.LayoutParams(-1, -2);
    descParams.topMargin = dp(12);
    descParams.setMargins(dp(16), 0, dp(16), 0);
    description.setLayoutParams(descParams);
    root.addView(description);

    // === زر إعادة المحاولة ===
    TextView retry = new TextView(this);
    retry.setText("إعادة المحاولة");
    retry.setTextSize(16);
    retry.setTextColor(Color.BLACK);
    retry.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
    retry.setGravity(Gravity.CENTER);
    retry.setPadding(dp(32), dp(14), dp(32), dp(14));
    GradientDrawable retryBg = new GradientDrawable();
    retryBg.setColor(Color.WHITE);
    retryBg.setCornerRadius(dp(28));
    retry.setBackground(retryBg);
    retry.setOnClickListener(v -> attemptReconnect());
    LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(-2, -2);
    retryParams.topMargin = dp(28);
    retry.setLayoutParams(retryParams);
    root.addView(retry);

    // === نص صغير ===
    TextView hint = new TextView(this);
    hint.setText("سيتم إعادة الاتصال تلقائياً عند عودة الإنترنت");
    hint.setTextSize(12);
    hint.setTextColor(Color.argb(120, 255, 255, 255));
    hint.setGravity(Gravity.CENTER);
    LinearLayout.LayoutParams hintParams = new LinearLayout.LayoutParams(-2, -2);
    hintParams.topMargin = dp(16);
    hint.setLayoutParams(hintParams);
    root.addView(hint);

    setContentView(root);

    // مراقبة الشبكة للعودة التلقائية
    registerNetworkCallback();
  }

  private void attemptReconnect() {
    if (isTransitioning) return;
    if (hasNetwork()) {
      isTransitioning = true;
      startActivity(new Intent(this, MainActivity.class));
      finish();
    } else {
      // اهتزاز بصري خفيف عند الفشل
      View rootView = findViewById(android.R.id.content);
      if (rootView != null) {
        rootView.animate().translationX(dp(6)).setDuration(60)
          .withEndAction(() -> rootView.animate().translationX(-dp(6)).setDuration(60)
            .withEndAction(() -> rootView.animate().translationX(0).setDuration(60).start()).start()).start();
      }
    }
  }

  private void registerNetworkCallback() {
    try {
      ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return;
      NetworkRequest request = new NetworkRequest.Builder()
          .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
          .build();
      networkCallback = new ConnectivityManager.NetworkCallback() {
        @Override
        public void onAvailable(Network network) {
          // عند عودة الإنترنت، انتقل تلقائياً بعد ثانية
          handler.postDelayed(() -> {
            runOnUiThread(() -> {
              if (!isTransitioning && hasNetwork()) {
                attemptReconnect();
              }
            });
          }, 1000);
        }
      };
      cm.registerNetworkCallback(request, networkCallback);
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @Override
  protected void onDestroy() {
    super.onDestroy();
    try {
      if (networkCallback != null) {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) cm.unregisterNetworkCallback(networkCallback);
      }
    } catch (Exception e) {}
    handler.removeCallbacksAndMessages(null);
  }

  @Override
  public void onBackPressed() {
    // منع الرجوع لصفحة المتصفح - الخروج من التطبيق بدلاً من ذلك
    finishAffinity();
  }

  private int dp(int value) {
    return (int) (value * getResources().getDisplayMetrics().density);
  }

  private boolean hasNetwork() {
    try {
      ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
      if (manager == null) return false;
      NetworkCapabilities caps = manager.getNetworkCapabilities(manager.getActiveNetwork());
      return caps != null && (
        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
        caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      );
    } catch (Exception e) {
      return false;
    }
  }
}
