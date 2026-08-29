import express from "express";

import {
  requireAuth
} from "../middleware/authMiddleware.js";

import {
  getWorkers,
  getWorkerById,
  getMyWorkerProfile,
  createWorkerProfile,
  updateWorkerProfile
} from "../controllers/workerController.js";

const router = express.Router();

router.get("/", getWorkers);

router.get(
  "/me/profile",
  requireAuth,
  getMyWorkerProfile
);

router.post(
  "/profile",
  requireAuth,
  createWorkerProfile
);

router.patch(
  "/:id",
  requireAuth,
  updateWorkerProfile
);

router.get(
  "/:id",
  getWorkerById
);

export default router;
