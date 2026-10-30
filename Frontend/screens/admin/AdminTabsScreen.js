// ADMIN shell: renders the active tab's content and ALWAYS shows the
// AdminBottomNav footer. The center QR button opens the camera.

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import AdminBottomNav, { ADMIN_TABS } from '../../components/common/AdminBottomNav';
import QRScanner from '../../components/common/QRScanner';
import { useTranslation } from '../../i18n/I18nContext';
import AdminQRTab from './AdminQRTab';

function PlaceholderTab({ title }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>{t('admin.comingSoon')}</Text>
    </View>
  );
}

function ProfileTab({ user, onLogout }) {
  const { t } = useTranslation();
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'A';
  return (
    <View style={styles.profile}>
      <TouchableOpacity onPress={onLogout} hitSlop={10}>
        <Text style={styles.logout}>{t('user.settings.logoutButton')}</Text>
      </TouchableOpacity>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      </View>
      <View style={styles.profileInfo}>
        <Text style={styles.name}>{[user?.firstName, user?.lastName].filter(Boolean).join(' ') || t('admin.profile.admin')}</Text>
        {!!user?.email && <Text style={styles.email}>{user.email}</Text>}
        <Text style={styles.role}>{t('admin.profile.admin')}</Text>
      </View>
    </View>
  );
}

export default function AdminTabsScreen({ user, onLogout }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(ADMIN_TABS.BRIEFCASE);
  const [scanning, setScanning] = useState(false);
  const [scanKey, setScanKey] = useState(0); // remount QRScanner to scan again
  const [scanResult, setScanResult] = useState(null); // { type, message }
  const machinesRef = useRef([]);

  const onMachinesLoaded = useCallback((list) => { machinesRef.current = list; }, []);

  const closeScanner = () => { setScanning(false); setScanResult(null); };
  const scanAgain = () => { setScanResult(null); setScanKey((k) => k + 1); };

  // Admins scanning a code should NOT hit POST /qr/scan: that would register
  // a real check-in / machine usage for the admin account. We only decode
  // the payload locally and tell the admin what it is.
  const handleScanned = (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (data?.type === 'ENTRY_EXIT') {
      return setScanResult({ type: 'success', message: t('admin.scan.entryExit') });
    }
    if (data?.type === 'MACHINE') {
      const m = machinesRef.current.find((x) => x.id === data.machineId);
      if (!m) return setScanResult({ type: 'error', message: t('admin.scan.machineUnknown') });
      const valid = !data.qrToken || m.qrToken === data.qrToken;
      return setScanResult(
        valid
          ? { type: 'success', message: t('admin.scan.machine', { name: m.name }) }
          : { type: 'error', message: t('admin.scan.machineOutdated', { name: m.name }) }
      );
    }
    if (data?.type === 'USER') {
      return setScanResult({ type: 'success', message: t('admin.scan.user') });
    }
    setScanResult({ type: 'error', message: t('admin.scan.unknown') });
  };

  let content;
  if (tab === ADMIN_TABS.BRIEFCASE) content = <AdminQRTab onMachinesLoaded={onMachinesLoaded} />;
  else if (tab === ADMIN_TABS.HOME) content = <PlaceholderTab title={t('admin.tabs.home')} />;
  else if (tab === ADMIN_TABS.TRAINING) content = <PlaceholderTab title={t('admin.tabs.training')} />;
  else content = <ProfileTab user={user} onLogout={onLogout} />;

  return (
    <View style={styles.container}>
      <View style={styles.body}>{content}</View>

      <AdminBottomNav active={tab} onSelect={setTab} onScanQR={() => setScanning(true)} />

      <Modal visible={scanning} animationType="slide" onRequestClose={closeScanner}>
        <View style={styles.scanner}>
          <QRScanner key={scanKey} onScanned={handleScanned} onClose={closeScanner} />
          {scanResult && (
            <View style={styles.resultBar}>
              <Text style={[styles.resultText, scanResult.type === 'error' ? styles.error : styles.success]}>
                {scanResult.message}
              </Text>
              <TouchableOpacity style={styles.resultBtn} onPress={scanAgain}>
                <Text style={styles.resultBtnLabel}>{t('admin.scan.again')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: globals.spacing.lg },
  placeholderTitle: { fontSize: globals.fontSize.xl, fontWeight: 'bold', color: globals.colors.text },
  placeholderText: { marginTop: globals.spacing.sm, color: globals.colors.textMuted },
  profile: { flex: 1, padding: globals.spacing.md, paddingTop: globals.spacing.lg },
  logout: { fontSize: globals.fontSize.md, color: globals.colors.text },
  avatarWrap: { position: 'absolute', top: globals.spacing.md, right: globals.spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: globals.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: globals.fontSize.lg, fontWeight: 'bold' },
  profileInfo: { marginTop: globals.spacing.xl * 2, alignItems: 'center' },
  name: { fontSize: globals.fontSize.xl, fontWeight: 'bold', color: globals.colors.text },
  email: { marginTop: globals.spacing.xs, color: globals.colors.textMuted },
  role: { marginTop: globals.spacing.sm, color: globals.colors.primary, fontWeight: '600' },
  scanner: { flex: 1, backgroundColor: '#000' },
  resultBar: { backgroundColor: globals.colors.secondary, padding: globals.spacing.lg, alignItems: 'center' },
  resultText: { textAlign: 'center', marginBottom: globals.spacing.sm, fontWeight: '600' },
  error: { color: globals.colors.danger },
  success: { color: globals.colors.primary },
  resultBtn: { backgroundColor: globals.colors.primary, paddingVertical: globals.spacing.sm, paddingHorizontal: globals.spacing.lg, borderRadius: globals.radius.md },
  resultBtnLabel: { color: '#fff', fontWeight: '600' },
});
