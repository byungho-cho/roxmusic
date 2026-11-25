package com.nurox.musictestbed;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;

@CapacitorPlugin(name = "BackgroundDiagnostics")
public class BackgroundDiagnostics extends Plugin {
    private static final String TAG = "MusicBackgroundPoC";
    private static final String FILE_NAME = "background-poc.jsonl";
    private static final long MAX_BYTES = 256 * 1024;

    public static synchronized void append(Context context, String event, JSONObject details) {
        try {
            JSONObject entry = new JSONObject();
            entry.put("event", event);
            entry.put("wallTimeMillis", System.currentTimeMillis());
            entry.put("elapsedRealtimeMillis", SystemClock.elapsedRealtime());
            entry.put("pid", Process.myPid());
            entry.put("sdk", Build.VERSION.SDK_INT);
            PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (power != null) {
                entry.put("screenInteractive", power.isInteractive());
                entry.put("powerSaveMode", power.isPowerSaveMode());
                entry.put("deviceIdleMode", power.isDeviceIdleMode());
            }
            Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (battery != null) {
                entry.put("batteryLevel", battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1));
                entry.put("batteryScale", battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1));
                entry.put("batteryTemperatureTenthsC", battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1));
                entry.put("plugged", battery.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0));
            }
            entry.put("details", details == null ? new JSONObject() : details);
            File file = new File(context.getFilesDir(), FILE_NAME);
            boolean keepPrevious = file.length() < MAX_BYTES;
            try (FileOutputStream output = new FileOutputStream(file, keepPrevious)) {
                output.write((entry.toString() + "\n").getBytes(StandardCharsets.UTF_8));
            }
            Log.i(TAG, entry.toString());
        } catch (Exception error) {
            Log.w(TAG, "DIAGNOSTICS_WRITE_FAILED");
        }
    }

    @Override
    public void load() {
        JSObject details = new JSObject();
        details.put("packageName", getContext().getPackageName());
        details.put("model", Build.MODEL);
        if (Build.VERSION.SDK_INT >= 26) {
            android.content.pm.PackageInfo webView = WebView.getCurrentWebViewPackage();
            if (webView != null) details.put("webViewVersion", webView.versionName);
        }
        append(getContext(), "native_plugin_ready", details);
    }

    @PluginMethod
    public void record(PluginCall call) {
        String event = call.getString("event", "");
        if (!Arrays.asList("player_ready", "player_state", "player_error", "load_requested",
                "autoplay_blocked", "suspend", "visibility", "pagehide", "app_state",
                "offline", "online", "timer_sample").contains(event)) {
            call.reject("INVALID_DIAGNOSTIC_EVENT");
            return;
        }
        JSObject details = new JSObject();
        details.put("hidden", call.getBoolean("hidden", false));
        String reason = call.getString("reason", "");
        if (reason.matches("[a-z_]{0,40}")) details.put("reason", reason);
        Integer state = call.getInt("playerState");
        Double position = call.getDouble("position");
        Double duration = call.getDouble("duration");
        if (state != null) details.put("playerState", state);
        if (position != null && Double.isFinite(position)) details.put("position", position);
        if (duration != null && Double.isFinite(duration)) details.put("duration", duration);
        append(getContext(), "web_" + event, details);
        call.resolve();
    }
}
