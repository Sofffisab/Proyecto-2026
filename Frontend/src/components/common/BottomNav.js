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
        source={require('../../assets/Group 49.png')}
        isActive={active === 'profile'}
        onPress={onGoToProfile}
      />
    </View>
  );
}

// A single footer icon. The tab that matches the current screen (`active`)
// is shown highlighted and isn't pressable — same behavior the original
// per-screen footers had for "the icon of the screen you're already on".
function NavIcon({ source, isActive, onPress }) {
  if (isActive) {
    return <Image source={source} style={[styles.footerImg, styles.footerImgActive]} />;
  }
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <Image source={source} style={styles.footerImg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    height: 75,
    backgroundColor: globals.colors.badge,
  },
  footerImg: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  footerImgActive: {
    tintColor: globals.colors.primary,
  },
  circulo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    width: 60,
    backgroundColor: globals.colors.primary,
    borderRadius: 30,
  },
  qr: {
    width: 35,
    height: 35,
  },
});
