package com.vernu.sms;

import android.Manifest;

public class AppConstants {
    /** Build-time default API endpoint. Used when the user hasn't overridden it in-app. */
    public static final String API_BASE_URL = BuildConfig.API_BASE_URL;
    /** Build-time default dashboard/website URL. Used when the user hasn't overridden it in-app. */
    public static final String DASHBOARD_URL = BuildConfig.DASHBOARD_URL;
    /** Public page for app releases/updates. Kept separate from the (possibly private) dashboard URL. */
    public static final String RELEASES_URL = BuildConfig.RELEASES_URL;
    public static final String[] requiredPermissions = new String[]{
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_PHONE_STATE
    };
    public static final String SHARED_PREFS_API_BASE_URL_KEY = "API_BASE_URL";
    public static final String SHARED_PREFS_DASHBOARD_URL_KEY = "DASHBOARD_URL";
    // Firebase client config fetched from the server (GET /config) and used to init FCM at runtime.
    public static final String SHARED_PREFS_FCM_APP_ID_KEY = "FCM_APP_ID";
    public static final String SHARED_PREFS_FCM_API_KEY_KEY = "FCM_API_KEY";
    public static final String SHARED_PREFS_FCM_PROJECT_ID_KEY = "FCM_PROJECT_ID";
    public static final String SHARED_PREFS_FCM_SENDER_ID_KEY = "FCM_SENDER_ID";
    public static final String SHARED_PREFS_DEVICE_ID_KEY = "DEVICE_ID";
    public static final String SHARED_PREFS_API_KEY_KEY = "API_KEY";
    public static final String SHARED_PREFS_GATEWAY_ENABLED_KEY = "GATEWAY_ENABLED";
    public static final String SHARED_PREFS_PREFERRED_SIM_KEY = "PREFERRED_SIM";
    public static final String SHARED_PREFS_RECEIVE_SMS_ENABLED_KEY = "RECEIVE_SMS_ENABLED";
    public static final String SHARED_PREFS_TRACK_SENT_SMS_STATUS_KEY = "TRACK_SENT_SMS_STATUS";
    public static final String SHARED_PREFS_LAST_VERSION_CODE_KEY = "LAST_VERSION_CODE";
    public static final String SHARED_PREFS_LAST_VERSION_NAME_KEY = "LAST_VERSION_NAME";
    public static final String SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY = "STICKY_NOTIFICATION_ENABLED";
    public static final String HEARTBEAT_WORK_TAG = "heartbeat";
    public static final String SHARED_PREFS_HEARTBEAT_ENABLED_KEY = "HEARTBEAT_ENABLED";
    public static final String SHARED_PREFS_HEARTBEAT_INTERVAL_MINUTES_KEY = "HEARTBEAT_INTERVAL_MINUTES";
    public static final String SHARED_PREFS_SMS_FILTER_CONFIG_KEY = "SMS_FILTER_CONFIG";
    public static final String SHARED_PREFS_DEVICE_NAME_KEY = "DEVICE_NAME";
    public static final String SHARED_PREFS_SMS_SEND_DELAY_SECONDS_KEY = "SMS_SEND_DELAY_SECONDS";
    /** Default delay between SMS sends (seconds). 5s helps avoid carrier/device throttling. */
    public static final int DEFAULT_SMS_SEND_DELAY_SECONDS = 5;
}
