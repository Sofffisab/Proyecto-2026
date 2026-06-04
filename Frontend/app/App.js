import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Text, TouchableOpacity } from 'react-native';
import globals from '../src/styles/globals';

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
          <Text style={styles.footerIcon}>{btn.icon}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function App() {
  const [showFooter, setShowFooter] = useState(true);

  const footerButtons = [
    { icon: '⌂', onPress: () => Alert.alert('Home') },
    { icon: '◎', onPress: () => Alert.alert('Search') },
    { icon: '◈', onPress: () => Alert.alert('Scan') },
    { icon: '◇', onPress: () => Alert.alert('Activity') },
    { icon: '◉', onPress: () => Alert.alert('Profile') },
  ];

  const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

  return (
    <View style={styles.wrapper}>
      <Header pageTitle="Editar Perfil"/>
      <Text
          style={{
            color: globals.colors.textLight,
            textDecorationLine: 'underline',
          }}
        >
  Guardar
    </Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Card title="Section A" content={lorem} />
        <Card
          title="Section B"
          content={lorem}
          isInteractive
          onPress={() => Alert.alert('Section B')}
        />
        <Card title="Section C" content={lorem} />
        <Card
          title="Section D"
          content={lorem}
          isInteractive
          onPress={() => setShowFooter(!showFooter)}
        />
      </ScrollView>
      <Footer buttons={footerButtons} show={showFooter} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  header: {
    width: '100%',
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
    backgroundColor: globals.colors.background,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  headerTitle: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
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
    fontSize: globals.fontSize.md,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  cardContent: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textLight,
  },
  footer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: globals.spacing.md,
    backgroundColor: globals.colors.background,
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: globals.spacing.sm,
  },
  footerIcon: {
    fontSize: globals.fontSize.xl,
    color: globals.colors.text,
  },
});