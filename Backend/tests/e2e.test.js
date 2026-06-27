import request from "supertest";
import app from "../src/server.js"; // Asegúrate de que apunte correctamente a tu archivo Express app

describe("🚀 FLOW TEST E2E — Flujo Completo de Autenticación y Rutas Protegidas", () => {
  let accessToken = "";
  const testUser = {
    email: "test@gym.com",
    password: "password123",
    firstName: "Test",
    lastName: "User"
  };

  // NOTA: Este test asume que la base de datos está corriendo. 
  // Si da error porque el usuario ya existe, puedes cambiar el email aquí arriba temporalmente.

  it("1. [POST /auth/register] -> Debe registrar un nuevo usuario con éxito", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send(testUser);

    // Validamos que responda un estado exitoso (200 o 201 según tu API)
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it("2. [POST /auth/login] -> Debe iniciar sesión y retornar un accessToken", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    
    // Guardamos el token en la variable global para los siguientes pasos
    accessToken = res.body.data.accessToken;
  });

  it("3. [GET /users/me] -> Debe permitir acceso al perfil portando el Token", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(testUser.email);
  });

  it("4. [POST /auth/register] -> Debe fallar (422) si el formato del email es inválido", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "notanemail" });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it("5. [GET /users/me] -> Debe denegar el acceso (412 o 401) si no se envía un token", async () => {
    const res = await request(app).get("/api/v1/users/me");

    expect([401, 412]).toContain(res.status); 
    // Ajusta al código de estado exacto que devuelva tu middleware (ej: 401 Unauthorized)
  });

  it("6. [GET /analytics/leaderboard] -> Debe permitir ver el leaderboard con token", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/leaderboard?limit=5")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it("7. [POST /auth/logout] -> Debe cerrar sesión correctamente", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it("8. [GET /users/me] -> Debe rechazar el token tras haber hecho logout (Revocado)", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);

    // Como el token fue revocado en el paso 7, aquí debe fallar
    expect([401, 403]).toContain(res.status);
  });
});