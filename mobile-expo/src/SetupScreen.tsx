import { Globe } from 'lucide-react-native';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { T } from './i18n/launcher';
import { checkServer, DEFAULT_SERVER, normalizeServer, saveServer } from './server';
import { radius, space, useTheme } from './theme';
import { Button, ErrorNote, Input, Text } from './ui';

interface Props {
  /** Adresse enregistrée, proposée pour modification. */
  initial: string | null;
  onDone: (origin: string) => void;
  /** Retour au serveur actuel sans changement (absent au premier lancement). */
  onCancel?: () => void;
}

/**
 * Adresse du serveur de l'hôtel, au premier lancement ou depuis le profil : vérifiée (manifeste
 * de l'application) avant d'être enregistrée. Même présentation que la connexion.
 */
export function SetupScreen({ initial, onDone, onCancel }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initial ?? DEFAULT_SERVER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || !value.trim()) return;
    setError(null);
    const origin = normalizeServer(value);
    if (!origin) {
      setError(T.invalid);
      return;
    }
    setBusy(true);
    const result = await checkServer(origin);
    setBusy(false);
    if (result !== 'ok') {
      setError(T[result]);
      return;
    }
    await saveServer(origin);
    onDone(origin);
  };

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: c.navy900 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Fond marine : icônes claires dans la barre d'état. */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space[12], paddingBottom: insets.bottom + space[6] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('../assets/hotelia-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="HOTELIA Management" />
        <View style={styles.heading}>
          <Text variant="title1" color="onDark" align="center" accessibilityRole="header">{T.title}</Text>
          <Text color="gray400" align="center">{T.intro}</Text>
        </View>
        <View style={[styles.form, { backgroundColor: c.surface }]}>
          <Input
            label={T.label}
            icon={Globe}
            value={value}
            onChangeText={setValue}
            onSubmitEditing={submit}
            placeholder="https://pms.mon-hotel.com"
            hint={T.hint}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="url"
            returnKeyType="go"
            ltr
            testID="server-input"
          />
          <ErrorNote message={error} />
          <Button label={busy ? T.connecting : T.connect} onPress={submit} loading={busy} disabled={!value.trim()} size="lg" fullWidth />
          {onCancel && <Button label={T.cancel} variant="ghost" onPress={onCancel} />}
        </View>
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
});
