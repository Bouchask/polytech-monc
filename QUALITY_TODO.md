# Palesso — Quality Roadmap to Production

This checklist tracks work required to move the current customer MVP from a locally testable prototype toward a production service. “Done” means verified in this repository or test environment; it does not imply a live marketplace is operating.

## Completed in this pass

- [x] Add backend feature coverage for OTP registration and account activation.
- [x] Verify Moroccan phone normalization and reject invalid mobile prefixes.
- [x] Verify incorrect and expired OTPs cannot create accounts.
- [x] Verify OTP resend cooldown prevents duplicate mail delivery.
- [x] Verify unverified accounts cannot log in and private endpoints require authentication.
- [x] Verify a verified account can log in and access `/api/me`.
- [x] Fix UUID mass assignment in the User model. Previously, valid OTP verification could fail while creating a new account because the controller supplied an `id` which the model discarded.
- [x] Validate uploaded media from server-detected MIME types, enforce 4-photo/1-video/1-audio limits, and align video size limits with the database.
- [x] Map supported audio and HEIC/HEIF extensions to their appropriate upload MIME types.
- [x] Read web CORS origins from environment configuration and limit private-LAN origin patterns to local development.
- [x] Prevent release builds from silently targeting localhost when `EXPO_PUBLIC_API_URL` is missing; document that this public URL is build-time configuration and contains no secret.
- [x] Apply Laravel Pint formatting to the modified PHP files.
- [x] Keep production-only secrets out of the Expo client; mobile API traffic goes through Laravel.

## Release blockers — external setup required

- [ ] Rotate the Supabase database password and any mail credentials previously shared in chat; update server secrets and confirm old credentials no longer work.
- [ ] Deploy the Laravel API to a maintained host with HTTPS, production error reporting, backups, and a stable `EXPO_PUBLIC_API_URL`.
- [ ] Configure production CORS for the actual app origins and mobile clients; remove development origins from production configuration.
- [ ] Configure SMTP with a verified sender domain/provider. Complete real inbox tests for registration OTP, resend, password reset, and delivery failure. A mocked mail test is not proof of delivery.
- [ ] Configure a shared production cache/rate-limit store (for example Redis) so OTP and login limits work across server instances.
- [ ] Confirm database backup and restore procedures, then run reviewed migrations through the deployment pipeline.

## Product and data integrity

- [ ] Move private request media from Laravel's local filesystem to durable private object storage (Supabase Storage or another provider); verify signed URL expiry and per-user authorization.
- [ ] Add media retention/deletion rules, file scanning policy, and tests for MIME spoofing, count/size limits, and cleanup after a failed request.
- [ ] Replace demo technicians, ratings, offers, availability, and appointments with clearly isolated development fixtures plus real customer-facing operations before launch.
- [ ] Implement and test technician onboarding, quote submission, dispatch, and notification delivery. Until then, never represent seed offers as real marketplace activity.
- [ ] Verify request/offer/appointment status transitions and concurrency against Postgres in an isolated staging project, including duplicate offer acceptance and cancellation races.
- [ ] Review account deletion, personal-data export, privacy notice, terms, and data retention for the target jurisdictions before public release.

## Mobile release quality

- [ ] Run Expo Doctor and resolve its findings. The audit environment could not reach the npm registry, so this check remains unverified.
- [ ] Produce iOS and Android development builds and inspect small, standard, and large device layouts, keyboard behavior, safe areas, camera/library permissions, audio recording, and map behavior.
- [ ] Configure a production API endpoint for physical devices; localhost defaults only work in local simulator/emulator workflows.
- [ ] Add automated app-flow coverage for guest browsing, booking draft restore after authentication, request publishing, offer acceptance, alerts, and profile editing.
- [ ] Add API feature tests for request ownership, cancellation, offer acceptance, appointment changes, notification ownership, and signed-media authorization. Address ownership and upload validation have focused coverage now.
- [ ] Verify offline/error/retry behavior and ensure locally persisted drafts do not retain sensitive credentials or stale personal data.

## Verified checks in this pass

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx expo export --platform web --output-dir /private/tmp/palesso-web-export` — passed; Metro bundled the app's web routes.
- `php artisan test --compact tests/Feature/AuthFlowTest.php` — passed: 12 tests, 63 assertions; includes OTP, password recovery, authentication, profile protection, address ownership, phone validation, and media validation.
- `php artisan test --compact` — passed: 14 tests, 65 assertions, including the two existing example tests.
- `php artisan route:list --path=api` — 26 routes registered.
- `vendor/bin/pint --dirty --format agent` — passed and formatted dirty PHP files.
- `npx expo-doctor` — not completed: npm registry DNS/network resolution failed (`ENOTFOUND`).

## Current rating

**7/10 as a customer MVP prototype; not production-ready.** A “10/10” rating is not defensible until the release blockers and device/staging checks above are complete. Demo data and a successful local API smoke test are not evidence of live service availability or real email delivery.
