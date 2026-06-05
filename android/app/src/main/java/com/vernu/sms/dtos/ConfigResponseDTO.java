package com.vernu.sms.dtos;

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
            return projectId != null && !projectId.isEmpty()
                    && applicationId != null && !applicationId.isEmpty()
                    && apiKey != null && !apiKey.isEmpty()
                    && messagingSenderId != null && !messagingSenderId.isEmpty();
        }
    }
}
