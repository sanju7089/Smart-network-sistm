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
This route must come before /:id
========================================
*/

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
