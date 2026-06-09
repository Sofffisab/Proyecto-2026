import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import globals from '../../styles/globals';

/**
 * Profile screen for the member.
 * Displays avatar, name, email, fitness level,
 * stats (shared workouts, streak, achievements, points),
 * and section tabs (Schedule, Data, Achievements).
 */
function ProfileScreen({ onEditPress }) {
  const stats = [
    { value: '28', label: 'Shared\nWorkouts' },
    { value: '28', label: 'Current\nStreak' },
    { value: '28', label: 'Achievements\nEarned' },
    { value: '28', label: 'Total\nPoints' },
  ];

  const sections = [
    { label: 'Current Schedule' },
    { label: 'Data' },
    { label: 'Achievements' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Your Profile</Text>
        <TouchableOpacity onPress={onEditPress} style={styles.editButton}>
          <Image
            source={require('../../../assets/images/edit-icon.png')}
            style={styles.editIcon}
          />
        </TouchableOpacity>
      </View>

      {/* Avatar + info */}
      <View style={styles.profileRow}>
        <View style={styles.avatarCircle} />

        <View style={styles.infoColumn}>
          <Text style={styles.name}>Name</Text>
          <Text style={styles.email}>email@example.com</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Level</Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Section tabs */}
      <View style={styles.sectionsColumn}>
        {sections.map((section, index) => (
          <TouchableOpacity key={index} style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    paddingBottom: globals.spacing.xl,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: globals.spacing.md,
    paddingTop: globals.spacing.lg,
    paddingBottom: globals.spacing.md,
  },
  headerTitle: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.text,
    flex: 1,
  },
  editButton: {
    padding: globals.spacing.xs,
  },
  editIcon: {
    width: 24,
    height: 24,
    tintColor: globals.colors.text,
  },

  // Avatar + info
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: globals.spacing.xl,
    paddingHorizontal: globals.spacing.lg,
    paddingBottom: globals.spacing.lg,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: globals.colors.avatarPlaceholder,
  },
  infoColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  name: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  email: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginBottom: globals.spacing.sm,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: globals.colors.badge,
    borderRadius: globals.radius.full,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.xs,
  },
  levelText: {
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
    color: globals.colors.text,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.text,
  },
  statLabel: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    textAlign: 'center',
    marginTop: globals.spacing.xs,
  },

  // Section tabs
  sectionsColumn: {
    marginTop: globals.spacing.lg,
    paddingHorizontal: globals.spacing.md,
    gap: globals.spacing.sm,
  },
  sectionCard: {
    width: '100%',
    height: 80,
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    justifyContent: 'center',
    paddingHorizontal: globals.spacing.md,
  },
  sectionLabel: {
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
    color: globals.colors.text,
  },
});

export default ProfileScreen;