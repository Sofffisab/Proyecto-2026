import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Footer from '../../components/common/Footer';

function ProfileScreen({ onEditPress }) {
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
      <Header pageTitle="Tu perfil" subtitle="Your Profile" />
      
      <ScrollView style={styles.content}>
        {/* Aquí va tu contenido actual de perfil */}
        
        <View style={{ padding: globals.spacing.md }}>
          <Button label="Editar Perfil" onPress={onEditPress} variant="primary" />
        </View>
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
  },
});

export default ProfileScreen;