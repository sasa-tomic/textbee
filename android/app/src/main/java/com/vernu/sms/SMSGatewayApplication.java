package com.vernu.sms;

import android.app.Application;
import android.util.Log;

import androidx.work.Configuration;
import androidx.work.WorkManager;

import com.vernu.sms.helpers.FirebaseInitHelper;

public class SMSGatewayApplication extends Application implements Configuration.Provider {
    private static final String TAG = "SMSGatewayApplication";
    
    @Override
    public void onCreate() {
        super.onCreate();

        // Load the user-configured API endpoint (or the build default) before any API call
        ApiManager.init(this);

        // Initialize Firebase/FCM from cached server config, then refresh it in the background.
        // The default FirebaseApp is created at runtime (no bundled google-services.json).
        FirebaseInitHelper.ensureInitialized(this);
        FirebaseInitHelper.refresh(this, null);

        // Initialize WorkManager early to ensure it's ready for background work
        // This is important for background tasks like heartbeat
        try {
            WorkManager.initialize(this, getWorkManagerConfiguration());
            Log.d(TAG, "WorkManager initialized successfully");
        } catch (IllegalStateException e) {
            // WorkManager might already be initialized (e.g., by androidx.startup)
            // This is fine, we can continue
            Log.d(TAG, "WorkManager already initialized or will be initialized automatically");
        }
    }
    
    @Override
    public Configuration getWorkManagerConfiguration() {
        return new Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build();
    }
} 