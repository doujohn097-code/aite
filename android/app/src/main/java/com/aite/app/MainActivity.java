package com.aite.app;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/** Native shell for Aite: keeps the production UI intact while applying Android-only UX. */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    if (!hasNetwork()) {
      startActivity(new Intent(this, OfflineActivity.class));
      finish();
      return;
    }
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onStart() {
    super.onStart();
    WebView webView = getBridge().getWebView();
    WebSettings settings = webView.getSettings();
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setTextZoom(100);
    webView.setLongClickable(false);
    webView.setHapticFeedbackEnabled(false);
  }

  private boolean hasNetwork() {
    ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
    if (manager == null) return false;
    NetworkCapabilities capabilities = manager.getNetworkCapabilities(manager.getActiveNetwork());
    return capabilities != null && (
      capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
      capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
      capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
    );
  }
}
