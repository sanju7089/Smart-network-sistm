import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

import {
  getWorkers,
  getWorkerById,
  getMyWorkerProfile,
  createWorkerProfile,
  updateWorkerProfile
} from "../controllers/workerController.js";

const router = express.Router();

// Public: सभी active workers
router.get("/", getWorkers);

// Protected: अपनी worker profile
router.get("/me/profile", requireAuth, getMyWorkerProfile);

// Protected: नई worker profile बनाना
router.post("/profile", requireAuth, createWorkerProfile);

// Protected: अपनी worker profile update करना
router.patch("/:id", requireAuth, updateWorkerProfile);

// Public: एक specific worker
router.get("/:id", getWorkerById);

export default router;
