import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { errorMessage, session } from '../api/client';
import { useI18n } from '../i18n';
import { radius, space, useTheme } from '../theme';
import { Button, ErrorNote, Icon, Input, Text } from '../ui';

interface Props {
  onSignedIn: () => void;
  /** Le profil exige d'activer la double authentification : écran web dédié (code QR). */
  onEnroll: () => void;
  onChangeServer: () => void;
}

/**
 * Connexion (charte HOTELIA, écran 1) : fond marine, logo, « Bienvenue ! », bouton or.
 * Mot de passe, puis code à 6 chiffres pour les profils soumis à la double authentification.
 */
export function SignInScreen({ onSignedIn, onEnroll, onChangeServer }: Props) {
  const { c } = useTheme();
  const { t, m } = useI18n();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (step === 'credentials') {
        const { step: next } = await session.login(email.trim(), password);
        if (next === 'mfa') setStep('mfa');
        else if (next === 'enroll') onEnroll();
        else onSignedIn();
      } else {
        await session.mfa(code);
        onSignedIn();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: c.navy900 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Fond marine : icônes claires dans la barre d'état. */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space[12], paddingBottom: insets.bottom + space[6] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('../../assets/hotelia-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="HOTELIA Management" />
        <View style={styles.heading}>
          <Text variant="display2" color="onDark" align="center" accessibilityRole="header">{m.welcome}</Text>
          <Text variant="bodyLg" color="gray400" align="center">{step === 'mfa' ? t.mfaHelp : m.signInHelp}</Text>
        </View>

        <View style={[styles.form, { backgroundColor: c.surface }]}>
          {step === 'credentials' ? (
            <>
              <Input
                label={t.email}
                icon={Mail}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                ltr
              />
              <Input
                ref={passwordRef}
                label={t.password}
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                ltr
                accessory={
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? m.hidePassword : m.showPassword}
                    hitSlop={12}
                  >
                    <Icon icon={showPassword ? EyeOff : Eye} color="textMuted" />
                  </Pressable>
                }
              />
            </>
          ) : (
            <Input
              label={t.mfaTitle}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="go"
              onSubmitEditing={submit}
              autoFocus
              ltr
            />
          )}
          <ErrorNote message={error} />
          <Button
            label={step === 'mfa' ? t.mfaVerify : busy ? t.signingIn : t.signIn}
            onPress={submit}
            loading={busy}
            disabled={step === 'credentials' ? !email || !password : code.length !== 6}
            size="lg"
            fullWidth
          />
          {step === 'mfa' && <Button label={t.back} variant="ghost" onPress={() => { setStep('credentials'); setCode(''); setError(null); }} />}
        </View>

        <Pressable onPress={onChangeServer} accessibilityRole="button" style={styles.link}>
          <Text color="gray400" style={styles.underline}>{t.changeServer}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, paddingHorizontal: space[4], gap: space[6], maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { width: 175, height: 150, alignSelf: 'center' },
  heading: { gap: space[2] },
  form: { borderRadius: radius.lg, padding: space[4], gap: space[4] },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space[3] },
  underline: { textDecorationLine: 'underline' },
});
