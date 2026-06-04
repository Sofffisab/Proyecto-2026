import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Text, TouchableOpacity } from 'react-native';
import globals from '../styles/globals';

console.log('[v0] WireframeScreen loaded');

const Header = ({ pageTitle }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{pageTitle}</Text>
  </View>
);

const Card = ({ title, content, isInteractive, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={onPress}
    disabled={!isInteractive}
    activeOpacity={isInteractive ? 0.7 : 1}
  >
    {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
    <Text style={styles.cardContent}>{content}</Text>
  </TouchableOpacity>
);

const Footer = ({ buttons, show }) => {
  if (!show) return null;
  return (
    <View style={styles.footer}>
      {buttons.map((btn, i) => (
        <TouchableOpacity key={i} style={styles.footerBtn} onPress={btn.onPress}>
          <Text style={styles.footerBtnText}>{btn.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const WireframeScreen = () => {
  console.log('[v0] WireframeScreen rendering');
  const [showFooter, setShowFooter] = useState(true);

  const footerButtons = [
    { label: 'Home', onPress: () => Alert.alert('Home') },
    { label: 'Profile', onPress: () => Alert.alert('Profile') },
    { label: 'Settings', onPress: () => Alert.alert('Settings') },
  ];

  return (
    <View style={styles.wrapper}>
      <Header pageTitle="Dashboard" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Card
          title="Static Card"
          content="This card displays static information only."
        />
        <Card
          title="Interactive Card"
          content="Tap to trigger an action."
          isInteractive
          onPress={() => Alert.alert('Pressed', 'This is an interactive card.')}
        />
        <Card
          title="User Profile"
          content="Profile details are displayed here."
        />
        <Card
          title="Toggle Footer"
          content="Tap to show or hide the footer."
          isInteractive
          onPress={() => setShowFooter(!showFooter)}
        />
      </ScrollView>
      <Footer buttons={footerButtons} show={showFooter} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  header: {
    width: '100%',
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
    backgroundColor: globals.colors.primary,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.secondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: globals.spacing.md,
  },
  card: {
    width: '90%',
    alignSelf: 'center',
    marginVertical: globals.spacing.sm,
    padding: globals.spacing.md,
    backgroundColor: globals.colors.secondary,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.border,
  },
  cardTitle: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.primary,
    marginBottom: globals.spacing.sm,
  },
  cardContent: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
  footer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: globals.spacing.md,
    backgroundColor: globals.colors.primary,
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: globals.spacing.sm,
  },
  footerBtnText: {
    fontSize: globals.fontSize.md,
    color: globals.colors.secondary,
    fontWeight: '600',
  },
});

export default Wireframe|Screen;