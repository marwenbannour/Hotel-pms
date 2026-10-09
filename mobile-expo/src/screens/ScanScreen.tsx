import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { setStatusBarStyle } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { roomErrorMessage, useRooms, useRoomStatus, useTypeCodes } from '../api/hotel';
import type { Room } from '../api/types';
import { useI18n } from '../i18n';
import { radius, space, useTheme } from '../theme';
import { Button, ErrorNote, Input, Text, Toast } from '../ui';
import { RoomSheet } from './RoomSheet';

/**
 * Contenu attendu d'un code QR de chambre : « hotelpms://room/204 » (ou une adresse qui finit
 * par /room/204 ou /rooms/204). Un numéro seul (« 204 ») est accepté aussi.
 */
export function roomNumberFromQr(data: string): string | null {
  const value = data.trim();
  const m = /(?:^|\/)rooms?\/([A-Za-z0-9-]{1,10})\/?$/i.exec(value) ?? /^([A-Za-z0-9-]{1,10})$/.exec(value);
  return m ? m[1] : null;
}

/** Scanner QR (charte HOTELIA, écran 5) : le code d'une chambre ouvre ses actions. */
export function ScanScreen() {
  const { c } = useTheme();
  const { m, h } = useI18n();
  const focused = useIsFocused();
  const { name: themeName } = useTheme();
  // Fond marine : icônes claires dans la barre d'état tant que l'onglet est affiché.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(themeName === 'dark' ? 'light' : 'dark');
    }, [themeName]),
  );
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const rooms = useRooms();
  const typeCode = useTypeCodes();
  const [room, setRoom] = useState<Room | null>(null);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const lastScan = useRef<{ data: string; at: number } | null>(null);
  const change = useRoomStatus((r) => {
    setError(null);
    setDone(h.done[r.status](r.number));
    setTimeout(() => setDone(null), 4000);
  });

  const open = (number: string | null) => {
    const found = number ? rooms.data?.find((r) => r.number.toLowerCase() === number.toLowerCase()) : undefined;
    if (!found) {
      setError(m.scanUnknown);
      return;
    }
    setError(null);
    setRoom(found);
  };

  const onScanned = ({ data }: { data: string }) => {
    // Le même code reste devant la caméra : un seul déclenchement toutes les 3 secondes.
    const now = Date.now();
    if (room || (lastScan.current && lastScan.current.data === data && now - lastScan.current.at < 3000)) return;
    lastScan.current = { data, at: now };
    open(roomNumberFromQr(data));
  };

  const granted = permission?.granted;
  return (
    <View style={[styles.flex, { backgroundColor: c.navy900 }]}>
      {granted && focused ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
      ) : null}
      <View style={[styles.overlay, { paddingTop: insets.top + space[4] }]}>
        <Text color="onDark" align="center" variant="bodyLg">{granted ? m.scanHelp : m.scanPermission}</Text>
        {granted ? (
          <View style={[styles.frame, { borderColor: c.accent }]} accessibilityElementsHidden />
        ) : permission?.canAskAgain !== false ? (
          <Button label={m.scanAllow} onPress={requestPermission} />
        ) : (
          <Text color="gray400" align="center">{m.scanDenied}</Text>
        )}
        <View style={[styles.manual, { backgroundColor: c.surface }]}>
          <Input label={m.roomNumber} value={manual} onChangeText={setManual} keyboardType="default" autoCapitalize="none" returnKeyType="go" onSubmitEditing={() => open(manual)} ltr />
          <ErrorNote message={error} />
          <Button label={m.openRoom} variant="secondary" onPress={() => open(manual)} disabled={!manual.trim()} fullWidth />
        </View>
      </View>
      {done ? <Toast message={done} /> : null}
      <RoomSheet
        room={room}
        typeCode={room ? typeCode.get(room.roomTypeId) : undefined}
        onClose={() => setRoom(null)}
        onPick={(r, next) => {
          setRoom(null);
          change.mutate({ room: r, status: next }, { onError: (e) => setError(roomErrorMessage(e, h.conflict)) });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: space[6], padding: space[4], paddingBottom: space[6] },
  frame: { width: 220, height: 220, borderRadius: radius.xl, borderWidth: 3 },
  manual: { alignSelf: 'stretch', padding: space[4], borderRadius: radius.lg, gap: space[3] },
});
