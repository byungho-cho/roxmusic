package com.nurox.musictestbed;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {
    private static final List<JSObject> pending = new ArrayList<>();
    private static ShareInboxPlugin active;

    @Override
    public void load() {
        active = this;
    }

    public static synchronized void receive(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction()) ||
                !"text/plain".equals(intent.getType())) return;
        CharSequence value = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (value == null || value.length() == 0 || value.length() > 10000) return;
        JSObject item = new JSObject();
        item.put("id", UUID.randomUUID().toString());
        item.put("text", value.toString());
        if (pending.size() >= 10) pending.remove(0);
        pending.add(item);
        // A recreated Activity must not replay its already accepted launch intent.
        intent.removeExtra(Intent.EXTRA_TEXT);
        if (active != null) active.notifyListeners("sharedText", item, true);
    }

    @PluginMethod
    public void consume(PluginCall call) {
        JSArray items = new JSArray();
        synchronized (ShareInboxPlugin.class) {
            for (JSObject item : pending) items.put(item);
            pending.clear();
        }
        JSObject result = new JSObject();
        result.put("items", items);
        call.resolve(result);
    }

    @PluginMethod
    public void openYoutube(PluginCall call) {
        String videoId = call.getString("videoId", "");
        Double seconds = call.getDouble("startSeconds", 0.0);
        if (!videoId.matches("[A-Za-z0-9_-]{11}") || seconds == null ||
                !Double.isFinite(seconds) || seconds < 0 || seconds > Integer.MAX_VALUE) {
            call.reject("INVALID_VIDEO");
            return;
        }
        Uri uri = Uri.parse("https://www.youtube.com/watch?v=" + videoId + "&t=" + seconds.intValue() + "s");
        Intent intent = new Intent(Intent.ACTION_VIEW, uri).setPackage("com.google.android.youtube");
        BackgroundDiagnostics.append(getContext(), "youtube_handoff_requested", null);
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(intent);
                BackgroundDiagnostics.append(getContext(), "youtube_app_opened", null);
                call.resolve();
            } catch (ActivityNotFoundException unavailable) {
                BackgroundDiagnostics.append(getContext(), "youtube_app_unavailable", null);
                try {
                    getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    BackgroundDiagnostics.append(getContext(), "external_fallback_opened", null);
                    call.resolve();
                } catch (ActivityNotFoundException error) {
                    BackgroundDiagnostics.append(getContext(), "handoff_failed", null);
                    call.reject("NO_YOUTUBE_HANDLER");
                }
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (active == this) active = null;
    }
}
