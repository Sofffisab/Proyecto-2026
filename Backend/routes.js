import { Router } from "express";
import multer from "multer";

const upload = multer();

const setuprouter = ({
  login,
  signup,
  updateuserprofile,
  authentication,
  deleteaccount,
  getcurrentuser,
}) => {
  const router = Router();

  router.get("/", (req, res) => {
    res.json({
      message: "Backend server is running",
      status: "OK",
      endpoints: {
        auth: [
          "POST /users/login",
          "POST /users/signup",
          "GET /api/users/me",
          "PUT /api/users/me",
          "DELETE /api/users/me",
        ],
      },
    });
  });

  router.post("/users/login", upload.none(), login);
  router.post("/users/signup", upload.single("foto_perfil"), signup);
  router.get("/api/users/me", authentication, getcurrentuser);
  router.put(
    "/api/users/me",
    authentication,
    upload.single("foto_perfil"), // allows optional photo update
    updateuserprofile
  );
  router.delete("/api/users/me", authentication, deleteaccount);

  return router;
};

export default setuprouter;