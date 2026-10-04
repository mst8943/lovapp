package tr.com.lovask.lovask_mobile

import io.flutter.embedding.android.FlutterActivity
import android.os.Bundle
import android.content.pm.ApplicationInfo
import android.view.WindowManager
import android.provider.Settings
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "tr.com.lovask.app/device")
            .setMethodCallHandler { call, result ->
                if (call.method == "androidId") {
                    result.success(Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID))
                } else {
                    result.notImplemented()
                }
            }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }
}
