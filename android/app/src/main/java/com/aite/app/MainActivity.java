package com.aite.app;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Native shell for Aite - يضمن عدم ظهور صفحة عدم الاتصال الافتراضية للمتصفح أبداً
 * - عند الإطلاق بدون إنترنت -> OfflineActivity
 * - عند فقدان الإنترنت أثناء التصفح -> اعتراض خطأ WebView وإظهار OfflineActivity
 * - عند عودة الإنترنت -> العودة تلقائياً
 */
public class MainActivity extends BridgeActivity {
  private boolean isOfflineLaunched = false;
  private boolean webViewConfigured = false;
  private ConnectivityManager.NetworkCallback networkCallback;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // يجب استدعاء super.onCreate دائماً وإلا يتوقف التطبيق (SuperNotCalledException)
    super.onCreate(savedInstanceState);
    if (!hasNetwork()) {
      launchOffline();
    }
  }

  @Override
  public void onStart() {
    super.onStart();
    if (webViewConfigured) return;
    try {
      WebView webView = getBridge().getWebView();
      WebSettings settings = webView.getSettings();
      settings.setSupportZoom(false);
      settings.setBuiltInZoomControls(false);
      settings.setDisplayZoomControls(false);
      settings.setTextZoom(100);
      settings.setMediaPlaybackRequiresUserGesture(false);
      webView.setLongClickable(false);
      webView.setHapticFeedbackEnabled(false);

      // نمدّد عميل Capacitor الأصلي بدلاً من استبداله حتى لا ينكسر الجسر الأصلي
      webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
          // فقط للأخطاء في الإطار الرئيسي وليس الموارد الفرعية
          if (request.isForMainFrame() && (!hasNetwork() || isNetworkError(error))) {
            launchOffline();
            return;
          }
          super.onReceivedError(view, request, error);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
          if (request.isForMainFrame() && !hasNetwork()) {
            launchOffline();
            return;
          }
          super.onReceivedHttpError(view, request, errorResponse);
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
          // انهيار محرك العرض: أعد إنشاء النشاط بدلاً من توقف التطبيق بالكامل
          try {
            recreate();
          } catch (Exception e) {
            e.printStackTrace();
          }
          return true;
        }
      });

      // مراقبة الشبكة للعودة التلقائية
      registerNetworkCallback();
      webViewConfigured = true;
    } catch (Exception e) {
      // في حالة فشل تهيئة WebView، لا نعرض صفحة خطأ
      e.printStackTrace();
    }
  }

  @Override
  public void onDestroy() {
    unregisterNetworkCallback();
    super.onDestroy();
  }

  @Override
  public void onResume() {
    super.onResume();
    // إذا عاد المستخدم وهناك إنترنت، تأكد أننا لسنا عالقين في حالة خطأ
    if (hasNetwork() && isOfflineLaunched) {
      isOfflineLaunched = false;
    }
  }

  private void launchOffline() {
    if (isOfflineLaunched) return;
    isOfflineLaunched = true;
    try {
      Intent intent = new Intent(this, OfflineActivity.class);
      intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
      startActivity(intent);
      finish();
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  private boolean isNetworkError(WebResourceError error) {
    if (error == null) return false;
    int code = error.getErrorCode();
    // أخطاء الشبكة الشائعة: بدون إنترنت، مهلة، فشل الاتصال
    return code == WebViewClient.ERROR_HOST_LOOKUP ||
           code == WebViewClient.ERROR_CONNECT ||
           code == WebViewClient.ERROR_TIMEOUT ||
           code == WebViewClient.ERROR_IO ||
           code == WebViewClient.ERROR_UNKNOWN;
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
        public void onLost(Network network) {
          // عند فقدان الشبكة أثناء الاستخدام، انتقل لصفحة عدم الاتصال فوراً
          runOnUiThread(() -> {
            if (!hasNetwork()) {
              launchOffline();
            }
          });
        }
      };
      cm.registerNetworkCallback(request, networkCallback);
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  private void unregisterNetworkCallback() {
    try {
      if (networkCallback != null) {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
          cm.unregisterNetworkCallback(networkCallback);
        }
        networkCallback = null;
      }
    } catch (Exception e) {
      // تجاهل
    }
  }

  private boolean hasNetwork() {
    try {
      ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
      if (manager == null) return false;
      NetworkCapabilities capabilities = manager.getNetworkCapabilities(manager.getActiveNetwork());
      return capabilities != null && (
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      );
    } catch (Exception e) {
      return false;
    }
  }
}
