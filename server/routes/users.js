import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

import {
  getUsers,
  getMyProfile,
  updateMyProfile,
  getUserById,
  deleteUser
} from "../controllers/userController.js";

const router = express.Router();

// सभी user routes के लिए login जरूरी है
router.use(requireAuth);

// अपना profile
router.get("/me", getMyProfile);

// अपना profile update
router.patch("/me", updateMyProfile);

// सभी users (Admin permission controller में check होगी)
router.get("/", getUsers);

// एक specific user
router.get("/:id", getUserById);

// User deactivate (Admin)
router.delete("/:id", deleteUser);

export default router;
