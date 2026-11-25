package com.nurox.musictestbed;

import com.getcapacitor.BridgeActivity;
import android.content.Intent;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        registerPlugin(ShareInboxPlugin.class);
        super.onCreate(state);
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
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new Event('music-testbed-suspend'))", null);
            getBridge().getWebView().onPause();
        }
        super.onStop();
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
        }
    }
}
