// src/components/trainer/MemberCard.js

import { View, Text, StyleSheet } from 'react-native';
import Card from '../common/Card';
import globals from '../../styles/globals';

/**
 * Muestra la informacion resumida de un miembro para el entrenador.
 *
 * Props:
 * - member (object): { name, machine, goal, lastHelped, wantsHelp }
 */
function MemberCard({ member }) {
  return (
    <Card>
      <Text style={styles.name}>{member.name}</Text>
      <Text style={styles.detail}>Maquina: {member.machine}</Text>
      <Text style={styles.detail}>Objetivo: {member.goal}</Text>
      <Text style={styles.detail}>Ultimo contacto: {member.lastHelped}</Text>
      <Text style={[styles.badge, member.wantsHelp && styles.badgeActive]}>
        {member.wantsHelp ? 'Quiere ayuda' : 'Sin solicitud'}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  name: {
    fontSize: globals.fontSize.lg,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  detail: {
    fontSize: globals.fontSize.md,
    color: globals.colors.textLight,
    marginBottom: globals.spacing.xs,
  },
  badge: {
    marginTop: globals.spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
    borderRadius: globals.radius.sm,
    backgroundColor: globals.colors.border,
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
    overflow: 'hidden',
  },
  badgeActive: {
    backgroundColor: globals.colors.primary,
    color: globals.colors.secondary,
  },
});

export default MemberCard;