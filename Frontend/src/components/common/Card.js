import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

const Card = ({ title, content, isInteractive = false, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={!isInteractive}
      activeOpacity={isInteractive ? 0.7 : 1}
    >
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.content}>
        <Text style={styles.contentText}>{content}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '90%',
    alignSelf: 'center',
    marginVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.lg,
    backgroundColor: globals.colors.secondary,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.border,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.primary,
    marginBottom: globals.spacing.sm,
  },
  content: {
    justifyContent: 'center',
  },
  contentText: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    lineHeight: globals.fontSize.md * 1.5,
  },
});

export default Card;