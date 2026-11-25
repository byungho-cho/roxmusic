package com.nurox.musictestbed;

import com.getcapacitor.BridgeActivity;
import android.content.Intent;
import android.os.Bundle;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;

public class MainActivity extends BridgeActivity {
    private BroadcastReceiver screenEvents;

    @Override
    public void onCreate(Bundle state) {
        registerPlugin(ShareInboxPlugin.class);
        registerPlugin(BackgroundDiagnostics.class);
        super.onCreate(state);
        BackgroundDiagnostics.append(this, "activity_create", null);
        screenEvents = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                    BackgroundDiagnostics.append(context, "screen_off", null);
                } else if (Intent.ACTION_USER_PRESENT.equals(action)) {
                    BackgroundDiagnostics.append(context, "user_present", null);
                }
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            registerReceiver(screenEvents, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(screenEvents, filter);
        }
        ShareInboxPlugin.receive(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShareInboxPlugin.receive(intent);
    }

    @Override
    public void onStop() {
        BackgroundDiagnostics.append(this, "activity_stop", null);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new Event('music-testbed-suspend'))", null);
            BackgroundDiagnostics.append(this, "webview_pause_requested", null);
            getBridge().getWebView().onPause();
        }
        super.onStop();
    }

    @Override
    public void onStart() {
        super.onStart();
        BackgroundDiagnostics.append(this, "activity_start", null);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        BackgroundDiagnostics.append(this, "activity_resume", null);
    }

    @Override
    public void onPause() {
        BackgroundDiagnostics.append(this, "activity_pause", null);
        super.onPause();
    }

    @Override
    public void onDestroy() {
        BackgroundDiagnostics.append(this, "activity_destroy", null);
        if (screenEvents != null) unregisterReceiver(screenEvents);
        super.onDestroy();
    }
}
