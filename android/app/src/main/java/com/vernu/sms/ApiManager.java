package com.vernu.sms;

import android.content.Context;

import com.vernu.sms.helpers.SharedPreferenceHelper;
import com.vernu.sms.services.GatewayApiService;

import okhttp3.HttpUrl;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiManager {
    private static GatewayApiService apiService;
    private static String baseUrl = AppConstants.API_BASE_URL;

    /**
     * Loads the API base URL the user configured in-app (falling back to the build default)
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

    public static synchronized String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Cleans up a user-entered endpoint so it works whether they paste a full base URL or just
     * the server origin: assumes https when no scheme is given, ensures a trailing slash (required
     * by Retrofit), and appends the "api/v1/" path when only an origin was entered (the server
     * serves the gateway endpoints under /api/v1/). Invalid input falls back to the build default.
     */
    public static String normalizeBaseUrl(String url) {
        if (url == null) {
            return AppConstants.API_BASE_URL;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return AppConstants.API_BASE_URL;
        }
        if (!trimmed.contains("://")) {
            trimmed = "https://" + trimmed;
        }
        if (!trimmed.endsWith("/")) {
            trimmed = trimmed + "/";
        }
        HttpUrl parsed = HttpUrl.parse(trimmed);
        if (parsed == null) {
            return AppConstants.API_BASE_URL;
        }
        // Origin only (e.g. https://sms.voxtra.ch) -> append the API path the server expects.
        if ("/".equals(parsed.encodedPath())) {
            trimmed = trimmed + "api/v1/";
        }
        return trimmed;
    }

    public static synchronized GatewayApiService getApiService() {
        if (apiService == null) {
            apiService = createApiService();
        }
        return apiService;
    }

    private static GatewayApiService createApiService() {
//        OkHttpClient.Builder httpClient = new OkHttpClient.Builder();
//        HttpLoggingInterceptor loggingInterceptor = new HttpLoggingInterceptor();
//        loggingInterceptor.setLevel(HttpLoggingInterceptor.Level.BODY);
//        httpClient.addInterceptor(loggingInterceptor);

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(baseUrl)
//                .client(httpClient.build())
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        return retrofit.create(GatewayApiService.class);
    }
}
