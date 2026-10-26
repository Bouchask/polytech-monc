<!doctype html>
<html lang="fr">
<body style="font-family:Arial,sans-serif;color:#183247;line-height:1.6">
  <h2>{{ $purpose === 'reset' ? 'Réinitialisez votre mot de passe' : 'Confirmez votre adresse e-mail' }}</h2>
  <p>Votre code Palesso :</p>
  <p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#147FC1">{{ $code }}</p>
  <p>Ce code expire dans 10 minutes. Si vous n’avez pas demandé ce code, ignorez cet e-mail.</p>
</body>
</html>
