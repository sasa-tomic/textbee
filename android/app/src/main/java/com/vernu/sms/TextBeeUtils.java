package com.vernu.sms;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.vernu.sms.services.StickyNotificationService;
import com.vernu.sms.helpers.SharedPreferenceHelper;
import com.vernu.sms.dtos.SimInfoDTO;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class TextBeeUtils {
    private static final String TAG = "TextBeeUtils";
    
    public static boolean isPermissionGranted(Context context, String permission) {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED;
    }

    public static List<SubscriptionInfo> getAvailableSimSlots(Context context) {

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return new ArrayList<>();
        }

        SubscriptionManager subscriptionManager = SubscriptionManager.from(context);
        return subscriptionManager.getActiveSubscriptionInfoList();

    }

    public static void startStickyNotificationService(Context context) {
        if(!isPermissionGranted(context, Manifest.permission.RECEIVE_SMS)){
            return;
        }
        
        // Only start service if user has enabled sticky notification
        boolean stickyNotificationEnabled = SharedPreferenceHelper.getSharedPreferenceBoolean(
                context,
                AppConstants.SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY,
                false
        );
        
        if (stickyNotificationEnabled) {
            Intent notificationIntent = new Intent(context, StickyNotificationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(notificationIntent);
            } else {
                context.startService(notificationIntent);
            }
            Log.i(TAG, "Starting sticky notification service");
        } else {
            Log.i(TAG, "Sticky notification disabled by user, not starting service");
        }
    }

    public static void stopStickyNotificationService(Context context) {
        Intent notificationIntent = new Intent(context, StickyNotificationService.class);
        context.stopService(notificationIntent);
        Log.i(TAG, "Stopping sticky notification service");
    }
    
    /**
     * Log a non-fatal exception (with optional context) to logcat.
     *
     * @param throwable The exception to log
     * @param message A message describing what happened
     * @param customData Optional map of context key-value pairs to include in the log
     */
    public static void logException(Throwable throwable, String message, Map<String, Object> customData) {
        Log.e(TAG, message, throwable);
        if (customData != null && !customData.isEmpty()) {
            Log.e(TAG, "Context: " + customData);
        }
    }
    
    /**
     * Simplified method to log a non-fatal exception with just a message
     */
    public static void logException(Throwable throwable, String message) {
        logException(throwable, message, null);
    }

    /**
     * Collects all available SIM information (physical SIMs and eSIMs) from the device
     * 
     * @param context The application context
     * @return List of SimInfoDTO objects containing SIM information, or empty list if permission not granted
     */
    public static List<SimInfoDTO> collectSimInfo(Context context) {
        List<SimInfoDTO> simInfoList = new ArrayList<>();

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "READ_PHONE_STATE permission not granted, cannot collect SIM info");
            return simInfoList;
        }

        try {
            SubscriptionManager subscriptionManager = SubscriptionManager.from(context);
            List<SubscriptionInfo> subscriptionInfoList = subscriptionManager.getActiveSubscriptionInfoList();

            if (subscriptionInfoList == null) {
                Log.d(TAG, "No active subscriptions found");
                return simInfoList;
            }

            for (SubscriptionInfo subscriptionInfo : subscriptionInfoList) {
                SimInfoDTO simInfo = new SimInfoDTO();
                simInfo.setSubscriptionId(subscriptionInfo.getSubscriptionId());

                // Get ICCID (may be null for eSIM)
                try {
                    String iccId = subscriptionInfo.getIccId();
                    if (iccId != null && !iccId.isEmpty()) {
                        simInfo.setIccId(iccId);
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get ICCID for subscription " + subscriptionInfo.getSubscriptionId());
                }

                // Get Card ID
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        int cardId = subscriptionInfo.getCardId();
                        // INVALID_CARD_ID is -1, check for valid card ID (>= 0)
                        if (cardId >= 0) {
                            simInfo.setCardId(cardId);
                        }
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get Card ID for subscription " + subscriptionInfo.getSubscriptionId());
                }

                // Get carrier name
                try {
                    CharSequence carrierName = subscriptionInfo.getCarrierName();
                    if (carrierName != null) {
                        simInfo.setCarrierName(carrierName.toString());
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get carrier name for subscription " + subscriptionInfo.getSubscriptionId());
                }

                // Get display name
                try {
                    CharSequence displayName = subscriptionInfo.getDisplayName();
                    if (displayName != null) {
                        simInfo.setDisplayName(displayName.toString());
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get display name for subscription " + subscriptionInfo.getSubscriptionId());
                }

                // Get SIM slot index
                try {
                    int simSlotIndex = subscriptionInfo.getSimSlotIndex();
                    if (simSlotIndex >= 0) {
                        simInfo.setSimSlotIndex(simSlotIndex);
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get SIM slot index for subscription " + subscriptionInfo.getSubscriptionId());
                }

                // Get MCC (getMccString() is API 29+; use getMcc() on older devices)
                try {
                    String mcc = null;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        mcc = subscriptionInfo.getMccString();
                    } else {
                        int mccInt = subscriptionInfo.getMcc();
                        if (mccInt != Integer.MAX_VALUE) {
                            mcc = String.format("%03d", mccInt);
                        }
                    }
                    if (mcc != null && !mcc.isEmpty()) {
                        simInfo.setMcc(mcc);
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get MCC for subscription " + subscriptionInfo.getSubscriptionId());
                }

                // Get MNC (getMncString() is API 29+; use getMnc() on older devices)
                try {
                    String mnc = null;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        mnc = subscriptionInfo.getMncString();
                    } else {
                        int mncInt = subscriptionInfo.getMnc();
                        if (mncInt != Integer.MAX_VALUE) {
                            mnc = String.valueOf(mncInt);
                        }
                    }
                    if (mnc != null && !mnc.isEmpty()) {
                        simInfo.setMnc(mnc);
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get MNC for subscription " + subscriptionInfo.getSubscriptionId());
                }

                // Get country ISO
                try {
                    String countryIso = subscriptionInfo.getCountryIso();
                    if (countryIso != null && !countryIso.isEmpty()) {
                        simInfo.setCountryIso(countryIso);
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get country ISO for subscription " + subscriptionInfo.getSubscriptionId());
                }

                // Get subscription type (0 = physical SIM, 1 = eSIM)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        int subscriptionType = subscriptionInfo.getSubscriptionType();
                        if (subscriptionType == SubscriptionManager.SUBSCRIPTION_TYPE_LOCAL_SIM) {
                            simInfo.setSubscriptionType("PHYSICAL_SIM");
                        } else if (subscriptionType == SubscriptionManager.SUBSCRIPTION_TYPE_REMOTE_SIM) {
                            simInfo.setSubscriptionType("ESIM");
                        }
                    } else {
                        // For older Android versions, default to PHYSICAL_SIM
                        simInfo.setSubscriptionType("PHYSICAL_SIM");
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Could not get subscription type for subscription " + subscriptionInfo.getSubscriptionId());
                }

                simInfoList.add(simInfo);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error collecting SIM info: " + e.getMessage(), e);
        }

        return simInfoList;
    }

    /**
     * Validates if a subscription ID exists in the active subscriptions
     * 
     * @param context The application context
     * @param subscriptionId The subscription ID to validate
     * @return true if the subscription ID exists, false otherwise
     */
    public static boolean isValidSubscriptionId(Context context, int subscriptionId) {
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }

        try {
            SubscriptionManager subscriptionManager = SubscriptionManager.from(context);
            List<SubscriptionInfo> subscriptionInfoList = subscriptionManager.getActiveSubscriptionInfoList();

            if (subscriptionInfoList == null) {
                return false;
            }

            for (SubscriptionInfo subscriptionInfo : subscriptionInfoList) {
                if (subscriptionInfo.getSubscriptionId() == subscriptionId) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error validating subscription ID: " + e.getMessage(), e);
        }

        return false;
    }
}
