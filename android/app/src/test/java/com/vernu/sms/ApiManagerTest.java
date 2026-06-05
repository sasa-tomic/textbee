package com.vernu.sms;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Unit tests for {@link ApiManager#normalizeBaseUrl(String)} — the value it returns is what the UI
 * shows and persists, so it must always be a bare server origin WITHOUT the "api/v1/" path (which is
 * appended automatically when the HTTP client is built).
 */
public class ApiManagerTest {

    @Test
    public void bareOrigin_getsTrailingSlash_andNoApiPath() {
        assertEquals("https://sms.voxtra.ch/", ApiManager.normalizeBaseUrl("https://sms.voxtra.ch"));
    }

    @Test
    public void schemeIsAssumedHttpsWhenMissing() {
        assertEquals("https://sms.voxtra.ch/", ApiManager.normalizeBaseUrl("sms.voxtra.ch"));
    }

    @Test
    public void trailingApiV1_isStripped() {
        assertEquals("https://sms.voxtra.ch/", ApiManager.normalizeBaseUrl("https://sms.voxtra.ch/api/v1/"));
        assertEquals("https://sms.voxtra.ch/", ApiManager.normalizeBaseUrl("https://sms.voxtra.ch/api/v1"));
    }

    @Test
    public void surroundingWhitespace_isTrimmed() {
        assertEquals("https://sms.voxtra.ch/", ApiManager.normalizeBaseUrl("  https://sms.voxtra.ch  "));
    }

    @Test
    public void subPathDeployment_isPreserved() {
        // Self-hosters behind a path prefix: only a trailing api/v1 is stripped, the prefix stays.
        assertEquals("https://example.com/textbee/", ApiManager.normalizeBaseUrl("https://example.com/textbee"));
        assertEquals("https://example.com/textbee/", ApiManager.normalizeBaseUrl("https://example.com/textbee/api/v1/"));
    }

    @Test
    public void blankOrInvalid_fallsBackToOriginWithoutApiPath() {
        for (String input : new String[]{null, "", "   "}) {
            String result = ApiManager.normalizeBaseUrl(input);
            assertTrue("fallback should be absolute: " + result, result.startsWith("http"));
            assertTrue("fallback should end with /: " + result, result.endsWith("/"));
            assertFalse("fallback must not contain the api path: " + result, result.contains("/api/v1"));
        }
    }
}
