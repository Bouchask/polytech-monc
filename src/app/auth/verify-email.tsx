import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, C, Field, Header, Screen } from '../../components/ui';
import { useAppStore } from '../../store/AppStore';

const RESEND_SECONDS = 60;

function verificationMessage(error: unknown) {
  const cause = error as (Error & { code?: string }) | null;
  if (/error sending confirmation email|smtp|email.*send/i.test(cause?.message ?? '')) {
    return 'Le backend n’a pas pu envoyer le code. Vérifiez sa configuration SMTP puis réessayez.';
  }
  if (/expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(cause?.message ?? '')) {
    return 'Ce code est invalide ou expiré. Vérifiez le dernier e-mail reçu ou demandez un nouveau code.';
  }
  return cause?.message || 'La vérification a échoué. Réessayez.';
}

export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string; returnTo?: string }>();
  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const returnTo = params.returnTo === 'summary' ? 'summary' : 'home';
  const { verifyEmailSignup, resendEmailSignup } = useAppStore();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempts, setAttempts] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const submit = async () => {
    if (inFlight.current || busy || resending) return;
    setError('');
    if (!/^\d{6}$/.test(code)) { setError('Saisissez les 6 chiffres du code reçu par e-mail.'); return; }
    if (attempts >= 5) { setError('Trop de codes incorrects. Demandez un nouveau code.'); return; }
    inFlight.current = true;
    setBusy(true);
    try {
      await verifyEmailSignup(email, code);
      router.replace(returnTo === 'summary' ? '/booking/summary' : '/(tabs)');
    } catch (cause) {
      setAttempts(value => value + 1);
      setError(verificationMessage(cause));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resending || busy || seconds > 0 || !email) return;
    setError('');
    setNotice('');
    setResending(true);
    try {
      await resendEmailSignup(email);
      setSeconds(RESEND_SECONDS);
      setAttempts(0);
      setCode('');
      setNotice('Demande reçue. Un code sera envoyé si une inscription est en attente. Si vous avez déjà un compte, connectez-vous ou réinitialisez votre mot de passe.');
    } catch (cause) {
      setError(verificationMessage(cause));
    } finally { setResending(false); }
  };

  if (!email) {
    return <Screen>
      <Header title="Vérifier mon e-mail" />
      <Text style={{ color: C.text, lineHeight: 22, marginBottom: 16 }}>L’adresse e-mail est manquante. Recommencez l’inscription.</Text>
      <Button title="Retour à l’inscription" onPress={() => router.replace('/auth/register')} />
    </Screen>;
  }

  return <Screen>
    <Header title="Vérifier mon e-mail" />
    <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: '#E4F3FA', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
      <Ionicons name="mail-unread-outline" size={27} color={C.blue} />
    </View>
    <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '800', color: C.navy, marginBottom: 8 }}>Confirmez votre adresse</Text>
    <Text style={{ fontSize: 15, color: C.muted, lineHeight: 22, marginBottom: 20 }}>
      Si une inscription est en attente, saisissez le code envoyé à <Text style={{ color: C.text, fontWeight: '700' }}>{email}</Text>. Si aucun message n’arrive, essayez la connexion ou la récupération du mot de passe.
    </Text>
    <Field label="Code à 6 chiffres" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" keyboardType="number-pad" autoCapitalize="none" />
    {!!notice && <Text accessibilityRole="status" style={{ color: C.green, fontSize: 13, lineHeight: 19, marginTop: -8, marginBottom: 12 }}>{notice}</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: C.red, marginBottom: 12, lineHeight: 19 }}>{error}</Text>}
    {attempts > 0 && <Text style={{ color: C.muted, fontSize: 12, marginTop: -8, marginBottom: 12 }}>{Math.max(0, 5 - attempts)} tentative(s) restante(s).</Text>}
    <Button title="Vérifier le code" loading={busy} disabled={attempts >= 5 || resending} onPress={submit} />
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: seconds > 0 || resending || busy }} disabled={seconds > 0 || resending || busy} onPress={resend} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
      <Text style={{ color: seconds > 0 || resending || busy ? C.muted : C.blue, fontWeight: '700', textAlign: 'center' }}>
        {resending ? 'Envoi en cours…' : seconds > 0 ? `Renvoyer le code dans 0:${String(seconds).padStart(2, '0')}` : 'Renvoyer le code'}
      </Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: C.muted, textAlign: 'center' }}>Reprendre l’inscription</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/auth/login')} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: C.blue, textAlign: 'center', fontWeight: '700' }}>Se connecter</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/auth/forgot')} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: C.blue, textAlign: 'center', fontWeight: '700' }}>Mot de passe oublié ?</Text>
    </Pressable>
  </Screen>;
}
