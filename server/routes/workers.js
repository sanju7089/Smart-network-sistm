import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Workers API is working.",
    data: []
  });
});

router.use(requireAuth);

router.get("/me/profile", (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

router.get("/:id", (req, res) => {
  res.json({
    success: true,
    message: `Worker ${req.params.id} endpoint is working.`
  });
});

export default router;
