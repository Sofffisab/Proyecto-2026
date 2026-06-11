import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Footer from '../../components/common/Footer';

// Recibimos las props de navegación enviadas desde app/index.js
export default function HomeScreen({ onGoToProfile, onGoToEditProfile, onNavigate }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={globals.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header pageTitle="Home" subtitle="Welcome back" />

      <ScrollView style={styles.content}>
        <View style={styles.buttonGroup}>
          {/* Usamos 'label' y conectamos el 'onPress' */}
          <Button label="Go to Profile Screen" onPress={onGoToProfile} />
          <Button label="Go to Edit Profile Screen" onPress={onGoToEditProfile} />
        </View>

        <Card title="Section A" content="Provisional section" />
        <Card title="Section B" content="Provisional section" />
      </ScrollView>

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: globals.colors.background,
  },
  content: {
    flex: 1,
    padding: globals.spacing.md,
  },
  buttonGroup: {
    marginBottom: globals.spacing.lg,
  }
});