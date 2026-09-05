import express from "express";

import {
  requireAuth,
  requireRole
} from "../middleware/authMiddleware.js";

import {
  getWorkers,
  getWorkerById,
  getMyWorkerProfile,
  createWorkerProfile,
  updateWorkerProfile,
  updateMyAvailability
} from "../controllers/workerController.js";

const router = express.Router();

/*
========================================
PUBLIC ROUTES
========================================
*/

router.get(
  "/",
  getWorkers
);

/*
========================================
PROTECTED PERSONAL PROFILE
IMPORTANT:
These routes must come before /:id
========================================
*/

router.get(
  "/me/profile",
  requireAuth,
  requireRole("worker"),
  getMyWorkerProfile
);

router.post(
  "/profile",
  requireAuth,
  requireRole("worker"),
  createWorkerProfile
);

router.patch(
  "/me/availability",
  requireAuth,
  requireRole("worker"),
  updateMyAvailability
);

/*
========================================
UPDATE WORKER
========================================
*/

router.patch(
  "/:id",
  requireAuth,
  updateWorkerProfile
);

/*
========================================
PUBLIC SINGLE WORKER
========================================
*/

router.get(
  "/:id",
  getWorkerById
);

export default router;
