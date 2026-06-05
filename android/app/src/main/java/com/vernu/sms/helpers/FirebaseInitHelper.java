package com.vernu.sms.helpers;

import android.content.Context;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.vernu.sms.ApiManager;
import com.vernu.sms.AppConstants;
import com.vernu.sms.dtos.ConfigResponseDTO;

import java.io.IOException;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Initializes the default {@link FirebaseApp} at runtime from configuration fetched from the
 * server (GET /config), instead of a build-time google-services.json. This lets a single APK
 * work against any self-hosted server + Firebase project.
 *
 * The Firebase client values (app id, api key, project id, sender id) are public identifiers,
 * not secrets, so caching them in SharedPreferences is fine.
 */
public class FirebaseInitHelper {
    private static final String TAG = "FirebaseInitHelper";

    public interface InitCallback {
        /**
         * @param ready  true once the default FirebaseApp is initialized and ready to use.
         * @param detail human-readable status/error (the project on success, or why it failed) —
         *               suitable for showing the user. Never null.
         */
        void onResult(boolean ready, String detail);
    }

    /** True once the default FirebaseApp exists (so FirebaseMessaging/Crashlytics can be used). */
    public static boolean isInitialized(Context context) {
        return !FirebaseApp.getApps(context).isEmpty();
    }

    /**
     * Ensures the default FirebaseApp is initialized using cached config. Returns true if Firebase
     * is ready, false if no (complete) config has been fetched yet. Safe to call repeatedly.
     */
    public static synchronized boolean ensureInitialized(Context context) {
        try {
            if (isInitialized(context)) {
                return true;
            }
            String appId = SharedPreferenceHelper.getSharedPreferenceString(context, AppConstants.SHARED_PREFS_FCM_APP_ID_KEY, "");
            String apiKey = SharedPreferenceHelper.getSharedPreferenceString(context, AppConstants.SHARED_PREFS_FCM_API_KEY_KEY, "");
            String projectId = SharedPreferenceHelper.getSharedPreferenceString(context, AppConstants.SHARED_PREFS_FCM_PROJECT_ID_KEY, "");
            String senderId = SharedPreferenceHelper.getSharedPreferenceString(context, AppConstants.SHARED_PREFS_FCM_SENDER_ID_KEY, "");
            if (appId.isEmpty() || apiKey.isEmpty() || projectId.isEmpty() || senderId.isEmpty()) {
                return false;
            }
            FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(appId)
                    .setApiKey(apiKey)
                    .setProjectId(projectId)
                    .setGcmSenderId(senderId)
                    .build();
            FirebaseApp.initializeApp(context, options);
            Log.d(TAG, "Firebase initialized at runtime for project " + projectId);
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "Failed to initialize Firebase from cached config", t);
            return false;
        }
    }

    /** Persists the Firebase client config fetched from the server. */
    public static void storeConfig(Context context, ConfigResponseDTO.FirebaseConfigDTO config) {
        SharedPreferenceHelper.setSharedPreferenceString(context, AppConstants.SHARED_PREFS_FCM_APP_ID_KEY, config.applicationId);
        SharedPreferenceHelper.setSharedPreferenceString(context, AppConstants.SHARED_PREFS_FCM_API_KEY_KEY, config.apiKey);
        SharedPreferenceHelper.setSharedPreferenceString(context, AppConstants.SHARED_PREFS_FCM_PROJECT_ID_KEY, config.projectId);
        SharedPreferenceHelper.setSharedPreferenceString(context, AppConstants.SHARED_PREFS_FCM_SENDER_ID_KEY, config.messagingSenderId);
    }

    /**
     * Fetches the client config from the current API endpoint, caches it, initializes Firebase,
     * and reports readiness on the calling (background) thread via the callback. Never throws.
     * The callback's {@code detail} carries a human-readable reason so the user can see exactly what
     * went wrong (bad endpoint, server error, or a server that isn't serving the FCM client config).
     */
    public static void refresh(Context context, InitCallback callback) {
        final String endpoint = ApiManager.getBaseUrl();
        ApiManager.getApiService().getConfig().enqueue(new Callback<ConfigResponseDTO>() {
            @Override
            public void onResponse(Call<ConfigResponseDTO> call, Response<ConfigResponseDTO> response) {
                if (!response.isSuccessful()) {
                    String detail = "Server returned HTTP " + response.code() + " for " + endpoint
                            + "config" + describeErrorBody(response);
                    Log.w(TAG, detail);
                    report(callback, isInitialized(context), detail);
                    return;
                }
                ConfigResponseDTO body = response.body();
                if (body == null || body.firebase == null) {
                    String detail = "Server response had no FCM config. Is " + endpoint
                            + " a TextBee server with /config enabled?";
                    Log.w(TAG, detail);
                    report(callback, isInitialized(context), detail);
                    return;
                }
                if (!body.firebase.isComplete()) {
                    String detail = "Server is missing FCM client settings (FIREBASE_CLIENT_*): "
                            + String.join(", ", body.firebase.missingFields())
                            + ". Set them on the server, then retry.";
                    Log.w(TAG, detail);
                    report(callback, isInitialized(context), detail);
                    return;
                }
                storeConfig(context, body.firebase);
                boolean ready = ensureInitialized(context);
                String detail = ready
                        ? "Loaded (project: " + body.firebase.projectId + ")"
                        : "Fetched config but Firebase failed to initialize. See logs.";
                report(callback, ready, detail);
            }

            @Override
            public void onFailure(Call<ConfigResponseDTO> call, Throwable t) {
                String reason = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
                String detail = "Couldn't reach " + endpoint + "config — " + reason
                        + ". Check the API endpoint and your connection.";
                Log.e(TAG, "Failed to fetch client config from server", t);
                report(callback, isInitialized(context), detail);
            }
        });
    }

    private static void report(InitCallback callback, boolean ready, String detail) {
        if (callback != null) {
            callback.onResult(ready, detail);
        }
    }

    /** Best-effort snippet of an HTTP error body, for diagnostics. Empty string if unavailable. */
    private static String describeErrorBody(Response<?> response) {
        try (ResponseBody errorBody = response.errorBody()) {
            if (errorBody == null) {
                return "";
            }
            String text = errorBody.string().trim();
            if (text.isEmpty()) {
                return "";
            }
            if (text.length() > 200) {
                text = text.substring(0, 200) + "…";
            }
            return ": " + text;
        } catch (IOException e) {
            return "";
        }
    }
}
