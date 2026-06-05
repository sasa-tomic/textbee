package com.vernu.sms.helpers;

import android.content.Context;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.vernu.sms.ApiManager;
import com.vernu.sms.AppConstants;
import com.vernu.sms.dtos.ConfigResponseDTO;

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
        void onResult(boolean ready);
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
     */
    public static void refresh(Context context, InitCallback callback) {
        ApiManager.getApiService().getConfig().enqueue(new Callback<ConfigResponseDTO>() {
            @Override
            public void onResponse(Call<ConfigResponseDTO> call, Response<ConfigResponseDTO> response) {
                boolean ready = false;
                if (response.isSuccessful() && response.body() != null
                        && response.body().firebase != null && response.body().firebase.isComplete()) {
                    storeConfig(context, response.body().firebase);
                    ready = ensureInitialized(context);
                } else {
                    Log.w(TAG, "Server returned no usable Firebase config (HTTP " + response.code() + ")");
                    ready = isInitialized(context);
                }
                if (callback != null) {
                    callback.onResult(ready);
                }
            }

            @Override
            public void onFailure(Call<ConfigResponseDTO> call, Throwable t) {
                Log.e(TAG, "Failed to fetch client config from server", t);
                if (callback != null) {
                    callback.onResult(isInitialized(context));
                }
            }
        });
    }
}
