import { Router } from "express";
import multer from "multer";

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const setuprouter = ({
  login,
  signup,
  refreshtoken,
  updateuserprofile,
  authentication,
  deleteaccount,
  getcurrentuser,
  updatepushtoken,
  refreshLimiter,
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
          "POST /users/refresh",
          "GET /api/users/me",
          "PUT /api/users/me",
          "PUT /api/users/pushToken",
          "DELETE /api/users/me",
        ],
      },
    });
  });

  router.post("/users/login", upload.none(), login);
  router.post("/users/signup", upload.single("profilePhoto"), signup);
  router.post("/users/refresh", refreshLimiter, upload.none(), refreshtoken);
  router.get("/api/users/me", authentication, getcurrentuser);
  router.put(
    "/api/users/me",
    authentication,
    upload.single("profilePhoto"), // allows optional photo update
    updateuserprofile
  );
  router.put("/api/users/pushToken", authentication, upload.none(), updatepushtoken);
  router.delete("/api/users/me", authentication, deleteaccount);

  return router;
};

export default setuprouter;