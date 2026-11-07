import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Scrollable body used by every trainer screen: big bold title, optional
 * grey caption under it, then the screen's content. The footer lives outside
 * (TrainerTabsScreen), so this only has to scroll.
 */
export default function ScreenBody({ title, subtitle, children }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.children}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: globals.spacing.md,
    paddingTop: globals.spacing.md,
    paddingBottom: globals.spacing.xl,
  },
  title: { fontSize: globals.fontSize.xl, fontWeight: '700', color: globals.colors.text },
  subtitle: {
    marginTop: globals.spacing.xs,
    fontSize: globals.fontSize.md,
    color: globals.colors.captionGrey,
  },
  children: { marginTop: globals.spacing.md },
});
