package com.vernu.sms;

import android.content.Context;

import com.vernu.sms.helpers.SharedPreferenceHelper;
import com.vernu.sms.services.GatewayApiService;

import okhttp3.HttpUrl;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiManager {
    /**
     * Path under the server origin where the gateway API is served. It is appended automatically when
     * the HTTP client is built — it is never shown to the user nor stored, so the UI only ever deals
     * with a clean server origin (e.g. https://sms.voxtra.ch).
     */
    private static final String API_PATH = "api/v1/";

    private static GatewayApiService apiService;
    /** Configured server origin WITHOUT the API path (e.g. https://sms.voxtra.ch/). */
    private static String baseUrl = normalizeBaseUrl(AppConstants.API_BASE_URL);

    /**
     * Loads the server origin the user configured in-app (falling back to the build default)
     * and rebuilds the service if it changed. Call once on app start.
     */
    public static synchronized void init(Context context) {
        String stored = SharedPreferenceHelper.getSharedPreferenceString(
                context, AppConstants.SHARED_PREFS_API_BASE_URL_KEY, AppConstants.API_BASE_URL);
        setBaseUrl(stored);
    }

    /**
     * Normalizes the given URL and, if it differs from the current one, swaps it in and
     * forces the cached service to be rebuilt against the new endpoint.
     */
    public static synchronized void setBaseUrl(String url) {
        String normalized = normalizeBaseUrl(url);
        if (!normalized.equals(baseUrl)) {
            baseUrl = normalized;
            apiService = null;
        }
    }

    /** The configured server origin (no API path) — this is the value the UI shows and persists. */
    public static synchronized String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Cleans up a user-entered server URL into a bare origin suitable for display/storage: assumes
     * https when no scheme is given, ensures a trailing slash (required by Retrofit), and strips a
     * trailing "api/v1/" if the user pasted a full API URL (or an older stored value included it).
     * The "api/v1/" path is never part of this value — it is re-added automatically in
     * {@link #createApiService()}. Invalid input falls back to the build default.
     */
    public static String normalizeBaseUrl(String url) {
        String fallback = stripApiPath(AppConstants.API_BASE_URL);
        if (url == null) {
            return fallback;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return fallback;
        }
        if (!trimmed.contains("://")) {
            trimmed = "https://" + trimmed;
        }
        if (!trimmed.endsWith("/")) {
            trimmed = trimmed + "/";
        }
        if (HttpUrl.parse(trimmed) == null) {
            return fallback;
        }
        return stripApiPath(trimmed);
    }

    /** Removes a trailing "/api/v1/" segment (keeping the slash before it) so only the origin remains. */
    private static String stripApiPath(String url) {
        String s = url.endsWith("/") ? url : url + "/";
        if (s.endsWith("/" + API_PATH)) {
            s = s.substring(0, s.length() - API_PATH.length());
        }
        return s;
    }

    public static synchronized GatewayApiService getApiService() {
        if (apiService == null) {
            apiService = createApiService();
        }
        return apiService;
    }

    private static GatewayApiService createApiService() {
        // The stored origin never carries the API path; append it here so callers can stay path-agnostic.
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(baseUrl + API_PATH)
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        return retrofit.create(GatewayApiService.class);
    }
}
