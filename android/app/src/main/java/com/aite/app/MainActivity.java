package com.aite.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.firebase.messaging.FirebaseMessaging;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final String APP_URL = "https://aite-app-one.vercel.app/";
    private static final String APP_HOST = "aite-app-one.vercel.app";
    private static final int REQUEST_FILE_CHOOSER = 1001;
    private static final int REQUEST_WEBRTC_PERMISSION = 1002;
    private static final int REQUEST_NOTIFICATIONS = 1003;

    private WebView webView;
    private SwipeRefreshLayout refreshLayout;
    private View offlineView;
    private View splashOverlay;
    private ProgressBar progressBar;

    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraOutputUri;
    private PermissionRequest pendingWebRtcRequest;
    private boolean isOffline = false;
    private boolean pageLoadedOnce = false;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        refreshLayout = findViewById(R.id.refreshLayout);
        offlineView = findViewById(R.id.offlineView);
        splashOverlay = findViewById(R.id.splashOverlay);
        progressBar = findViewById(R.id.progressBar);

        NotificationHelper.ensureChannels(this);
        setupWebView();

        findViewById(R.id.retryButton).setOnClickListener(v -> reloadApp());
        refreshLayout.setOnRefreshListener(() -> webView.reload());
        refreshLayout.setColorSchemeColors(0xFFFFFFFF);
        refreshLayout.setProgressBackgroundColorSchemeColor(0xFF222222);
        // لا تفعّل السحب للتحديث إلا عندما لا يستطيع أي عنصر داخل الصفحة
        // التمرير للأعلى — يمنع التحديث العرضي أثناء تمرير الرسائل والقوائم
        refreshLayout.setOnChildScrollUpCallback((parent, child) -> webView.canScrollVertically(-1));

        registerNetworkCallback();
        askNotificationPermission();
        fetchFcmToken();

        String startUrl = resolveStartUrl(getIntent());
        webView.loadUrl(startUrl);
    }

    private String resolveStartUrl(Intent intent) {
        if (intent == null) return APP_URL;
        String extra = intent.getStringExtra("url");
        if (extra != null && extra.startsWith("https://" + APP_HOST)) return extra;
        Uri data = intent.getData();
        if (data != null && APP_HOST.equals(data.getHost())) return data.toString();
        return APP_URL;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String url = resolveStartUrl(intent);
        if (!APP_URL.equals(url) && webView != null) webView.loadUrl(url);
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        String ua = s.getUserAgentString();
        s.setUserAgentString(ua.replace("; wv", "") + " AiteApp/1.0");

        // Native app feel: no long-press selection / callout
        webView.setOnLongClickListener(v -> true);
        webView.setLongClickable(false);
        webView.setHapticFeedbackEnabled(false);

        webView.addJavascriptInterface(new NativeBridge(), "AiteNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleExternalUrl(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectNativeEnhancements();
                pushStoredTokenToWeb();
                refreshLayout.setRefreshing(false);
                updateRefreshAvailability(url);
                if (!pageLoadedOnce) {
                    pageLoadedOnce = true;
                    hideSplash();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int errorCode,
                                        String description, String failingUrl) {
                if (failingUrl != null && failingUrl.equals(view.getUrl())) showOffline();
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                            WebResourceResponse errorResponse) {
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                    showOffline();
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler,
                                           SslError error) {
                handler.cancel();
                showOffline();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100 && !isOffline) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                return openFileChooser(callback, params);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                handleWebRtcPermission(request);
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return true;
            }
        });
    }

    private boolean handleExternalUrl(Uri uri) {
        if (uri == null) return false;
        String host = uri.getHost();
        if (host == null) return false;
        if (host.equals(APP_HOST) || host.endsWith(".firebaseapp.com")
                || host.endsWith(".googleapis.com") || host.endsWith(".google.com")) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
        }
        return true;
    }

    private void injectNativeEnhancements() {
        String js = "(function(){"
                + "var st=document.getElementById('aite-native-style');"
                + "if(!st){st=document.createElement('style');st.id='aite-native-style';"
                + "st.textContent='*{-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;-webkit-tap-highlight-color:transparent!important}"
                + "input,textarea,[contenteditable=true],[contenteditable=\"\"]{-webkit-user-select:text!important;user-select:text!important}"
                + "html,body{touch-action:manipulation;overscroll-behavior:none}';"
                + "document.documentElement.appendChild(st);}"
                + "var m=document.querySelector('meta[name=viewport]');"
                + "if(!m){m=document.createElement('meta');m.name='viewport';"
                + "(document.head||document.documentElement).appendChild(m);}"
                + "m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');"
                // راقب تغيّر المسار داخل التطبيق (SPA) لتحديث سلوك السحب للتحديث
                + "if(!window.__aiteNavWatch){window.__aiteNavWatch=1;"
                + "var push=history.pushState,rep=history.replaceState;"
                + "var fire=function(){window.dispatchEvent(new Event('aite-route-change'));};"
                + "history.pushState=function(){var r=push.apply(this,arguments);fire();return r;};"
                + "history.replaceState=function(){var r=rep.apply(this,arguments);fire();return r;};"
                + "window.addEventListener('popstate',fire);"
                + "window.addEventListener('aite-route-change',function(){"
                + "if(window.AiteNative&&AiteNative.onRouteChange)AiteNative.onRouteChange(location.pathname);});}"
                + "})();";
        webView.evaluateJavascript(js, null);
    }

    /** السحب للتحديث متاح فقط في صفحات التغذية — معطّل في الرسائل والريلز */
    private void updateRefreshAvailability(String url) {
        if (refreshLayout == null) return;
        String path = url != null ? Uri.parse(url).getPath() : null;
        if (path == null) path = "/";
        boolean blocked = path.startsWith("/messages") || path.startsWith("/reels");
        refreshLayout.setEnabled(!blocked);
    }

    // ---------------------------------------------------------------- files

    private boolean openFileChooser(ValueCallback<Uri[]> callback,
                                    WebChromeClient.FileChooserParams params) {
        if (filePathCallback != null) filePathCallback.onReceiveValue(null);
        filePathCallback = callback;

        Intent contentIntent;
        try {
            contentIntent = params.createIntent();
        } catch (Exception e) {
            contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
            contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
            contentIntent.setType("*/*");
        }
        if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }

        List<Intent> initialIntents = new ArrayList<>();
        PackageManager pm = getPackageManager();

        Intent captureImage = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (captureImage.resolveActivity(pm) != null) {
            Uri out = createCaptureUri("jpg");
            if (out != null) {
                cameraOutputUri = out;
                captureImage.putExtra(MediaStore.EXTRA_OUTPUT, out);
                captureImage.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                initialIntents.add(captureImage);
            }
        }

        Intent captureVideo = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
        if (captureVideo.resolveActivity(pm) != null) {
            Uri out = createCaptureUri("mp4");
            if (out != null) {
                if (cameraOutputUri == null) cameraOutputUri = out;
                captureVideo.putExtra(MediaStore.EXTRA_OUTPUT, out);
                captureVideo.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                initialIntents.add(captureVideo);
            }
        }

        Intent chooser = Intent.createChooser(contentIntent, null);
        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,
                initialIntents.toArray(new Intent[0]));
        try {
            startActivityForResult(chooser, REQUEST_FILE_CHOOSER);
        } catch (ActivityNotFoundException e) {
            filePathCallback = null;
            return false;
        }
        return true;
    }

    private Uri createCaptureUri(String extension) {
        try {
            String name = "AITE_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US)
                    .format(new Date());
            File dir = new File(getCacheDir(), "capture");
            if (!dir.exists()) dir.mkdirs();
            File file = File.createTempFile(name, "." + extension, dir);
            return FileProvider.getUriForFile(this,
                    "com.aite.app.fileprovider", file);
        } catch (IOException | IllegalArgumentException e) {
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_FILE_CHOOSER || filePathCallback == null) return;

        Uri[] results = null;
        if (resultCode == RESULT_OK) {
            if (data == null || (data.getData() == null && data.getClipData() == null)) {
                if (cameraOutputUri != null) results = new Uri[]{cameraOutputUri};
            } else if (data.getClipData() != null) {
                ClipData clip = data.getClipData();
                List<Uri> uris = new ArrayList<>();
                for (int i = 0; i < clip.getItemCount(); i++) {
                    uris.add(clip.getItemAt(i).getUri());
                }
                results = uris.toArray(new Uri[0]);
            } else {
                results = new Uri[]{data.getData()};
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
        cameraOutputUri = null;
    }

    // ------------------------------------------------------- permissions

    private void handleWebRtcPermission(PermissionRequest request) {
        runOnUiThread(() -> {
            List<String> needed = new ArrayList<>();
            for (String resource : request.getResources()) {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                        && !hasPermission(Manifest.permission.CAMERA)) {
                    needed.add(Manifest.permission.CAMERA);
                }
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                        && !hasPermission(Manifest.permission.RECORD_AUDIO)) {
                    needed.add(Manifest.permission.RECORD_AUDIO);
                }
            }
            if (needed.isEmpty()) {
                request.grant(request.getResources());
            } else {
                pendingWebRtcRequest = request;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    requestPermissions(needed.toArray(new String[0]),
                            REQUEST_WEBRTC_PERMISSION);
                } else {
                    request.deny();
                }
            }
        });
    }

    private boolean hasPermission(String permission) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    REQUEST_NOTIFICATIONS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                           int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_WEBRTC_PERMISSION && pendingWebRtcRequest != null) {
            boolean allGranted = grantResults.length > 0;
            for (int r : grantResults) {
                if (r != PackageManager.PERMISSION_GRANTED) allGranted = false;
            }
            if (allGranted) {
                pendingWebRtcRequest.grant(pendingWebRtcRequest.getResources());
            } else {
                pendingWebRtcRequest.deny();
            }
            pendingWebRtcRequest = null;
        }
    }

    // ----------------------------------------------------------- network

    private void registerNetworkCallback() {
        connectivityManager =
                (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onLost(Network network) {
                runOnUiThread(() -> {
                    if (!isNetworkAvailable()) showOffline();
                });
            }

            @Override
            public void onAvailable(Network network) {
                runOnUiThread(() -> {
                    if (isOffline) reloadApp();
                });
            }
        };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
        } else {
            NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();
            connectivityManager.registerNetworkCallback(request, networkCallback);
        }
    }

    private boolean isNetworkAvailable() {
        if (connectivityManager == null) return true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = connectivityManager.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps =
                    connectivityManager.getNetworkCapabilities(network);
            return caps != null
                    && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        }
        android.net.NetworkInfo info = connectivityManager.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void showOffline() {
        isOffline = true;
        refreshLayout.setRefreshing(false);
        refreshLayout.setEnabled(false);
        webView.setVisibility(View.GONE);
        offlineView.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.GONE);
    }

    private void reloadApp() {
        if (!isNetworkAvailable()) {
            Toast.makeText(this, R.string.offline_title, Toast.LENGTH_SHORT).show();
            return;
        }
        isOffline = false;
        offlineView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        refreshLayout.setEnabled(true);
        webView.reload();
    }

    private void hideSplash() {
        if (splashOverlay == null) return;
        splashOverlay.animate().alpha(0f).setDuration(300).withEndAction(() -> {
            if (splashOverlay != null) {
                splashOverlay.setVisibility(View.GONE);
                splashOverlay = null;
            }
        }).start();
    }

    // -------------------------------------------------------------- fcm

    private void fetchFcmToken() {
        FirebaseMessaging.getInstance().getToken()
                .addOnSuccessListener(token -> {
                    TokenStore.save(this, token);
                    pushStoredTokenToWeb();
                });
    }

    private void pushStoredTokenToWeb() {
        String token = TokenStore.get(this);
        if (token == null || webView == null) return;
        String js = "(function(){"
                + "window.__aiteFcmToken='" + token + "';"
                + "try{localStorage.setItem('aite:fcmToken','" + token + "');}catch(e){}"
                + "window.dispatchEvent(new CustomEvent('aite-fcm-token',{detail:'" + token + "'}));"
                + "})();";
        webView.evaluateJavascript(js, null);
    }

    public class NativeBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getFcmToken() {
            return TokenStore.get(MainActivity.this);
        }

        @JavascriptInterface
        public void subscribeTopic(String topic) {
            if (topic != null && topic.matches("[a-zA-Z0-9-_.~%]{1,900}")) {
                FirebaseMessaging.getInstance().subscribeToTopic(topic);
            }
        }

        @JavascriptInterface
        public void refreshToken() {
            fetchFcmToken();
        }

        @JavascriptInterface
        public void onRouteChange(String path) {
            runOnUiThread(() -> updateRefreshAvailability(
                    "https://aite-app-one.vercel.app" + (path != null ? path : "/")));
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            pushStoredTokenToWeb();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    static class TokenStore {
        private static final String PREFS = "aite_prefs";
        private static final String KEY = "fcm_token";

        static void save(Context context, String token) {
            SharedPreferences prefs =
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY, token).apply();
        }

        static String get(Context context) {
            SharedPreferences prefs =
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            return prefs.getString(KEY, null);
        }
    }

    // ---------------------------------------------------------- lifecycle

    @Override
    public void onBackPressed() {
        if (isOffline) {
            super.onBackPressed();
            return;
        }
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (IllegalArgumentException ignored) {
            }
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
