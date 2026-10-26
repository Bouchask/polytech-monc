# Palesso

Palesso is a French-language Expo/React Native customer app for home services in Morocco. The mobile app talks only to the local Laravel API. Laravel owns authentication, OTP email, authorization, business operations, and private request media. Supabase is used only as the hosted PostgreSQL database; the mobile bundle contains no Supabase key or database credential.

## Project documentation

- [Frontend architecture, routes, local setup, user flows, and limitations](FRONTEND.md)
- [Laravel backend architecture, environment, API reference, media pipeline, and limitations](backend/README.md)

## Requirements

- Node.js and npm
- PHP 8.3+ with `pdo_pgsql`
- Composer
- Network access to the Supabase PostgreSQL Session Pooler
- SMTP credentials on the Laravel backend for real verification and recovery email

## First-time setup

1. Rotate the Supabase database password and the Gmail App Password previously pasted into chat. Do not reuse either credential.
2. In Supabase Dashboard → **Connect**, copy the **Session pooler** host/username/port (port 5432) and configure `backend/.env`. Set `DB_PASSWORD` to the newly rotated database password and keep `DB_SSLMODE=require`. Do not use a transaction-pooler connection for Laravel's persistent PHP process. The direct host supplied for this project resolves to IPv6 only, and this development environment has no IPv6 route; the IPv4 Session pooler is required here. Copy its exact host from the dashboard rather than guessing it. Because this configuration stores `DB_PASSWORD` separately, leave its `@` literal; if you instead use a single `DB_URL`, percent-encode `@` as `%40` in the password.
3. Configure `MAIL_HOST=smtp.gmail.com`, `MAIL_PORT=587`, `MAIL_USERNAME`, `MAIL_PASSWORD` (a new Google App Password), and `MAIL_FROM_ADDRESS` in `backend/.env`. These values are server-only. A provider's SMTP acceptance does not guarantee final inbox delivery.
4. From the repository root:

   ```sh
   cd backend
   composer install
   cp .env.example .env # only if .env does not exist
   php artisan key:generate # only on first setup; do not replace an existing APP_KEY
   php artisan migrate --pretend
   ```

   Review the migration output and back up the Supabase project before applying migrations. First apply the existing schema migrations from `supabase/migrations` using the Supabase CLI or SQL Editor. If you want demo fixtures, apply `supabase/seed.sql` now as well. Then run `php artisan migrate`. The Laravel identity migration copies legacy `auth.users` rows into `public.users` and changes customer foreign keys to Laravel-owned users; it does not delete old Auth rows. **Do not run this migration against production until the generated SQL and foreign-key changes have been reviewed and a database backup exists. Never run `supabase db reset` against a hosted project.**

5. In another terminal, run Laravel locally:

   ```sh
   cd backend
   php artisan serve --host=0.0.0.0 --port=8000
   ```

6. Configure the Expo client URL in the ignored root `.env` (already defaults to web/iOS simulator):

   ```env
   EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api
   ```

   Android emulator: `http://10.0.2.2:8000/api`. A physical device can use the computer's LAN IP, or an HTTPS ngrok tunnel. To use ngrok, keep Laravel running, open another terminal and run `ngrok http 8000`, then copy the generated HTTPS forwarding URL into `.env`, ending it with `/api` (for example `https://your-name.ngrok-free.dev/api`). The ngrok process must stay running. Restart Expo with `npx expo start --clear` after changing the URL. The app adds ngrok's browser interstitial bypass header only for ngrok API URLs.

   If using Expo Web from a different origin, set `CORS_ALLOWED_ORIGINS` in `backend/.env` to the exact Expo Web origin (scheme and port, comma-separated if needed), then run `php artisan optimize:clear` and restart Laravel. Native Expo Go requests do not use browser CORS.

7. Start Expo from the repository root with `npm start` or `npm run web`.

For a release build, set `EXPO_PUBLIC_API_URL` to the deployed Laravel HTTPS API URL before building. Release builds no longer fall back to localhost; the app shows a configuration error if the URL is missing. `EXPO_PUBLIC_*` is embedded in the client bundle, so only the public API base URL belongs there—never a database, SMTP, or service-role secret.

## Useful local checks

```sh
(cd backend && php artisan route:list --path=api)
(cd backend && php artisan test)
(cd backend && php artisan migrate:status)
npm run typecheck
npm run lint
```

`GET /api/health` reports whether Laravel can reach PostgreSQL. It will show `database: unavailable` until `backend/.env` contains the correct fresh session-pooler connection details and the database is reachable.

## Seed/demo data

`supabase/seed.sql` contains demo catalog, technician, offer, request, and notification fixtures. Review it before applying, especially if using a hosted project. Run it only against the intended development database and before the Laravel identity migration, because its test account is created in `auth.users` and then copied to `public.users`. The Laravel demo sign-in is available only if that fixture account was seeded; do not expect it in a fresh project without running the seed. Demo prices, ratings, offers, and availability are not live marketplace information.

## Authentication and data boundary

- Laravel issues Sanctum bearer tokens after email OTP verification. Native builds store the token with Expo SecureStore; the browser preview uses local AsyncStorage.
- Registration requires name, email, and password; Moroccan phone is optional. Mail OTP is hashed in PostgreSQL, expires after 10 minutes, has a resend cooldown and attempt limit. Passwords are never persisted in the app.
- Laravel's SMTP credentials and Supabase database password must never use `EXPO_PUBLIC_*` variables or enter source control.
- The Expo app persists only the booking draft and selected home location locally. Customer records, requests, offers, appointments, and alerts flow through Laravel and PostgreSQL.
- Uploaded request media is stored privately on the configured Laravel filesystem (`local` for development, Cloudflare R2 for deployment) and served through expiring signed Laravel URLs. Supabase stores metadata and object references only; it does not store binary media.
- Technician matching, real dispatch, payments, real-time availability, SMS, push notifications, and support ticket delivery are not implemented. Creating a request stores a record only; it does not contact a professional.

## Database migration notes

Supabase continues to provide PostgreSQL, but its Auth, Storage, PostgREST, and Edge Functions are not called by the app. Laravel uses the Supabase Postgres session pooler with a server-side database password. Existing SQL functions are called by Laravel within a transaction after setting the trusted customer claim, retaining their atomic status-transition rules. The Laravel database role is privileged and must never be exposed to the mobile app.

Back up before migrating. The identity migration is intentionally not automatically reversible after new Laravel-authenticated users are created. Existing users are copied by UUID, but existing Supabase Auth sessions are not Laravel sessions; customers will sign in again.

## Private media pipeline (Cloudflare R2)

The existing authenticated `POST /api/requests` multipart endpoint remains the upload API. It accepts the existing `payload`, `media[]`, and `mediaMeta` fields. A `mediaMeta` entry is JSON such as `[ {"type":"image","name":"fuite.jpg"} ]` in the same order as `media[]`. Each response/request detail includes `request_media` metadata, `processing_status`, and an expiring signed `url` (plus a signed `thumbnail_url` for images); poll `GET /api/requests/{id}` to observe queued processing. These URLs are private Laravel delivery links, not R2 public URLs. The same signed read endpoint supports byte-range responses for media playback.

Example request after authentication:

```sh
curl -X POST "$API_URL/requests" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'payload={"categoryId":"plomberie","serviceTypes":["Lavabo"],"serviceItemIds":[],"urgency":"urgent","address":{"address":"Maarif, Casablanca"}}' \
  -F 'mediaMeta=[{"type":"image","name":"fuite.jpg"}]' \
  -F 'media[]=@./fuite.jpg;type=image/jpeg'
```

Per request limits are four images (20 MiB each), one video (100 MiB), one audio item (20 MiB), 220 MiB total, and six files. Laravel validates content signatures and formats; it does not trust the submitted filename/MIME. `intervention/image` with GD is used for images; `league/flysystem-aws-s3-v3` and the AWS PHP SDK provide R2 support. Configure PHP GD, EXIF, `upload_max_filesize`, `post_max_size`, and the web server body limit as described above.

1. Apply `supabase/migrations/20261026140000_media_pipeline.sql` to the intended Supabase project after taking a database backup. It adds nullable processing metadata and increases the table's maximum stored object size to 100 MiB (the API separately limits photos/audio to 20 MiB and videos to 100 MiB), updates the existing request RPC MIME/size validation, and keeps existing rows as `object_disk=local`, `processing_status=ready`. The columns are additive. A manual, guarded rollback script is provided at `supabase/rollback/20261026140000_media_pipeline.sql`; inspect it and back up first because it removes the new metadata, and refuses to restore the 50 MiB cap if larger records exist.
2. Create a Cloudflare R2 S3 API token restricted to this bucket with Object Read and Object Write permissions. Put its access key ID and secret only in `backend/.env` or the deployment secret manager. Never place them in the Expo `.env` or `EXPO_PUBLIC_*` variables.
3. Set `MEDIA_DISK=r2`, `R2_BUCKET=app-media`, `R2_REGION=auto`, `R2_ENDPOINT=https://97cd36438ff51941c6a0f50a40a35f3b.r2.cloudflarestorage.com`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. The endpoint is the account-level S3 API endpoint; do not append `/app-media` because the bucket is a separate setting. `R2_PUBLIC_BASE_URL` is separate and should remain empty for private uploads. Do not guess the Public Development URL; it is not configured in this repository. Public delivery is not required for the signed Laravel flow.
4. Set `MEDIA_REQUIRE_PROBE=true` in production and install a working FFmpeg/FFprobe build with H.264, AAC, WebP and GD support. Provision PHP with `upload_max_filesize=100M`, `post_max_size=220M`, an adequate `memory_limit` (256M or higher), and the reverse proxy request-body limit at least 220 MiB. Set a persistent queue driver, `MEDIA_VIDEO_ASYNC=true`, and run a queue worker, for example `php artisan queue:work --tries=3 --timeout=660`. Configure the Laravel scheduler (`php artisan schedule:work` for local use or the standard once-per-minute scheduler in production) to run `media:cleanup-orphans`; it removes R2 objects unreferenced by Supabase after the configured retention and old local processing temp files. The worker and scheduler need writable temporary storage and sufficient disk space.
5. Locally, leave `MEDIA_DISK=local`, `MEDIA_VIDEO_ASYNC=false`, and `MEDIA_REQUIRE_PROBE=false`; no R2 credentials are needed. Images are EXIF-auto-oriented and re-encoded to WebP only when smaller (or resized when over the configured dimensions), with a private thumbnail. Animated images and lossless profile inputs retain the original. Audio defaults to `preserve_original`; optional profiles are `voice_compact`, `voice_high_quality`, `music_high_quality`, and `lossless_archive`, with bitrate/sample-rate controls in `config/media.php`. FLAC conversion avoids an additional lossy encode but cannot restore detail already lost in a compressed source. Videos support `mobile_standard`, `mobile_high_quality`, `small_file`, and `archive_original`. Small videos may process inline up to `MEDIA_VIDEO_SYNC_THRESHOLD_BYTES`; larger ones queue only when async processing is enabled. A valid smaller MP4 derivative replaces the source only after FFprobe checks codec, audio presence, duration, frame rate, and sync; otherwise the original remains selected.

The Supabase SQL migration has no automatic down migration because restoring a smaller byte limit can fail if objects larger than 50 MiB have been stored, and removing columns discards metadata. Back up first and use the guarded script above only after verifying storage references and R2 objects. Actual R2 connectivity cannot be verified until valid R2 credentials are set in the backend environment; credentials are deliberately not committed here. Cloudflare's current R2 Standard free allowance is 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations per month; overages are usage-billed, while R2 egress is free. Check current [R2 pricing](https://developers.cloudflare.com/r2/pricing/) before launch.
