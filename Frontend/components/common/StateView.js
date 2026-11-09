import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Standard loading / error / empty states for screens that load from the API.
 *
 *   <StateView loading={loading} error={error} onRetry={reload} empty={!list.length} emptyText="...">
 *     ...content...
 *   </StateView>
 */
export default function StateView({ loading, error, onRetry, empty, emptyText, children }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={globals.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        {onRetry && (
          <TouchableOpacity onPress={() => onRetry()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryLabel}>{t('common.retry')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{emptyText}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: globals.spacing.xl },
  error: { color: globals.colors.danger, textAlign: 'center', fontSize: globals.fontSize.md },
  empty: { color: globals.colors.textSecondary, textAlign: 'center', fontSize: globals.fontSize.md },
  retry: {
    marginTop: globals.spacing.md,
    paddingVertical: 8,
    paddingHorizontal: globals.spacing.lg,
    borderRadius: globals.radius.full,
    borderWidth: 1.5,
    borderColor: globals.colors.primary,
  },
  retryLabel: { color: globals.colors.primary, fontWeight: '700' },
});
