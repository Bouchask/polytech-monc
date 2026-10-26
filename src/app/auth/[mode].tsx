import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/AppStore';
import { C, Card, Field, Header, Screen, Button } from '../../components/ui';
import { normalizeMoroccanMobile } from '../../utils/moroccanPhone';

function authMessage(error: unknown) {
  const cause = error as (Error & { code?: string }) | null;
  if (/error sending confirmation email|smtp|email.*send/i.test(cause?.message ?? '')) {
    return 'Le backend n’a pas pu envoyer le code. Vérifiez sa configuration SMTP puis réessayez.';
  }
  if (cause?.code === 'invalid_credentials') return 'Identifiant ou mot de passe incorrect.';
  if (/expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(cause?.message ?? '')) return 'Ce code est invalide ou expiré. Vérifiez le code reçu ou demandez-en un nouveau.';
  return cause?.message || 'Connexion impossible. Vérifiez vos informations puis réessayez.';
}

export default function Auth() {
  const { mode, returnTo, email: emailParam } = useLocalSearchParams<{ mode: string; returnTo?: string; email?: string }>();
  const { user, signIn, signUp, updateUser, requestPasswordReset, resetPassword } = useAppStore();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? (typeof emailParam === 'string' ? emailParam : ''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const isEdit = mode === 'edit-profile';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const title = isEdit ? 'Modifier mon profil' : isRegister ? 'Créer un compte' : isForgot ? 'Réinitialiser le mot de passe' : 'Se connecter';
  const submit = async () => {
    setError('');
    if (isForgot) {
      if (!email.trim()) { setError('Saisissez l’adresse e-mail associée à votre compte.'); return; }
      setBusy(true);
      try {
        if (!recoverySent) {
          await requestPasswordReset(email.trim());
          setRecoverySent(true);
        } else {
          if (!/^\d{6}$/.test(recoveryCode)) { setError('Saisissez le code à 6 chiffres reçu par e-mail.'); return; }
          if (recoveryPassword.length < 8) { setError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return; }
          if (recoveryPassword !== recoveryConfirm) { setError('Les mots de passe ne correspondent pas.'); return; }
          await resetPassword(email.trim(), recoveryCode, recoveryPassword);
          router.replace('/auth/login');
        }
      }
      catch (cause) { setError(authMessage(cause)); }
      finally { setBusy(false); }
      return;
    }
    if (isEdit) {
      if (name.trim().length < 2) { setError('Entrez votre nom complet.'); return; }
      setBusy(true);
      try { await updateUser({ name: name.trim(), phone, email: email.trim() || undefined }); router.back(); }
      catch (cause) { setError(authMessage(cause)); }
      finally { setBusy(false); }
      return;
    }
    if ((!isRegister && !email.trim()) || (isRegister ? password.length < 8 : !password.length)) { setError(isRegister ? 'Entrez votre adresse e-mail et un mot de passe d’au moins 8 caractères.' : 'Entrez votre adresse e-mail et votre mot de passe.'); return; }
    if (isRegister && name.trim().length < 2) { setError('Entrez votre nom complet.'); return; }
    if (isRegister) {
      if (!email.trim()) { setError('Saisissez votre adresse e-mail.'); return; }
      if (phone.trim()) {
        try { normalizeMoroccanMobile(phone); }
        catch (cause) { setError(authMessage(cause)); return; }
      }
      if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    }
    setBusy(true);
    try {
      if (isRegister) {
        const normalizedPhone = phone.trim() ? normalizeMoroccanMobile(phone) : undefined;
        await signUp({ name, phone: normalizedPhone, email: email.trim(), password });
        router.push({ pathname: '/auth/verify-email', params: { email: email.trim().toLowerCase(), returnTo: returnTo === 'summary' ? 'summary' : 'home' } });
      } else {
        await signIn({ email: email.trim(), password });
        router.replace(returnTo === 'summary' ? '/booking/summary' : '/(tabs)');
      }
    } catch (cause) {
      const apiError = cause as (Error & { code?: string }) | null;
      if (isRegister && apiError?.code === 'account_exists') {
        setExistingAccount(true);
      } else {
        setError(authMessage(cause));
      }
    } finally { setBusy(false); }
  };

  return <Screen>
    <Header title={title} />
    {isForgot ? <>
      <Text style={{ color: C.muted, lineHeight: 21, marginBottom: 18 }}>Un code de vérification sera envoyé à l’adresse e-mail associée à votre compte.</Text>
      <Field label="Adresse e-mail" value={email} onChangeText={setEmail} placeholder="vous@exemple.ma" keyboardType="email-address" autoCapitalize="none" />
      {recoverySent && <>
        <Card style={{ backgroundColor: '#E7F5EF' }}><Text style={{ color: C.green, fontWeight: '700' }}>Si cette adresse correspond à un compte, un code a été envoyé. Vérifiez votre boîte mail.</Text></Card>
        <Field label="Code à 6 chiffres" value={recoveryCode} onChangeText={value => setRecoveryCode(value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" keyboardType="number-pad" />
        <Field label="Nouveau mot de passe" value={recoveryPassword} onChangeText={setRecoveryPassword} placeholder="8 caractères minimum" secureTextEntry />
        <Field label="Confirmer le mot de passe" value={recoveryConfirm} onChangeText={setRecoveryConfirm} placeholder="Répétez le mot de passe" secureTextEntry />
      </>}
      {!!error && <Text accessibilityRole="alert" style={{ color: C.red, marginBottom: 12 }}>{error}</Text>}
      <Button title={recoverySent ? 'Changer le mot de passe' : 'Envoyer le code'} loading={busy} onPress={submit} />
    </> : <>
      <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: '#E4F3FA', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Ionicons name="shield-checkmark-outline" size={27} color={C.blue} /></View>
      <Text style={{ fontSize: 14, color: C.muted, lineHeight: 21, marginBottom: 20 }}>{isEdit ? 'Mettez à jour les informations de votre compte.' : 'Votre compte et vos demandes sont enregistrés dans la base Palesso.'}</Text>
      {(isRegister || isEdit) && <Field label={isRegister ? 'Nom complet *' : 'Nom complet'} value={name} onChangeText={setName} placeholder="Votre nom" />}
      {(isRegister || isEdit) && <Field label="Téléphone mobile (facultatif)" value={phone} onChangeText={setPhone} placeholder="06 12 34 56 78" keyboardType="phone-pad" autoCapitalize="none" />}
      {(isRegister || isEdit || !isForgot) && <Field label={isEdit ? 'E-mail' : isRegister ? 'E-mail *' : 'Adresse e-mail'} value={email} onChangeText={value => { setEmail(value); setExistingAccount(false); setError(''); }} placeholder="vous@exemple.ma" keyboardType="email-address" autoCapitalize="none" />}
      {!isEdit && <Field label={isRegister ? 'Mot de passe * (8 caractères minimum)' : 'Mot de passe'} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry={!showPassword} right={<Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} hitSlop={8} onPress={() => setShowPassword(value => !value)}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} /></Pressable>} />}
      {isRegister && <Field label="Confirmer le mot de passe *" value={confirm} onChangeText={setConfirm} placeholder="••••••••" secureTextEntry={!showPassword} />}
      {isRegister && <Text style={{ fontSize: 12, color: C.muted, marginTop: -8, marginBottom: 8 }}>En créant un compte, vous acceptez les conditions d’utilisation.</Text>}
      {isRegister && existingAccount && <Card style={{ marginTop: 4, borderColor: '#B9DDF1', backgroundColor: '#F0F8FD' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#DDEFF9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="person-circle-outline" size={24} color={C.blue} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.navy, fontSize: 16, lineHeight: 21, fontWeight: '800' }}>Cette adresse a déjà un compte</Text>
            <Text style={{ color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5 }}>Connectez-vous avec vos identifiants ou récupérez l’accès à votre compte.</Text>
          </View>
        </View>
        <Button title="Se connecter" icon="log-in-outline" onPress={() => router.replace({ pathname: '/auth/[mode]', params: { mode: 'login', email: email.trim().toLowerCase() } })} />
        <Button title="Mot de passe oublié ?" icon="key-outline" secondary onPress={() => router.replace({ pathname: '/auth/[mode]', params: { mode: 'forgot', email: email.trim().toLowerCase() } })} />
      </Card>}
      {!isRegister && !isEdit && <Text onPress={() => router.push('/auth/forgot')} style={{ color: C.blue, fontWeight: '700', textAlign: 'right', marginBottom: 8 }}>Mot de passe oublié ?</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: C.red, marginBottom: 12, lineHeight: 19 }}>{error}</Text>}
      {!(isRegister && existingAccount) && <Button title={isEdit ? 'Enregistrer' : isRegister ? 'Recevoir mon code par e-mail' : 'Se connecter'} loading={busy} onPress={submit} />}
      {!isEdit && !(isRegister && existingAccount) && <>
        <Text style={{ color: C.muted, textAlign: 'center', marginTop: 20 }}>{isRegister ? 'Déjà un compte ?' : 'Nouveau sur Palesso ?'} <Text onPress={() => router.replace(isRegister ? '/auth/login' : '/auth/register')} style={{ color: C.blue, fontWeight: '800' }}>{isRegister ? 'Se connecter' : 'Créer un compte'}</Text></Text>
        {!isRegister && <Card style={{ marginTop: 24, backgroundColor: '#F6F9FB' }}>
          <Text style={{ fontWeight: '800', color: C.navy }}>Compte de démonstration local</Text>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 5, lineHeight: 18 }}>E-mail : samira.demo@palesso.test{ '\n' }Mot de passe : PalessoDemo2026!</Text>
          <Text style={{ fontSize: 11, color: C.muted, marginTop: 7 }}>Disponible après insertion des données de démonstration dans la base connectée.</Text>
        </Card>}
      </>}
    </>}
  </Screen>;
}
