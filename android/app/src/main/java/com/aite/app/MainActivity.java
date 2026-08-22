package com.aite.app;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import com.getcapacitor.BridgeActivity;

/**
 * Native shell for Aite - يضمن عدم ظهور صفحة عدم الاتصال الافتراضية للمتصفح أبداً
 * - عند الإطلاق بدون إنترنت -> OfflineActivity
 * - عند فقدان الإنترنت أثناء التصفح -> اعتراض خطأ WebView وإظهار OfflineActivity
 * - عند عودة الإنترنت -> العودة تلقائياً
 */
public class MainActivity extends BridgeActivity {
  private boolean isOfflineLaunched = false;
  private ConnectivityManager.NetworkCallback networkCallback;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    if (!hasNetwork()) {
      launchOffline();
      return;
    }
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onStart() {
    super.onStart();
    try {
      WebView webView = getBridge().getWebView();
      WebSettings settings = webView.getSettings();
      settings.setSupportZoom(false);
      settings.setBuiltInZoomControls(false);
      settings.setDisplayZoomControls(false);
      settings.setTextZoom(100);
      settings.setMediaPlaybackRequiresUserGesture(false);
      webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
      webView.setLongClickable(false);
      webView.setHapticFeedbackEnabled(false);

      // اعتراض أخطاء التحميل لمنع صفحة المتصفح الافتراضية
      WebViewClient originalClient = webView.getWebViewClient();
      webView.setWebViewClient(new WebViewClient() {
        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
          // فقط للأخطاء في الإطار الرئيسي وليس الموارد الفرعية
          if (request.isForMainFrame()) {
            if (!hasNetwork() || isNetworkError(error)) {
              launchOffline();
            }
          }
          // لا نستدعي super لمنع عرض صفحة الخطأ الافتراضية
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse errorResponse) {
          if (request.isForMainFrame() && !hasNetwork()) {
            launchOffline();
          }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
          // دع العميل الأصلي يتعامل مع التنقل إذا كان موجوداً
          if (originalClient != null) {
            try {
              return originalClient.shouldOverrideUrlLoading(view, request);
            } catch (Exception e) {
              // تجاهل
            }
          }
          return false;
        }
      });

      // مراقبة الشبكة للعودة التلقائية
      registerNetworkCallback();
    } catch (Exception e) {
      // في حالة فشل تهيئة WebView، لا نعرض صفحة خطأ
      e.printStackTrace();
    }
  }

  @Override
  public void onStop() {
    super.onStop();
    unregisterNetworkCallback();
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
        @Override
        public void onAvailable(Network network) {
          // عند عودة الشبكة، لا نفعل شيئاً هنا لأن OfflineActivity ستراقب وتعود
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
