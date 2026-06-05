package com.vernu.sms.dtos;

import java.util.ArrayList;
import java.util.List;

/**
 * Response of GET /config — public client configuration served by the server.
 * Carries the (non-secret) Firebase client identifiers used to initialize FCM at runtime.
 */
public class ConfigResponseDTO {
    public FirebaseConfigDTO firebase;

    public static class FirebaseConfigDTO {
        public String projectId;
        public String applicationId;
        public String apiKey;
        public String messagingSenderId;

        public boolean isComplete() {
            return missingFields().isEmpty();
        }

        /**
         * Names of the required Firebase client fields the server didn't provide. Used to tell the
         * user exactly which FIREBASE_CLIENT_* settings are missing on the server when the config is
         * incomplete.
         */
        public List<String> missingFields() {
            List<String> missing = new ArrayList<>();
            if (isBlank(projectId)) missing.add("projectId");
            if (isBlank(applicationId)) missing.add("applicationId");
            if (isBlank(apiKey)) missing.add("apiKey");
            if (isBlank(messagingSenderId)) missing.add("messagingSenderId");
            return missing;
        }

        private static boolean isBlank(String s) {
            return s == null || s.trim().isEmpty();
        }
    }
}
