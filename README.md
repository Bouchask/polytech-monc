# Palesso — prototype mobile

Palesso is a French-language customer-side home-services marketplace prototype for Morocco, built with Expo SDK 58, React Native, TypeScript, Expo Router, and NativeWind.

## Run locally

```sh
npm install
npm start
```

Use `npm run ios`, `npm run android`, or `npm run web` to choose a target. A development build is required for native location and media-picker behavior; Expo Go includes the SDK modules used by this project.

## Demo journeys

- Browse categories as a guest from the welcome screen or tap **Passer**.
- Open **Plomberie → Filtre d’eau** to see example catalogue estimates.
- Start **Faire une demande** to step through a local booking draft. Add media through the system picker; location can be entered manually or requested from the device.
- Publishing prompts for mock sign-in. Any phone and password of at least four characters work; account creation is also local.
- Open **Suivi → PL-240518 → Comparer les offres** to compare seeded technicians and accept one.
- Open the accepted appointment from **Suivi → PL-240392**.
- Check **Alertes** and **Compte** for seeded notifications, preferences, and profile flows.

## What is simulated

There is no server, real account, SMS, payment, technician dispatch, messaging, push delivery, or booking provider. Customer identity is represented by a SecureStore demo token; non-sensitive mock records and preferences are stored locally with AsyncStorage. Requests created by the booking wizard, offer selection, cancellation, notification reads, and profile edits update local app state. Seed data is provided to make pending, offers received, accepted/in-progress, completed, and cancelled states easy to explore. Reset app storage to restore the initial scenarios.

Catalogue price ranges, ratings, technician profiles, reviews, availability, and seeded requests are sample content. Estimates are not guaranteed final prices. Accepting an offer only updates the local demonstration state.

## Native configuration and limitations

- Location permission copy is configured for foreground use on iOS and Android. If permission is unavailable, manual address entry remains usable.
- The location preview is a lightweight illustrative map; no map tile API key is required. Device coordinates are shown as a simulated address string rather than reverse-geocoded.
- Photo and video attachments use Expo Image Picker. Audio recording is not available in this MVP and is labeled as such in the booking UI.
- Remote Unsplash and avatar images need connectivity; the reusable image component falls back to an icon when loading fails.
- Notification examples are local in-app records only.
- Arabic is shown as a future language option; the interface is French and does not yet implement RTL layout.

## Checks

Run `npm run typecheck` and `npm run lint` for strict TypeScript and Expo lint checks.
