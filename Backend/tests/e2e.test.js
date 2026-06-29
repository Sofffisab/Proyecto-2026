import request from "supertest";
import app from "../src/server.js"; 

describe("🚀 E2E FLOW TEST — Full Authentication Flow and Protected Routes", () => {
  let accessToken = "";
  const testUser = {
    email: "test@gym.com",
    password: "password123",
    firstName: "Test",
    lastName: "User"
  };

  // NOTE: This test assumes that the database is running.
  // If it fails because the user already exists, you can temporarily change the email above.

  it("1. [POST /auth/register] -> Should successfully register a new user", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send(testUser);

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it("2. [POST /auth/login] -> Should log in and return an accessToken", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    
    accessToken = res.body.data.accessToken;
  });

  it("3. [POST /auth/register] -> Should reject registration if fields are missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "invalid" });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it("4. [POST /auth/register] -> Should reject registration if email format is invalid", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: \"notanemail\" });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it("5. [GET /users/me] -> Should deny access (401 or 412) if no token is provided", async () => {
    const res = await request(app).get("/api/v1/users/me");

    expect([401, 412]).toContain(res.status); 
  });

  it("6. [GET /analytics/leaderboard] -> Should allow viewing the leaderboard with a valid token", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/leaderboard?limit=5")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it("7. [POST /auth/logout] -> Should log out successfully", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});