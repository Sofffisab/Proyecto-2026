import { describe, it, expect, beforeEach, vi } from "vitest";
import * as complaintController from "../../../src/controllers/complaint.controller.js";
import * as complaintService from "../../../src/services/complaint.service.js";

vi.mock("../../../src/services/complaint.service.js");

describe("ComplaintController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: "user-1", role: "USER" },
      params: {},
      validatedData: {},
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("createComplaint creates a complaint reported by the caller and returns 201", async () => {
    req.validatedData = {
      reportedUserId: "user-2",
      reason: "HARASSMENT",
      message: "Rude behavior",
    };
    const created = { id: "complaint-1", ...req.validatedData, reporterId: "user-1" };
    complaintService.createComplaint.mockResolvedValue(created);

    await complaintController.createComplaint(req, res, next);

    expect(complaintService.createComplaint).toHaveBeenCalledWith({
      reporterId: "user-1",
      reportedUserId: "user-2",
      reason: "HARASSMENT",
      message: "Rude behavior",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: created });
  });

  it("createTrainerComplaint lets a trainer report a member and returns 201", async () => {
    req.user = { id: "trainer-1", role: "TRAINER" };
    req.validatedData = {
      reportedUserId: "user-2",
      reason: "DAÑO_DE_MAQUINA",
      message: "Rompió la cinta",
    };
    const created = { id: "complaint-9", ...req.validatedData, reporterId: "trainer-1", source: "TRAINER_REPORT" };
    complaintService.createTrainerComplaint.mockResolvedValue(created);

    await complaintController.createTrainerComplaint(req, res, next);

    expect(complaintService.createTrainerComplaint).toHaveBeenCalledWith({
      reporterId: "trainer-1",
      reportedUserId: "user-2",
      reason: "DAÑO_DE_MAQUINA",
      message: "Rompió la cinta",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: created });
  });

  it("getMyComplaints returns only the caller's complaints", async () => {
    const complaints = [{ id: "complaint-1", reporterId: "user-1" }];
    complaintService.getUserComplaints.mockResolvedValue(complaints);

    await complaintController.getMyComplaints(req, res, next);

    expect(complaintService.getUserComplaints).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: complaints });
  });

  it("getAdminComplaints returns all complaints", async () => {
    const complaints = [{ id: "complaint-1" }, { id: "complaint-2" }];
    complaintService.getComplaints.mockResolvedValue(complaints);

    await complaintController.getAdminComplaints(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: complaints });
  });

  describe("getById", () => {
    it("returns 404 via next() when the complaint does not exist", async () => {
      req.params.id = "missing";
      complaintService.getComplaintById.mockResolvedValue(null);

      await complaintController.getById(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(404);
    });

    it("returns 403 via next() when a non-owner, non-admin requests someone else's complaint", async () => {
      req.params.id = "complaint-1";
      complaintService.getComplaintById.mockResolvedValue({
        id: "complaint-1",
        reporterId: "someone-else",
      });

      await complaintController.getById(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
    });

    it("returns the complaint when the caller is the reporter", async () => {
      req.params.id = "complaint-1";
      const complaint = { id: "complaint-1", reporterId: "user-1" };
      complaintService.getComplaintById.mockResolvedValue(complaint);

      await complaintController.getById(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: complaint });
    });

    it("returns the complaint when the caller is an ADMIN, regardless of ownership", async () => {
      req.user = { id: "admin-1", role: "ADMIN" };
      req.params.id = "complaint-1";
      const complaint = { id: "complaint-1", reporterId: "someone-else" };
      complaintService.getComplaintById.mockResolvedValue(complaint);

      await complaintController.getById(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: complaint });
    });
  });

  it("resolveComplaint approves the complaint as the acting admin", async () => {
    req.user = { id: "admin-1", role: "ADMIN" };
    req.params.id = "complaint-1";
    const resolved = { id: "complaint-1", status: "APPROVED" };
    complaintService.approveComplaint.mockResolvedValue(resolved);

    await complaintController.resolveComplaint(req, res, next);

    expect(complaintService.approveComplaint).toHaveBeenCalledWith("complaint-1", "admin-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: resolved });
  });

  it("rejectComplaint rejects the complaint as the acting admin", async () => {
    req.user = { id: "admin-1", role: "ADMIN" };
    req.params.id = "complaint-1";
    const rejected = { id: "complaint-1", status: "REJECTED" };
    complaintService.rejectComplaint.mockResolvedValue(rejected);

    await complaintController.rejectComplaint(req, res, next);

    expect(complaintService.rejectComplaint).toHaveBeenCalledWith("complaint-1", "admin-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: rejected });
  });

  it("forwards unexpected service errors to next()", async () => {
    const error = new Error("db down");
    complaintService.getComplaints.mockRejectedValue(error);

    await complaintController.getAdminComplaints(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
