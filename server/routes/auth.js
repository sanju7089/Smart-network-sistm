import express from "express";
import {
  signup,
  login,
  getCurrentUser
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", signup);

router.post("/login", login);

router.get("/me", requireAuth, getCurrentUser);

router.get("/status", (req, res) => {
  res.json({
    success: true,
    message: "Auth route is working."
  });
});

export default router;
