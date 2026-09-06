import express from "express";

import {
  requireAuth
} from "../middleware/authMiddleware.js";

import {
  updateJobLocation,
  updateWorkerLocation,
  getNearbyJobs,
  getNearbyWorkers
} from "../controllers/liveLocationController.js";

const router = express.Router();

/*
 * Save customer's GPS location for a job
 */
router.patch(
  "/job/:id",
  requireAuth,
  updateJobLocation
);

/*
 * Save worker's GPS location
 */
router.patch(
  "/worker/me",
  requireAuth,
  updateWorkerLocation
);

/*
 * Find open jobs within 30 KM by default
 */
router.get(
  "/jobs/nearby",
  getNearbyJobs
);

/*
 * Find available workers within 30 KM by default
 */
router.get(
  "/workers/nearby",
  getNearbyWorkers
);

export default router;
