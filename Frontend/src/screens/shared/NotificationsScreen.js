// src/screens/shared/NotificationsScreen.js
//
// Generic notification inbox, shared across roles (User/Trainer/Admin all
// receive Notification rows — see prisma schema's Notification model).
// The Backend already creates these for a wide range of events: points
// milestones and badge unlocks (gamification.service.js), stale-goal
// nudges (suggestionEngine.service.js, spec's "update progress" reminder
// requirement), routine requests (routine.service.js), reward delivery
// (reward.service.js), complaint outcomes (complaint.service.js), machine
// usage conflicts (machineConflict.service.js), and social challenge
// invites (jobs/challenge.job.js). This screen is a plain reverse-chron
// list — it doesn't special-case any of those types.
//
// Wired to GET /notifications, PATCH /notifications/:id/read,
// PATCH /notifications/read-all, DELETE /notifications/:id
// (notification.api.js).

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import { useTranslation } from '../../i18n/I18nContext';
import * as notificationApi from '../../api/services/notification.api';

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

/**
 * @param {function} [onBack]
 */
export default function NotificationsScreen({ onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await notificationApi.getNotifications();
      setItems(res.data ?? []);
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleMarkRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await notificationApi.markAsRead(id);
    } catch {
      load();
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationApi.markAllAsRead();
    } catch {
      load();
    }
  };

  const handleDelete = async (id) => {
    const previous = items;
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationApi.deleteNotification(id);
    } catch {
      setItems(previous);
    }
  };

  return (
    <View style={styles.container}>
      <Header pageTitle={t('notifications.title')} />

      <ScrollView style={styles.content}>
        {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}

        {!loading && error && <Text style={styles.errorText}>{t('notifications.loadError')}</Text>}

        {!loading && !error && items.length > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}

        {!loading && !error && items.length === 0 && (
          <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
        )}

        {!loading &&
          !error &&
          items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => !item.read && handleMarkRead(item.id)}
            >
              <Text style={styles.rowTitle}>{item.title}</Text>
              {!!item.body && <Text style={styles.rowBody}>{item.body}</Text>}
              <Text style={styles.rowDate}>{formatDateTime(item.createdAt)}</Text>
              <Text style={styles.deleteLink} onPress={() => handleDelete(item.id)}>
                {t('notifications.delete')}
              </Text>
            </TouchableOpacity>
          ))}

        <Text style={styles.backLink} onPress={onBack}>{t('notifications.back')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    flex: 1,
    padding: globals.spacing.md,
  },
  spinner: {
    marginTop: globals.spacing.xl,
  },
  markAllButton: {
    alignSelf: 'flex-end',
    marginBottom: globals.spacing.sm,
  },
  markAllText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
  },
  row: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  rowUnread: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.sectionCard,
  },
  rowTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
  },
  rowBody: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
    marginTop: globals.spacing.xs,
  },
  rowDate: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
  },
  deleteLink: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.danger,
    marginTop: globals.spacing.xs,
  },
  emptyText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    textAlign: 'center',
    marginTop: globals.spacing.xl,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
