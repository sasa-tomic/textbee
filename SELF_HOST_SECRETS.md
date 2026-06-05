# Self-Hosting Secrets

To run TextBee end-to-end you need Firebase credentials in `api/.env`. None of the
real credentials are ever committed — only `.example` placeholders are.

The Android app **no longer bundles a build-time `google-services.json`**. Instead it
fetches its (public) Firebase client config from the server at `GET /api/v1/config` and
initializes FCM at runtime. That means **one APK works against any self-hosted server** —
just point the app at your API endpoint in the app's settings, and it picks up the right
Firebase project from that server.

So there are two halves of the Firebase setup, **both living in `api/.env`**:

1. **Admin SDK** — lets the server *send* push messages (secret).
2. **Client config** — served to the app so it can *receive* them (public identifiers).

## 1. Firebase Admin SDK JSON → `api/.env` (secret — server sends FCM)

In the Firebase console: Project Settings → Service accounts → "Generate new
private key". You get a JSON file. Validate it before using:

```bash
jq -e '.type == "service_account" and .private_key and .project_id and .client_email' \
  /path/to/firebase-admin.json && echo OK
```

Copy `api/.env.example` to `api/.env` (or create from scratch) and map the JSON
fields to env vars. **Note:** the code uses `FIREBASE_CLIENT_C509_CERT_URL`
(typo of `X509`) — match it exactly:

| Admin SDK JSON field          | `api/.env` var                   |
| ----------------------------- | -------------------------------- |
| `project_id`                  | `FIREBASE_PROJECT_ID`            |
| `private_key_id`              | `FIREBASE_PRIVATE_KEY_ID`        |
| `private_key`                 | `FIREBASE_PRIVATE_KEY`           |
| `client_email`                | `FIREBASE_CLIENT_EMAIL`          |
| `client_id`                   | `FIREBASE_CLIENT_ID`             |
| `client_x509_cert_url`        | `FIREBASE_CLIENT_C509_CERT_URL`  |

`FIREBASE_PRIVATE_KEY` must be **double-quoted** with literal `\n` escapes kept
as-is (the code does `.replace(/\\n/g, '\n')` at boot). Example line:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...==\n-----END PRIVATE KEY-----\n"
```

## 2. Firebase CLIENT config → `api/.env` (public — app receives FCM)

These are **public client identifiers**, not secrets (the Android API key is
restricted by package name + signing certificate). They are served unauthenticated
at `GET /api/v1/config` so the app can initialize FCM at runtime.

Get them from the Firebase console: Project Settings → General → "Your apps" →
Android app. They are exactly the values inside a `google-services.json`:

| Firebase console / `google-services.json` field            | `api/.env` var                        |
| ---------------------------------------------------------- | ------------------------------------- |
| App ID — `client[].client_info.mobilesdk_app_id`           | `FIREBASE_CLIENT_APP_ID`              |
| Web API Key — `client[].api_key[].current_key`             | `FIREBASE_CLIENT_API_KEY`             |
| Project number — `project_info.project_number`             | `FIREBASE_CLIENT_MESSAGING_SENDER_ID` |
| Project ID — `project_info.project_id`                     | `FIREBASE_CLIENT_PROJECT_ID` (optional; defaults to `FIREBASE_PROJECT_ID`) |

The Admin SDK project (section 1) and the client config (section 2) **must be the
same Firebase project**.

Verify the endpoint returns your values once the API is running:

```bash
curl -s http://localhost:3001/api/v1/config | jq .firebase
# { "projectId": "...", "applicationId": "1:...:android:...", "apiKey": "...", "messagingSenderId": "..." }
```

After editing `api/.env`, rebuild the API container (a plain `restart` will not
re-read the env file):

```bash
docker compose up -d --force-recreate textbee-api
```

## What's committed vs ignored

| Path                | Committed? | Notes                                            |
| ------------------- | ---------- | ------------------------------------------------ |
| `api/.env`          | NO         | Gitignored. Real secrets + public client config. |
| `api/.env.example`  | yes        | Template.                                        |

> The Android app no longer uses `google-services.json` at all — Firebase is
> configured at runtime from `GET /api/v1/config` (see `FirebaseInitHelper`).
