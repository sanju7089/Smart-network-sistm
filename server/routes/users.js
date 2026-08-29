import express from "express";

import {
  requireAuth,
  requireRole
} from "../middleware/authMiddleware.js";

import {
  getUsers,
  getMyProfile,
  updateMyProfile,
  getUserById,
  deleteUser
} from "../controllers/userController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/me", getMyProfile);

router.patch("/me", updateMyProfile);

router.get(
  "/",
  requireRole("admin"),
  getUsers
);

router.get(
  "/:id",
  requireRole("admin"),
  getUserById
);

router.delete(
  "/:id",
  requireRole("admin"),
  deleteUser
);

export default router;
