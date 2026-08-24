-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose
-ignorewarnings
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class org.apache.cordova.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.aite.app.MainActivity { *; }
-keep class com.aite.app.AiteFirebaseMessagingService { *; }
-keep class com.aite.app.AiteUpdateBridge { *; }
-keepclassmembers class com.aite.app.AiteUpdateBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
