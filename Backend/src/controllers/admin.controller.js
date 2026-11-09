// Admin screens: Miembros, Estadísticas, Historial and the review of reports.
// (Premios lives in reward.controller.js.) Controllers stay thin: the rules are
// in admin.service.js and report.service.js.

import * as adminService from "../services/admin.service.js";
import * as reportService from "../services/report.service.js";
import { logActivity, ACTIVITY } from "../services/activityLog.service.js";

const wrap = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ── Miembros ──
export const listMembers = wrap(() => adminService.listMembers());
export const createMember = wrap((req) => adminService.createMember(req.user.id, req.validatedData), 201);
export const resendInvite = wrap((req) => adminService.resendMemberInvite(req.user.id, req.params.id));
export const setMemberActive = wrap((req) => adminService.setMemberActive(req.user.id, req.params.id, req.validatedData.isActive));

// ── Estadísticas / Historial ──
export const getStats = wrap(() => adminService.getStats());
export const getHistory = wrap((req) =>
  adminService.getHistory({ role: req.query.role, limit: req.query.limit, before: req.query.before })
);

// ── Denuncias ──
export const listReports = wrap(async (req) => {
  const [items, counts] = await Promise.all([
    reportService.listReports({ state: req.query.state ?? "PENDING" }),
    reportService.getReportCounts(),
  ]);
  return { items, counts };
});
export const acceptReport = wrap((req) => reportService.acceptReport(req.params.kind, req.params.id, req.user.id));
export const rejectReport = wrap((req) => reportService.rejectReport(req.params.kind, req.params.id, req.user.id));
export const escalateReport = wrap((req) => reportService.escalateReport(req.params.kind, req.params.id, req.user.id));
export const revertReport = wrap((req) => reportService.revertReport(req.params.kind, req.params.id, req.user.id));
export const getSuspicious = wrap(() => reportService.getSuspiciousBehavior());
export const getReportsOfUser = wrap((req) => reportService.getReportsOfUser(req.params.userId));
export const listReviewRequests = wrap(() => reportService.listReviewRequests());
export const resolveReviewRequest = wrap((req) => reportService.resolveReviewRequest(req.params.id, req.user.id));

// ── Trainer reports a machine (people go through POST /complaints/trainer) ──
export const reportMachine = wrap(async (req) => {
  const created = await reportService.createMachineDenuncia({
    reporterId: req.user.id,
    machineId: req.validatedData.machineId,
    comment: req.validatedData.comment,
  });
  await logActivity({
    actorId: req.user.id,
    action: ACTIVITY.TRAINER_REPORT_SENT,
    entityType: "Denuncia",
    entityId: created.id,
    metadata: { target: "machine" },
  });
  return created;
}, 201);
