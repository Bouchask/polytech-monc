# Palesso backend — guide technique

API Laravel du MVP client Palesso. Le backend gère les comptes, codes de vérification par e-mail, demandes, rendez-vous, autorisations et médias. PostgreSQL est hébergé par Supabase; le client mobile ne se connecte jamais directement à Supabase.

> **État de l’intégration:** l’API est implémentée, avec tests Laravel. Une configuration valide de Supabase PostgreSQL, SMTP et, en production, R2/FFmpeg reste nécessaire. Ce dépôt ne contient volontairement aucun secret. Une réponse positive du transport SMTP signifie que le serveur SMTP a accepté le message, pas que le destinataire l’a reçu.

## Sommaire

- [Architecture et flux](#architecture-et-flux)
- [Démarrage local](#démarrage-local)
- [Configuration](#configuration)
- [Base de données Supabase](#base-de-données-supabase)
- [API HTTP](#api-http)
- [Authentification et e-mail OTP](#authentification-et-e-mail-otp)
- [Upload et traitement des médias](#upload-et-traitement-des-médias)
- [R2, files et planificateur](#r2-files-et-planificateur)
- [Tests et qualité](#tests-et-qualité)
- [Limites connues et évaluation](#limites-connues-et-évaluation)

## Architecture et flux

```text
Expo / React Native
  └── HTTPS/HTTP JSON + multipart, Bearer Sanctum
       └── Laravel 13 (API, validation, logique métier, SMTP, médias)
            ├── Supabase PostgreSQL (données et fonctions SQL)
            ├── SMTP (codes OTP et récupération)
            └── Filesystem local en développement / Cloudflare R2 facultatif
```

- Les routes sont dans `routes/api.php`; les contrôleurs API dans `app/Http/Controllers/Api`.
- Les utilisateurs et leurs données sont contrôlés côté serveur. Les opérations de demande/offre qui dépendent des fonctions SQL s’exécutent dans une transaction et définissent le claim PostgreSQL de l’utilisateur authentifié.
- Les données du catalogue sont lues dans PostgreSQL. Les écrans peuvent conserver des données de secours embarquées côté frontend pour afficher le catalogue en mode dégradé.
- Les fichiers binaires sont stockés dans le disque configuré. PostgreSQL conserve les références et métadonnées, jamais le binaire.
- Sanctum fournit des jetons Bearer personnels. Les médias sont privés et servis par un endpoint Laravel signé et temporaire.

## Démarrage local

Prérequis: PHP 8.3+, Composer, extensions PHP `pdo_pgsql`, `fileinfo`, `gd` et `exif` (selon formats d’image), Node/npm seulement si vous utilisez les outils Vite fournis; PostgreSQL accessible. FFmpeg/FFprobe est recommandé pour inspecter audio/vidéo.

À partir de la racine du dépôt:

```sh
cd backend
composer install
cp .env.example .env       # uniquement si .env n’existe pas
php artisan key:generate   # uniquement au premier démarrage
php artisan config:clear
php artisan route:list --path=api
php artisan serve --host=0.0.0.0 --port=8000
```

Dans un autre terminal, depuis la racine, lancer le client Expo. Référez-vous à [FRONTEND.md](../FRONTEND.md) pour `EXPO_PUBLIC_API_URL` selon navigateur, émulateur ou téléphone réel.

Vérifier la base:

```sh
curl -i http://127.0.0.1:8000/api/health
```

Une réponse `200` avec `{"status":"ok","database":"connected"}` confirme que Laravel exécute une requête PostgreSQL. `503` signifie que la connexion base/configuration n’est pas fonctionnelle.

Ne pas lancer `php artisan migrate` contre une base partagée avant d’avoir appliqué et vérifié les migrations SQL Supabase, contrôlé le plan de migration et créé une sauvegarde.

## Configuration

Copier `backend/.env.example` vers `backend/.env`, puis remplir localement. Ne jamais committer `.env`, clés SMTP, mots de passe PostgreSQL, jetons R2 ou clés de rôle Supabase.

### Application, réseau et CORS

| Variable | Usage |
| --- | --- |
| `APP_ENV`, `APP_DEBUG`, `APP_URL`, `APP_KEY` | Environnement et URL Laravel. `APP_DEBUG=false` en production; générer une clé unique. |
| `FRONTEND_URL` | Origine Expo Web utilisée par les liens de vérification. |
| `CORS_ALLOWED_ORIGINS` | Liste d’origines web exacte, séparée par des virgules. Pas nécessaire pour les appels natifs. |

### Supabase PostgreSQL

Configurer `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_SSLMODE=require`. Utiliser les paramètres actuels **Session pooler** affichés par Supabase (host et username exacts); ne pas recopier de mot de passe dans un fichier versionné. Les caractères spéciaux restent littéraux lorsque le mot de passe est une variable séparée. Pour `DB_URL`, encoder les caractères réservés.

### E-mail OTP

`MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`. Gmail nécessite un App Password actif et les exigences de compte Google. Après changement:

```sh
php artisan config:clear
php artisan queue:restart
```

Les messages d’inscription/récupération sont envoyés synchroniquement par `Mail::send`; pas de file e-mail dédiée dans le flux actuel. Inspecter `storage/logs/laravel.log` en cas d’échec, sans journaliser de code OTP ou secret.

### Stockage et traitement média

Valeurs principales (voir toutes les valeurs et défauts dans `.env.example` et `config/media.php`):

| Variable | Défaut / signification |
| --- | --- |
| `FILESYSTEM_DISK`, `MEDIA_DISK` | `local` en développement; choisir `r2` uniquement après configuration/validation. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Secrets et nom bucket R2; côté serveur seulement. |
| `R2_ENDPOINT` | Endpoint S3 au niveau du compte, sans suffixe `/app-media`; bucket configuré séparément. |
| `R2_REGION` | `auto`. |
| `R2_PUBLIC_BASE_URL` | Laisser vide pour la livraison privée actuelle. URL de livraison distincte de l’endpoint S3. |
| `MEDIA_*_MAX_BYTES`, `MEDIA_REQUEST_MAX_BYTES` | Limites fichiers et total; paramètres PHP/proxy doivent autoriser le même volume. |
| `MEDIA_IMAGE_*`, `MEDIA_AUDIO_*`, `MEDIA_VIDEO_*` | Profils, qualité, tailles, durées, seuils et comportement. |
| `FFMPEG_BINARY`, `FFPROBE_BINARY`, `MEDIA_REQUIRE_PROBE` | Exécutables inspection/transcodage; en production exiger inspection fonctionnelle. |

Ne pas mettre ces valeurs dans `EXPO_PUBLIC_*`. La configuration R2 n’est pas considérée validée tant qu’un test d’upload/lecture/suppression avec les identifiants déployés n’a pas réussi.

## Base de données Supabase

Le schéma SQL versionné est dans `../supabase/migrations/`; les fixtures locales sont dans `../supabase/seed.sql`. Appliquer les migrations dans l’ordre chronologique via Supabase CLI/SQL Editor selon la procédure du projet. L’identité Laravel, les données client, les demandes et leurs relations reposent sur les tables `users`, `profiles`, `addresses`, `service_requests`, `request_media`, `offers`, `technicians`, `appointments`, `notifications`, et les tables catalogue.

Avant base existante ou production:

1. Faire un backup Supabase.
2. Examiner chaque migration SQL et les contraintes/FK touchées.
3. Appliquer les migrations Supabase dans l’ordre; ne pas exécuter un reset de base hébergée.
4. Exécuter `php artisan migrate --pretend`, examiner, puis `php artisan migrate` seulement si le schéma de départ correspond.
5. Les données de démo sont facultatives et uniquement pour un projet de développement. `seed.sql` contient des profils/offres/demandes d’exemple; ce ne sont pas des professionnels ni disponibilités réels.

Certaines opérations utilisent des fonctions PostgreSQL (`create_service_request`, `cancel_service_request`, `accept_service_offer`, `mark_notification_read`). Elles font partie du contrat SQL: conserver leur signature et leurs règles ou mettre à jour Laravel et les migrations ensemble.

## API HTTP

Préfixe local: `http://127.0.0.1:8000/api`. Sauf mention contraire, les réponses sont JSON. Les routes protégées attendent `Authorization: Bearer <sanctum-token>`. Les erreurs de validation sont généralement HTTP `422` avec `message` et `errors`; les limites peuvent renvoyer `429`, l’absence d’accès `401/404`, et les conflits métier `409`.

### Routes publiques

| Méthode et chemin | But | Entrée / réponse |
| --- | --- | --- |
| `GET /health` | Vérifier l’API et PostgreSQL | `status`, `database`; code 503 si SQL indisponible. |
| `GET /catalog` | Catalogue | `categories`, `serviceTypes`, `serviceItems`, `technicians`. Les valeurs de techniciens sont fixtures/catalogue, pas dispatch réel. |
| `GET /media/{media}?signature=…&expires=…` | Diffuser un média signé temporaire | Route signée relative; option `variant=thumbnail`; support `Range`. Aucune authentification Bearer, signature obligatoire. |
| `POST /auth/register` | Démarrer inscription | `{name,email,phone?,password}`; limite 10/min + limite par adresse/IP. Retour 202 après acceptation SMTP; `409 account_exists` si e-mail déjà utilisé; 503 config/transport. |
| `POST /auth/verify-email` | Vérifier OTP | `{email,code}` (6 chiffres); retour token Sanctum + user après validation, 201. |
| `POST /auth/resend-signup` | Renvoyer OTP inscription | `{email}`; cooldown 60 s, limite route 5/min. Réponse neutre si aucune inscription en attente. |
| `POST /auth/login` | Connexion | `{email,password}`; token + user; limite 10/min et limitation supplémentaire des échecs. Compte non vérifié refusé. |
| `POST /auth/password/forgot` | Demander code de récupération | `{email}`; réponse neutre 202 pour ne pas révéler l’existence d’un compte. |
| `POST /auth/password/reset` | Définir nouveau mot de passe | `{email,code,password,password_confirmation}`; OTP 6 chiffres, expiration 10 min, limite essais. Invalide les anciens tokens. |

### Routes authentifiées

| Méthode et chemin | But | Entrée / effet |
| --- | --- | --- |
| `GET /me` | Profil courant | `{user}`. |
| `POST /auth/logout` | Révoquer le token courant | `{message}`. |
| `POST /auth/password/change` | Changer le mot de passe | `current_password`, `password`, `password_confirmation`. |
| `GET /me/bootstrap` | Charger l’état client | `user`, `profile`, `addresses`, `requests` (médias signés), `offers`, `notifications` (max 100), `appointments`; techniciens inclus par défaut, désactivables avec `?includeTechnicians=false`. |
| `PATCH /me/profile` | Modifier le profil | `{name,phone?,email?}`. Téléphone marocain normalisé; e-mail différent refusé sans flux de vérification dédié. |
| `GET /addresses` | Lister adresses propres au client | `{addresses}`. |
| `POST /addresses` | Ajouter adresse | `label`, `address`, `details?`, `latitude?`, `longitude?`; retourne 201. |
| `DELETE /addresses/{id}` | Supprimer adresse du client | 404 si absente/non possédée. |
| `POST /notifications/read` | Marquer toutes notifications lues | Utilise la fonction SQL sécurisée par utilisateur. |
| `POST /notifications/{id}/read` | Marquer une notification lue | Même logique pour une notification. |
| `GET /requests` | Lister demandes du client | `{requests}` et médias signés d’une heure. |
| `POST /requests` | Créer demande et joindre médias | `multipart/form-data`: champ `payload` JSON, `media[]` répété facultatif, `mediaMeta` JSON aligné par index. 201 avec demande. Limite 10/min. |
| `GET /requests/{id}` | Détail demande | Vérifie propriétaire; renvoie `request`, `offers`, `appointment`. |
| `POST /requests/{id}/cancel` | Annuler demande | Utilise la fonction SQL métier; les transitions interdites sont refusées par SQL. |
| `POST /requests/{requestId}/offers/{offerId}/accept` | Accepter une offre | Appelle la fonction SQL transactionnelle; la demande doit appartenir au client et rester éligible. |
| `PATCH /requests/{requestId}/appointment` | Replanifier | `{scheduledAt?,allDay}`; l’heure est requise si `allDay=false`; date doit être future. |
| `DELETE /requests/{requestId}/appointment` | Annuler rendez-vous | Met le rendez-vous en annulation, rouvre les offres et ajoute une notification. |

Exemple de création minimal:

```sh
curl -X POST "$API_URL/requests" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'payload={"categoryId":"plomberie","serviceTypes":["Lavabo"],"serviceItemIds":[],"urgency":"urgent","address":{"address":"Maarif, Casablanca"}}'
```

Le champ `payload` doit inclure `categoryId`, `urgency` (`urgent` ou `scheduled`) et `address.address`. Il accepte notamment `serviceTypes[]`, `serviceItemIds[]`, `customService`, `description` (max 5 000), `scheduledAt`, `allDay`, adresse et coordonnées. La validation du calendrier côté serveur ne valide pas exhaustivement toutes les combinaisons métier de schedule; le client doit fournir les champs cohérents.

## Authentification et e-mail OTP

- L’identifiant de compte actuel est **l’e-mail**, pas le téléphone. Le téléphone marocain est facultatif et normalisé sur le profil.
- Inscription valide nom, e-mail, mot de passe (8–128), téléphone optionnel; le code est généré côté serveur, hashé dans `pending_registrations`, expire après 10 minutes, maximum 5 essais et renvoi après 60 secondes.
- L’utilisateur n’est créé qu’après OTP valide; le compte reçoit `email_verified_at` et un token Sanctum.
- Le SMTP est utilisé directement dans la requête. Ne jamais révéler un code en réponse API ou l’écrire dans les logs.
- Connexion par e-mail/mot de passe uniquement. Les comptes non vérifiés sont rejetés.
- Réinitialisation: code hashé dans `password_reset_tokens`, durée de 10 minutes; un succès révoque les tokens existants.
- Le serveur ne reçoit jamais le mot de passe stocké depuis le client après la requête; il le hache avec Laravel.
- Les tokens sont stockés dans SecureStore natif et AsyncStorage web côté app.

Il n’existe actuellement ni authentification SMS, ni connexion téléphone/mot de passe, ni fournisseur d’identité externe. Utiliser un SMTP avec livraison réelle configurée; `MAIL_MAILER=log` convient seulement au développement et ne livre aucun e-mail.

## Upload et traitement des médias

Endpoint actuel: `POST /api/requests`; ce n’est pas un endpoint de téléversement isolé. Exemples de métadonnées en ordre correspondant aux fichiers:

```json
[{"type":"image","name":"fuite.jpg"},{"type":"video","name":"inspection.mov","durationMs":12000}]
```

Règles contrôleur: au plus 6 fichiers au total, 4 images, 1 vidéo, 1 audio; limite agrégée configurée à 220 MiB. Par défaut: image 20 MiB, audio 20 MiB, vidéo 100 MiB; vidéo 3 min, audio 60 min. Le service vérifie MIME détecté/signature et contenu, nettoie le nom de fichier et génère des clés UUID serveur. `mediaMeta.type` sert à déclarer le type attendu, mais ne remplace pas la détection serveur.

| Média | Traitement existant | Limites à retenir |
| --- | --- | --- |
| Image | Intervention Image/GD: orientation, limite dimensions/pixels, WebP dérivé si utile, miniature facultative. | JPEG/PNG/WebP/AVIF selon prise en charge GD. Images animées et profil sans perte gardent l’original. Pas de garantie que chaque fichier soit plus petit. |
| Audio | Préserve par défaut; FFprobe inspecte codecs/durée; profils optionnels Opus/AAC/FLAC. Sortie lossy choisie seulement si valide et utile. | Pas d’amélioration de qualité possible après compression source. FFmpeg/FFprobe requis pour inspection/transcodage fiable. |
| Vidéo | FFprobe; job Laravel optionnel pour MP4 H.264/AAC, validation avant remplacement, affiche miniature éventuelle. | Async désactivé par défaut. Vidéo originale conservée si FFmpeg absent/échec ou sortie non avantageuse. |

Le backend nettoie les fichiers temporaires et objets partiellement chargés lors d’échecs avant commit. Les grands traitements vidéo utilisent `OptimizeRequestVideo` quand `MEDIA_VIDEO_ASYNC=true`, seuils atteints et queue non synchrone. Les états/metadata sont enregistrés en base; consulter `GET /requests/{id}` pour le résultat.

**Écart actuel client/serveur:** `AppStore.publish` refuse un seul fichier supérieur à 50 MiB côté Expo alors que l’API autorise une vidéo jusqu’à 100 MiB. Ajuster ensemble client, PHP (`upload_max_filesize`, `post_max_size`), proxy et serveur avant d’utiliser des vidéos de plus de 50 MiB.

Les URLs médias sont des URL Laravel signées valides une heure, privées. Le contrôleur prend en charge les requêtes de plage pour lecture vidéo/audio. Ne pas exposer le bucket publiquement sans décider explicitement d’une politique de confidentialité.

## R2, files et planificateur

Pour R2, ajouter le disque `r2` aux variables serveur de `.env` et sélectionner `MEDIA_DISK=r2`. `R2_ENDPOINT` est l’endpoint API S3 au niveau du compte (sans bucket); `R2_BUCKET` est séparé. `R2_PUBLIC_BASE_URL` n’est pas l’endpoint S3 et n’est pas utilisé pour rendre les médias privés publics.

En production média:

```sh
php artisan queue:work --tries=3 --timeout=660
php artisan schedule:work   # développement; prod: scheduler standard toutes les minutes
```

La queue doit être persistante (pas `sync`) pour traiter les vidéos en arrière-plan. La commande planifiée `media:cleanup-orphans` purge objets R2 orphelins après la rétention configurée et anciens fichiers temporaires. Pour une vérification manuelle:

```sh
php artisan media:cleanup-orphans
```

En production configurer PHP et le proxy pour autoriser une requête jusqu’à 220 MiB, un `memory_limit` adapté, l’espace de travail temporaire, timeouts de worker suffisants, GD/EXIF et une build FFmpeg/FFprobe compatible. R2 nécessite credentials avec droits minimaux lecture/écriture sur le bucket. Aucun coût ou quota R2 n’est garanti ici; consulter le tarif Cloudflare actuel.

## Tests et qualité

Commandes depuis `backend/`:

```sh
php artisan test
vendor/bin/pint --test
composer validate --no-check-publish
php artisan route:list --path=api
```

Les tests présents couvrent flux auth, livraison signée/plage média, service upload et job vidéo simulé. Ils ne remplacent pas un test SMTP réel, une connexion Supabase/R2 réelle, un test de livraison en boîte de réception ou un essai de charge. Les tests médias utilisent des doubles/stockage de test, pas votre bucket de production.

## Limites connues et évaluation

**Évaluation indicative du backend: 7/10 pour un MVP local en cours d’intégration; pas une certification production.** Points positifs: séparation contrôleurs/services, validation, Sanctum, OTP hashé, transactions SQL, accès utilisateur, tests médias et URLs privées signées. Le score est réduit par l’absence de preuve de configuration externe réelle (Supabase/SMTP/R2), la livraison OTP synchrone, la dépendance à plusieurs fonctions SQL/migrations manuelles, la couverture de tests limitée à l’intégration locale simulée, et les écarts de limites client/serveur.

Limites à résoudre avant lancement:

- Configurer et tester les valeurs réelles Supabase + SMTP + R2 depuis l’environnement de déploiement; aucune connexion live n’est garantie par les fichiers versionnés.
- Créer/rotater tout secret précédemment partagé et conserver les nouveaux secrets hors Git.
- Prévoir monitoring, sauvegardes et procédure de restauration PostgreSQL, rétention des médias, alertes de queue, rate limit distribué/cache robuste et politique de suppression/conservation des données.
- Le catalogue, les avis/offres et disponibilité de démonstration ne signifient pas qu’un prestataire réel a été contacté. Paiements, dispatch, chat, SMS, push et support réel sont hors périmètre.
- La migration des identités peut nécessiter reconnexion des utilisateurs; suivre les notes du README racine et inspecter les migrations avant production.
- FFmpeg absent ou mal lié désactive l’optimisation utile; ne pas promettre conversion sans vérifier la build du serveur.
- Les utilisateurs sont email-first; changer cela vers téléphone exige une évolution coordonnée du schéma, des contraintes, du client et des endpoints.

Voir aussi [README général](../README.md) et [documentation frontend](../FRONTEND.md).
