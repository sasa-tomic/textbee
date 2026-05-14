# Self-Hosting Secrets

To run TextBee end-to-end you need two Firebase artifacts (one per environment
if you split dev/prod) and an `api/.env` file. None of the real credentials are
ever committed — only `.example` placeholders are.

This fork follows a two-Firebase-project convention: a `*-dev` project for the
`dev` build flavor (`applicationId = ch.voxtra.sms.dev`) and a `*-prod` project
for the `prod` flavor (`applicationId = ch.voxtra.sms`).

## 1. Firebase Admin SDK JSON → `api/.env`

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

After editing `api/.env`, rebuild the API container (a plain `restart` will not
re-read the env file):

```bash
docker compose up -d --force-recreate textbee-api
```

## 2. Android `google-services.json` → flavor source set

In the Firebase console: Project Settings → "Your apps" → Android app → download
`google-services.json`. Drop it into the matching flavor's source set:

| Build flavor | applicationId        | Firebase project (this fork) | File path                                  |
| ------------ | -------------------- | ---------------------------- | ------------------------------------------ |
| `dev`        | `ch.voxtra.sms.dev`  | `voxtra-dev`                 | `android/app/src/dev/google-services.json`  |
| `prod`       | `ch.voxtra.sms`      | `voxtra-prod`                | `android/app/src/prod/google-services.json` |

The Android Firebase gradle plugin auto-selects the right file based on the
active variant — no Gradle changes needed.

Validate the package name matches the flavor before building:

```bash
jq -r '.client[].client_info.android_client_info.package_name' \
  android/app/src/dev/google-services.json
# must print: ch.voxtra.sms.dev

jq -r '.client[].client_info.android_client_info.package_name' \
  android/app/src/prod/google-services.json
# must print: ch.voxtra.sms
```

A mismatch makes the Firebase plugin fail at `processDevDebugGoogleServices` /
`processProdDebugGoogleServices` build time with a clear error.

## What's committed vs ignored

| Path                                              | Committed? | Notes                              |
| ------------------------------------------------- | ---------- | ---------------------------------- |
| `api/.env`                                         | NO         | Gitignored. Real secrets.          |
| `api/.env.example`                                 | yes        | Template.                          |
| `android/app/src/{dev,prod}/google-services.json` | NO         | Gitignored. Real Firebase config.  |
| `android/app/src/{dev,prod}/google-services.json.example` | yes | Shape reference + correct package. |
