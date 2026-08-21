# Aite Android

The Android app is a Capacitor native shell for `https://aite-app-one.vercel.app/`, preserving the complete production web experience while adding native behavior:

- Android app id: `com.aite.app`
- zoom and long-press browser callouts disabled in the native WebView
- native offline screen that does not load the website fallback
- Firebase Cloud Messaging via `@capacitor/push-notifications`
- native launcher assets generated from the supplied Aite logo

## Local build

1. Put your Firebase `google-services.json` in `android/app/google-services.json` (it is intentionally ignored by git).
2. Use JDK 17 and Android SDK API 34.
3. Run:

```bash
npm ci
npm run android:sync
cd android
./gradlew assembleDebug
```

The debug APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

For Play Store distribution, generate a signing key and configure a signed release/AAB; never commit the key or `google-services.json`.
