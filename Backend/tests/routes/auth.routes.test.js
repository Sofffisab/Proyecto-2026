import request from "supertest";
import app from "../../src/server.js";

// Requires a real test DB or a Prisma mock at the server level.
// Easiest approach: use a separate DATABASE_URL pointing to a test schema.

describe("POST /api/v1/auth/register", () => {
  it("returns 422 for missing fields", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "bad" });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it("returns 422 for weak password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "test@test.com", password: "123", firstName: "A", lastName: "B" });
    expect(res.status).toBe(422);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("returns 422 for empty body", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({});
    expect(res.status).toBe(422);
  });

  it("returns 401 or 500 for unknown email (not 422)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });
    // 401 if DB reachable, 500 if not — either way NOT 422 (validation passed)
    expect([401, 500]).toContain(res.status);
  });
});
