import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';

import globals from '../src/styles/globals';

import Header from '../src/components/Header';
import Card from '../src/components/Card';
import Footer from '../src/components/Footer';

export default function HomeScreen() {
  const [showFooter, setShowFooter] = useState(true);

  const footerButtons = [
    { label: '⌂', onPress: () => Alert.alert('Home') },
    { label: '◎', onPress: () => Alert.alert('Search') },
    { label: '◈', onPress: () => Alert.alert('Scan') },
    { label: '◇', onPress: () => Alert.alert('Activity') },
    { label: '◉', onPress: () => Alert.alert('Profile') },
  ];

  const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

  return (
    <View style={styles.wrapper}>
      {/* Usamos tu componente Header pasándole las props que espera */}
      <Header pageTitle="Editar Perfil" subtitle="Modificá tu información personal" />
      
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Card title="Section A" content={lorem} />
        
        <Card
          title="Section B"
          content={lorem}
          isInteractive={true}
          onPress={() => Alert.alert('Section B')}
        />
        
        <Card title="Section C" content={lorem} />
        
        <Card
          title="Section D"
          content={lorem}
          isInteractive={true}
          onPress={() => setShowFooter(!showFooter)}
        />
      </ScrollView>

      {/* Usamos tu componente Footer pasándole tus botones */}
      <Footer buttons={footerButtons} show={showFooter} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: globals.spacing.md,
  },
});