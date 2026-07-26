// src/screens/admin/ReviewReportsScreen.js
//
// Review Reports Screen (Admin) - spec section 18.
//
// Backend wiring:
//   GET /complaints                        -> every complaint     (complaintAdmin.api.js)
//   GET /complaints/:id                    -> single complaint detail, on row tap (complaintAdmin.api.js)
//   PATCH /complaints/:id/resolve|/reject   -> approve/reject      (complaintAdmin.api.js)
//   GET /admin/review-requests              -> unresolved PointReviewRequest
//   PATCH /admin/review-requests/:id/resolve                       (gamification.api.js)
//   GET /users                              -> join names onto complaints (user.api.js)
//
// "Comportamiento sospechoso" (suspicious behavior) is derived client-side
// from the same complaints list: anyone with >= SUSPICIOUS_THRESHOLD
// PENDING+APPROVED complaints received, or filed, is surfaced here — the
// Backend doesn't expose a dedicated endpoint for this yet.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as complaintAdminApi from '../../api/services/complaintAdmin.api';
import * as gamificationApi from '../../api/services/gamification.api';
import * as userApi from '../../api/services/user.api';

const SUSPICIOUS_THRESHOLD = 3;

/**
 * @param {function} [onBack]
 */
export default function ReviewReportsScreen({ onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [reviewRequests, setReviewRequests] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [busyId, setBusyId] = useState(null);

  // Detail modal (GET /complaints/:id), opened by tapping a row.
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [complaintsResult, requestsResult, usersResult] = await Promise.allSettled([
      complaintAdminApi.getAllComplaints(),
      gamificationApi.getReviewRequests(),
      userApi.getUsers({ limit: 200 }),
    ]);

    let anyFailed = false;

    if (complaintsResult.status === 'fulfilled') {
      setComplaints(complaintsResult.value.data ?? []);
    } else anyFailed = true;

    if (requestsResult.status === 'fulfilled') {
      setReviewRequests(requestsResult.value.data ?? []);
    } else anyFailed = true;

    if (usersResult.status === 'fulfilled') {
      const map = {};
      (usersResult.value.data ?? []).forEach((u) => { map[u.id] = u; });
      setUsersById(map);
    } else anyFailed = true;

    setError(anyFailed ? t('admin.reviewReports.loadError') : null);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const nameFor = (id) => {
    const u = usersById[id];
    if (!u) return id;
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || id;
  };

  const pendingComplaints = useMemo(() => complaints.filter((c) => c.status === 'PENDING'), [complaints]);
  const decidedComplaints = useMemo(() => complaints.filter((c) => c.status !== 'PENDING'), [complaints]);

  const suspicious = useMemo(() => {
    const receivedCount = {};
    const filedCount = {};
    complaints.forEach((c) => {
      if (c.status === 'REJECTED') return;
      receivedCount[c.reportedUserId] = (receivedCount[c.reportedUserId] ?? 0) + 1;
      filedCount[c.reporterId] = (filedCount[c.reporterId] ?? 0) + 1;
    });
    const rows = [];
    Object.entries(receivedCount).forEach(([id, count]) => {
      if (count >= SUSPICIOUS_THRESHOLD) rows.push({ id, count, type: 'received' });
    });
    Object.entries(filedCount).forEach(([id, count]) => {
      if (count >= SUSPICIOUS_THRESHOLD) rows.push({ id, count, type: 'filed' });
    });
    return rows;
  }, [complaints]);

  const handleApprove = async (id) => {
    setBusyId(id);
    try {
      await complaintAdminApi.approveComplaint(id);
      await load();
    } catch (err) {
      setError(err.message || t('admin.reviewReports.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    setBusyId(id);
    try {
      await complaintAdminApi.rejectComplaint(id);
      await load();
    } catch (err) {
      setError(err.message || t('admin.reviewReports.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (id) => {
    setDetailId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const { data } = await complaintAdminApi.getComplaintDetail(id);
      setDetail(data);
    } catch (err) {
      setDetailError(err.message || t('admin.reviewReports.detailError'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setDetailError(null);
  };

  const handleApproveFromDetail = async () => {
    if (!detailId) return;
    await handleApprove(detailId);
    closeDetail();
  };

  const handleRejectFromDetail = async () => {
    if (!detailId) return;
    await handleReject(detailId);
    closeDetail();
  };

  const handleResolveRequest = async (id) => {
    setBusyId(id);
    try {
      await gamificationApi.resolveReviewRequest(id);
      setReviewRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message || t('admin.reviewReports.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.reviewReports.approvedTitle')}</Text>
        {pendingComplaints.length === 0 && decidedComplaints.length === 0 && !loading ? (
          <Text style={styles.mutedText}>{t('admin.reviewReports.noComplaints')}</Text>
        ) : (
          <>
            {pendingComplaints.map((c) => (
              <TouchableOpacity key={c.id} style={styles.row} onPress={() => openDetail(c.id)} activeOpacity={0.7}>
                <Text style={styles.rowTitle}>
                  {nameFor(c.reporterId)} → {nameFor(c.reportedUserId)}
                </Text>
                <Text style={styles.mutedText}>{c.reason}</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => handleApprove(c.id)}
                    disabled={busyId === c.id}
                  >
                    <Text style={styles.smallButtonText}>{t('admin.reviewReports.approve')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallButton, styles.rejectButton]}
                    onPress={() => handleReject(c.id)}
                    disabled={busyId === c.id}
                  >
                    <Text style={styles.smallButtonText}>{t('admin.reviewReports.reject')}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
            {decidedComplaints.map((c) => (
              <TouchableOpacity key={c.id} style={styles.row} onPress={() => openDetail(c.id)} activeOpacity={0.7}>
                <Text style={styles.rowTitle}>
                  {nameFor(c.reporterId)} → {nameFor(c.reportedUserId)}
                </Text>
                <Text style={styles.mutedText}>{c.reason} · {c.status}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.reviewReports.requestsTitle')}</Text>
        {reviewRequests.length === 0 && !loading ? (
          <Text style={styles.mutedText}>{t('admin.reviewReports.noRequests')}</Text>
        ) : (
          reviewRequests.map((r) => (
            <View key={r.id} style={styles.row}>
              <Text style={styles.rowTitle}>
                {`${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim() || r.user?.email}
              </Text>
              <Text style={styles.mutedText}>{r.reason}</Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => handleResolveRequest(r.id)}
                disabled={busyId === r.id}
              >
                <Text style={styles.smallButtonText}>{t('admin.reviewReports.markResolved')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.reviewReports.behaviorTitle')}</Text>
        {suspicious.length === 0 && !loading ? (
          <Text style={styles.mutedText}>{t('admin.reviewReports.noSuspicious')}</Text>
        ) : (
          suspicious.map((s, idx) => (
            <Text key={`${s.id}-${s.type}-${idx}`} style={styles.row}>
              {nameFor(s.id)} — {s.type === 'received'
                ? t('admin.reviewReports.receivedCount', { count: s.count })
                : t('admin.reviewReports.filedCount', { count: s.count })}
            </Text>
          ))
        )}
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('admin.reviewReports.back')}</Text>
      </TouchableOpacity>

      <Modal
        visible={!!detailId}
        transparent
        animationType="fade"
        onRequestClose={closeDetail}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{t('admin.reviewReports.detailTitle')}</Text>

            {detailLoading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
            {detailError && <Text style={styles.errorText}>{detailError}</Text>}

            {!detailLoading && !detailError && detail && (
              <>
                <Text style={styles.detailLabel}>{t('admin.reviewReports.detailReporter')}</Text>
                <Text style={styles.detailValue}>{nameFor(detail.reporterId)}</Text>

                <Text style={styles.detailLabel}>{t('admin.reviewReports.detailReported')}</Text>
                <Text style={styles.detailValue}>{nameFor(detail.reportedUserId)}</Text>

                <Text style={styles.detailLabel}>{t('admin.reviewReports.detailReason')}</Text>
                <Text style={styles.detailValue}>{detail.reason}</Text>

                {!!detail.message && (
                  <>
                    <Text style={styles.detailLabel}>{t('admin.reviewReports.detailMessage')}</Text>
                    <Text style={styles.detailValue}>{detail.message}</Text>
                  </>
                )}

                <Text style={styles.detailLabel}>{t('admin.reviewReports.detailStatus')}</Text>
                <Text style={styles.detailValue}>{detail.status}</Text>

                {detail.status === 'PENDING' && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={handleApproveFromDetail}
                      disabled={busyId === detailId}
                    >
                      <Text style={styles.smallButtonText}>{t('admin.reviewReports.approve')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallButton, styles.rejectButton]}
                      onPress={handleRejectFromDetail}
                      disabled={busyId === detailId}
                    >
                      <Text style={styles.smallButtonText}>{t('admin.reviewReports.reject')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity onPress={closeDetail}>
              <Text style={styles.backLink}>{t('admin.reviewReports.detailClose')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { padding: globals.spacing.md },
  spinner: { marginBottom: globals.spacing.md },
  card: {
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
  },
  cardTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  row: {
    paddingVertical: globals.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  rowTitle: { fontSize: globals.fontSize.md, color: globals.colors.text },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
  },
  actionsRow: { flexDirection: 'row', gap: globals.spacing.sm, marginTop: globals.spacing.xs },
  smallButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.sm,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
    alignSelf: 'flex-start',
    marginTop: globals.spacing.xs,
    marginRight: globals.spacing.sm,
  },
  rejectButton: { backgroundColor: globals.colors.danger },
  smallButtonText: { color: globals.colors.secondary, fontSize: globals.fontSize.sm, fontWeight: '600' },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: globals.spacing.lg,
  },
  modalCard: {
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
  },
  detailLabel: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.sm,
  },
  detailValue: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
});
