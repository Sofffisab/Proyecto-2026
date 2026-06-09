import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Footer from '../../components/common/Footer';

export default function HomeScreen({ onNavigate }) {
  const [showFooter, setShowFooter] = useState(true);

  const footerButtons = [
    { label: 'Home',    onPress: () => Alert.alert('Home') },
    { label: 'Search',  onPress: () => Alert.alert('Search') },
    { label: 'Scan',    onPress: () => Alert.alert('Scan') },
    { label: 'Profile', onPress: () => router.push('/profile') },
  ];

  const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

  return (
    <View style={styles.wrapper}>
      <Header pageTitle="Home" subtitle="Welcome back" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Provisional navigation — remove once real nav is wired up */}
        <Card
          title="Go to Profile Screen"
          content="Provisional button to preview ProfileScreen."
          isInteractive
          onPress={() => router.push('/profile')}
        />
        <Card
          title="Go to Edit Profile Screen"
          content="Provisional button to preview EditProfileScreen."
          isInteractive
          onPress={() => router.push('/edit-profile')}
        />

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
          onPress={() => setShowFooter((v) => !v)}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: globals.spacing.md,
  },
});