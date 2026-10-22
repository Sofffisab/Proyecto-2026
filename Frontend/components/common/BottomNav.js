import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * BottomNav — the app's persistent footer bar.
 *
 * It always has the same 5 buttons pointing at the same 5 destinations:
 *   calendar -> onGoToCalendar
 *   home     -> onGoToHome
 *   (center) -> onScanQR      (opens the QR scanner)
 *   trophy   -> onGoToAchievements
 *   profile  -> onGoToProfile
 *
 * Rather than every screen re-declaring this row (icons + styles +
 * navigation wiring), screens just render <BottomNav /> and pass:
 *   - `active`: which tab this screen IS (so it renders highlighted and
 *     non-pressable instead of navigating to itself), one of
 *     'calendar' | 'home' | 'trophy' | 'profile' (omit if none apply).
 *   - the handler(s) for the other tabs. Any handler that's omitted is
 *     simply rendered disabled instead of crashing.
 *
 * Visual design (Figma): white bar, outlined grey icons, the active tab
 * in teal with a thin teal underline, and a larger teal QR button in the
 * middle.
 *
 * Example (from ProfileScreen, since "profile" IS this screen):
 *   <BottomNav
 *     active="profile"
 *     onGoToHome={onGoToHome}
 *     onGoToAchievements={onGoToAchievementsGoals}
 *     onScanQR={() => setShowScanQR(true)}
 *   />
 */
export default function BottomNav({
  active,
  onGoToCalendar,
  onGoToHome,
  onScanQR,
  onGoToAchievements,
  onGoToProfile,
}) {
  return (
    <View style={styles.footer}>
      <NavIcon
        source={require('../../assets/Imagen.png')}
        isActive={active === 'calendar'}
        onPress={onGoToCalendar}
      />
      <NavIcon
        source={require('../../assets/Vector (3).png')}
        isActive={active === 'home'}
        onPress={onGoToHome}
      />
      <TouchableOpacity style={styles.circulo} onPress={onScanQR} disabled={!onScanQR}>
        <Image source={require('../../assets/boxicons_qr-scan.png')} style={styles.qr} />
      </TouchableOpacity>
      <NavIcon
        source={require('../../assets/proicons_trophy.png')}
        isActive={active === 'trophy'}
        onPress={onGoToAchievements}
      />
      <NavIcon
        source={require('../../assets/nav_profile.png')}
        isActive={active === 'profile'}
        onPress={onGoToProfile}
      />
    </View>
  );
}

// A single footer icon. The tab that matches the current screen (`active`)
// is shown teal with an underline and isn't pressable — same behavior the
// original per-screen footers had for "the icon of the screen you're
// already on".
function NavIcon({ source, isActive, onPress }) {
  const icon = (
    <View style={styles.iconWrap}>
      <Image
        source={source}
        style={[styles.footerImg, isActive && styles.footerImgActive]}
      />
      <View style={[styles.underline, isActive && styles.underlineActive]} />
    </View>
  );
  if (isActive) return icon;
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    height: 84,
    paddingHorizontal: 6,
    backgroundColor: globals.colors.surface,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  footerImg: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  footerImgActive: {
    tintColor: globals.colors.primary,
  },
  underline: {
    marginTop: 6,
    height: 2,
    width: 32,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: globals.colors.primary,
  },
  circulo: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 68,
    width: 68,
    marginBottom: 6,
    backgroundColor: globals.colors.primary,
    borderRadius: 34,
    ...globals.shadow.button,
  },
  qr: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
});
