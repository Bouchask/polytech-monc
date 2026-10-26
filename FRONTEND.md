# Palesso frontend — guide technique

Guide du client mobile Expo/React Native et de son intégration Laravel. L’interface est en français, pensée mobile-first pour iOS et Android, avec Expo Web pour l’aperçu navigateur. Les écrans ne parlent pas directement à Supabase: `src/lib/api.ts` appelle l’API Laravel.

## Démarrage

Prérequis: Node.js/npm et un serveur Laravel accessible. Le projet utilise Expo SDK 58, React Native 0.88 et Expo Router.

À la racine:

```sh
cp .env.example .env  # uniquement si .env n’existe pas
npm install
npm run web           # navigateur sur le port 8083
# ou
npm start             # Expo/QR et choix de plateforme
npm run ios
npm run android
```

Définir l’URL API dans `.env` avant le démarrage; Expo incorpore `EXPO_PUBLIC_*` au bundle, donc cette variable doit contenir uniquement une URL publique, jamais un secret:

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

| Environnement | Valeur API typique |
| --- | --- |
| Navigateur Expo Web ou simulateur iOS sur le même Mac | `http://127.0.0.1:8000/api` |
| Émulateur Android | `http://10.0.2.2:8000/api` |
| Téléphone physique | `http://IP_LAN_DU_MAC:8000/api`, Laravel lancé sur `0.0.0.0`; téléphone et ordinateur sur le même réseau |
| Téléphone hors réseau local | URL HTTPS du tunnel de développement (ex. ngrok) ou backend déployé |

Après changement d’URL, redémarrer Expo (au besoin `npx expo start --clear`). Le serveur Laravel doit rester actif. Le client ajoute un en-tête de contournement interstitiel uniquement pour des hôtes ngrok reconnus.

## Architecture

```text
src/app/                 Expo Router: fichiers de route et layouts
src/components/          UI réutilisable par domaine
src/data/                Catalogue de secours et suggestions locales
src/lib/api.ts           Fetch, token, erreurs, URL assets
src/store/AppStore.tsx   État partagé et opérations API
src/types/               Modèles métier TypeScript
src/utils/               Validation/formatage/utilitaires
```

- `src/app/_layout.tsx` fournit le `AppStoreProvider`, navigation racine et fond Palesso.
- `src/app/(tabs)/_layout.tsx` définit les onglets **Accueil**, **Suivi**, **Alertes**, **Compte**; le badge d’alertes vient de l’état non lu localisé par bootstrap.
- `src/components/ui.tsx` centralise les primitives (`Screen`, `Header`, `Button`, `Card`, `Field`, `Photo`, `Tag`) et tokens `C`.
- `src/store/AppStore.tsx` hydrate le catalogue et, si token présent, les données client depuis Laravel. Il centralise inscription/connexion, demandes, offres, adresses, profil et notifications.
- `src/lib/api.ts` normalise erreurs HTTP, configuration d’URL, bearer-token et urls média.
- `src/data/catalog.ts` est le secours de catalogue et de données d’affichage; ce contenu ne prouve pas une disponibilité ou une offre réelle.

### Routes actuelles

| Route | Écran / rôle |
| --- | --- |
| `/` | Accueil de bienvenue et entrée dans le parcours. |
| `/(tabs)` | Accueil principal. |
| `/(tabs)/tracking` | Suivi des demandes, états et rendez-vous accessibles au compte. |
| `/(tabs)/alerts` | Centre de notifications. |
| `/(tabs)/account` | Compte client ou état invité. |
| `/auth/[mode]` | Connexion, création de compte et récupération selon le mode. |
| `/auth/verify-email` | Saisie du code de vérification d’inscription. |
| `/category/[id]` | Types de service d’une catégorie et sélection associée. |
| `/booking/[step]` | Assistant de demande: catégorie, type, prestations, adresse, description, calendrier, résumé. |
| `/confirmation/[id]` | Confirmation d’une demande publiée. |
| `/request/[id]` | Détail, état et actions de demande. |
| `/offers/[id]` | Comparaison et acceptation des offres simulées/stockées. |
| `/technician/[id]` | Profil client-facing d’un professionnel référencé. |
| `/appointment/[id]` | Détails/modification/annulation du rendez-vous. |
| `/search` | Recherche catalogue. |
| `/addresses` | Gestion/sélection d’adresses. |
| `/settings` | Préférences. |
| `/help` | Aide/FAQ d’interface. |

## Flux fonctionnels

### Découverte et demande

Un invité peut parcourir catalogue, catégories et rechercher. Le draft partagé garde catégorie, types, prestations, description, pièces jointes, adresse et planification; le draft et l’adresse d’accueil sont sauvegardés dans AsyncStorage sous `palesso-local`. La publication est protégée: résumé → connexion/inscription si nécessaire → reprise et envoi du draft → confirmation. Les détails du client et demandes sont rechargés depuis `/me/bootstrap`/API.

Parcours de réservation dans le code: `category` → `type` → `items` → `location` → `describe` → `schedule` → `summary`. Les médias et description sont facultatifs sauf règles précisées dans UI/API. `description` est limitée à 5 000 caractères. Authentification est demandée à la publication, pas à la découverte.

### Authentification actuelle

L’inscription exige nom, e-mail et mot de passe; téléphone marocain est optionnel. L’inscription démarre une vérification OTP par e-mail via Laravel; l’écran saisit un code à six chiffres. Connexion et récupération sont par e-mail. Le client n’invente ni OTP ni succès d’authentification. Cette architecture est email-first; elle n’implémente pas SMS OTP ni login au téléphone.

La session est conservée dans SecureStore natif et AsyncStorage navigateur avec la clé client `palesso-laravel-api-token-v1`. Le token est envoyé en `Authorization: Bearer`. Une réponse 401 efface le token local. Logout appelle le backend puis efface le token et les données client.

### État partagé et persistance

- Catalogue: récupéré depuis `GET /api/catalog`; l’état initial a un fallback embarqué. En cas d’erreur, `dataError` est défini; un échec ne signifie pas que le serveur a enregistré quoi que ce soit.
- Données privées: `GET /api/me/bootstrap` après restauration de session/connexion. Demandes, offres, techniciens associés, rendez-vous, notifications et adresses sont transformés vers les types frontend.
- Booking draft et adresse d’accueil: AsyncStorage pour survivre au redémarrage/rechargement. Les données réelles sont persistées via API seulement lors d’actions serveur.
- Les notifications lues et autres mutations serveur actualisent l’état depuis API ou par mutation locale après réponse positive.

### Médias et emplacement

- `MediaAttachments` exploite les API Expo disponibles pour photos/vidéos et audio; le draft ne téléverse pas avant publication. Les fichiers restent des URI locales et peuvent disparaître si système/nettoyage retire leur cache; pas d’upload pendant brouillon.
- Les limites d’interface incluent jusqu’à 4 photos; backend autorise 1 vidéo + 1 audio. Avant publication, le client impose actuellement 50 MiB par média, serveur vidéo 100 MiB: limite effective du client plus basse.
- Localisation utilise Expo Location avec action utilisateur, sélection manuelle et carte selon variante native/web. La recherche locale de lieux n’est pas un service de géocodage en direct. Coordonnées/adresse réelles nécessitent permission/service supporté.
- Le backend sert les fichiers par URL signée temporaire; le client convertit chemin relatif avec `apiAssetUrl`.

## Écrans et interactions

### Accueil, recherche, catalogue

L’accueil utilise la recherche/catégories/radial selector et ouvre les routes de catégorie ou réservation. Recherche et adresses suggérées utilisent les données locales/catalogue disponible, pas un moteur distant. Les images distantes dépendent de la connectivité et URL data; composants de photo fournissent les états visuels. L’onglet Alertes ouvre le flux backend lorsqu’un utilisateur est connecté; invité voit un prompt.

### Suivi, offres et rendez-vous

Les demandes et offres affichées après connexion sont les lignes retournées par backend/fixtures. Accepter offre, annuler demande, replanifier ou annuler rendez-vous envoient des appels API dédiés, puis rafraîchissent les données. Les noms, notes, ratings et offres de seed/demo sont des exemples; pas de dispatch ni contact réel avec technicien.

### Compte, adresses et aide

Profil et adresses sont synchronisés par API; changement d’e-mail est refusé côté backend faute de parcours de vérification spécifique. Préférences et FAQ de démonstration n’impliquent pas forcément un service externe. Voir [backend README](backend/README.md) pour routes et contrat JSON.

## Design et responsive

Palette définie dans `src/components/ui.tsx`/thème: bleu `#147FC1`, cyan `#10B8D5`, navy `#183247`, fond `#F4F8FC`. Navigation Expo Router avec headers cachés du Stack afin que les écrans contrôlent leurs en-têtes. Les onglets ont safe-area native. Primitives UI partagées gardent tailles/actions cohérentes.

Le projet fonctionne aussi via React Native Web. Le rendu web n’est pas équivalent à validation native: permissions système, SecureStore, carte, clavier, sélecteurs, capture audio/vidéo et navigation/gestes doivent être testés sur vrais builds. Les modules natifs ajoutés exigent Expo Go compatible ou build de développement selon leur intégration/version.

## Vérification et commandes

```sh
npm run typecheck
npm run lint
npx expo-doctor
npm run web
```

Les deux premières sont les checks statiques principaux. Les captures multi-tailles, tests E2E et vrais appareils ne sont pas garantis par ces commandes. Documenter les résultats d’exécution réels lors de chaque release; ne pas déduire qu’iOS/Android fonctionne uniquement à partir du navigateur.

## Limites et travaux pré-production

1. **Dépendance réseau:** catalogue et opérations compte/demande nécessitent Laravel. Le fallback catalogue ne fournit pas une API de réservation hors ligne.
2. **OTP et identité:** OTP e-mail uniquement, nécessite SMTP réellement configuré côté Laravel. Les 60 secondes/minutes de countdown UI ne remplacent pas rate limits serveur.
3. **Pas de marketplace live:** aucune recherche géographique réelle, disponibilité temps réel, dispatch, chat, paiement, push notification ou support ticket réel.
4. **Médias:** brouillon local et upload multipart via Laravel à publication; pas d’upload direct R2. Limite frontend de 50 MiB est plus stricte que le maximum vidéo API 100 MiB. Test audio/permissions nécessite appareil ou navigateur avec support.
5. **Dates:** le flux de calendrier doit être exercé autour de changement de jour/fuseau et dates passées sur appareil; API exige date future quand on replanifie. Éviter les valeurs de date figées dans fixtures.
6. **Responsive:** contrôle visuel sur 320–430 dp, tailles de texte accessibles, clavier et safe areas à refaire sur iOS/Android réels. Les tests automatisés E2E ne sont pas présents dans les scripts actuels.
7. **Session:** stockage web AsyncStorage correspond au stockage navigateur, pas à un cookie HttpOnly; protéger l’origine web/HTTPS et évaluer modèle de session avant publication web sensible.
8. **Localisation/carte:** résultat GPS dépend permissions, matériel et configuration native; recherche locale ne constitue pas geocoding.
9. **Démo:** les données de seed, ratings, prix estimés, statuts et professionnels sont du contenu d’essai. L’app ne doit pas prétendre qu’un fournisseur réel a été contacté.

### Évaluation indicative

**Frontend: 7/10 pour un prototype MVP connecté; pas une validation de production.** Points forts: routes organisées, store/API centralisés, type métier, draft persistant, session séparée du mot de passe, parcours client complet et UI partagée. Écarts: absence de tests E2E automatisés, quelques capacités natives non vérifiées sur appareil, pas de télémétrie/offline robuste, images et données de démo, décalage limite média client/serveur et flux email-only. Une note production nécessite scénarios E2E et tests iOS/Android réels, audit accessibilité, performances réseau et vérification API déployée.

## Sécurité côté client

- Toute variable `EXPO_PUBLIC_*` est visible dans le bundle; ne jamais y mettre mot de passe DB, SMTP, clé R2, secret Supabase/service-role ou clé privée.
- Ne pas journaliser bearer tokens, OTP ou données personnelles.
- L’app est un client non fiable: validation et autorisation finales appartiennent à Laravel.
- `EXPO_PUBLIC_API_URL` est l’unique configuration backend nécessaire au client. Supabase est une dépendance d’infrastructure serveur, non une dépendance mobile.
