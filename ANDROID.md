# Aite Android

A lightweight Kotlin-based Capacitor shell for `https://aite-app-one.vercel.app/`.

## Features

- package id: `com.aite.app`
- Kotlin native shell
- smooth remote WebView with hardware acceleration
- file/media upload support
- camera + microphone permission support
- native FCM push notifications
- no branded app splash screen beyond the required Android launch background
- text selection disabled outside editable fields
- zoom disabled
- custom offline screen
- cold start always lands on the home route (no last-page restore)
- hardware back steps through the in-app history, then returns home, and only
  backgrounds the app from home

## CI build

The GitHub Actions workflow builds debug and release APK files.

It expects the repository secret below:

- `AITE_ANDROID_GOOGLE_SERVICES_JSON`: full contents of `google-services.json`

## Local build

```bash
npm ci
npx cap sync android
cd android
./gradlew assembleDebug assembleRelease
```
